/**
 * Les bases mutantes : où elles se posent, ce qu'elles tiennent.
 *
 * Fonctions pures : la place des bases se tire de la seed et de la mairie,
 * sans PRNG du monde — une nouvelle partie et une ancienne sauvegarde qui
 * les découvre au chargement les posent au même endroit. Le monde garde la
 * liste (`World.enemyBases`) et leurs points de vie.
 *
 * Chaque anneau (`ENEMY_BASE_RINGS`) répartit ses bases à pas régulier tout
 * autour de la mairie, décalé d'un angle tiré de la seed. Une base se pose
 * au plus près de sa place idéale, sur une emprise libre (`free` : terrain
 * constructible, ni arbre ni rocher) ; sans place à `ENEMY_BASE.search`
 * tuiles, elle n'est pas posée — l'anneau a un trou, au bord d'un lac.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import { ENEMY_BASE, ENEMY_BASE_RINGS, enemyBaseLevel } from '../data/enemyBases.ts';
import type { EnemyBase } from './types.ts';

/** Sel du décalage angulaire des anneaux. */
const RING_SALT = 0x6b43a9b5;

/**
 * Les bases de tous les anneaux, autour de `hall` (centre de la mairie, en
 * tuiles). `free(tx, ty)` : la tuile peut-elle porter une base ?
 */
export function placeEnemyBases(seed: number, hall: { x: number; y: number }, free: (tx: number, ty: number) => boolean): EnemyBase[] {
  const bases: EnemyBase[] = [];

  ENEMY_BASE_RINGS.forEach((ring, index) => {
    const offset = ((hash3(seed ^ RING_SALT, index, 0) % 3600) / 3600) * ((Math.PI * 2) / ring.count);

    for (let i = 0; i < ring.count; i += 1) {
      const angle = offset + (i / ring.count) * Math.PI * 2;
      const spot = nearestSpot(hall.x + Math.cos(angle) * ring.radius, hall.y + Math.sin(angle) * ring.radius, free);

      if (!spot) continue;
      bases.push({ id: bases.length + 1, ...spot, level: ring.level, hp: enemyBaseLevel(ring.level).hp });
    }
  });
  return bases;
}

/** L'emprise libre la plus proche de (cx, cy) — son centre idéal, en tuiles —, ou `null`. */
function nearestSpot(cx: number, cy: number, free: (tx: number, ty: number) => boolean): { tx: number; ty: number } | null {
  const { width, height, search } = ENEMY_BASE;
  const ox = Math.round(cx - width / 2);
  const oy = Math.round(cy - height / 2);
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;

  for (let dy = -search; dy <= search; dy += 1) {
    for (let dx = -search; dx <= search; dx += 1) {
      const d = dx * dx + dy * dy;

      if (d >= bestD || d > search * search) continue;
      if (!footprintFree(ox + dx, oy + dy, free)) continue;
      best = { tx: ox + dx, ty: oy + dy };
      bestD = d;
    }
  }
  return best;
}

function footprintFree(tx: number, ty: number, free: (tx: number, ty: number) => boolean): boolean {
  for (let y = ty; y < ty + ENEMY_BASE.height; y += 1) {
    for (let x = tx; x < tx + ENEMY_BASE.width; x += 1) {
      if (!free(x, y)) return false;
    }
  }
  return true;
}

/** La base est-elle encore debout ? */
export function isStanding(base: EnemyBase): boolean {
  return base.hp > 0;
}

/** Centre de l'emprise, en pixels monde. */
export function baseCenter(base: EnemyBase): { x: number; y: number } {
  return { x: (base.tx + ENEMY_BASE.width / 2) * TILE_SIZE, y: (base.ty + ENEMY_BASE.height / 2) * TILE_SIZE };
}

/** La tuile est-elle dans la zone que tient la base — morte ou vive ? */
export function inBaseZone(base: EnemyBase, tx: number, ty: number): boolean {
  const { x, y } = baseCenter(base);
  const reach = enemyBaseLevel(base.level).zoneRadius * TILE_SIZE;

  return distanceSq(x, y, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE) <= reach * reach;
}

/** La tuile est-elle sous l'emprise de la base ? */
export function onBase(base: EnemyBase, tx: number, ty: number): boolean {
  return tx >= base.tx && tx < base.tx + ENEMY_BASE.width && ty >= base.ty && ty < base.ty + ENEMY_BASE.height;
}

/**
 * Le point (x, y) frappe-t-il la base ? Son emprise, et le campement qui
 * monte au-dessus — une flèche vise son centre, elle passe par le haut.
 */
export function hitsBase(base: EnemyBase, x: number, y: number): boolean {
  const left = base.tx * TILE_SIZE;
  const top = (base.ty - 1) * TILE_SIZE;

  return x >= left && x < left + ENEMY_BASE.width * TILE_SIZE && y >= top && y < (base.ty + ENEMY_BASE.height) * TILE_SIZE;
}

/** L'arc entame-t-il cette base ? Il faut un équipement de son niveau, au moins. */
export function canDamage(base: EnemyBase, gear: number): boolean {
  return gear >= base.level;
}
