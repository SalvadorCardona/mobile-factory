/**
 * Entités de la simulation.
 *
 * Une `Map<EntityId, Entity>` avec union discriminée, pas d'ECS. C'est plus
 * lisible et ça reste rentable bien au-delà de ce que ce jeu manipulera avant
 * longtemps. `sim/` étant isolé, le stockage se change sans toucher au rendu.
 */

import type { BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Store } from './store.ts';

export type EntityId = number;

export interface Drill {
  kind: 'drill';
  id: EntityId;
  proto: BuildingId;
  /** Tuile d'origine (coin haut-gauche de l'emprise). */
  tx: number;
  ty: number;
  width: number;
  height: number;
  /** Coffre interne. */
  store: Store;
  /** Objet extrait par le gisement sous la foreuse, `null` si elle est posée à sec. */
  output: ItemId | null;
  /** Vrai quand le coffre est plein : la foreuse ne se replanifie plus. */
  blocked: boolean;
}

export type Entity = Drill;

export interface Player {
  /** Position en pixels monde, au tick courant. */
  x: number;
  y: number;
  /** Position au tick précédent — le rendu interpole entre les deux. */
  prevX: number;
  prevY: number;
}
