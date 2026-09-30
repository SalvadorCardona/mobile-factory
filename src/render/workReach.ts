/**
 * Le rayon de coupe d'une cabane de bûcheron : un cercle discret au sol.
 *
 * Il se montre quand on place une cabane — autour du fantôme, pour voir
 * quels arbres elle atteindra — et quand on en sélectionne une. Ailleurs, il
 * n'encombre pas la carte. Même centre, même rayon que la simulation
 * (`sim/lumberjacks.ts`) : le centre de l'emprise, `LUMBERJACKS.radius`.
 *
 * Le `Graphics` n'est redessiné que si le cercle change de place.
 */

import { Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, STROKE, hex } from '../data/artDirection.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { LUMBERJACKS } from '../data/workers.ts';
import type { GhostState } from '../input/placement.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

const REACH = hex(PALETTE.mint.shade);

export class WorkReachLayer {
  public readonly container = new Graphics();

  private lastKey = '';
  private readonly world: World;

  public constructor(world: World) {
    this.world = world;
    this.container.visible = false;
  }

  /** `ghost` : le fantôme posé en mode construction ; `selected` : le bâtiment dont la fenêtre est ouverte. */
  public update(ghost: GhostState | null, selected: EntityId | null): void {
    const area = this.area(ghost, selected);

    this.container.visible = area !== null;
    if (!area) {
      this.lastKey = '';
      return;
    }

    const key = `${area.tx}:${area.ty}`;

    if (key === this.lastKey) return;
    this.lastKey = key;

    const { width, height } = BUILDINGS.lumberCamp;

    this.container
      .clear()
      .circle((area.tx + width / 2) * TILE_SIZE, (area.ty + height / 2) * TILE_SIZE, LUMBERJACKS.radius * TILE_SIZE)
      .fill({ color: REACH, alpha: 0.06 })
      .stroke({ width: STROKE.width, color: REACH, alpha: 0.45 });
  }

  /** L'emprise dont montrer le rayon : le fantôme d'une cabane, ou la cabane sélectionnée. */
  private area(ghost: GhostState | null, selected: EntityId | null): { tx: number; ty: number } | null {
    if (ghost && BUILDINGS[ghost.building].kind === 'lumberCamp') return ghost;

    const entity = selected === null ? undefined : this.world.entities.get(selected);

    return entity && BUILDINGS[entity.proto].kind === 'lumberCamp' ? entity : null;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
