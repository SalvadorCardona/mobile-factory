/**
 * Parties de test — contenu pur.
 *
 * Une partie de test s'ouvre par une URL (`/mobile-factory/test`) sur une
 * base déjà construite, pour essayer une fenêtre, un ouvrier ou un chantier
 * sans rejouer les dix premières minutes. Elle n'est pas une sauvegarde
 * figée : `sim/testScenario.ts` la rebâtit à chaque chargement avec les
 * commandes du jeu (chantier posé, « Transférer »), à partir de ce qui est
 * décrit ici. Quand un coût ou une règle change, le scénario suit — ou son
 * test casse, et le dit.
 *
 * Positions en tuiles, relatives au coin haut-gauche de la mairie : la
 * seed fixe tire toujours la même carte, la même clairière, la même mairie.
 *
 * Ajouter un scénario = ajouter une entrée ; `/test/<id>` l'ouvre, `/test`
 * seul ouvre `base`.
 */

import type { BuildingId } from './buildings.ts';
import type { ItemId } from './items.ts';

/** Un bâtiment de la base, posé à (dx, dy) tuiles du coin de la mairie. */
export interface ScenarioBuilding {
  building: BuildingId;
  dx: number;
  dy: number;
  /**
   * Un chantier laissé en cours : ce qu'il a déjà reçu. Sans ce champ, le
   * bâtiment est livré en entier — et fini, s'il n'attend pas de bâtisseurs.
   */
  delivered?: Partial<Record<ItemId, number>>;
}

export interface TestScenarioProto {
  /** Le bandeau « Partie de test » le précise. */
  label: string;
  /** La carte : toujours la même, la partie est déterministe. */
  seed: number;
  /** Dans l'ordre de construction, après la mairie, qui est toujours bâtie. */
  buildings: readonly ScenarioBuilding[];
  /** Le coffre de la mairie, une fois la base bâtie. */
  town: Partial<Record<ItemId, number>>;
  /** Le sac d'Adam. */
  bag: Partial<Record<ItemId, number>>;
  /** Où se tient Adam, en tuiles du coin de la mairie. */
  adam: { dx: number; dy: number };
  /** Vrai : la partie s'ouvre au crépuscule du premier jour, plutôt qu'au matin — le moment où l'on va dormir. */
  dusk?: boolean;
  /** Le niveau de l'arc d'Adam (`data/gear.ts`) ; absent : l'arc de fortune. */
  gear?: number;
  /**
   * Adam se tient à tant de tuiles du centre de la base mutante la plus
   * proche de la mairie, du côté de la mairie, plutôt qu'à `adam`.
   */
  nearBase?: number;
}

export const TEST_SCENARIOS = {
  /**
   * Une petite base au matin du premier jour : la mairie et son stock, une
   * cabane de bûcheron, une ferme et un puits qui tournent, un poste de construction
   * dont les bâtisseurs finissent le labo — bois livré, pierre en route, fer
   * manquant : il attend Adam.
   */
  base: {
    label: 'Petite base',
    seed: 100,
    buildings: [
      { building: 'lumberCamp', dx: -6, dy: 0 },
      { building: 'farm', dx: 6, dy: 0 },
      { building: 'well', dx: -3, dy: 9 },
      { building: 'constructionPost', dx: -5, dy: 5 },
      { building: 'lab', dx: 4, dy: 5, delivered: { wood: 14, stone: 3 } },
    ],
    town: { wood: 40, stone: 30, food: 12, water: 12 },
    bag: { wood: 6, stone: 4 },
    adam: { dx: 1, dy: 4 },
  },
  /**
   * Le labo fini à côté d'Adam, et de quoi payer la Fonderie en ville : on
   * la lance, on transfère, et la forge entre au menu de construction.
   */
  lab: {
    label: 'Labo',
    seed: 100,
    buildings: [{ building: 'lab', dx: 4, dy: 5 }],
    town: { wood: 40, stone: 30, ironOre: 12, food: 12, water: 12 },
    bag: {},
    adam: { dx: 3, dy: 4 },
  },
  /**
   * La maison du forestier au sud-est de la mairie, son carré d'herbe nue : on
   * regarde le forestier le planter rang par rang, puis les pousses grandir.
   */
  forest: {
    label: 'Forestier',
    seed: 100,
    buildings: [{ building: 'foresterHouse', dx: 7, dy: 10 }],
    town: { wood: 40, stone: 30, food: 12, water: 12 },
    bag: {},
    adam: { dx: 5, dy: 8 },
  },
  /**
   * La ferme au sud-est de la mairie, son champ d'herbe nue : on regarde ses
   * fermiers semer case par case, les cultures pousser, puis la récolte
   * rentrer au coffre.
   */
  farm: {
    label: 'Ferme',
    seed: 100,
    buildings: [{ building: 'farm', dx: 7, dy: 10 }],
    town: { wood: 40, stone: 30, food: 12, water: 12 },
    bag: {},
    adam: { dx: 5, dy: 8 },
  },
  /**
   * Le soir tombe sur une base de dix ouvriers — bûcherons, bâtisseurs,
   * logisticiens — et une seule Maison de quatre lits : quatre vont s'y
   * coucher, les six autres dorment dehors devant leur travail. On pose une
   * Maison de plus, et le compte des logés monte.
   */
  housing: {
    label: 'Maisons',
    seed: 100,
    buildings: [
      { building: 'lumberCamp', dx: -6, dy: 0 },
      { building: 'constructionPost', dx: -5, dy: 5 },
      { building: 'logisticsPost', dx: 6, dy: 0 },
      { building: 'home', dx: 6, dy: 2 },
    ],
    town: { wood: 40, stone: 30, food: 40, water: 40 },
    bag: { wood: 12, stone: 6 },
    adam: { dx: 1, dy: 4 },
    dusk: true,
  },
  /**
   * Une nurserie vide dans le rayon d'un poste de logistique, et de la
   * nourriture à la mairie : on regarde les logisticiens la lui porter,
   * son stock monter, puis l'enfant naître.
   */
  nursery: {
    label: 'Nurserie',
    seed: 100,
    buildings: [
      { building: 'logisticsPost', dx: 6, dy: 0 },
      { building: 'nursery', dx: 5, dy: 5 },
    ],
    town: { wood: 40, stone: 30, food: 30, water: 20 },
    bag: {},
    adam: { dx: 2, dy: 5 },
  },
  /**
   * Adam à l'orée de la base mutante la plus proche, l'arc cerclé de fer au
   * poing : son chef, ses gardiens et son cracheur l'attendent. On esquive
   * le cercle de la massue et les crachats, on abat le chef, le bouclier
   * tombe, puis la base.
   */
  raid: {
    label: 'Base mutante',
    seed: 100,
    buildings: [],
    town: { wood: 40, stone: 30, food: 12, water: 12 },
    bag: {},
    adam: { dx: 1, dy: 4 },
    gear: 1,
    nearBase: 10,
  },
} as const satisfies Record<string, TestScenarioProto>;

export type TestScenarioId = keyof typeof TEST_SCENARIOS;

/** Le scénario que `/test` ouvre sans précision. */
export const DEFAULT_TEST_SCENARIO: TestScenarioId = 'base';
