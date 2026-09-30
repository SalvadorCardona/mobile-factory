/**
 * Aperçu fantôme du placement, et grille du mode construction.
 *
 * Dès qu'un bâtiment est armé, la carte passe en **mode construction** : une
 * grille de tuiles se dessine autour du joueur, et l'emprise de chaque
 * bâtiment ou chantier existant est soulignée. Sans elle, un fantôme de 2×2
 * posé « à peu près là » finit une tuile trop à gauche une fois sur deux ; la
 * grille rend la case lisible, et les emprises disent où on ne pourra pas poser.
 *
 * Le fantôme dit trois choses en même temps : où le bâtiment ira, s'il est
 * posable, et jusqu'où le joueur peut construire. La couleur vient de
 * `world.placementBlock()` — le même juge que le tick, jamais une seconde
 * règle écrite en parallèle. Refusé, le fantôme ne rougit pas en entier :
 * seules les **cases fautives** de l'emprise passent au rouge, et le sprite
 * pâlit pour laisser voir l'arbre ou l'eau qu'il recouvrait.
 *
 * Le `Graphics` n'est redessiné que lorsque la case ou la validité change :
 * retesseller un rectangle à 120 Hz pour rien serait le genre de gaspillage
 * qu'on paye en batterie.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { PALETTE, RADIUS, STROKE, hex } from '../data/artDirection.ts';
import { BUILD_REACH_TILES } from '../sim/player.ts';
import type { PlacementBlock, World } from '../sim/world.ts';
import type { GhostState } from '../input/placement.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';

const VALID = hex(PALETTE.mint.base);
const INVALID = hex(PALETTE.coral.base);
const WHITE = hex(PALETTE.paper.base);
const SITE = hex(PALETTE.yellow.base);

/** Opacité du sprite fantôme : posable, il se montre ; refusé, il s'efface devant les cases rouges. */
const PREVIEW_ALPHA = 0.7;
const PREVIEW_ALPHA_BLOCKED = 0.4;
/** Retrait d'une case fautive dans sa tuile : deux cases voisines restent deux cases. */
const CELL_INSET = 2;

/** Rayon de la grille autour du joueur, en tuiles : un peu plus que la portée. */
const GRID_RADIUS = BUILD_REACH_TILES + 3;

export class GhostLayer {
  public readonly container = new Container();

  private readonly grid = new Graphics();
  private readonly footprints = new Graphics();
  private readonly outline = new Graphics();
  private readonly cells = new Graphics();
  private readonly reach = new Graphics();
  private readonly preview = new Sprite();
  private lastKey = '';
  private lastGridKey = '';

  private readonly world: World;
  private readonly library: SpriteLibrary;

  public constructor(world: World, library: SpriteLibrary) {
    this.world = world;
    this.library = library;
    this.preview.alpha = PREVIEW_ALPHA;
    // Ancré au pied de l'emprise : le toit dépasse vers le haut, comme le bâtiment fini.
    this.preview.anchor.set(0, 1);

    this.container.addChild(this.grid, this.footprints, this.reach, this.preview, this.cells, this.outline);
    this.container.visible = false;
  }

