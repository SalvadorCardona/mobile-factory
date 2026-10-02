/**
 * Le relevé d'un chantier, objet par objet : ce qu'il coûte, ce qui est livré,
 * ce qui manque, ce qui est en route et ce que la ville en a.
 *
 * Rien de neuf dans l'état : tout se déduit du chantier (`delivered`), du coût
 * de son bâtiment, des jobs qui le livrent (`JobBoard.siteIncoming`, porteurs
 * comme bâtisseurs) et du stock disponible de la ville. La carte en tire la
 * rangée d'icônes sous la barre du chantier, sa fenêtre le détail.
 */

import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Site } from './types.ts';

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

/**
 * Une ligne par objet du coût, dans l'ordre de `BUILDINGS[proto].cost`.
 * `incoming(item)` : ce qui est déjà promis au chantier ; `town` : le stock de
 * la ville (`available`), ou `null` sans mairie.
 */
export function siteLedger(
  site: Site,
  incoming: (item: ItemId) => number,
  town: { available(item: ItemId): number } | null,
): SiteLine[] {
  return (Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]).map(([item, needed]) => {
    const delivered = Math.min(needed, site.delivered[item] ?? 0);
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
