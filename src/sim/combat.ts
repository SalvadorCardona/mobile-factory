/**
 * Les arcs et leurs flèches.
 *
 * Toutes les armes du jeu sont automatiques : elles cherchent l'ennemi le
 * plus proche à portée et tirent dès que leur délai est écoulé. Adam porte
 * la sienne en permanence et vise tout ce qui l'attaque — mutants, crabes,
 * loups ; la tour de guet en porte une plus longue et ne vise que les
 * mutants, les seuls à s'en prendre au village.
 *
 * Pas de ligne de vue : la simulation n'en a pas, une flèche passe
 * au-dessus des arbres, des rochers et des murs.
 *
 * Une flèche est une ligne droite tirée vers la position du mutant au
 * moment du tir : pas d'anticipation. Un mutant lent et une flèche rapide
 * suffisent à ce qu'elle touche presque toujours, et la rater de temps en
 * temps fait partie du charme — à condition que la collision soit balayée,
 * cf. `stepArrow`.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import { ENEMIES, WILDLIFE } from '../data/enemies.ts';
import { WEAPONS, type WeaponId } from '../data/weapons.ts';
import type { Arrow, Foe } from './types.ts';

/**
 * L'ennemi le plus proche de (x, y) à moins de `range` tuiles, ou `null`.
 * À égalité, le premier rencontré : l'ordre de la map, donc déterministe.
 */
export function nearestFoe<T extends Foe>(foes: Iterable<T>, x: number, y: number, range: number): T | null {
  const limit = range * TILE_SIZE;
  let best: T | null = null;
  let bestSq = limit * limit;

  for (const foe of foes) {
    const sq = distanceSq(x, y, foe.x, foe.y);

    if (sq < bestSq || (best === null && sq === bestSq)) {
      bestSq = sq;
      best = foe;
    }
  }
  return best;
}

/** Demi-boîte d'un ennemi, en pixels monde : ses pieds. */
export function foeBox(foe: Foe): { halfW: number; halfH: number } {
  return foe.kind === 'mutant' ? ENEMIES[foe.proto] : WILDLIFE[foe.proto];
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
 * Un tick de flèche : avance, et renvoie l'ennemi touché s'il y en a un.
 * `null` si elle vole encore ; `ttl` à zéro si elle s'est perdue.
 */
export function stepArrow<T extends Foe>(arrow: Arrow, foes: Iterable<T>): T | null {
  arrow.prevX = arrow.x;
  arrow.prevY = arrow.y;
  arrow.x += arrow.vx;
  arrow.y += arrow.vy;
  arrow.ttl -= 1;

  /*
   * Test balayé, pas ponctuel. Une flèche avance de 25 px par tick ; la
   * boîte d'un mutant en fait 20 de large et 24 de haut. Tester la seule
   * position d'arrivée, c'est laisser la flèche sauter par-dessus la cible
   * une fois sur deux — l'arc d'Adam ratait un mutant immobile à trois
   * tuiles. On échantillonne donc le trajet du tick par pas de `SWEEP_STEP`.
   */
  const length = Math.hypot(arrow.vx, arrow.vy);
  const samples = Math.max(1, Math.ceil(length / SWEEP_STEP));
  const list = [...foes];

  for (let i = 1; i <= samples; i += 1) {
    const x = arrow.prevX + (arrow.vx * i) / samples;
    const y = arrow.prevY + (arrow.vy * i) / samples;

    for (const foe of list) {
      if (touches(foe, x, y)) return foe;
    }
  }
  return null;
}

/** Pas d'échantillonnage du trajet d'une flèche, en pixels : moins que la plus petite dimension d'une cible. */
const SWEEP_STEP = 6;

/**
 * La boîte d'un ennemi est basse (ses pieds) ; la flèche vise son corps,
 * qu'on prend deux fois plus haut que la boîte.
 */
function touches(foe: Foe, x: number, y: number): boolean {
  const box = foeBox(foe);

  return Math.abs(x - foe.x) <= box.halfW + 2 && y >= foe.y - box.halfH * 3 && y <= foe.y + box.halfH;
}
