/**
 * Le sol : un bloc de tuiles = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les tuiles d'un bloc sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont des milliers de quads par frame.
 *
 * Le sol et le décor sont régénérés depuis la seed et ne changent jamais :
 * un bloc baké n'est jamais rebaké. Les arbres et les rochers, qui changent
 * et qui montent au-dessus de leur tuile, sont des sprites à part
 * (`resourceLayer.ts`).
 *
 * Trois règles tenues ici :
 * - bake unique ;
 * - culling : seuls les blocs intersectant la caméra sont dans le graphe ;
 * - éviction : au-delà de la marge, la RenderTexture est détruite. C'est ce
 *   qui empêche une exploration de 20 minutes de saturer la VRAM du téléphone.
 *
 * Le dessin est vectoriel : le bloc est baké à la résolution de l'écran,
 * plafonnée à 2 — au-delà, un bloc pèserait plus de 9 Mo pour un gain que
 * l'œil ne voit pas sur des aplats. C'est aussi pour la mémoire que le bloc
 * fait 16 × 16 tuiles et non un chunk entier : 4 Mo par bloc au lieu de 16.
 */

import { Container, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js';
import { TILE_SIZE, coordKey } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import { decorAt, terrainAt, type TerrainKind } from '../sim/terrain.ts';
import type { Camera } from './camera.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import { CORNERS, CORNER_SIDES, SIDES, SIDE_OFFSET, type TerrainTiles } from './terrainTiles.ts';

/** Côté d'un bloc, en tuiles, et en pixels monde. */
const BLOCK_TILES = 16;
const BLOCK_SIZE = BLOCK_TILES * TILE_SIZE;

/** Marge de bake et d'éviction, en blocs au-delà de la zone visible. */
const BAKE_MARGIN = 0;
const KEEP_MARGIN = 1;

/** Résolution maximale d'un bloc baké. */
const MAX_BLOCK_RESOLUTION = 2;

interface BakedBlock {
  sprite: Sprite;
  texture: RenderTexture;
}

export class ChunkLayer {
  public readonly container = new Container();

  private readonly baked = new Map<string, BakedBlock>();

  private readonly renderer: Renderer;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly seed: number;
  private readonly resolution: number;

  public constructor(renderer: Renderer, library: SpriteLibrary, tiles: TerrainTiles, seed: number) {
    this.renderer = renderer;
    this.library = library;
    this.tiles = tiles;
    this.seed = seed;
    this.resolution = Math.min(MAX_BLOCK_RESOLUTION, library.stats.resolution);
  }

  /** Nombre de blocs actuellement bakés — remonté au HUD de debug. */
  public get drawn(): number {
    return this.baked.size;
  }

  public update(camera: Camera): void {
    const bounds = camera.visibleCells(BLOCK_SIZE, BAKE_MARGIN);

    for (let by = bounds.minCy; by <= bounds.maxCy; by += 1) {
      for (let bx = bounds.minCx; bx <= bounds.maxCx; bx += 1) {
        const key = coordKey(bx, by);

        if (!this.baked.has(key)) this.baked.set(key, this.bake(bx, by));
      }
    }

    this.evict(camera.visibleCells(BLOCK_SIZE, KEEP_MARGIN));
  }

  private bake(bx: number, by: number): BakedBlock {
    const texture = RenderTexture.create({
      width: BLOCK_SIZE,
      height: BLOCK_SIZE,
      resolution: this.resolution,
      scaleMode: 'linear',
    });

    this.renderInto(bx, by, texture);

    const sprite = new Sprite(texture);

    sprite.position.set(bx * BLOCK_SIZE, by * BLOCK_SIZE);
    this.container.addChild(sprite);

    return { sprite, texture };
  }

  /**
   * Dessine le bloc dans sa RenderTexture, puis jette la scène.
   *
   * Quatre passes, dans l'ordre du peintre : le sol, les transitions (faces
   * avant, liserés), les coins arrondis, puis le décor. Les sprites sont
   * temporaires : seule la texture survit. Celles du tileset, partagées, restent.
   */
  private renderInto(bx: number, by: number, target: RenderTexture): void {
    const scene = new Container();
    const edges = new Container();
    const corners = new Container();
    const props = new Container();
    const baseTx = bx * BLOCK_TILES;
    const baseTy = by * BLOCK_TILES;
    const { seed } = this;

    // Une rangée de marge autour du bloc : les transitions du bord en dépendent.
    const span = BLOCK_TILES + 2;
    const kinds: TerrainKind[] = new Array<TerrainKind>(span * span);

    for (let ly = -1; ly <= BLOCK_TILES; ly += 1) {
      for (let lx = -1; lx <= BLOCK_TILES; lx += 1) {
        kinds[(ly + 1) * span + lx + 1] = terrainAt(seed, baseTx + lx, baseTy + ly);
      }
    }

    const kindAt = (lx: number, ly: number): TerrainKind => kinds[(ly + 1) * span + lx + 1]!;

    for (let ly = 0; ly < BLOCK_TILES; ly += 1) {
      for (let lx = 0; lx < BLOCK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        const kind = kindAt(lx, ly);

        scene.addChild(tileSprite(this.tiles.ground(kind, tx, ty, hash3(seed ^ 0x6a09e667, tx, ty)), lx, ly));

        for (const side of SIDES) {
          const [dx, dy] = SIDE_OFFSET[side];

          if (kindAt(lx + dx, ly + dy) === kind) continue;

          const edge = this.tiles.edge(kind, side);

          if (edge) edges.addChild(tileSprite(edge, lx, ly));
        }

        // Un coin est saillant quand ses deux voisins orthogonaux sont d'un
        // même autre sol : on l'arrondit, peint dans la couleur de ce sol.
        for (const corner of CORNERS) {
          const [vertical, horizontal] = CORNER_SIDES[corner];
          const [vx, vy] = SIDE_OFFSET[vertical];
          const [hx, hy] = SIDE_OFFSET[horizontal];
          const above = kindAt(lx + vx, ly + vy);
          const beside = kindAt(lx + hx, ly + hy);

          if (above === kind || beside !== above) continue;
          corners.addChild(tileSprite(this.tiles.corner(beside, tx + hx, ty + hy, corner), lx, ly));
        }

        const decor = decorAt(seed, tx, ty);

        if (decor) props.addChild(tileSprite(this.library.part('decor', decor), lx, ly));
      }
    }

    scene.addChild(edges, corners, props);
    this.renderer.render({ target, container: scene, clear: true });
    scene.destroy({ children: true });
  }

  private evict(bounds: { minCx: number; minCy: number; maxCx: number; maxCy: number }): void {
    for (const [key, entry] of this.baked) {
      const parts = key.split(',');
      const bx = Number(parts[0]);
      const by = Number(parts[1]);

      const outside = bx < bounds.minCx || bx > bounds.maxCx || by < bounds.minCy || by > bounds.maxCy;

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

/** Un sprite de tuile posé sur la grille locale ; la texture a déjà la taille d'une tuile. */
function tileSprite(texture: Texture, lx: number, ly: number): Sprite {
  const sprite = new Sprite(texture);

  sprite.position.set(lx * TILE_SIZE, ly * TILE_SIZE);
  return sprite;
}
