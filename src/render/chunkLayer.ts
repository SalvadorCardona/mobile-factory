/**
 * Terrain et ressources de surface : un chunk = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les 1024 tuiles d'un chunk sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont 1024 quads par chunk et par frame — et autant de
 * sprites d'arbres en plus.
 *
 * Les arbres et rochers sont bakés avec le terrain : ils ne bougent pas, et
 * ils sont des centaines par écran. Quand Adam en abîme un, la simulation
 * marque le chunk sale et il est rebaké — deux fois par tuile au plus, à
 * l'entame et à la disparition.
 *
 * Trois règles tenues ici :
 * - bake unique, rebake seulement si `chunk.dirty` ;
 * - culling : seuls les chunks intersectant la caméra sont dans le graphe ;
 * - éviction : au-delà de la marge, la RenderTexture est détruite. C'est ce
 *   qui empêche une exploration de 20 minutes de saturer la VRAM du téléphone.
 */

import { Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { CHUNK_SIZE, CHUNK_TILES, TILE_SIZE, coordKey } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import { RESOURCES } from '../data/resources.ts';
import { terrainAt, type TerrainKind } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import { TERRAIN_COLORS } from './atlas.ts';
import type { Camera } from './camera.ts';
import { SPRITE_SCALE, type SpriteLibrary } from './spriteLibrary.ts';

/** Marge d'éviction, en chunks au-delà de la zone visible. */
const KEEP_MARGIN = 2;

interface BakedChunk {
  sprite: Sprite;
  texture: RenderTexture;
}

export class ChunkLayer {
  public readonly container = new Container();

  private readonly baked = new Map<string, BakedChunk>();

  private readonly renderer: Renderer;
  private readonly library: SpriteLibrary;

  public constructor(renderer: Renderer, library: SpriteLibrary) {
    this.renderer = renderer;
    this.library = library;
  }

  /** Nombre de chunks actuellement dessinés — remonté au HUD de debug. */
  public get drawn(): number {
    return this.baked.size;
  }

  public update(world: World, camera: Camera): void {
    const bounds = camera.visibleChunks();

    for (let cy = bounds.minCy; cy <= bounds.maxCy; cy += 1) {
      for (let cx = bounds.minCx; cx <= bounds.maxCx; cx += 1) {
        const key = coordKey(cx, cy);
        const chunk = world.chunks.peek(cx, cy);
        const existing = this.baked.get(key);

        if (existing && chunk?.dirty) {
          this.renderInto(world, cx, cy, existing.texture);
          chunk.dirty = false;
        } else if (!existing) {
          this.baked.set(key, this.bake(world, cx, cy));
          const fresh = world.chunks.peek(cx, cy);

          if (fresh) fresh.dirty = false;
        }
      }
    }

    this.evict(bounds);
  }

  private bake(world: World, cx: number, cy: number): BakedChunk {
    const texture = RenderTexture.create({
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
      resolution: 1,
      scaleMode: 'nearest',
    });

    this.renderInto(world, cx, cy, texture);

    const sprite = new Sprite(texture);

    sprite.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
    this.container.addChild(sprite);

    return { sprite, texture };
  }

  /**
   * Dessine le chunk dans sa RenderTexture, puis jette la géométrie.
   *
   * Les rectangles de terrain sont regroupés par couleur et remplis en un
   * seul `fill()` par couleur : huit instructions de dessin au lieu de 1024.
   * Les ressources sont des sprites temporaires par-dessus. Tout est détruit
   * juste après — seule la texture survit, et c'est elle qu'on affiche.
   */
  private renderInto(world: World, cx: number, cy: number, target: RenderTexture): void {
    const scene = new Container();
    const graphics = new Graphics();
    const byColor = new Map<number, number[]>();
    const baseTx = cx * CHUNK_TILES;
    const baseTy = cy * CHUNK_TILES;

    scene.addChild(graphics);

    for (let ly = 0; ly < CHUNK_TILES; ly += 1) {
      for (let lx = 0; lx < CHUNK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        const color = shadeOf(world.seed, tx, ty, terrainAt(world.seed, tx, ty));
        let coords = byColor.get(color);

        if (!coords) {
          coords = [];
          byColor.set(color, coords);
        }
        coords.push(lx * TILE_SIZE, ly * TILE_SIZE);

        const resource = world.resources.at(tx, ty);

        if (!resource) continue;

        const stage = resource.stage === 'damaged' ? 'damaged' : 'full';
        const sprite = new Sprite(this.library.still(RESOURCES[resource.id].sprite, stage));

        sprite.position.set(lx * TILE_SIZE, ly * TILE_SIZE);
        sprite.scale.set(SPRITE_SCALE);
        scene.addChild(sprite);
      }
    }

    for (const [color, coords] of byColor) {
      for (let i = 0; i < coords.length; i += 2) {
        graphics.rect(coords[i]!, coords[i + 1]!, TILE_SIZE, TILE_SIZE);
      }
      graphics.fill(color);
    }

    this.renderer.render({ target, container: scene, clear: true });
    scene.destroy({ children: true });
  }

  private evict(bounds: { minCx: number; minCy: number; maxCx: number; maxCy: number }): void {
    for (const [key, entry] of this.baked) {
      const parts = key.split(',');
      const cx = Number(parts[0]);
      const cy = Number(parts[1]);

      const outside =
        cx < bounds.minCx - KEEP_MARGIN ||
        cx > bounds.maxCx + KEEP_MARGIN ||
        cy < bounds.minCy - KEEP_MARGIN ||
        cy > bounds.maxCy + KEEP_MARGIN;

      if (!outside) continue;

      entry.sprite.destroy();
      entry.texture.destroy(true);
      this.baked.delete(key);
    }
  }

  public destroy(): void {
    for (const entry of this.baked.values()) {
      entry.sprite.destroy();
      entry.texture.destroy(true);
    }
    this.baked.clear();
    this.container.destroy();
  }
}

/** Une des deux teintes du terrain, tirée de la seed : le grain du pixel art. */
function shadeOf(seed: number, tx: number, ty: number, kind: TerrainKind): number {
  const pair = TERRAIN_COLORS[kind];

  return hash3(seed ^ 0x6a09e667, tx, ty) % 3 === 0 ? pair[1] : pair[0];
}
