/**
 * Le rayon de travail d'un bâtiment : un cercle discret au sol.
 *
 * Deux bâtiments en ont un : la cabane de bûcheron (les arbres que ses
 * bûcherons coupent, cercle menthe) et le poste de logistique (les
 * producteurs que ses logisticiens vident, cercle cyan). Il se montre quand
 * on en place un — autour du fantôme, pour voir ce qu'il atteindra — et
 * quand on en sélectionne un. Ailleurs, il n'encombre pas la carte. Même
 * centre, même rayon que la simulation (`sim/lumberjacks.ts`,
 * `sim/jobs.ts`) : le centre de l'emprise, `LUMBERJACKS.radius` ou
 * `LOGISTICIANS.radius`.
 *
 * Le `Graphics` n'est redessiné que si le cercle change de place.
 */

import { Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, STROKE, hex } from '../data/artDirection.ts';
import { BUILDINGS, type BuildingId, type BuildingKind } from '../data/buildings.ts';
import { LOGISTICIANS, LUMBERJACKS } from '../data/workers.ts';
import type { GhostState } from '../input/placement.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

/** Les bâtiments qui ont un rayon de travail : son rayon en tuiles, sa couleur. */
const REACHES: Partial<Record<BuildingKind, { radius: number; color: number }>> = {
  lumberCamp: { radius: LUMBERJACKS.radius, color: hex(PALETTE.mint.shade) },
  depot: { radius: LOGISTICIANS.radius, color: hex(PALETTE.cyan.shade) },
};

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
    const reach = area && REACHES[BUILDINGS[area.proto].kind];

    this.container.visible = Boolean(reach);
    if (!area || !reach) {
      this.lastKey = '';
      return;
    }

    const key = `${area.proto}:${area.tx}:${area.ty}`;

    if (key === this.lastKey) return;
    this.lastKey = key;

    const { width, height } = BUILDINGS[area.proto];

    this.container
      .clear()
      .circle((area.tx + width / 2) * TILE_SIZE, (area.ty + height / 2) * TILE_SIZE, reach.radius * TILE_SIZE)
      .fill({ color: reach.color, alpha: 0.06 })
      .stroke({ width: STROKE.width, color: reach.color, alpha: 0.45 });
  }

  /** L'emprise dont montrer le rayon : le fantôme d'un bâtiment qui en a un, sinon le bâtiment sélectionné. */
  private area(ghost: GhostState | null, selected: EntityId | null): { proto: BuildingId; tx: number; ty: number } | null {
    if (ghost && REACHES[BUILDINGS[ghost.building].kind]) return { proto: ghost.building, tx: ghost.tx, ty: ghost.ty };

    const entity = selected === null ? undefined : this.world.entities.get(selected);

    return entity ?? null;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
