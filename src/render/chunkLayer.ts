/**
 * Le sol : un bloc de tuiles = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les tuiles d'un bloc sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont des milliers de quads par frame.
 *
 * Le sol et le décor sont régénérés depuis la seed et ne changent jamais.
 * Seules les routes pavées s'y ajoutent, au-dessus du sol : un pavage ou un
 * coup de marteau rebake le bloc touché (`invalidate`) — et son voisin si
 * la dalle est au bord, puisque la voisine change de raccord. Les arbres et les rochers, qui changent
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
import type { RoadNetwork } from '../sim/roads.ts';
import { decorAt } from '../sim/terrain.ts';
import type { Camera } from './camera.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import { BlockTerrain, CORNERS, CORNER_SIDES, SIDES, SIDE_OFFSET, groundRoll, type TerrainTiles } from './terrainTiles.ts';

/** Côté d'un bloc, en tuiles, et en pixels monde. */
export const BLOCK_TILES = 16;
export const BLOCK_SIZE = BLOCK_TILES * TILE_SIZE;

/** Marge de bake et d'éviction, en blocs au-delà de la zone visible. */
export const BAKE_MARGIN = 0;
export const KEEP_MARGIN = 1;

/** Résolution maximale d'un bloc baké. */
const MAX_BLOCK_RESOLUTION = 2;

interface BakedBlock {
  bx: number;
  by: number;
  sprite: Sprite;
  texture: RenderTexture;
}

export class ChunkLayer {
  public readonly container = new Container();

  private readonly baked = new Map<string, BakedBlock>();
  /** Blocs bakés dont une route a changé : rebakés au prochain `update`. */
  private readonly stale = new Set<string>();

  private readonly renderer: Renderer;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly seed: number;
  private readonly roads: RoadNetwork;
  private readonly resolution: number;

  public constructor(renderer: Renderer, library: SpriteLibrary, tiles: TerrainTiles, seed: number, roads: RoadNetwork) {
    this.renderer = renderer;
    this.library = library;
    this.tiles = tiles;
    this.seed = seed;
    this.roads = roads;
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

    for (const key of this.stale) {
      const entry = this.baked.get(key);

      if (entry) this.renderInto(entry.bx, entry.by, entry.texture);
    }
    this.stale.clear();

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

    return { bx, by, sprite, texture };
  }

  /**
   * Dessine le bloc dans sa RenderTexture, puis jette la scène.
   *
   * Cinq passes, dans l'ordre du peintre : le sol (l'eau selon sa
   * profondeur), les transitions (faces avant, liserés), les coins arrondis
   * — entre sols et entre profondeurs d'eau —, les routes, puis le décor,
   * qu'une dalle recouvre : pas de fleur sur un pavé. Les sprites sont
   * temporaires : seule la texture survit. Celles du tileset, partagées, restent.
   */
  private renderInto(bx: number, by: number, target: RenderTexture): void {
    const scene = new Container();
    const edges = new Container();
    const corners = new Container();
    const props = new Container();
    const paving = new Container();
    const baseTx = bx * BLOCK_TILES;
    const baseTy = by * BLOCK_TILES;
    const { seed } = this;

    // Trois rangées de marge : les coins du bord regardent la profondeur de
    // la voisine, qui regarde elle-même deux tuiles autour.
    const terrain = new BlockTerrain(seed, baseTx, baseTy, BLOCK_TILES, 3);
    // Un palier par sol, et un par profondeur d'eau : c'est entre paliers que les coins s'arrondissent.
    const layerAt = (lx: number, ly: number): string => {
      const kind = terrain.kind(lx, ly);

      return kind === 'water' ? `water${terrain.depth(lx, ly)}` : kind;
    };

    for (let ly = 0; ly < BLOCK_TILES; ly += 1) {
      for (let lx = 0; lx < BLOCK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        const kind = terrain.kind(lx, ly);
        const roll = groundRoll(seed, tx, ty);

        scene.addChild(tileSprite(this.tiles.ground(kind, tx, ty, roll, terrain.depth(lx, ly)), lx, ly));

        for (const side of SIDES) {
          const [dx, dy] = SIDE_OFFSET[side];

          if (terrain.kind(lx + dx, ly + dy) === kind) continue;

          const edge = this.tiles.edge(kind, side);

          if (edge) edges.addChild(tileSprite(edge, lx, ly));
        }

        // Un coin est saillant quand ses deux voisins orthogonaux sont d'un
        // même autre palier : on l'arrondit, peint dans la couleur de ce palier.
        const layer = layerAt(lx, ly);

        for (const corner of CORNERS) {
          const [vertical, horizontal] = CORNER_SIDES[corner];
          const [vx, vy] = SIDE_OFFSET[vertical];
          const [hx, hy] = SIDE_OFFSET[horizontal];
          const above = layerAt(lx + vx, ly + vy);
          const beside = layerAt(lx + hx, ly + hy);

          if (above === layer || beside !== above) continue;

          const neighbour = terrain.kind(lx + hx, ly + hy);

          corners.addChild(
            tileSprite(this.tiles.corner(neighbour, tx + hx, ty + hy, corner, terrain.depth(lx + hx, ly + hy)), lx, ly),
          );
        }

        if (this.roads.has(tx, ty)) {
          paving.addChild(tileSprite(this.tiles.road(this.roads.links(tx, ty)), lx, ly));
          continue;
        }

        const decor = decorAt(seed, tx, ty);

        if (decor) props.addChild(tileSprite(this.library.part('decor', decor), lx, ly));
      }
    }

    scene.addChild(edges, corners, paving, props);
    this.renderer.render({ target, container: scene, clear: true });
    scene.destroy({ children: true });
  }

  /**
   * Une dalle a été posée ou retirée en (tx, ty) : son bloc se rebake, et
   * celui de chaque voisine, dont le raccord change. Un bloc pas encore baké
   * le sera de toute façon à jour.
   */
  public invalidate(tx: number, ty: number): void {
    for (const [dx, dy] of [[0, 0], ...Object.values(SIDE_OFFSET)]) {
      const key = coordKey(Math.floor((tx + dx) / BLOCK_TILES), Math.floor((ty + dy) / BLOCK_TILES));

      if (this.baked.has(key)) this.stale.add(key);
    }
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
      this.stale.delete(key);
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
