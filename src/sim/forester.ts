/**
 * Le forestier : quel carré planter, et dans quel ordre.
 *
 * Ce module ne fait rien bouger — c'est `World` qui fait marcher le
 * forestier, avec `walkToward()` comme un bûcheron. Il répond à deux
 * questions : quelles cases forment la forêt d'une maison, et où se poster
 * pour planter sur l'une d'elles.
 *
 * Le carré (`FORESTERS.plot` de côté) est centré sur l'emprise de la maison.
 * Ni l'emprise ni l'allée devant la porte n'en font partie. Les cases sont
 * rendues rang par rang, de haut en bas et de gauche à droite : c'est l'ordre
 * de plantation, et la forêt se remplit proprement.
 *
 * Ce qu'est chaque case — libre, en pousse, arbre, ou prise par autre chose
 * (eau, bâti, route, rocher, filon) — se juge dans `World.forestPlot()`,
 * qui connaît la carte.
 *
 * Le champ d'une ferme est le même carré, d'un autre côté (`side`) : les
 * fermiers le sèment dans le même ordre (`sim/farmer.ts`).
 */

import { TILE_SIZE, type TileCoord } from '../core/grid.ts';
import { FORESTERS } from '../data/workers.ts';

/** Une emprise : ce qu'il faut savoir d'une maison, posée ou en fantôme. */
export interface Footprint {
  tx: number;
  ty: number;
  width: number;
  height: number;
}

/** Ce qu'est une case du carré : `free` se plante, `blocked` ne se plantera pas tant que rien ne change. */
export type PlotState = 'free' | 'sapling' | 'tree' | 'blocked';

export interface PlotTile extends TileCoord {
  state: PlotState;
}

/** Le coin haut-gauche du carré de côté `side` : centré sur l'emprise, arrondi vers le haut-gauche si les parités diffèrent. */
export function plotOrigin(house: Footprint, side: number = FORESTERS.plot): TileCoord {
  return {
    tx: house.tx - Math.floor((side - house.width) / 2),
    ty: house.ty - Math.floor((side - house.height) / 2),
  };
}

/**
 * Les cases du carré, dans l'ordre de plantation : rang par rang, de gauche
 * à droite. L'emprise et l'allée — les deux cases sous la porte — en sont exclues.
 */
export function plotTiles(house: Footprint, side: number = FORESTERS.plot): TileCoord[] {
  const origin = plotOrigin(house, side);
  const doorY = house.ty + house.height;
  const doorX = house.tx + Math.floor(house.width / 2);
  const tiles: TileCoord[] = [];

  for (let ty = origin.ty; ty < origin.ty + side; ty += 1) {
    for (let tx = origin.tx; tx < origin.tx + side; tx += 1) {
      const inside = tx >= house.tx && tx < house.tx + house.width && ty >= house.ty && ty < house.ty + house.height;
      const aisle = ty === doorY && (tx === doorX || tx === doorX - 1);

      if (!inside && !aisle) tiles.push({ tx, ty });
    }
  }
  return tiles;
}

/** La tuile est-elle dans le carré de cette maison ? */
export function inPlot(house: Footprint, tx: number, ty: number, side: number = FORESTERS.plot): boolean {
  return plotTiles(house, side).some((tile) => tile.tx === tx && tile.ty === ty);
}

/** Où se poste le forestier — ou le fermier : juste à gauche de la case, face à elle — l'outil s'enfonce de profil. */
export function plantSpot(tile: TileCoord): { x: number; y: number } {
  return { x: tile.tx * TILE_SIZE - 4, y: (tile.ty + 1) * TILE_SIZE - 5 };
}

/** Ce que la fenêtre compte : pousses, arbres adultes, cases libres. */
export interface PlotCount {
  saplings: number;
  trees: number;
  free: number;
}

export function countPlot(tiles: readonly PlotTile[]): PlotCount {
  const count: PlotCount = { saplings: 0, trees: 0, free: 0 };

  for (const { state } of tiles) {
    if (state === 'sapling') count.saplings += 1;
    else if (state === 'tree') count.trees += 1;
    else if (state === 'free') count.free += 1;
  }
  return count;
}
