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
export type BuildingKind = 'drill' | 'townHall' | 'nursery' | 'tower' | 'house' | 'farm' | 'forge' | 'clinic';

export interface BuildingProto {
  label: string;
  /** Texte de la fenêtre d'inspection du chantier. */
  siteDescription: string;
  /** Texte de la fenêtre d'inspection du bâtiment fini. */
  description: string;
  /** Ce que fait le bâtiment, en une ligne : sa carte du menu de construction. */
  effect: string;
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
  /**
   * Ouvriers que le bâtiment emploie ou héberge une fois terminé. Ils
   * comptent dans la population de la colonie ; les porteurs en sortiront.
   */
  workers: number;
  /** Proposé dans le menu de construction ? La mairie, unique, ne l'est pas. */
  menu: boolean;
  /**
   * Faut-il un plan pour le bâtir ? Un bâtiment à plan n'entre dans le menu
   * qu'une fois le plan donné par Ève, en récompense d'une quête (`data/quests.ts`).
   */
  plan: boolean;
  /**
   * Nuit à voir tomber avant de pouvoir le poser. Le menu montre la carte, grisée,
   * dès le début : le joueur sait à quoi servira le charbon avant d'en avoir
   * besoin, sans avoir trop de choix trop tôt.
   */
  unlockNight: number;
  /** Sprite du bâtiment : son chantier, sa version finie, sa version endommagée. */
  sprite: SpriteId;
  /** Arme automatique du bâtiment, ou `null` s'il n'en porte pas. */
  weapon: WeaponId | null;
}

export const BUILDINGS = {
  townHall: {
    label: LORE.buildings.townHall.name,
    siteDescription: LORE.buildings.townHall.site,
    description: LORE.buildings.townHall.description,
    effect: LORE.buildings.townHall.effect,
    kind: 'townHall',
    width: 3,
    height: 3,
    cost: { wood: 20, stone: 12 },
    storage: Infinity,
    hp: 120,
    workers: 0,
    menu: false,
    plan: false,
    unlockNight: 0,
    sprite: 'townHall',
    weapon: null,
  },
  drill: {
    label: LORE.buildings.drill.name,
    siteDescription: LORE.buildings.drill.site,
    description: LORE.buildings.drill.description,
    effect: LORE.buildings.drill.effect,
    kind: 'drill',
    width: 2,
    height: 2,
    cost: { stone: 6, ironOre: 4 },
    storage: 50,
    hp: 40,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 0,
    sprite: 'drill',
    weapon: null,
  },
  nursery: {
    label: LORE.buildings.nursery.name,
    siteDescription: LORE.buildings.nursery.site,
    description: LORE.buildings.nursery.description,
    effect: LORE.buildings.nursery.effect,
    kind: 'nursery',
    width: 2,
    height: 2,
    cost: { wood: 14, stone: 6 },
    storage: 12,
    hp: 60,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 0,
    sprite: 'nursery',
    weapon: null,
  },
  builderHouse: {
    label: LORE.buildings.builderHouse.name,
    siteDescription: LORE.buildings.builderHouse.site,
    description: LORE.buildings.builderHouse.description,
    effect: LORE.buildings.builderHouse.effect,
    kind: 'house',
    width: 2,
    height: 2,
    cost: { wood: 16, stone: 8 },
    storage: 0,
    hp: 70,
    workers: 4,
    menu: true,
    plan: true,
    unlockNight: 0,
    sprite: 'builderHouse',
    weapon: null,
  },
  farm: {
    label: LORE.buildings.farm.name,
    siteDescription: LORE.buildings.farm.site,
    description: LORE.buildings.farm.description,
    effect: LORE.buildings.farm.effect,
    kind: 'farm',
    width: 2,
    height: 2,
    cost: { wood: 10, stone: 4 },
    storage: 40,
    hp: 50,
    workers: 4,
    menu: true,
    plan: false,
    unlockNight: 0,
    sprite: 'farm',
    weapon: null,
  },
  watchtower: {
    label: LORE.buildings.watchtower.name,
    siteDescription: LORE.buildings.watchtower.site,
    description: LORE.buildings.watchtower.description,
    effect: LORE.buildings.watchtower.effect,
    kind: 'tower',
    width: 2,
    height: 2,
    cost: { wood: 12, stone: 4 },
    storage: 0,
    hp: 60,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 0,
    sprite: 'watchtower',
    weapon: 'towerBow',
  },
  forge: {
    label: LORE.buildings.forge.name,
    siteDescription: LORE.buildings.forge.site,
    description: LORE.buildings.forge.description,
    effect: LORE.buildings.forge.effect,
    kind: 'forge',
    width: 2,
    height: 2,
    cost: { wood: 8, stone: 10, ironOre: 4 },
    storage: 30,
    hp: 60,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 1,
    sprite: 'forge',
    weapon: null,
  },
  reinforcedTower: {
    label: LORE.buildings.reinforcedTower.name,
    siteDescription: LORE.buildings.reinforcedTower.site,
    description: LORE.buildings.reinforcedTower.description,
    effect: LORE.buildings.reinforcedTower.effect,
    kind: 'tower',
    width: 2,
    height: 2,
    cost: { wood: 10, stone: 6, ironPlate: 4 },
    storage: 0,
    hp: 90,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 1,
    sprite: 'reinforcedTower',
    weapon: 'reinforcedBow',
  },
  clinic: {
    label: LORE.buildings.clinic.name,
    siteDescription: LORE.buildings.clinic.site,
    description: LORE.buildings.clinic.description,
    effect: LORE.buildings.clinic.effect,
    kind: 'clinic',
    width: 2,
    height: 2,
    cost: { wood: 12, stone: 8, food: 4 },
    storage: 0,
    hp: 60,
    workers: 0,
    menu: true,
    plan: false,
    unlockNight: 1,
    sprite: 'clinic',
    weapon: null,
  },
} as const satisfies Record<string, BuildingProto>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Bâtiments proposés dans le menu, dans l'ordre de déclaration. */
export const MENU_BUILDING_IDS = BUILDING_IDS.filter((id) => BUILDINGS[id].menu);

export function isBuildingId(value: string): value is BuildingId {
  return value in BUILDINGS;
}
