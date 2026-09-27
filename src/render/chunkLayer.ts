/**
 * Terrain et ressources de surface : un chunk = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les 1024 tuiles d'un chunk sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont 1024 quads par chunk et par frame — et autant de
 * sprites d'arbres en plus.
 *
 * Les arbres, les rochers et le décor sont bakés avec le terrain : ils ne bougent pas, et
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

import { Container, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js';
import { CHUNK_SIZE, CHUNK_TILES, TILE_SIZE, coordKey } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import { RESOURCES } from '../data/resources.ts';
import { decorAt, terrainAt, type TerrainKind } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';
import { SPRITE_SCALE, type SpriteLibrary } from './spriteLibrary.ts';
import { SIDES, SIDE_OFFSET, variantOf, type TerrainTiles } from './terrainTiles.ts';

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
  private readonly tiles: TerrainTiles;

  public constructor(renderer: Renderer, library: SpriteLibrary, tiles: TerrainTiles) {
    this.renderer = renderer;
    this.library = library;
    this.tiles = tiles;
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
   * Dessine le chunk dans sa RenderTexture, puis jette la scène.
   *
   * Trois passes, dans l'ordre du peintre : le sol (une variante du tileset
   * par tuile), les transitions vers les voisines d'un autre terrain, puis
   * les ombres et les ressources de surface. Les sprites sont temporaires :
   * tout est détruit juste après — seule la texture survit, et c'est elle
   * qu'on affiche. Les textures du tileset, elles, sont partagées et restent.
   */
  private renderInto(world: World, cx: number, cy: number, target: RenderTexture): void {
    const scene = new Container();
    const edges = new Container();
    const props = new Container();
    const baseTx = cx * CHUNK_TILES;
    const baseTy = cy * CHUNK_TILES;
    const { seed } = world;

    // Une rangée de marge autour du chunk : les transitions du bord en dépendent.
    const span = CHUNK_TILES + 2;
    const kinds: TerrainKind[] = new Array<TerrainKind>(span * span);

    for (let ly = -1; ly <= CHUNK_TILES; ly += 1) {
      for (let lx = -1; lx <= CHUNK_TILES; lx += 1) {
        kinds[(ly + 1) * span + lx + 1] = terrainAt(seed, baseTx + lx, baseTy + ly);
      }
    }

    const kindAt = (lx: number, ly: number): TerrainKind => kinds[(ly + 1) * span + lx + 1]!;

    for (let ly = 0; ly < CHUNK_TILES; ly += 1) {
      for (let lx = 0; lx < CHUNK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        const kind = kindAt(lx, ly);
        const variants = this.tiles.ground[kind];
        const ground = tileSprite(variants[variantOf(hash3(seed ^ 0x6a09e667, tx, ty)) % variants.length]!, lx, ly);

        scene.addChild(ground);

        for (const side of SIDES) {
          const [dx, dy] = SIDE_OFFSET[side];
          const neighbour = kindAt(lx + dx, ly + dy);

          if (neighbour === kind) continue;

          const edge = this.tiles.edge(kind, neighbour, side);

          if (edge) edges.addChild(tileSprite(edge, lx, ly));
        }

        const decor = decorAt(seed, tx, ty);

        if (decor) props.addChild(tileSprite(this.library.still('decor', decor), lx, ly));

        const resource = world.resources.at(tx, ty);

        if (!resource) continue;

        const stage = resource.stage === 'damaged' ? 'damaged' : 'full';
        // L'essence d'un arbre est tirée par tuile : elle reste la même une fois entamé.
        const sprites = RESOURCES[resource.id].sprites;
        const sprite = sprites[hash3(seed ^ 0x510e527f, tx, ty) % sprites.length]!;

        props.addChild(
          tileSprite(this.tiles.shadow, lx, ly),
          tileSprite(this.library.still(sprite, stage), lx, ly),
        );
      }
    }

    scene.addChild(edges, props);
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

/** Un sprite de tuile à la résolution source, agrandi ×2, posé sur la grille locale. */
function tileSprite(texture: Texture, lx: number, ly: number): Sprite {
  const sprite = new Sprite(texture);

  sprite.position.set(lx * TILE_SIZE, ly * TILE_SIZE);
  sprite.scale.set(SPRITE_SCALE);
  return sprite;
}
