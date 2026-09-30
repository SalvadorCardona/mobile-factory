/**
 * L'ordre des cartes du menu de construction : l'utile du moment d'abord.
 *
 * Au crépuscule et la nuit, les bâtiments armés (la tour de guet) passent en
 * tête : on pose une tour en deux touches quand la vague arrive. Viennent
 * ensuite ce qu'on peut bâtir et payer tout de suite, puis ce qu'on peut
 * bâtir sans avoir encore de quoi le remplir, enfin les cartes grisées.
 * À rang égal, l'ordre des données.
 *
 * Fonction pure, sans DOM : `buildMenu.ts` l'applique à l'ouverture du tiroir
 * seulement — une carte ne saute jamais sous le doigt pendant qu'on regarde.
 */

import { BUILDINGS, type BuildingId } from '../data/buildings.ts';

export interface BuildOrderContext {
  /** Crépuscule ou nuit : les mutants approchent. */
  threat: boolean;
  /** La carte est grisée (mairie en chantier, nuit pas encore vue, un seul par colonie). */
  locked: (id: BuildingId) => boolean;
  /** Le sac et la ville couvrent tout le coût. */
  affordable: (id: BuildingId) => boolean;
}

export function buildOrder(ids: readonly BuildingId[], context: BuildOrderContext): BuildingId[] {
  const rank = (id: BuildingId): number => {
    if (context.locked(id)) return 3;
    if (context.threat && BUILDINGS[id].weapon !== null) return 0;
    return context.affordable(id) ? 1 : 2;
  };

  // `sort` est stable : à rang égal, l'ordre des données tient.
  return [...ids].sort((a, b) => rank(a) - rank(b));
}