  /**
   * `building` : le mode construction est actif (bâtiment armé, fantôme posé
   * ou non). `ghost` : le fantôme, s'il est posé. `block` : pourquoi il ne
   * se pose pas, calculé une fois par le renderer.
   */
  public update(building: boolean, ghost: GhostState | null, block: PlacementBlock | null): void {
    if (!building) {
      this.container.visible = false;
      this.lastKey = '';
      this.lastGridKey = '';
      return;
    }

    this.container.visible = true;
    this.updateGrid();

    // Le cercle de portée suit le joueur en continu, lui.
    this.reach.position.set(this.world.player.x, this.world.player.y);

    if (!ghost) {
      this.preview.visible = false;
      this.outline.visible = false;
      this.cells.visible = false;
      this.lastKey = '';
      this.drawReach();
      return;
    }
    this.preview.visible = true;
    this.outline.visible = true;
    this.cells.visible = true;

    // Adam qui marche dans l'emprise change les cases sans changer le motif : elles sont dans la clé.
    const tiles = block?.tiles.map(({ tx, ty }) => `${tx},${ty}`).join(';') ?? '';
    const key = `${ghost.building}:${ghost.tx}:${ghost.ty}:${block?.reason ?? 'ok'}:${tiles}`;

    if (key === this.lastKey) return;
    this.lastKey = key;

    const proto = BUILDINGS[ghost.building];
    const color = block ? INVALID : VALID;

    this.preview.texture = this.library.texture(`${proto.sprite}.built`);
    this.preview.position.set(ghost.tx * TILE_SIZE, (ghost.ty + proto.height) * TILE_SIZE);
    this.preview.tint = block ? WHITE : VALID;
    this.preview.alpha = block ? PREVIEW_ALPHA_BLOCKED : PREVIEW_ALPHA;

    this.cells.clear();
    for (const tile of block?.tiles ?? []) {
      this.cells
        .roundRect(
          tile.tx * TILE_SIZE + CELL_INSET,
          tile.ty * TILE_SIZE + CELL_INSET,
          TILE_SIZE - CELL_INSET * 2,
          TILE_SIZE - CELL_INSET * 2,
          RADIUS.block,
        )
        .fill({ color: INVALID, alpha: 0.7 })
        .stroke({ width: STROKE.width, color: INVALID, alignment: 1 });
    }

    this.outline
      .clear()
      .roundRect(
        ghost.tx * TILE_SIZE,
        ghost.ty * TILE_SIZE,
        proto.width * TILE_SIZE,
        proto.height * TILE_SIZE,
        RADIUS.block,
      )
      .stroke({ width: STROKE.width * 1.5, color, alignment: 1 });

    this.drawReach();
  }

  private drawReach(): void {
    this.reach
      .clear()
      .circle(0, 0, BUILD_REACH_TILES * TILE_SIZE)
      .stroke({ width: STROKE.width, color: WHITE, alpha: 0.4 });
  }

  /**
   * La grille et les emprises ne se redessinent que si le joueur change de
   * tuile ou si le nombre d'entités change : un `Graphics` de quelques
   * centaines de segments retesselé à chaque frame ferait chauffer le téléphone.
   */
  private updateGrid(): void {
    const { tx, ty } = worldToTile(this.world.player.x, this.world.player.y);
    const key = `${tx}:${ty}:${this.world.entities.size}`;

    if (key === this.lastGridKey) return;
    this.lastGridKey = key;

    const left = (tx - GRID_RADIUS) * TILE_SIZE;
    const top = (ty - GRID_RADIUS) * TILE_SIZE;
    const span = (GRID_RADIUS * 2 + 1) * TILE_SIZE;

    this.grid.clear();
    for (let i = 0; i <= GRID_RADIUS * 2 + 1; i += 1) {
      const offset = i * TILE_SIZE;

      this.grid.moveTo(left + offset, top).lineTo(left + offset, top + span);
      this.grid.moveTo(left, top + offset).lineTo(left + span, top + offset);
    }
    this.grid.stroke({ width: 1, color: WHITE, alpha: 0.35 });

    this.footprints.clear();
    for (const entity of this.world.entities.values()) {
      if (Math.abs(entity.tx - tx) > GRID_RADIUS + 3 || Math.abs(entity.ty - ty) > GRID_RADIUS + 3) continue;

      const color = entity.kind === 'site' ? SITE : WHITE;

      this.footprints
        .roundRect(
          entity.tx * TILE_SIZE,
          entity.ty * TILE_SIZE,
          entity.width * TILE_SIZE,
          entity.height * TILE_SIZE,
          RADIUS.block,
        )
        .fill({ color, alpha: 0.18 })
        .stroke({ width: STROKE.width, color, alpha: 0.6, alignment: 1 });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
