/**
 * Le relevé d'un chantier, objet par objet : ce qu'il coûte, ce qui est livré,
 * ce qui manque, ce qui est en route et ce que la ville en a.
 *
 * Rien de neuf dans l'état : tout se déduit du chantier (`delivered`), du coût
 * de son bâtiment, des jobs qui le livrent (`JobBoard.siteIncoming`, porteurs
 * comme bâtisseurs) et du stock disponible de la ville. La carte en tire la
 * rangée d'icônes sous la barre du chantier, sa fenêtre le détail.
 *
 * Le labo qui attend le coût de sa recherche a le même relevé (`labLedger`) :
 * livré, c'est ce que son coffre en a ; en route, ce que les porteurs y ont
 * réservé (`Store.expected`).
 */

import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { isCollecting, researchCost } from './research.ts';
import type { Lab, Site } from './types.ts';

export interface SiteLine {
  item: ItemId;
  /** Ce que le bâtiment coûte de cet objet. */
  needed: number;
  /** Ce qui est déjà au chantier, plafonné au coût. */
  delivered: number;
  /** Ce qui manque encore au chantier : `needed - delivered`. */
  missing: number;
  /** Ce qu'un porteur ou un bâtisseur apporte déjà (réservé à la création du job). */
  incoming: number;
  /** Ce que la ville en a de disponible — `null` tant que la mairie n'est pas debout. */
  inTown: number | null;
  done: boolean;
  /**
   * À sec : il en manque plus que ce qui est en route, et la ville n'en a
   * plus du tout. Rien ne viendra de la mairie — à Adam d'en rapporter.
   */
  dry: boolean;
}

type Town = { available(item: ItemId): number } | null;

/**
 * Une ligne par objet du coût, dans l'ordre de `BUILDINGS[proto].cost`.
 * `incoming(item)` : ce qui est déjà promis au chantier ; `town` : le stock de
 * la ville (`available`), ou `null` sans mairie.
 */
export function siteLedger(site: Site, incoming: (item: ItemId) => number, town: Town): SiteLine[] {
  return ledger(Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][], (item) => site.delivered[item] ?? 0, incoming, town);
}

/**
 * Le relevé du labo, dans l'ordre du coût de sa recherche : vide tant qu'il
 * n'attend rien — aucune recherche, ou une recherche payée qui tourne.
 */
export function labLedger(lab: Lab, town: Town): SiteLine[] {
  if (!isCollecting(lab)) return [];
  // Compté sur le disponible, comme `labNeeds` : un reste qu'un porteur rapporte à la mairie n'est plus au labo.
  return ledger(researchCost(lab.research!), (item) => lab.store.available(item), (item) => lab.store.expected(item), town);
}

function ledger(cost: [ItemId, number][], given: (item: ItemId) => number, incoming: (item: ItemId) => number, town: Town): SiteLine[] {
  return cost.map(([item, needed]) => {
    const delivered = Math.min(needed, given(item));
    const missing = needed - delivered;
    const coming = Math.min(missing, incoming(item));
    const inTown = town ? town.available(item) : null;

    return {
      item,
      needed,
      delivered,
      missing,
      incoming: coming,
      inTown,
      done: missing === 0,
      dry: inTown === 0 && missing > coming,
    };
  });
}
