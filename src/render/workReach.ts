/**
 * Le rayon de travail d'un bâtiment : un cercle discret au sol.
 *
 * Trois bâtiments en ont un : la cabane de bûcheron (les arbres que ses
 * bûcherons coupent, cercle menthe), le poste de logistique (les
 * producteurs que ses logisticiens vident, cercle cyan) et le poste de
 * construction (les chantiers que ses bâtisseurs livrent et bâtissent,
 * cercle violet). Il se montre quand
 * on en place un — autour du fantôme, pour voir ce qu'il atteindra — et
 * quand on en sélectionne un. Ailleurs, il n'encombre pas la carte. Même
 * centre, même rayon que la simulation (`sim/lumberjacks.ts`,
 * `sim/jobs.ts`) : le centre de l'emprise, `LUMBERJACKS.radius`,
 * `LOGISTICIANS.radius` ou `BUILDERS.radius`.
 *
 * La maison du forestier, elle, a un **carré** : la forêt qu'il plante
 * (`sim/forester.ts`), même carré que la simulation, chaque case libre
 * marquée d'une pastille — là où il plantera. Les cases prises (eau, bâti,
 * route, rocher) n'en ont pas : elles sont ignorées.
 *
 * Le `Graphics` n'est redessiné que si le cercle change de place, ou qu'une
 * case du carré change d'état.
 */

import { Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, RADIUS, STROKE, hex } from '../data/artDirection.ts';
import { BUILDINGS, type BuildingId, type BuildingKind } from '../data/buildings.ts';
import { BUILDERS, FORESTERS, LOGISTICIANS, LUMBERJACKS } from '../data/workers.ts';
import type { GhostState } from '../input/placement.ts';
import { plotOrigin } from '../sim/forester.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

/** Les bâtiments qui ont un rayon de travail : son rayon en tuiles, sa couleur. */
const REACHES: Partial<Record<BuildingKind, { radius: number; color: number }>> = {
  lumberCamp: { radius: LUMBERJACKS.radius, color: hex(PALETTE.mint.shade) },
  depot: { radius: LOGISTICIANS.radius, color: hex(PALETTE.cyan.shade) },
  yard: { radius: BUILDERS.radius, color: hex(PALETTE.violet.shade) },
};

/** Le carré du forestier : sa couleur, et le retrait d'une pastille de case libre dans sa tuile. */
const PLOT_COLOR = hex(PALETTE.mint.shade);
const PLOT_DOT_INSET = 10;

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

    if (area && BUILDINGS[area.proto].kind === 'foresterHouse') {
      this.container.visible = true;
      this.drawPlot(area);
      return;
    }

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

  /** Le carré de forêt : son contour, et une pastille sur chaque case que le forestier plantera. */
  private drawPlot(area: { proto: BuildingId; tx: number; ty: number }): void {
    const { width, height } = BUILDINGS[area.proto];
    const tiles = this.world.forestPlot({ tx: area.tx, ty: area.ty, width, height });
    const key = `${area.proto}:${area.tx}:${area.ty}:${tiles.map((tile) => tile.state[0]).join('')}`;

    if (key === this.lastKey) return;
    this.lastKey = key;

    const origin = plotOrigin({ tx: area.tx, ty: area.ty, width, height });
    const side = FORESTERS.plot * TILE_SIZE;

    this.container
      .clear()
      .roundRect(origin.tx * TILE_SIZE, origin.ty * TILE_SIZE, side, side, RADIUS.large)
      .fill({ color: PLOT_COLOR, alpha: 0.06 })
      .stroke({ width: STROKE.width, color: PLOT_COLOR, alpha: 0.45 });

    for (const tile of tiles) {
      if (tile.state !== 'free') continue;
      this.container
        .roundRect(
          tile.tx * TILE_SIZE + PLOT_DOT_INSET,
          tile.ty * TILE_SIZE + PLOT_DOT_INSET,
          TILE_SIZE - PLOT_DOT_INSET * 2,
          TILE_SIZE - PLOT_DOT_INSET * 2,
          RADIUS.small,
        )
        .fill({ color: PLOT_COLOR, alpha: 0.35 });
    }
  }

  /** L'emprise dont montrer le rayon : le fantôme d'un bâtiment qui en a un, sinon le bâtiment sélectionné. */
  private area(ghost: GhostState | null, selected: EntityId | null): { proto: BuildingId; tx: number; ty: number } | null {
    const kind = ghost && BUILDINGS[ghost.building].kind;

    if (ghost && kind && (REACHES[kind] || kind === 'foresterHouse')) return { proto: ghost.building, tx: ghost.tx, ty: ghost.ty };

    const entity = selected === null ? undefined : this.world.entities.get(selected);

    return entity ?? null;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
