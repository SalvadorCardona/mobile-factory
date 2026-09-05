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
