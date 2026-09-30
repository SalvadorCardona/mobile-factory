/**
 * Ennemis — contenu pur.
 *
 * Un mutant est un mobile : il se déplace à chaque tick, contrairement aux
 * bâtiments qui dorment entre deux réveils. Il n'a qu'une idée, la mairie,
 * et qu'un comportement : marcher droit dessus, et casser ce qui le bloque.
 *
 * Les vitesses sont en tuiles par seconde, les durées en ticks (20 par
 * seconde), les dégâts en points de vie de bâtiment.
 */

import type { ItemId } from './items.ts';
import type { SpriteId } from './sprites.ts';

export interface EnemyProto {
  label: string;
  /** Points de vie : une flèche d'arc en retire `WEAPONS.*.damage`. */
  hp: number;
  /** Tuiles par seconde. */
  speed: number;
  /** Dégâts infligés au bâtiment heurté, tous les `attackTicks`. */
  damage: number;
  attackTicks: number;
  sprite: SpriteId;
  /** Demi-largeur et demi-hauteur de la boîte de collision, en pixels monde. */
  halfW: number;
  halfH: number;
}

export const ENEMIES = {
  mutant: {
    label: 'Mutant radioactif',
    hp: 3,
    speed: 1.7,
    damage: 4,
    attackTicks: 20,
    sprite: 'mutant',
    halfW: 8,
    halfH: 6,
  },
} as const satisfies Record<string, EnemyProto>;

export type EnemyId = keyof typeof ENEMIES;

/**
 * Les vagues.
 *
 * Rien n'attaque tant que la mairie est en chantier : le joueur apprend à
 * récolter et à livrer en paix. Une fois le toit posé, la première vague part
 * après `firstDelay`, puis une toutes les `interval`. L'effectif grossit d'un
 * mutant toutes les `growEvery` vagues, jusqu'à `maxSize`.
 */
export const WAVES = {
  firstDelay: 20 * 60,
  interval: 20 * 45,
  growEvery: 2,
  maxSize: 8,
  /** Distance d'apparition depuis le centre de la mairie, en tuiles. */
  minDistance: 16,
  maxDistance: 20,
} as const;

/** Effectif de la vague numéro `wave` (la première vaut 1). */
export function waveSize(wave: number): number {
  return Math.min(WAVES.maxSize, 1 + Math.floor((wave - 1) / WAVES.growEvery));
}

/* ------------------------------------------------------------------ faune */

/**
 * La faune sauvage — une menace en plus des mutants, pas à leur place.
 *
 * Elle ne vise pas la mairie : chaque bête vit autour de sa **tanière**, un
 * point tiré de la seed dans un chunk, sur le terrain qui lui convient. Elle
 * y flâne, charge Adam s'il entre dans son rayon d'aggro, et rentre quand il
 * s'éloigne ou qu'elle s'est trop écartée de chez elle. L'arc d'Adam la vise
 * comme un mutant ; les tours de guet, non : elle ne menace pas le village.
 *
 * - `shore` : le sable, le long de l'eau. Un crabe ne le quitte jamais.
 * - `forest` : le cœur des massifs d'arbres. Un loup en sort pour charger,
 *   jamais bien loin.
 */
export type Habitat = 'shore' | 'forest';

export interface WildlifeProto {
  label: string;
  hp: number;
  /** Tuiles par seconde en flânant, et en chargeant. */
  speed: number;
  chargeSpeed: number;
  /** Points de vie retirés à Adam par coup, tous les `attackTicks`. */
  damage: number;
  attackTicks: number;
  /** Distance, en tuiles, à laquelle la bête repère Adam et charge. */
  aggroRadius: number;
  /** Au-delà de cette distance à Adam, en tuiles, elle lâche la poursuite. */
  giveUpRadius: number;
  /** Distance maximale à la tanière, en tuiles : au-delà, elle rentre. */
  leashRadius: number;
  habitat: Habitat;
  /**
   * Vrai si la bête se faufile entre les arbres et les rochers, comme un
   * mutant ; l'eau et le bâti l'arrêtent toujours. Sans ça, un loup qui
   * charge dans une forêt dense reste coincé contre le premier tronc.
   */
  throughTrees: boolean;
  /** Tirages de tanière par chunk : plus il y en a, plus l'espèce est dense. */
  densPerChunk: number;
  /** Effectif d'une tanière, bornes comprises. */
  groupMin: number;
  groupMax: number;
  /** Ticks avant qu'une tanière vidée par l'arc se repeuple. */
  respawnTicks: number;
  /** Objet ajouté au sac quand l'arc abat la bête, ou `null`. */
  loot: ItemId | null;
  sprite: SpriteId;
  halfW: number;
  halfH: number;
}

export const WILDLIFE = {
  /** Faibles et nombreux : ils pincent qui marche sur leur plage. */
  crab: {
    label: 'Crabe des ruines',
    hp: 1,
    speed: 1.1,
    chargeSpeed: 2.2,
    damage: 1,
    attackTicks: 16,
    aggroRadius: 2,
    giveUpRadius: 4,
    leashRadius: 5,
    habitat: 'shore',
    throughTrees: false,
    densPerChunk: 10,
    groupMin: 2,
    groupMax: 3,
    respawnTicks: 20 * 90,
    loot: 'food',
    sprite: 'crab',
    halfW: 8,
    halfH: 5,
  },
  /** Des meutes de deux ou trois, rapides et coriaces, au fond des bois. */
  wolf: {
    label: 'Loup indigo',
    hp: 4,
    speed: 1.6,
    chargeSpeed: 4,
    damage: 2,
    attackTicks: 20,
    aggroRadius: 5,
    giveUpRadius: 8,
    leashRadius: 9,
    habitat: 'forest',
    throughTrees: true,
    densPerChunk: 3,
    groupMin: 2,
    groupMax: 3,
    respawnTicks: 20 * 180,
    loot: null,
    sprite: 'wolf',
    halfW: 9,
    halfH: 6,
  },
} as const satisfies Record<string, WildlifeProto>;

export type WildlifeId = keyof typeof WILDLIFE;

export const WILDLIFE_IDS = Object.keys(WILDLIFE) as WildlifeId[];

/**
 * Règles d'apparition de la faune, communes aux espèces.
 *
 * Les tanières des chunks voisins de celui d'Adam sont passées en revue
 * toutes les `checkTicks` ; une tanière vide se peuple si elle est hors de
 * l'écran (`minPlayerDistance`), loin du village, et si le plafond n'est pas
 * atteint. Une bête trop loin d'Adam est rangée dans sa tanière.
 */
export const WILDLIFE_SPAWN = {
  checkTicks: 20,
  /** Chunks passés en revue autour de celui d'Adam (2 : un carré de 5 × 5). */
  chunkRadius: 2,
  /** Plafond de bêtes vivantes sur toute la carte. */
  cap: 24,
  /** Distance minimale d'Adam à la tanière, en tuiles : au-delà du bord d'un écran de téléphone. */
  minPlayerDistance: 24,
  /** Au-delà, en tuiles, une bête rentre dans sa tanière et disparaît. */
  despawnDistance: 72,
  /** Aucune tanière à moins de tant de tuiles de la mairie : le départ reste paisible. */
  townHallClearance: 20,
  /** Ni à moins de tant de tuiles d'un autre bâtiment : le village est à l'abri. */
  buildingClearance: 10,
} as const;
