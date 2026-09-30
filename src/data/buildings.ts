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
export type BuildingKind =
  | 'drill'
  | 'townHall'
  | 'nursery'
  | 'tower'
  | 'house'
  | 'farm'
  | 'forge'
  | 'clinic'
  | 'lab'
  | 'lumberCamp';

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
  /**
   * Rayon logistique, en tuiles, depuis le centre de l'emprise : un chantier
   * dans ce rayon puise dans le coffre du bâtiment fini. `0` pour un bâtiment
   * qui n'est pas un entrepôt, `Infinity` pour supprimer la notion de distance.
   */
  logisticRadius: number;
  /** Points de vie du bâtiment fini. */
  hp: number;
  /**
   * Ouvriers que le bâtiment héberge une fois terminé, et le plus qu'il en
   * emploie : son maximum. Ils comptent dans la population de la colonie ;
   * les porteurs en sortiront. À la construction, il les emploie tous.
   */
  workers: number;
  /**
   * Le moins d'ouvriers qu'on peut lui laisser depuis sa fenêtre (sélecteur
   * − / + de `sim/staffing.ts`). Zéro : c'est une pause de fait.
   */
  minWorkers: number;
  /** Proposé dans le menu de construction ? La mairie, unique, ne l'est pas. */
  menu: boolean;
  /** Un seul par colonie, chantier compris : le labo de recherche. */
  unique: boolean;
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
  /**
   * Niveaux d'amélioration au-delà du premier, dans l'ordre : `upgrades[0]`
   * est le niveau 2. Ils se gagnent depuis la fenêtre du bâtiment fini, contre
   * leur `cost`. Vide pour un bâtiment qui ne s'améliore pas.
   */
  upgrades: readonly BuildingUpgrade[];
}

/**
 * Un niveau d'amélioration : ce qu'il coûte depuis le niveau d'avant, et ce
 * qu'il remplace dans le prototype — points de vie, arme, sprite, textes.
 */
export interface BuildingUpgrade {
  /** Nom du bâtiment à ce niveau : le titre de sa fenêtre. */
  label: string;
  /** Verbe du bouton qui y mène : « Renforcer ». */
  action: string;
  /** Texte de la fenêtre d'inspection à ce niveau. */
  description: string;
  /** Payé d'un coup, comme un « Transférer » : le sac d'abord, puis la ville si elle est à portée. */
  cost: Partial<Record<ItemId, number>>;
  hp: number;
  weapon: WeaponId | null;
  sprite: SpriteId;
}

/** Ce qui change d'un niveau à l'autre, lu par la simulation et le rendu. */
export type BuildingLevel = Pick<BuildingUpgrade, 'label' | 'description' | 'hp' | 'weapon' | 'sprite'>;

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
    logisticRadius: 10,
    hp: 120,
    workers: 0,
    minWorkers: 0,
    menu: false,
    unique: true,
    plan: false,
    unlockNight: 0,
    sprite: 'townHall',
    weapon: null,
    upgrades: [],
  },
  lumberCamp: {
    label: LORE.buildings.lumberCamp.name,
    siteDescription: LORE.buildings.lumberCamp.site,
    description: LORE.buildings.lumberCamp.description,
    effect: LORE.buildings.lumberCamp.effect,
    kind: 'lumberCamp',
    width: 2,
    height: 2,
    cost: { wood: 8, stone: 4 },
    storage: 20,
    logisticRadius: 0,
    hp: 50,
    workers: 2,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 0,
    sprite: 'lumberCamp',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 40,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 0,
    sprite: 'drill',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 60,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 0,
    sprite: 'nursery',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 70,
    workers: 4,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: true,
    unlockNight: 0,
    sprite: 'builderHouse',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 50,
    workers: 4,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 0,
    sprite: 'farm',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 60,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 0,
    sprite: 'watchtower',
    weapon: 'towerBow',
    // Le coût est celui de l'ancienne tour renforcée, moins la tour de planches déjà debout.
    upgrades: [
      {
        label: LORE.buildings.watchtower.reinforced.name,
        action: LORE.buildings.watchtower.reinforced.action,
        description: LORE.buildings.watchtower.reinforced.description,
        cost: { stone: 2, ironPlate: 4 },
        hp: 90,
        weapon: 'reinforcedBow',
        sprite: 'reinforcedTower',
      },
    ],
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
    logisticRadius: 0,
    hp: 60,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 1,
    sprite: 'forge',
    weapon: null,
    upgrades: [],
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
    logisticRadius: 0,
    hp: 60,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: false,
    plan: false,
    unlockNight: 1,
    sprite: 'clinic',
    weapon: null,
    upgrades: [],
  },
  lab: {
    label: LORE.buildings.lab.name,
    siteDescription: LORE.buildings.lab.site,
    description: LORE.buildings.lab.description,
    effect: LORE.buildings.lab.effect,
    kind: 'lab',
    width: 2,
    height: 2,
    cost: { wood: 14, stone: 10, ironOre: 4 },
    // De quoi recevoir le plus gros coût de recherche, et ce qui reste d'une recherche abandonnée.
    storage: 40,
    logisticRadius: 0,
    hp: 60,
    workers: 0,
    minWorkers: 0,
    menu: true,
    unique: true,
    plan: false,
    unlockNight: 0,
    sprite: 'lab',
    weapon: null,
    upgrades: [],
  },
} as const satisfies Record<string, BuildingProto>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Bâtiments proposés dans le menu, dans l'ordre de déclaration. */
export const MENU_BUILDING_IDS = BUILDING_IDS.filter((id) => BUILDINGS[id].menu);

/** Le niveau le plus haut qu'atteint le bâtiment : 1 s'il ne s'améliore pas. */
export function maxLevel(id: BuildingId): number {
  const proto: BuildingProto = BUILDINGS[id];

  return proto.upgrades.length + 1;
}

/** Le bâtiment à ce niveau (1 = tel que bâti). */
export function buildingLevel(id: BuildingId, level: number): BuildingLevel {
  const proto: BuildingProto = BUILDINGS[id];

  return proto.upgrades[level - 2] ?? proto;
}

/** L'amélioration qui suit ce niveau, ou `null` au niveau maximal. */
export function nextUpgrade(id: BuildingId, level: number): BuildingUpgrade | null {
  const proto: BuildingProto = BUILDINGS[id];

  return proto.upgrades[level - 1] ?? null;
}

export function isBuildingId(value: string): value is BuildingId {
  return value in BUILDINGS;
}
