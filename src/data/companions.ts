/**
 * Compagnons — contenu pur.
 *
 * La caserne forme des compagnons qui suivent Adam : un **guerrier** qui va
 * au contact, un **archer** qui garde ses distances, un **soigneur** qui ne
 * combat pas et panse Adam comme les autres compagnons. Ce ne sont ni des
 * ouvriers ni des habitants : ils ne mangent pas, ne dorment pas, ne
 * comptent pas dans la population — une petite escorte, au plus
 * `COMPANIONS.max`, qui meurt quand ses points de vie tombent à zéro.
 *
 * Chaque classe est une entrée de `COMPANION_CLASSES` : points de vie,
 * dégâts, portée, vitesse, soin, coût de recrutement et temps de formation.
 */

import type { ItemId } from './items.ts';
import type { SpriteId } from './sprites.ts';

export interface CompanionClassProto {
  label: string;
  /** Ce que la classe fait, en une ligne : sa carte dans la fenêtre de la caserne. */
  effect: string;
  /** Sprite du compagnon (un pantin, cf. `render/puppet.ts`). */
  sprite: Extract<SpriteId, 'warrior' | 'archer' | 'healer'>;
  /** Points de vie. */
  hp: number;
  /** Vitesse de marche, en tuiles par seconde — Adam marche à 4,5. */
  speed: number;
  /** Points de vie retirés par coup ou par flèche ; 0 : ne combat pas. */
  damage: number;
  /** Portée de l'attaque, en tuiles : le corps à corps d'un guerrier, l'arc d'un archer. */
  range: number;
  /** Ticks entre deux attaques. */
  cooldown: number;
  /**
   * La distance, en tuiles, en deçà de laquelle il recule devant l'ennemi
   * (un archer) ; 0 : il va au contact.
   */
  keep: number;
  /** Points de vie rendus à chaque soin ; 0 : ne soigne pas. */
  heal: number;
  /** Ticks entre deux soins. */
  healCooldown: number;
  /** Portée du soin, en tuiles. */
  healRange: number;
  /** Ce que coûte le recrutement, payé d'un coup : le sac d'abord, puis la ville dans le rayon de la caserne. */
  cost: Partial<Record<ItemId, number>>;
  /** Ticks de formation à la caserne avant que le compagnon sorte. */
  trainTicks: number;
}

export const COMPANION_CLASSES = {
  warrior: {
    label: 'Guerrier',
    effect: 'Au corps à corps, beaucoup de points de vie.',
    sprite: 'warrior',
    hp: 14,
    speed: 4.8,
    damage: 2,
    range: 1.2,
    cooldown: 16,
    keep: 0,
    heal: 0,
    healCooldown: 0,
    healRange: 0,
    cost: { food: 6, ironPlate: 2 },
    trainTicks: 20 * 25,
  },
  archer: {
    label: 'Archer',
    effect: 'Tire de loin et garde ses distances, peu de points de vie.',
    sprite: 'archer',
    hp: 5,
    speed: 4.8,
    damage: 1,
    range: 6,
    cooldown: 18,
    keep: 3,
    heal: 0,
    healCooldown: 0,
    healRange: 0,
    cost: { food: 6, wood: 8 },
    trainTicks: 20 * 20,
  },
  healer: {
    label: 'Soigneur',
    effect: 'Ne combat pas : soigne Adam et les compagnons blessés.',
    sprite: 'healer',
    hp: 6,
    speed: 4.8,
    damage: 0,
    range: 0,
    cooldown: 0,
    keep: 0,
    heal: 1,
    healCooldown: 20 * 2,
    healRange: 5,
    cost: { food: 8, wood: 4 },
    trainTicks: 20 * 30,
  },
} as const satisfies Record<string, CompanionClassProto>;

export type CompanionClassId = keyof typeof COMPANION_CLASSES;

export const COMPANION_CLASS_IDS = Object.keys(COMPANION_CLASSES) as CompanionClassId[];

export function isCompanionClass(value: unknown): value is CompanionClassId {
  return typeof value === 'string' && Object.hasOwn(COMPANION_CLASSES, value);
}

/** La troupe : sa taille, comment elle suit, quand elle attaque. */
export const COMPANIONS = {
  /** Compagnons vivants et en formation, toutes casernes confondues : au-delà, le recrutement est refusé. */
  max: 5,
  /** Distance, en tuiles, à laquelle un compagnon se tient d'Adam au repos (rayon de la formation). */
  followGap: 1.8,
  /** Tolérance autour de sa place : il ne bouge pas tant qu'il y est à moins de cela, en tuiles. */
  settle: 0.5,
  /** Adam à plus de ces tuiles : le compagnon se téléporte à ses côtés (coincé, ou Adam réveillé à la mairie). */
  teleportRange: 14,
  /** Un ennemi n'est engagé que s'il est à moins de ces tuiles d'Adam : ensuite, le compagnon revient. */
  engageRange: 7,
  /** Un ennemi au contact d'un compagnon (en tuiles) le frappe. */
  contactRange: 0.9,
  /** Ticks passés sans avancer, loin d'Adam, avant qu'un compagnon coincé le rejoigne d'un bond. */
  stuckTicks: 40,
  /** Ticks d'immunité après un coup reçu : un seul coup par seconde, quel que soit le nombre d'assaillants. */
  hurtTicks: 20,
} as const;
