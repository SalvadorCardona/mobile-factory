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
 */

import type { LootTable } from './enemies.ts';
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

/** Le niveau d'une base, borné à la table : une sauvegarde retouchée ne casse rien. */
export function enemyBaseLevel(level: number): EnemyBaseLevel {
  return ENEMY_BASE_LEVELS[Math.max(0, Math.min(ENEMY_BASE_LEVELS.length - 1, level - 1))]!;
}
