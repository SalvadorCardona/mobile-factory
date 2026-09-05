/**
 * Bâtiments — contenu pur.
 *
 * Ajouter un bâtiment = ajouter une entrée ici. Aucune ligne de logique à
 * écrire ailleurs tant que le `kind` existe déjà côté simulation.
 *
 * Un bâtiment ne se pose jamais fini : le placement crée un **chantier**, qui
 * devient le bâtiment quand le joueur y a apporté tout le `cost`. Un coût
 * vide se termine au tick même du placement.
 */

import type { ItemId } from './items.ts';
import type { SpriteId } from './sprites.ts';

/** Comportement simulé associé au bâtiment. Un `kind` = un cas dans `sim/`. */
export type BuildingKind = 'drill' | 'townHall';

export interface BuildingProto {
  label: string;
  kind: BuildingKind;
  /** Emprise en tuiles. */
  width: number;
  height: number;
  /** Coût de construction, à apporter sur le chantier. */
  cost: Partial<Record<ItemId, number>>;
  /** Capacité du coffre interne, en nombre total d'objets. `Infinity` pour un entrepôt. */
  storage: number;
  /** Proposé dans le menu de construction ? La mairie, unique, ne l'est pas. */
  menu: boolean;
  /** Planche de sprites du bâtiment terminé. */
  sprite: SpriteId;
}

export const BUILDINGS = {
  townHall: {
    label: 'Mairie',
    kind: 'townHall',
    width: 3,
    height: 3,
    cost: { wood: 20, stone: 12 },
    storage: Infinity,
    menu: false,
    sprite: 'townHall',
  },
  drill: {
    label: 'Foreuse',
    kind: 'drill',
    width: 2,
    height: 2,
    cost: { stone: 6, ironOre: 4 },
    storage: 50,
    menu: true,
    sprite: 'drill',
  },
} as const satisfies Record<string, BuildingProto>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Bâtiments proposés dans le menu, dans l'ordre de déclaration. */
export const MENU_BUILDING_IDS = BUILDING_IDS.filter((id) => BUILDINGS[id].menu);

export function isBuildingId(value: string): value is BuildingId {
  return value in BUILDINGS;
}
