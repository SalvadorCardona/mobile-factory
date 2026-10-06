/**
 * Bases mutantes — contenu pur.
 *
 * Autour de la mairie, la carte place des anneaux de bases mutantes : un
 * campement de ruines, de flaques et de tonneaux, qui **tient une zone**.
 * Tant qu'une base est debout, on ne bâtit ni ne récolte dans sa zone — ni
 * Adam, ni ses bûcherons. Les mutants des vagues, eux, en sortent comme ils
 * veulent. Le premier anneau laisse la clairière libre : la ville de départ
 * s'y bâtit, filons de pierre (≤ 12 tuiles) et de fer (≤ 20) compris.
 *
 * Une base se détruit à l'arc d'Adam, mais seulement avec un **équipement
 * de niveau suffisant** (`data/gear.ts`) : en dessous, les flèches n'y font
 * rien, et le jeu le dit. Abattue, elle libère sa zone pour de bon, rapporte
 * du Prestige et lâche son butin ; elle ne revient jamais.
 *
 * Plus on s'éloigne, plus l'anneau est coriace : le niveau de la base est
 * celui de son anneau.
 *
 * Une base abrite deux sortes de mutants :
 * - ses **gardiens** ne la quittent jamais : ils flânent dans sa zone et
 *   chargent Adam dès qu'il y entre. Morts, la base les refait le jour,
 *   lentement (`guards`). Les uns cognent (`WILDLIFE.guardian`), les autres
 *   crachent de loin (`WILDLIFE.spitter`) et reculent quand on les approche ;
 * - son **chef** (`WILDLIFE.chief`, `chief`) : un gros gardien à massue,
 *   annoncé par sa barre de vie. Tant qu'il vit, la base est sous bouclier —
 *   aucune flèche ne l'entame, quel que soit l'arc. Il ne revient jamais :
 *   l'abattre est l'étape qui ouvre la base, et il paie en Prestige et en
 *   butin rare. Si Adam fuit, il rentre et regagne lentement sa vie ;
 * - ses **assaillants** (`RAIDS.proto`) sont produits le jour, à la cadence
 *   de son niveau (`raid`), jusqu'à sa capacité : ils attendent dans la
 *   base — le badge en dit le nombre — et sortent tous à la tombée de la
 *   nuit pour marcher sur la ville. Ce sont les seuls ennemis de la nuit :
 *   sans base debout, la nuit est calme.
 */

import type { EnemyId, LootTable } from './enemies.ts';
import type { SpriteId } from './sprites.ts';

/** Ce qu'une base est à son niveau. Le niveau est aussi celui de l'équipement qu'il faut pour l'entamer. */
export interface EnemyBaseLevel {
  /** Points de vie : une flèche en retire ses dégâts. */
  hp: number;
  /** Rayon de la zone tenue, en tuiles, depuis le centre de l'emprise. */
  zoneRadius: number;
  /** Prestige gagné en l'abattant. */
  prestige: number;
  /** Ce qu'elle lâche au sol en tombant (`LOOT_DROPS`). */
  loot: LootTable;
  /** Ses assaillants : quand elle commence à en produire, à quelle cadence, combien elle en garde. */
  raid: RaidSpec;
  /** Ses gardiens : combien, et le temps de jour qu'il lui faut pour en refaire un. */
  guards: GuardSpec;
  /** Son chef (`WILDLIFE.chief`) : tant qu'il vit, la base ne se laisse pas entamer. */
  chief: ChiefSpec;
}

/**
 * Le chef d'une base, à son niveau : plus la base est loin, plus il est
 * coriace. Il ne revient pas : abattu, la base perd son bouclier pour de bon.
 */
