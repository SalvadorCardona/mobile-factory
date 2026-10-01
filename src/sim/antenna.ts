/**
 * L'Antenne : ce que son coffre attend pour monter d'un étage.
 *
 * Son premier étage est un chantier ordinaire. Les deux suivants sont ses
 * niveaux d'amélioration (`BUILDINGS.antenna.upgrades`), mais ils ne se
 * paient pas d'un coup comme une tour qu'on renforce : ils se **livrent**,
 * comme un chantier — Adam qui la heurte, « Transférer » (le sac, puis la
 * ville dans son rayon), les porteurs depuis la mairie. L'étage monte dès que
 * le coffre tient tout son coût.
 *
 * Fonctions pures, comme `sim/research.ts` pour le labo : `World` décide sur
 * elles, l'UI les lit pour griser ses boutons et remplir ses jauges.
 */

import { nextUpgrade } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Antenna } from './types.ts';

/** Le coût de l'étage suivant, objet par objet ; vide une fois l'émetteur posé. */
export function floorCost(antenna: Antenna): [ItemId, number][] {
  const floor = nextUpgrade(antenna.proto, antenna.level);

  return floor ? (Object.entries(floor.cost) as [ItemId, number][]) : [];
}

/** Ce qu'il faut encore de cet objet à l'étage suivant, sans compter ce que les porteurs apportent : ce qu'Adam peut y poser. */
export function floorNeeds(antenna: Antenna, item: ItemId): number {
  const needed = floorCost(antenna).find(([wanted]) => wanted === item)?.[1] ?? 0;

  return Math.max(0, needed - antenna.store.count(item));
}

/** Ce que l'étage attend encore et que personne n'apporte : sa « place libre », pour la ville et les porteurs. */
export function floorWants(antenna: Antenna, item: ItemId): number {
  return Math.max(0, floorNeeds(antenna, item) - antenna.store.expected(item));
}

/** Ce qui manque encore à l'étage suivant, tous objets confondus ; 0 quand il peut monter — ou qu'il n'y en a plus. */
export function floorMissing(antenna: Antenna): number {
  return floorCost(antenna).reduce((sum, [item]) => sum + floorNeeds(antenna, item), 0);
}
