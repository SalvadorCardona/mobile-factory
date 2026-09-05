/**
 * Les mutants : une intelligence artificielle en une phrase.
 *
 * Un mutant marche droit sur la mairie. Il traverse l'eau, les arbres et les
 * rochers — c'est un mutant, il ne contourne rien — et seul le bâti l'arrête.
 * Ce qui le bloque, il le casse : un mur de foreuses ralentit une vague, il
 * ne la détourne pas. Quand il atteint la mairie, il la casse aussi.
 *
 * Pas de pathfinding : un mutant qui devrait chercher un chemin pour
 * contourner un bâtiment est un mutant qu'on peut piéger. Celui-ci ne se
 * piège pas, et c'est ce qui donne aux tours de guet un sens.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { ENEMIES, WAVES } from '../data/enemies.ts';
import type { Rng } from '../core/rng.ts';
import { facingOf, moveBox } from './motion.ts';
import type { EntityId, Mutant } from './types.ts';

/** Ce qu'un mutant a heurté ce tick : le bâtiment à casser. */
export interface MutantStep {
  blockedBy: EntityId | null;
  /** Vrai si le délai d'attaque est écoulé et qu'un coup part. */
  strikes: boolean;
}

/**
 * Un tick de mutant. `occupantAt` dit quel bâtiment occupe une tuile, s'il y
 * en a un : c'est la seule chose qui bloque un mutant.
 */
export function stepMutant(
  mutant: Mutant,
  target: { x: number; y: number },
  occupantAt: (tx: number, ty: number) => EntityId | undefined,
  stepSeconds: number,
): MutantStep {
  const proto = ENEMIES[mutant.proto];

  // Le délai court même en marchant : un mutant qui revient frappe tout de suite.
  if (mutant.attackCooldown > 0) mutant.attackCooldown -= 1;

  const dx = target.x - mutant.x;
  const dy = target.y - mutant.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 1) {
    mutant.prevX = mutant.x;
    mutant.prevY = mutant.y;
    mutant.moving = false;
    return { blockedBy: null, strikes: false };
  }

  const speed = proto.speed * TILE_SIZE * stepSeconds;
  const wantX = (dx / distance) * speed;
  const wantY = (dy / distance) * speed;
  const box = { halfW: proto.halfW, halfH: proto.halfH };
  const contact = moveBox(mutant, box, wantX, wantY, (tx, ty) => occupantAt(tx, ty) !== undefined);

  mutant.moving = mutant.x !== mutant.prevX || mutant.y !== mutant.prevY;
  mutant.facing = facingOf(wantX, wantY);

  const blockedBy = contact ? (occupantAt(contact.tx, contact.ty) ?? null) : null;

  if (blockedBy === null) return { blockedBy: null, strikes: false };

  // Le premier coup part tout de suite ; les suivants attendent la cadence.
  if (mutant.attackCooldown > 0) return { blockedBy, strikes: false };

  mutant.attackCooldown = proto.attackTicks;
  return { blockedBy, strikes: true };
}

/**
 * Un point d'apparition autour de la mairie : un angle au hasard, une
 * distance entre `minDistance` et `maxDistance` tuiles. Le tirage vient du
 * PRNG du monde, donc d'une seed — une vague est rejouable comme le reste.
 */
export function spawnPoint(rng: Rng, center: { x: number; y: number }): { x: number; y: number } {
  const angle = rng() * Math.PI * 2;
  const distance = (WAVES.minDistance + rng() * (WAVES.maxDistance - WAVES.minDistance)) * TILE_SIZE;

  return { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance };
}
