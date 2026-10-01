/**
 * Routes pavées — contenu pur.
 *
 * La pierre en trop devient des chemins : une tuile pavée coûte une pierre,
 * payée tout de suite (le sac d'abord, puis la ville si la tuile est dans
 * son rayon), sans chantier. Sur une route, tout mobile allié — Adam, les
 * porteurs, les bûcherons, les bâtisseurs — avance plus vite ; les mutants
 * et les bêtes n'en tirent rien. Optimiser la distance devient un levier :
 * une foreuse loin de la mairie coûte moins de porteurs si on y mène une route.
 *
 * Une route se retire au marteau, et rend sa pierre. Elle bloque la pose d'un
 * bâtiment : on la retire d'abord.
 */

import type { ItemId } from './items.ts';

export interface RoadProto {
  /** Ce que coûte une tuile pavée — et ce qu'elle rend une fois retirée. */
  item: ItemId;
  /** Multiplicateur de vitesse d'un mobile allié sur une route. */
  speed: number;
  /** Tuiles au plus par tracé : un doigt qui glisse ne vide pas la ville d'un geste. */
  maxTiles: number;
}

export const ROADS = {
  item: 'stone',
  speed: 1.6,
  maxTiles: 40,
} as const satisfies RoadProto;

/** Voisines pavées d'une tuile, en bits : haut, droite, bas, gauche. Le dessin de la dalle en dépend. */
export const ROAD_LINK = { top: 1, right: 2, bottom: 4, left: 8 } as const;
