/**
 * Les arcs et leurs flèches.
 *
 * Toutes les armes du jeu sont automatiques : elles cherchent le mutant le
 * plus proche à portée et tirent dès que leur délai est écoulé. Adam porte
 * la sienne en permanence ; la tour de guet en porte une plus longue.
 *
 * Une flèche est une ligne droite tirée vers la position du mutant au
 * moment du tir : pas d'anticipation. Un mutant lent et une flèche rapide
 * suffisent à ce qu'elle touche presque toujours, et la rater de temps en
 * temps fait partie du charme.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import { ENEMIES } from '../data/enemies.ts';
import { WEAPONS, type WeaponId } from '../data/weapons.ts';
import type { Arrow, Mutant } from './types.ts';

/** Le mutant le plus proche de (x, y) à moins de `range` tuiles, ou `null`. */
export function nearestMutant(
  mutants: Iterable<Mutant>,
  x: number,
  y: number,
  range: number,
): Mutant | null {
  const limit = range * TILE_SIZE;
  let best: Mutant | null = null;
  let bestSq = limit * limit;

  for (const mutant of mutants) {
    const sq = distanceSq(x, y, mutant.x, mutant.y);

    if (sq <= bestSq) {
      bestSq = sq;
      best = mutant;
    }
  }
  return best;
}

/** Fabrique une flèche partant de (x, y) vers la cible. L'id est donné par le monde. */
export function shoot(id: number, weapon: WeaponId, x: number, y: number, target: { x: number; y: number }): Arrow {
  const proto = WEAPONS[weapon];
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy) || 1;
  const pixelsPerTick = (proto.arrowSpeed * TILE_SIZE) / 20;
  // La flèche vole un peu plus loin que la portée : la cible bouge.
  const ttl = Math.ceil(((proto.range + 1) * TILE_SIZE) / pixelsPerTick);

  return {
    kind: 'arrow',
    id,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'right',
    moving: true,
    vx: (dx / distance) * pixelsPerTick,
    vy: (dy / distance) * pixelsPerTick,
    ttl,
    damage: proto.damage,
  };
}

/**
 * Un tick de flèche : avance, et renvoie le mutant touché s'il y en a un.
 * `null` si elle vole encore ; `ttl` à zéro si elle s'est perdue.
 */
export function stepArrow(arrow: Arrow, mutants: Iterable<Mutant>): Mutant | null {
  arrow.prevX = arrow.x;
  arrow.prevY = arrow.y;
  arrow.x += arrow.vx;
  arrow.y += arrow.vy;
  arrow.ttl -= 1;

  for (const mutant of mutants) {
    const proto = ENEMIES[mutant.proto];

    // La boîte du mutant est basse (ses pieds) ; la flèche vise son corps,
    // qu'on prend deux fois plus haut que la boîte.
    if (
      Math.abs(arrow.x - mutant.x) <= proto.halfW + 2 &&
      arrow.y >= mutant.y - proto.halfH * 3 &&
      arrow.y <= mutant.y + proto.halfH
    ) {
      return mutant;
    }
  }
  return null;
}
