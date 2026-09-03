/**
 * Terrain : un chunk = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les 1024 tuiles d'un chunk sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont 1024 quads par chunk et par frame.
 *
 * Trois règles tenues ici :
 * - bake unique, rebake seulement si `chunk.dirty` ;
 * - culling : seuls les chunks intersectant la caméra sont dans le graphe ;
 * - éviction : au-delà de la marge, la RenderTexture est détruite. C'est ce
 *   qui empêche une exploration de 20 minutes de saturer la VRAM du téléphone.
 */

import { Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { CHUNK_SIZE, CHUNK_TILES, TILE_SIZE, coordKey } from '../core/grid.ts';
import { oreAt, terrainAt, type TerrainKind } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';
import { ORE_COLOR, TERRAIN_COLORS } from './atlas.ts';

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

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
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
    const texture = RenderTexture.create({ width: CHUNK_SIZE, height: CHUNK_SIZE });

    this.renderInto(world, cx, cy, texture);

    const sprite = new Sprite(texture);

    sprite.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
    this.container.addChild(sprite);

    return { sprite, texture };
  }

  /**
   * Dessine le chunk dans sa RenderTexture, puis jette la géométrie vectorielle.
   *
   * Les rectangles sont regroupés par type de terrain et remplis en un seul
   * `fill()` par type : quatre instructions de dessin au lieu de 1024. Le
   * `Graphics` est détruit juste après — seule la texture survit, et c'est elle
   * qu'on affiche.
   */
  private renderInto(world: World, cx: number, cy: number, target: RenderTexture): void {
    const graphics = new Graphics();
    const byKind = new Map<TerrainKind, number[]>();
    const ore: number[] = [];
    const baseTx = cx * CHUNK_TILES;
    const baseTy = cy * CHUNK_TILES;

    for (let ly = 0; ly < CHUNK_TILES; ly += 1) {
      for (let lx = 0; lx < CHUNK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        const kind = terrainAt(world.seed, tx, ty);
        let coords = byKind.get(kind);

        if (!coords) {
          coords = [];
          byKind.set(kind, coords);
        }
        coords.push(lx * TILE_SIZE, ly * TILE_SIZE);

        if (oreAt(world.seed, tx, ty)) ore.push(lx * TILE_SIZE, ly * TILE_SIZE);
      }
    }

    for (const [kind, coords] of byKind) {
      for (let i = 0; i < coords.length; i += 2) {
        graphics.rect(coords[i]!, coords[i + 1]!, TILE_SIZE, TILE_SIZE);
      }
      graphics.fill(TERRAIN_COLORS[kind]);
    }

    for (let i = 0; i < ore.length; i += 2) {
      graphics.circle(ore[i]! + TILE_SIZE / 2, ore[i + 1]! + TILE_SIZE / 2, TILE_SIZE / 3);
    }
    if (ore.length > 0) graphics.fill({ color: ORE_COLOR, alpha: 0.85 });

    this.renderer.render({ target, container: graphics, clear: true });
    graphics.destroy();
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
