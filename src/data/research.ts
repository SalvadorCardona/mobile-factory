/**
 * Recherches du labo — contenu pur.
 *
 * Une recherche = un coût, une durée, des prérequis, et un effet ou des
 * bâtiments à débloquer. Le coût
 * mêle objets communs (bois, pierre, minerai…) et butin d'ennemis (gelée de
 * mutant, croc de loup, pince de crabe, cœur de la Reine) : le combat nourrit
 * la progression.
 *
 * Le labo n'en mène qu'une à la fois. On la choisit, le labo attend son coût
 * — apporté par Adam (heurt, « Transférer » : le sac puis la ville dans son
 * rayon) ou livré par les porteurs depuis la mairie — puis le compte à
 * rebours tourne ; à la fin, l'effet vaut pour toute la partie.
 *
 * Un effet n'a pas de mécanique propre : c'est un **modificateur** ajouté à
 * une statistique (`ResearchStat`), que la simulation lit à un seul endroit,
 * `World.bonus(stat)` (`sim/research.ts`). Les données du jeu, elles, ne
 * bougent jamais.
 *
 * Une recherche peut aussi **débloquer des bâtiments** (`unlocks`) : la
 * forge et le four à charbon, la clinique. Tant qu'elle n'est pas finie, ils
 * n'apparaissent pas au menu de construction ; le labo est l'endroit où l'on
 * découvre ce qui arrive ensuite (`World.isUnlocked`).
 *
 * `validatePrototypes()` vérifie les objets, les quantités, les prérequis
 * (connus, sans cycle) et que le coffre du labo contient le plus gros coût.
 */

import type { BuildingId } from './buildings.ts';
import type { ItemId } from './items.ts';

/**
 * Ce qu'une recherche peut améliorer. Chaque statistique a une valeur de
 * base (lue dans les données par `sim/research.ts`) et s'additionne aux
 * modificateurs des recherches finies.
 */
export type ResearchStat =
  /** Points de vie retirés par une flèche de l'arc d'Adam. */
  | 'bowDamage'
  /** Ticks entre deux flèches de l'arc d'Adam (négatif : il tire plus vite). */
  | 'bowCooldown'
  /** Places du sac. */
  | 'bagCapacity'
  /** Vitesse d'Adam, en tuiles par seconde. */
  | 'walkSpeed'
  /** Objets portés en un voyage par un porteur (ex-mutants compris). */
  | 'porterCarry'
  /** Part de bois en plus à chaque passage de récolte sur un arbre. */
  | 'woodYield'
  /** Ticks entre deux minerais d'une foreuse (négatif : elle va plus vite). */
  | 'drillTicks'
  /** Nourriture par récolte d'une ferme. */
  | 'farmYield';

/**
 * Comment afficher une statistique : son libellé, son unité, et `ticks` si
 * la valeur est une durée en ticks — elle s'affiche alors en secondes.
 */
export interface ResearchStatProto {
  label: string;
  unit: string;
  ticks: boolean;
  /** Une part (0,25 → « +25 % ») plutôt qu'une quantité. */
  percent: boolean;
}

export const RESEARCH_STATS = {
  bowDamage: { label: 'Dégâts de l’arc', unit: '', ticks: false, percent: false },
  bowCooldown: { label: 'Délai entre deux flèches', unit: ' s', ticks: true, percent: false },
  bagCapacity: { label: 'Places du sac', unit: '', ticks: false, percent: false },
  walkSpeed: { label: 'Vitesse d’Adam', unit: ' cases/s', ticks: false, percent: false },
  porterCarry: { label: 'Charge d’un porteur', unit: '', ticks: false, percent: false },
  woodYield: { label: 'Bois récolté en plus', unit: '', ticks: false, percent: true },
  drillTicks: { label: 'Temps d’extraction', unit: ' s', ticks: true, percent: false },
  farmYield: { label: 'Nourriture par récolte', unit: '', ticks: false, percent: false },
} as const satisfies Record<ResearchStat, ResearchStatProto>;

/** Les thèmes du panneau : la liste se lit groupée, dans cet ordre. */
export const RESEARCH_THEMES = {
  building: 'Bâtiments',
  combat: 'Combat',
  harvest: 'Récolte',
  town: 'Ville',
} as const;

export type ResearchTheme = keyof typeof RESEARCH_THEMES;