export interface ChiefSpec {
  hp: number;
  /** Points de vie retirés à Adam par coup de massue, au contact. */
  damage: number;
  /** Points de vie retirés à Adam s'il reste dans le cercle du coup de zone (`CHIEF`). */
  slamDamage: number;
  /** Prestige gagné en l'abattant, en plus de `KILL_PRESTIGE.chief`. */
  prestige: number;
  /** Ce qu'il lâche au sol, en plus de la table de son espèce (`WILDLIFE.chief.loot`). */
  loot: LootTable;
}

/**
 * La production d'assaillants d'une base, le jour seulement.
 *
 * La cadence est en ticks de **jour** par assaillant, à la première nuit où
 * la base attaque ; elle s'accélère ensuite de `RAIDS.paceGrowth` par nuit
 * (`raidTicks`). La production est fractionnaire : une base lente met
 * plusieurs jours à en faire un, et le compte qu'elle a commencé tient d'un
 * jour à l'autre. Pleine, elle attend la nuit.
 */
export interface RaidSpec {
  /** Première nuit où elle produit des assaillants (la première vaut 1). */
  from: number;
  /** Ticks de jour par assaillant, la nuit `from`. */
  ticksPerRaider: number;
  /** Assaillants en réserve, au plus, la nuit `from` ; `RAIDS` la fait grandir. */
  capacity: number;
}

/** Les gardiens d'une base. */
export interface GuardSpec {
  /** Gardiens au corps à corps (`WILDLIFE.guardian`). */
  count: number;
  /** Cracheurs, qui tirent de loin (`WILDLIFE.spitter`). */
  spitters: number;
  /** Ticks de jour pour refaire un gardien tombé. */
  respawnTicks: number;
}

/** Un anneau : sa distance à la mairie, combien de bases s'y répartissent, et leur niveau. */
export interface EnemyBaseRing {
  /** Distance du centre de la mairie au centre des bases, en tuiles. */
  radius: number;
  count: number;
  level: number;
}

export const ENEMY_BASE = {
  label: 'Base mutante',
  description:
    'Un campement de ruines et de flaques fluo. Tant qu’il tient, personne ne bâtit ni ne récolte dans sa zone.',
  /** Emprise en tuiles : elle arrête Adam comme un bâtiment, pas les mutants. */
  width: 3,
  height: 3,
  sprite: 'enemyBase' satisfies SpriteId,
  /**
   * Distance, en tuiles, au-delà de la portée de l'arc à laquelle Adam vise
   * encore la base : il vise son centre, elle est large.
   */
  reach: 1.5,
  /** Ticks entre deux « Il vous faut un meilleur équipement » tant qu'Adam reste devant. */
  resistTicks: 20 * 4,
  /** Écart maximal, en tuiles, entre la place idéale d'une base et celle où elle se pose. */
  search: 4,
} as const;

