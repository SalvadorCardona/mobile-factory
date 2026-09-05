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

/** Ce que tout bâtiment posé partage : une identité et une emprise. */
interface Placed {
  id: EntityId;
  proto: BuildingId;
  /** Tuile d'origine (coin haut-gauche de l'emprise). */
  tx: number;
  ty: number;
  width: number;
  height: number;
}

/**
 * Un chantier : l'emprise est réservée, le bâtiment n'existe pas encore.
 * Le joueur y apporte le coût du prototype en le heurtant ; au dernier
 * objet livré, le chantier devient le bâtiment, sous le même id.
 */
export interface Site extends Placed {
  kind: 'site';
  /** Ce qui a déjà été livré, par objet. */
  delivered: Partial<Record<ItemId, number>>;
}

export interface Drill extends Placed {
  kind: 'drill';
  /** Coffre interne. */
  store: Store;
  /** Objet extrait par le gisement sous la foreuse, `null` si elle est posée à sec. */
  output: ItemId | null;
  /** Vrai quand le coffre est plein : la foreuse ne se replanifie plus. */
  blocked: boolean;
}

/** La mairie : le premier toit de la colonie, et son entrepôt. */
export interface TownHall extends Placed {
  kind: 'townHall';
  store: Store;
}

export type Entity = Site | Drill | TownHall;

export type Building = Exclude<Entity, Site>;

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Player {
  /** Position en pixels monde, au tick courant — le centre de la boîte de collision. */
  x: number;
  y: number;
  /** Position au tick précédent — le rendu interpole entre les deux. */
  prevX: number;
  prevY: number;
  /** Direction du regard, conservée à l'arrêt : le sprite ne se retourne pas tout seul. */
  facing: Facing;
  /** Vrai si le joueur a effectivement bougé ce tick. Pilote l'animation de marche. */
  moving: boolean;
  /** Le sac à dos. */
  inventory: Store;
}

/** La tuile contre laquelle le joueur pousse ce tick, s'il y en a une. */
export interface Contact {
  tx: number;
  ty: number;
}