export interface ResearchProto {
  label: string;
  /** Une ligne, sous le nom : ce que la recherche raconte. */
  description: string;
  theme: ResearchTheme;
  /** Ce qu'il faut déposer au labo avant que le compte à rebours démarre. */
  cost: Partial<Record<ItemId, number>>;
  /** Durée du compte à rebours, en ticks (20 par seconde). */
  duration: number;
  /** Recherches à finir d'abord (ids de `RESEARCH`, vérifiés par `validatePrototypes()`). */
  requires: readonly string[];
  /** Le modificateur ajouté à `stat` une fois la recherche finie, ou `null` pour une recherche qui ne fait que débloquer. */
  effect: { stat: ResearchStat; amount: number } | null;
  /** Bâtiments qui n'entrent au menu de construction qu'une fois la recherche finie. */
  unlocks: readonly BuildingId[];
  /**
   * L'ère qui l'ouvre (index de `ERAS`, `data/eras.ts`) : son onglet au labo.
   * Elle ne se lance qu'une fois la colonie arrivée à cette ère.
   */
  era: number;
}

export const RESEARCH = {
  metalworking: {
    label: 'Fonderie',
    description: 'Un creuset de pierre, un soufflet de fortune : le fer se laisse fondre.',
    theme: 'building',
    cost: { stone: 10, ironOre: 8 },
    duration: 20 * 45,
    requires: [],
    effect: null,
    unlocks: ['forge', 'charcoalKiln'],
    era: 0,
  },
  fieldMedicine: {
    label: 'Médecine de fortune',
    description: 'De la gelée de mutant sous la loupe : ce qui les change se soigne.',
    theme: 'building',
    cost: { food: 6, mutantGoo: 2 },
    duration: 20 * 45,
    requires: [],
    effect: null,
    unlocks: ['clinic'],
    era: 0,
  },
  militia: {
    label: 'Milice',
    description: 'Des lances taillées, un râtelier : de quoi former une petite escorte.',
    theme: 'building',
    cost: { wood: 10, stone: 8, wolfFang: 2 },
    duration: 20 * 45,
    requires: [],
    effect: null,
    unlocks: ['barracks'],
    era: 0,
  },
  sharpArrows: {
    label: 'Flèches à croc',
    description: 'Des crocs de loup en pointe de flèche : ça mord.',
    theme: 'combat',
    cost: { wood: 8, wolfFang: 3 },
    duration: 20 * 45,
    requires: [],
    effect: { stat: 'bowDamage', amount: 0.5 },
    unlocks: [],
    era: 0,
  },
  quickDraw: {
    label: 'Tir rapide',
    description: 'Une corde enduite de gelée de mutant : elle claque plus vite.',
    theme: 'combat',
    cost: { wood: 6, mutantGoo: 4 },
    duration: 20 * 60,
    requires: ['sharpArrows'],
    effect: { stat: 'bowCooldown', amount: -4 },
    unlocks: [],
    era: 0,
  },
  irradiatedArrows: {
    label: 'Flèches irradiées',
    description: 'Un éclat du cœur de la Reine dans chaque pointe : ça brûle.',
    theme: 'combat',
    cost: { ironPlate: 4, radCore: 1 },
    duration: 20 * 90,
    requires: ['sharpArrows'],
    effect: { stat: 'bowDamage', amount: 1 },
    unlocks: [],
    era: 0,
  },
  bigBag: {
    label: 'Sac renforcé',
    description: 'Des pinces de crabe en guise de boucles : le sac prend du ventre.',
    theme: 'town',
    cost: { wood: 8, crabClaw: 4 },
    duration: 20 * 45,
    requires: [],
    effect: { stat: 'bagCapacity', amount: 15 },
    unlocks: [],
    era: 0,
  },
  walkingBoots: {
    label: 'Bottes de marche',
    description: 'Semelles de pierre polie, tiges tressées : Adam file.',
    theme: 'town',
    cost: { stone: 6, food: 6 },
    duration: 20 * 45,
    requires: [],
    effect: { stat: 'walkSpeed', amount: 0.9 },
    unlocks: [],
    era: 0,
  },
  sturdyPorters: {
    label: 'Porteurs endurants',
    description: 'De bons repas et des hottes plus larges pour les ouvriers.',
    theme: 'town',
    cost: { food: 10, wood: 10 },
    duration: 20 * 60,
    requires: ['walkingBoots'],
    effect: { stat: 'porterCarry', amount: 2 },
    unlocks: [],
    era: 0,
  },
  sharpAxes: {
    label: 'Haches affûtées',
    description: 'Une meule de pierre et du fil de fer : chaque coup compte.',
    theme: 'harvest',
    cost: { stone: 8, ironOre: 6 },
    duration: 20 * 45,
    requires: [],
    effect: { stat: 'woodYield', amount: 0.5 },
    unlocks: [],
    era: 0,
  },
  fastDrills: {
    label: 'Foreuses rapides',
    description: 'Des mèches trempées au charbon : les foreuses creusent plus vite.',
    theme: 'harvest',
    cost: { ironOre: 10, coal: 4 },
    duration: 20 * 60,
    requires: ['sharpAxes'],
    effect: { stat: 'drillTicks', amount: -10 },
    unlocks: [],
    era: 0,
  },
  fertileFarms: {
    label: 'Fermes fertiles',
    description: 'Un engrais de gelée de mutant, dilué. Beaucoup dilué.',
    theme: 'harvest',
    cost: { food: 6, mutantGoo: 3 },
    duration: 20 * 60,
    requires: [],
    effect: { stat: 'farmYield', amount: 1 },
    unlocks: [],
    era: 0,
  },
  masonry: {
    label: 'Maçonnerie',
    description: 'Pierre concassée, feu de bois, moules de planches : la brique revient.',
    theme: 'building',
    cost: { stone: 12, wood: 12 },
    duration: 20 * 45,
    requires: [],
    effect: null,
    unlocks: ['brickworks'],
    era: 1,
  },
  handcarts: {
    label: 'Charrettes à bras',
    description: 'Deux roues de récup sous une caisse de briques : les porteurs en prennent plus.',
    theme: 'town',
    cost: { brick: 10, wood: 10 },
    duration: 20 * 60,
    requires: ['masonry'],
    effect: { stat: 'porterCarry', amount: 1 },
    unlocks: [],
    era: 1,
  },
  toolmaking: {
    label: 'Outillage',
    description: 'Un étau, une meule et des plaques de fer : on façonne ses propres outils.',
    theme: 'building',
    cost: { ironPlate: 4, brick: 10 },
    duration: 20 * 60,
    requires: [],
    effect: null,
    unlocks: ['workshop'],
    era: 2,
  },
  compositeBows: {
    label: 'Arcs composites',
    description: 'Du bois, de la corne de croc, des outils précis : l’arc mord plus fort.',
    theme: 'combat',
    cost: { tools: 4, wolfFang: 3 },
    duration: 20 * 60,
    requires: ['toolmaking'],
    effect: { stat: 'bowDamage', amount: 0.5 },
    unlocks: [],
    era: 2,
  },
  toolDrills: {
    label: 'Foreuses outillées',
    description: 'Des mèches changées à la clé, sans arrêter la roue.',
    theme: 'harvest',
    cost: { tools: 6, brick: 6 },
    duration: 20 * 60,
    requires: ['toolmaking'],
    effect: { stat: 'drillTicks', amount: -10 },
    unlocks: [],
    era: 2,
  },
  steelmaking: {
    label: 'Haut fourneau',
    description: 'Plus chaud que la forge, plus haut que la mairie : l’acier coule.',
    theme: 'building',
    cost: { tools: 8, ironPlate: 10, coal: 10 },
    duration: 20 * 90,
    requires: [],
    effect: null,
    unlocks: ['steelworks'],
    era: 3,
  },
  steelArrows: {
    label: 'Flèches d’acier',
    description: 'Des pointes d’acier trempé : plus rien ne leur résiste.',
    theme: 'combat',
    cost: { steel: 4, wood: 10 },
    duration: 20 * 90,
    requires: ['steelmaking'],
    effect: { stat: 'bowDamage', amount: 1 },
    unlocks: [],
    era: 3,
  },
  steelFrame: {
    label: 'Sac à armature',
    description: 'Une armature d’acier, des sangles neuves : le sac tient le double sans plier.',
    theme: 'town',
    cost: { steel: 3, tools: 3 },
    duration: 20 * 90,
    requires: ['steelmaking'],
    effect: { stat: 'bagCapacity', amount: 20 },
    unlocks: [],
    era: 3,
  },
} as const satisfies Record<string, ResearchProto>;

export type ResearchId = keyof typeof RESEARCH;

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

export function isResearchId(value: string): value is ResearchId {
  return Object.hasOwn(RESEARCH, value);
}
