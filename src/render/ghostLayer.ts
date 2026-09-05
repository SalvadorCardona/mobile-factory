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
 * `world.canPlace()` — le même juge que le tick, jamais une seconde règle
 * écrite en parallèle.
 *
 * Le `Graphics` n'est redessiné que lorsque la case ou la validité change :
 * retesseller un rectangle à 120 Hz pour rien serait le genre de gaspillage
 * qu'on paye en batterie.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { BUILD_REACH_TILES } from '../sim/player.ts';
import type { World } from '../sim/world.ts';
import type { GhostState } from '../input/placement.ts';
import { SPRITE_SCALE, type SpriteLibrary } from './spriteLibrary.ts';

const VALID = 0x7fc8a9;
const INVALID = 0xe2725b;

/** Rayon de la grille autour du joueur, en tuiles : un peu plus que la portée. */
const GRID_RADIUS = BUILD_REACH_TILES + 3;

export class GhostLayer {
  public readonly container = new Container();

  private readonly grid = new Graphics();
  private readonly footprints = new Graphics();
  private readonly outline = new Graphics();
  private readonly reach = new Graphics();
  private readonly preview = new Sprite();
  private lastKey = '';
  private lastGridKey = '';

  private readonly world: World;
  private readonly library: SpriteLibrary;

  public constructor(world: World, library: SpriteLibrary) {
    this.world = world;
    this.library = library;
    this.preview.alpha = 0.6;
    this.preview.scale.set(SPRITE_SCALE);

    this.container.addChild(this.grid, this.footprints, this.reach, this.preview, this.outline);
    this.container.visible = false;
  }

  /**
   * `building` : le mode construction est actif (bâtiment armé, fantôme posé
   * ou non). `ghost` : le fantôme, s'il est posé.
   */
  public update(building: boolean, ghost: GhostState | null): void {
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
      this.lastKey = '';
      this.drawReach();
      return;
    }
    this.preview.visible = true;
    this.outline.visible = true;

    const rejection = this.world.canPlace(ghost.building, ghost.tx, ghost.ty);
    const key = `${ghost.building}:${ghost.tx}:${ghost.ty}:${rejection ?? 'ok'}`;

    if (key === this.lastKey) return;
    this.lastKey = key;

    const proto = BUILDINGS[ghost.building];
    const color = rejection ? INVALID : VALID;

    this.preview.texture = this.library.still(proto.sprite, 'idle');
    this.preview.position.set(ghost.tx * TILE_SIZE, ghost.ty * TILE_SIZE);
    this.preview.tint = color;

    this.outline
      .clear()
      .rect(
        ghost.tx * TILE_SIZE,
        ghost.ty * TILE_SIZE,
        proto.width * TILE_SIZE,
        proto.height * TILE_SIZE,
      )
      .stroke({ width: 3, color, alignment: 1 });

    this.drawReach();
  }

  private drawReach(): void {
    this.reach
      .clear()
      .circle(0, 0, BUILD_REACH_TILES * TILE_SIZE)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
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
    this.grid.stroke({ width: 1, color: 0xffffff, alpha: 0.14, pixelLine: true });

    this.footprints.clear();
    for (const entity of this.world.entities.values()) {
      if (Math.abs(entity.tx - tx) > GRID_RADIUS + 3 || Math.abs(entity.ty - ty) > GRID_RADIUS + 3) continue;

      this.footprints
        .rect(entity.tx * TILE_SIZE, entity.ty * TILE_SIZE, entity.width * TILE_SIZE, entity.height * TILE_SIZE)
        .fill({ color: entity.kind === 'site' ? 0xf0c060 : 0xffffff, alpha: 0.12 })
        .stroke({ width: 2, color: entity.kind === 'site' ? 0xf0c060 : 0xffffff, alpha: 0.45, alignment: 1 });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