/** Par niveau : `ENEMY_BASE_LEVELS[level - 1]`. */
export const ENEMY_BASE_LEVELS = [
  {
    hp: 60,
    zoneRadius: 8,
    prestige: 10,
    loot: [
      { item: 'ironPlate', min: 2, max: 4, chance: 1 },
      { item: 'mutantGoo', min: 1, max: 3, chance: 1 },
    ],
    // Onze bases au premier anneau, un assaillant tous les deux jours et demi chacune : quatre la première nuit.
    raid: { from: 1, ticksPerRaider: 20 * 450, capacity: 2 },
    guards: { count: 2, spitters: 1, respawnTicks: 20 * 120 },
    // Vingt-quatre flèches de l'arc de départ : une demi-minute de combat en esquivant.
    chief: {
      hp: 24,
      damage: 3,
      slamDamage: 4,
      prestige: 5,
      loot: [
        { item: 'ironPlate', min: 1, max: 2, chance: 1 },
        { item: 'mutantGoo', min: 2, max: 3, chance: 1 },
      ],
    },
  },
  {
    hp: 120,
    zoneRadius: 9,
    prestige: 25,
    loot: [
      { item: 'ironPlate', min: 4, max: 6, chance: 1 },
      { item: 'mutantGoo', min: 2, max: 4, chance: 1 },
      { item: 'wolfFang', min: 1, max: 2, chance: 0.5 },
    ],
    // Le deuxième anneau se réveille à la nuit 8, plus lent : il épaule le premier.
    raid: { from: 8, ticksPerRaider: 20 * 1200, capacity: 2 },
    guards: { count: 3, spitters: 1, respawnTicks: 20 * 150 },
    chief: {
      hp: 40,
      damage: 4,
      slamDamage: 5,
      prestige: 12,
      loot: [
        { item: 'ironPlate', min: 2, max: 3, chance: 1 },
        { item: 'mutantGoo', min: 3, max: 4, chance: 1 },
        { item: 'wolfFang', min: 1, max: 2, chance: 0.6 },
      ],
    },
  },
  {
    hp: 200,
    zoneRadius: 10,
    prestige: 50,
    loot: [
      { item: 'ironPlate', min: 6, max: 10, chance: 1 },
      { item: 'mutantGoo', min: 3, max: 5, chance: 1 },
      { item: 'radCore', min: 1, max: 1, chance: 0.5 },
    ],
    raid: { from: 12, ticksPerRaider: 20 * 1800, capacity: 2 },
    guards: { count: 4, spitters: 2, respawnTicks: 20 * 180 },
    chief: {
      hp: 60,
      damage: 5,
      slamDamage: 6,
      prestige: 25,
      loot: [
        { item: 'ironPlate', min: 3, max: 5, chance: 1 },
        { item: 'mutantGoo', min: 4, max: 6, chance: 1 },
        { item: 'radCore', min: 1, max: 1, chance: 0.35 },
      ],
    },
  },
] as const satisfies readonly EnemyBaseLevel[];

/**
 * Les anneaux, du plus proche au plus loin. Leurs zones se touchent presque :
 * l'anneau forme une limite qu'on franchit à pied, mais où l'on ne s'installe
 * pas. Le premier commence à `radius - search - zoneRadius` = 22 tuiles de la
 * mairie au plus près : le fer du foyer (≤ 20) reste hors de toute zone.
 */
export const ENEMY_BASE_RINGS = [
  { radius: 34, count: 11, level: 1 },
  { radius: 54, count: 14, level: 2 },
  { radius: 76, count: 18, level: 3 },
] as const satisfies readonly EnemyBaseRing[];

/**
 * Les assaillants, toutes bases confondues.
 *
 * La difficulté monte d'elle-même : chaque nuit, une base produit
 * `paceGrowth` fois plus vite qu'à sa première (nuit 9 : trois fois plus
 * vite qu'à la nuit 1, pour un niveau 1), et sa capacité gagne une place
 * toutes les `capacityEvery` nuits, jusqu'à `capacityMax` — le badge n'a
 * qu'un chiffre.
 */
export const RAIDS = {
  /** L'espèce que produisent les bases : le mutant des vagues. */
  proto: 'mutant' satisfies EnemyId,
  paceGrowth: 0.25,
  capacityEvery: 4,
  capacityMax: 9,
  /** Ticks entre la sortie de deux assaillants de la même base : ils passent la porte l'un après l'autre. */
  exitStagger: 10,
} as const;

/**
 * Où les gardiens se montrent : quand Adam passe à `showTiles` tuiles du
 * centre d'une base, ses gardiens sortent flâner devant ; au-delà de
 * `hideTiles`, ils rentrent — comptés, pas tués. Comme une tanière : on ne
 * fait marcher que ce qu'Adam peut croiser.
 */
export const GUARD_RANGE = {
  showTiles: 26,
  hideTiles: 34,
} as const;

/** Le niveau d'une base, borné à la table : une sauvegarde retouchée ne casse rien. */
export function enemyBaseLevel(level: number): EnemyBaseLevel {
  return ENEMY_BASE_LEVELS[Math.max(0, Math.min(ENEMY_BASE_LEVELS.length - 1, level - 1))]!;
}
