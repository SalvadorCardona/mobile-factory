/**
 * Les ouvriers de la maison des constructeurs : les porteurs.
 *
 * Pas d'A* par porteur — cent porteurs qui recalculent un chemin, c'est fini.
 * Pour commencer, la **ligne droite** : un porteur passe derrière les arbres
 * et les bâtiments, comme on contourne sans y penser, mais jamais dans l'eau.
 * Ce n'est pas le pas qui l'arrête au bord d'un lac : un job dont le trajet
 * traverserait l'eau n'est tout simplement pas créé (`clearLine`). Le jour
 * où arriveront les champs de flux, seul le corps de `walkToward()` changera.
 *
 * Ce module ne décide rien de ce qui est porté : c'est `jobs.ts`. Il fait
 * avancer un ouvrier vers un point et dit s'il y est.
 */

import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { CLINIC } from '../data/clinic.ts';
import { EX_MUTANT, PORTERS } from '../data/workers.ts';
import { facingOf } from './motion.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Patient, Worker } from './types.ts';

/** Pas d'échantillonnage d'une ligne droite, en pixels : moins d'un quart de tuile, aucun coin d'eau n'échappe. */
const LINE_STEP = TILE_SIZE / 4;

/** Vitesse de marche, en tuiles par seconde : un porteur, un ex-mutant, un patient qui boitille. */
function speedOf(walker: Worker | Patient): number {
  if (walker.kind === 'patient') return CLINIC.limpSpeed;
  return walker.exMutant ? EX_MUTANT.speed : PORTERS.speed;
}

/** Ce qu'un ouvrier porte en un voyage : un ex-mutant, plus fort, en prend davantage. */
export function carryOf(worker: Worker): number {
  return worker.exMutant ? EX_MUTANT.carry : PORTERS.carry;
}

/**
 * Avance d'un tick vers (x, y), en ligne droite. Renvoie `true` à
 * l'arrivée — le marcheur est alors posé exactement sur le point.
 */
export function walkToward(worker: Worker | Patient, x: number, y: number, stepSeconds: number): boolean {
  const dx = x - worker.x;
  const dy = y - worker.y;
  const distance = Math.hypot(dx, dy);
  const speed = speedOf(worker) * TILE_SIZE * stepSeconds;

  worker.prevX = worker.x;
  worker.prevY = worker.y;

  if (distance <= speed) {
    worker.x = x;
    worker.y = y;
    worker.moving = distance > 0;
    return true;
  }

  worker.x += (dx / distance) * speed;
  worker.y += (dy / distance) * speed;
  worker.moving = true;
  worker.facing = facingOf(dx, dy);
  return false;
}

/** Reste sur place ce tick : le rendu n'interpole plus. */
export function standStill(worker: Worker | Patient): void {
  worker.prevX = worker.x;
  worker.prevY = worker.y;
  worker.moving = false;
}

/** La ligne droite de (x0, y0) à (x1, y1) reste-t-elle hors de l'eau ? */
export function clearLine(seed: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / LINE_STEP));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const tx = floorDiv(x0 + (x1 - x0) * t, TILE_SIZE);
    const ty = floorDiv(y0 + (y1 - y0) * t, TILE_SIZE);

    if (!isWalkable(terrainAt(seed, tx, ty))) return false;
  }
  return true;
}
