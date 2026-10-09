/**
 * Le sol : un bloc de tuiles = un Sprite.
 *
 * Levier de performance numéro un sur mobile. Les tuiles d'un bloc sont
 * dessinées **une fois** dans une RenderTexture, puis affichées comme un seul
 * Sprite. Sans ça, ce sont des milliers de quads par frame.
 *
 * Le sol, la prairie (taches, brins, fleurettes : `meadow.ts`) et le décor
 * sont régénérés depuis la seed et ne changent jamais. Une chose s'y
 * ajoute, que la ville trace : les routes pavées — un pavage ou un coup de
 * marteau rebake le bloc touché (`invalidate`), et son voisin si la dalle
 * est au bord, puisque la voisine change de raccord. Les arbres et les rochers, qui changent
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
import type { Land } from '../sim/contamination.ts';
import type { RoadNetwork } from '../sim/roads.ts';
import { decorAt } from '../sim/terrain.ts';
import type { Camera } from './camera.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import { BlockTerrain, CORNERS, CORNER_SIDES, SIDES, SIDE_OFFSET, groundRoll, type Surface, type TerrainTiles } from './terrainTiles.ts';
import { PATCH_SIZE } from '../art/terrain.ts';
import { patchesIn, sprinkleAt } from './meadow.ts';

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
  private readonly land: Land;
  private readonly resolution: number;

  public constructor(renderer: Renderer, library: SpriteLibrary, tiles: TerrainTiles, seed: number, roads: RoadNetwork, land: Land) {
    this.renderer = renderer;
    this.library = library;
    this.tiles = tiles;
    this.seed = seed;
    this.roads = roads;
    this.land = land;
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
   * Neuf passes, dans l'ordre du peintre : le sol (sous l'eau, la terre de
   * sa rive : l'eau est peinte par `waterLayer.ts`), les taches de la
   * prairie, ses brins et fleurettes, les terres polluées et radioactives
   * (`Land`), qui recouvrent le sol, les transitions (faces avant,
   * liserés), les coins arrondis entre sols, les routes, puis le décor, qu'une dalle recouvre : pas de fleur sur un pavé. Les
   * sprites sont temporaires : seule la texture survit. Celles du tileset,
   * partagées, restent.
   */
  private renderInto(bx: number, by: number, target: RenderTexture): void {
    const scene = new Container();
    const meadow = new Container();
    const sprinkles = new Container();
    const edges = new Container();
    const corners = new Container();
    const props = new Container();
    const paving = new Container();
    const soil = new Container();
    const baseTx = bx * BLOCK_TILES;
    const baseTy = by * BLOCK_TILES;
    const { seed } = this;

    // Deux rangées de marge : un coin du bord regarde le sol de la voisine,
    // qui regarde elle-même une tuile autour quand elle est sous l'eau.
    const terrain = new BlockTerrain(seed, baseTx, baseTy, BLOCK_TILES, 2);

    // La surface de chaque tuile du bloc et de sa première couronne, lue une fois.
    const surfaceSpan = BLOCK_TILES + 2;
    const surfaces: Surface[] = [];

    for (let ly = -1; ly <= BLOCK_TILES; ly += 1) {
      for (let lx = -1; lx <= BLOCK_TILES; lx += 1) {
        surfaces.push(this.land.at(baseTx + lx, baseTy + ly) ?? terrain.beneath(lx, ly));
      }
    }

    const surfaceAt = (lx: number, ly: number): Surface => surfaces[(ly + 1) * surfaceSpan + lx + 1]!;

    for (let ly = 0; ly < BLOCK_TILES; ly += 1) {
      for (let lx = 0; lx < BLOCK_TILES; lx += 1) {
        const tx = baseTx + lx;
        const ty = baseTy + ly;
        // L'eau n'est pas bakée : sous elle, la terre de sa rive (`waterLayer.ts` la peint par-dessus).
        const ground = terrain.beneath(lx, ly);
        const roll = groundRoll(seed, tx, ty);
        const own = surfaceAt(lx, ly);

        scene.addChild(tileSprite(this.tiles.ground(ground, roll), lx, ly));

        for (const side of SIDES) {
          const [dx, dy] = SIDE_OFFSET[side];

          // La terre contaminée recouvre son sol : les transitions du sol dessous se taisent.
          if (own !== ground || terrain.beneath(lx + dx, ly + dy) === ground) continue;

          const edge = this.tiles.edge(ground, side);

          if (edge) edges.addChild(tileSprite(edge, lx, ly));
        }

        // Un coin est saillant quand ses deux voisins orthogonaux sont d'une
        // même autre surface : on l'arrondit, peint dans la couleur de celle-ci.
        // Vaut aussi pour la terre contaminée, dont les plaques ont ainsi des
        // coins saillants et rentrants arrondis.
        for (const corner of CORNERS) {
          const [vertical, horizontal] = CORNER_SIDES[corner];
          const [vx, vy] = SIDE_OFFSET[vertical];
          const [hx, hy] = SIDE_OFFSET[horizontal];
          const above = surfaceAt(lx + vx, ly + vy);
          const beside = surfaceAt(lx + hx, ly + hy);

          if (above === own || beside !== above) continue;

          corners.addChild(tileSprite(this.tiles.surfaceCorner(beside, corner), lx, ly));
        }

        if (this.roads.has(tx, ty)) {
          paving.addChild(tileSprite(this.tiles.road(this.roads.links(tx, ty)), lx, ly));
          continue;
        }

        // Une terre polluée ou radioactive recouvre le sol : ni décor ni fleurette dessus.
        const tainted = this.land.at(tx, ty);

        if (tainted) {
          soil.addChild(tileSprite(this.tiles.contamination(tainted, roll), lx, ly));
          continue;
        }

        const decor = decorAt(seed, tx, ty);

        if (decor) {
          props.addChild(tileSprite(this.library.part('decor', decor), lx, ly));
          continue;
        }

        const sprinkle = terrain.kind(lx, ly) === 'grass' ? sprinkleAt(seed, tx, ty) : null;

        if (sprinkle) {
          const sprite = new Sprite(this.tiles.sprinkle(sprinkle.name));

          sprite.position.set(lx * TILE_SIZE + sprinkle.dx, ly * TILE_SIZE + sprinkle.dy);
          sprinkles.addChild(sprite);
        }
      }
    }

    const left = bx * BLOCK_SIZE;
    const top = by * BLOCK_SIZE;

    for (const patch of patchesIn(seed, left, top, left + BLOCK_SIZE, top + BLOCK_SIZE)) {
      const sprite = new Sprite(this.tiles.patch(patch.tone, patch.shape));
      const width = PATCH_SIZE.width * patch.scale;

      sprite.scale.set(patch.flip ? -patch.scale : patch.scale, patch.scale);
      sprite.position.set(patch.x - left + (patch.flip ? width : 0), patch.y - top);
      meadow.addChild(sprite);
    }

    scene.addChild(meadow, sprinkles, soil, edges, corners, paving, props);
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
