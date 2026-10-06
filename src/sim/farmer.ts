/**
 * Le champ d'une ferme : quelles cases ses fermiers cultivent, et dans quel
 * ordre.
 *
 * C'est le carré du forestier (`sim/forester.ts`), de `FARMERS.plot` de
 * côté : centré sur la ferme, ni l'emprise ni l'allée devant la porte, rang
 * par rang de haut en bas et de gauche à droite. Ce module ne fait rien
 * bouger — c'est `World` qui fait marcher les fermiers, comme le forestier.
 *
 * Ce qu'est chaque case — libre, semée, en pousse, mûre, ou prise par autre
 * chose (eau, sable, bâti, route, rocher, filon, arbre) — se juge dans
 * `World.farmField()`, qui connaît la carte.
 */

import type { TileCoord } from '../core/grid.ts';
import { FARMERS } from '../data/workers.ts';
import { plotOrigin, plotTiles, type Footprint } from './forester.ts';

/** Ce qu'est une case du champ : `free` se sème, `ripe` se récolte, `blocked` ne se cultivera pas tant que rien ne change. */
export type FieldState = 'free' | 'sown' | 'growing' | 'ripe' | 'blocked';

export interface FieldTile extends TileCoord {
  state: FieldState;
}

/** Le coin haut-gauche du champ. */
export function fieldOrigin(farm: Footprint): TileCoord {
  return plotOrigin(farm, FARMERS.plot);
}

/** Les cases du champ, dans l'ordre de semis : rang par rang, de gauche à droite. */
export function fieldTiles(farm: Footprint): TileCoord[] {
  return plotTiles(farm, FARMERS.plot);
}

/** Ce que la fenêtre compte : semis et pousses, cultures mûres, cases libres. */
export interface FieldCount {
  growing: number;
  ripe: number;
  free: number;
}

export function countField(tiles: readonly FieldTile[]): FieldCount {
  const count: FieldCount = { growing: 0, ripe: 0, free: 0 };

  for (const { state } of tiles) {
    if (state === 'sown' || state === 'growing') count.growing += 1;
    else if (state === 'ripe') count.ripe += 1;
    else if (state === 'free') count.free += 1;
  }
  return count;
}
