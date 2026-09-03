/**
 * Aperçu fantôme du placement.
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
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { BUILD_REACH_TILES } from '../sim/player.ts';
import type { World } from '../sim/world.ts';
import type { Atlas } from './atlas.ts';
import type { GhostState } from '../input/placement.ts';

const VALID = 0x7fc8a9;
const INVALID = 0xe2725b;

export class GhostLayer {
  public readonly container = new Container();

  private readonly outline = new Graphics();
  private readonly reach = new Graphics();
  private readonly preview: Sprite;
  private lastKey = '';

  private readonly world: World;
  private readonly atlas: Atlas;

  public constructor(world: World, atlas: Atlas) {
    this.world = world;
    this.atlas = atlas;
    this.preview = new Sprite(atlas.buildings.drill);
    this.preview.alpha = 0.6;

    this.container.addChild(this.reach, this.preview, this.outline);
    this.container.visible = false;
  }

  public update(ghost: GhostState | null): void {
    if (!ghost) {
      this.container.visible = false;
      this.lastKey = '';
      return;
    }

    this.container.visible = true;

    const rejection = this.world.canPlace(ghost.building, ghost.tx, ghost.ty);
    const key = `${ghost.building}:${ghost.tx}:${ghost.ty}:${rejection ?? 'ok'}`;

    // Le cercle de portée suit le joueur en continu, lui.
    this.reach.position.set(this.world.player.x, this.world.player.y);

    if (key === this.lastKey) return;
    this.lastKey = key;

    const proto = BUILDINGS[ghost.building];
    const color = rejection ? INVALID : VALID;

    this.preview.texture = this.atlas.buildings[ghost.building];
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

    this.reach
      .clear()
      .circle(0, 0, BUILD_REACH_TILES * TILE_SIZE)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
