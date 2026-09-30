/**
 * Pause et effectifs des bâtiments.
 *
 * Deux réglages, posés depuis la fenêtre d'un bâtiment par des commandes
 * (`pauseBuilding`, `setWorkers`) et sauvegardés avec lui :
 *
 * - **la pause** d'un bâtiment producteur (foreuse, ferme, forge, nurserie,
 *   cabane de bûcheron) : il ne produit plus et ne consomme plus rien ; ses
 *   ouvriers finissent leur geste en cours puis flânent, et les porteurs
 *   peuvent toujours vider son coffre ;
 * - **l'effectif voulu** (`staff`) d'un bâtiment qui emploie, entre son
 *   minimum (`minWorkers`) et son maximum (`workers`). Zéro vaut pause.
 *
 * Les ouvriers viennent de la population de la ville : ceux que logent les
 * bâtiments finis. Chaque bâtiment qui emploie y puise, dans l'ordre de son
 * id — le plus ancien d'abord —, ce qu'il veut, tant qu'il en reste :
 * l'affectation ne dépend que de l'état, jamais du hasard. Ce qu'il n'obtient
 * pas reste un poste vide, « ouvrier manquant », qui se remplit tout seul
 * dès qu'un autre bâtiment en rend un.
 *
 * Ce module ne fait que compter : `World` en tire qui travaille.
 */

import { BUILDINGS, type BuildingId, type BuildingKind } from '../data/buildings.ts';
import type { EntityId } from './types.ts';

/** Ce qu'un producteur fait tourner : ce qu'on peut mettre en pause. */
const PAUSABLE: ReadonlySet<BuildingKind> = new Set<BuildingKind>(['drill', 'farm', 'forge', 'nursery', 'lumberCamp']);

/** Le bâtiment produit-il quelque chose qu'on puisse arrêter ? */
export function canPause(proto: BuildingId): boolean {
  return PAUSABLE.has(BUILDINGS[proto].kind);
}

/** Le bâtiment emploie-t-il des ouvriers qu'on peut régler ? */
export function employs(proto: BuildingId): boolean {
  return BUILDINGS[proto].workers > 0;
}

/** L'effectif ramené dans les bornes du bâtiment ; un nombre illisible vaut le maximum. */
export function clampStaff(proto: BuildingId, staff: number): number {
  const { minWorkers, workers } = BUILDINGS[proto];

  if (!Number.isFinite(staff)) return workers;
  return Math.max(minWorkers, Math.min(workers, Math.trunc(staff)));
}

/** Ce que le panneau montre d'un bâtiment qui emploie. */
export interface Staffing {
  min: number;
  max: number;
  /** Ce que le joueur a demandé. */
  wanted: number;
  /** Les postes occupés : `wanted - filled` ouvriers manquent. */
  filled: number;
}

/** Un bâtiment qui emploie, vu par la répartition. */
export interface StaffDemand {
  id: EntityId;
  wanted: number;
}

/**
 * La répartition de `pool` ouvriers entre les bâtiments, par id croissant :
 * chacun prend ce qu'il veut tant qu'il en reste. Renvoie les postes
 * occupés par bâtiment ; `pool` moins leur somme, ce sont les ouvriers libres.
 */
export function allocateStaff(demands: readonly StaffDemand[], pool: number): Map<EntityId, number> {
  const filled = new Map<EntityId, number>();
  let left = Math.max(0, pool);

  for (const { id, wanted } of [...demands].sort((a, b) => a.id - b.id)) {
    const taken = Math.min(Math.max(0, wanted), left);

    filled.set(id, taken);
    left -= taken;
  }
  return filled;
}
