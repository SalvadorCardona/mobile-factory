/**
 * L'équipement d'Adam — contenu pur.
 *
 * Un niveau d'équipement, c'est un arc : Adam part avec l'arc de fortune
 * (niveau 0) et en forge de meilleurs à la **forge** (`GEAR_WORKSHOP`),
 * depuis sa fenêtre, contre des objets payés le sac d'abord, puis la ville
 * si la forge est dans son rayon (commande `craftGear`). L'arc ne tire ni
 * plus fort ni plus loin : son niveau dit quelles bases mutantes il entame
 * (`data/enemyBases.ts`) — une base de niveau N demande un arc de niveau N
 * au moins.
 *
 * Seul le niveau atteint est de l'état (`Player.gear`).
 */

import type { BuildingId } from './buildings.ts';
import type { ItemId } from './items.ts';

export interface GearProto {
  label: string;
  /** Ce qu'il coûte à forger depuis le niveau d'avant ; vide pour l'arc de départ. */
  cost: Partial<Record<ItemId, number>>;
}

/** Par niveau, de 0 (l'arc de départ) au dernier. */
export const GEAR = [
  { label: 'Arc de fortune', cost: {} },
  { label: 'Arc cerclé de fer', cost: { ironPlate: 4, wood: 15 } },
  { label: 'Arc composite', cost: { ironPlate: 12, mutantGoo: 6, wolfFang: 4 } },
  { label: 'Arc radioactif', cost: { ironPlate: 25, mutantGoo: 10, radCore: 1 } },
] as const satisfies readonly GearProto[];

/** Le bâtiment dont la fenêtre forge l'équipement. */
export const GEAR_WORKSHOP: BuildingId = 'forge';

/** Le niveau le plus haut. */
export const MAX_GEAR = GEAR.length - 1;

/** Le prototype d'un niveau, borné à la table. */
export function gearOf(level: number): GearProto {
  return GEAR[Math.max(0, Math.min(MAX_GEAR, level))]!;
}
