/**
 * Bâtiments — contenu pur.
 *
 * Ajouter un bâtiment = ajouter une entrée ici. Aucune ligne de logique à
 * écrire ailleurs tant que le `kind` existe déjà côté simulation.
 *
 * Un bâtiment ne se pose jamais fini : le placement crée un **chantier**, qui
 * devient le bâtiment quand le joueur y a apporté tout le `cost`. Un coût
 * vide se termine au tick même du placement.
 *
 * Tout bâtiment fini a des points de vie : les mutants cassent ce qui les
 * sépare de la mairie, et la mairie elle-même. À zéro, il disparaît.
 */

import type { ItemId } from './items.ts';
import { LORE } from './lore.ts';
import type { SpriteId } from './sprites.ts';
import type { WeaponId } from './weapons.ts';

/** Comportement simulé associé au bâtiment. Un `kind` = un cas dans `sim/`. */
export type BuildingKind = 'drill' | 'townHall' | 'nursery' | 'tower';

export interface BuildingProto {
  label: string;
  /** Texte de la fenêtre d'inspection. */
  description: string;
  kind: BuildingKind;
  /** Emprise en tuiles. */
  width: number;
  height: number;
  /** Coût de construction, à apporter sur le chantier. */
  cost: Partial<Record<ItemId, number>>;
  /** Capacité du coffre interne, en nombre total d'objets. `Infinity` pour un entrepôt. */
  storage: number;
  /** Points de vie du bâtiment fini. */
  hp: number;
  /** Proposé dans le menu de construction ? La mairie, unique, ne l'est pas. */
  menu: boolean;
  /** Planche de sprites du bâtiment terminé. */
  sprite: SpriteId;
  /** Arme automatique du bâtiment, ou `null` s'il n'en porte pas. */
  weapon: WeaponId | null;
}

export const BUILDINGS = {
  townHall: {
    label: LORE.buildings.townHall.name,
    description: LORE.buildings.townHall.description,
    kind: 'townHall',
    width: 3,
    height: 3,
    cost: { wood: 20, stone: 12 },
    storage: Infinity,
    hp: 120,
    menu: false,
    sprite: 'townHall',
    weapon: null,
  },
  drill: {
    label: LORE.buildings.drill.name,
    description: LORE.buildings.drill.description,
    kind: 'drill',
    width: 2,
    height: 2,
    cost: { stone: 6, ironOre: 4 },
    storage: 50,
    hp: 40,
    menu: true,
    sprite: 'drill',
    weapon: null,
  },
  nursery: {
    label: LORE.buildings.nursery.name,
    description: LORE.buildings.nursery.description,
    kind: 'nursery',
    width: 2,
    height: 2,
    cost: { wood: 14, stone: 6 },
    storage: 0,
    hp: 60,
    menu: true,
    sprite: 'nursery',
    weapon: null,
  },
  watchtower: {
    label: LORE.buildings.watchtower.name,
    description: LORE.buildings.watchtower.description,
    kind: 'tower',
    width: 2,
    height: 2,
    cost: { wood: 12, stone: 4 },
    storage: 0,
    hp: 60,
    menu: true,
    sprite: 'watchtower',
    weapon: 'towerBow',
  },
} as const satisfies Record<string, BuildingProto>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Bâtiments proposés dans le menu, dans l'ordre de déclaration. */
export const MENU_BUILDING_IDS = BUILDING_IDS.filter((id) => BUILDINGS[id].menu);

export function isBuildingId(value: string): value is BuildingId {
  return value in BUILDINGS;
}

/** Ticks entre deux naissances à la nurserie : dix minutes. */
export const NURSERY_BIRTH_TICKS = 20 * 60 * 10;
