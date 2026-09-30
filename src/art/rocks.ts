/**
 * Les rochers : pierre, fer, charbon.
 *
 * Trois couleurs distinctes, pour qu'on sache d'un coup d'œil ce qu'on va
 * casser, et aucune n'est le violet des ruines (`FAMILY_TONES`) :
 * - **pierre** en corail, une fleur a poussé dessus ;
 * - **fer** en cyan, clouté de pépites claires ;
 * - **charbon** en indigo, aux facettes luisantes.
 *
 * Même construction pour les trois : deux capsules en trois tons, la seconde
 * devant la première, un caillou détaché. Entamé, il ne reste que l'avant.
 *
 * Cadre 40 × 40 ; le pied est à (20, 34), l'ancre.
 */

import { PALETTE, circle, flower, leaf, pill, shadedPill, svg, type Tone } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 40;
const H = 40;
const BASE_X = 20;
const BASE_Y = 34;

type Detail = (full: boolean) => string;

function boulder(tone: Tone, detail: Detail, full: boolean): string {
  return svg(
    W,
    H,
    full ? shadedPill(4, 11, 26, 23, 7, tone) : '',
    shadedPill(full ? 18 : 10, full ? 17 : 19, full ? 18 : 20, full ? 17 : 15, 5, tone),
    shadedPill(full ? 3 : 4, 27, 8, 7, 2.5, tone),
    detail(full),
  );
}

const stoneDetail: Detail = (full) =>
  full ? flower(13, 12, 'yellow') + leaf(13, 15, 200, 0.8) : flower(21, 17, 'yellow');

const ironDetail: Detail = (full) => {
  const nuggets: [number, number, number][] = full
    ? [[12, 18, 2.6], [20, 14.5, 2], [27, 22, 2.4]]
    : [[18, 23, 2.4], [25, 25, 1.8]];

  return nuggets
    .map(([x, y, r]) => circle(x + 0.5, y + 0.5, r, PALETTE.cyan.shade) + circle(x, y, r * 0.8, PALETTE.cyan.light))
    .join('');
};

const coalDetail: Detail = (full) =>
  full
    ? pill(9, 17, 7, 2.4, PALETTE.ink.light) + pill(22, 21.5, 6, 2.2, PALETTE.ink.light) + circle(28.5, 16, 1.4, PALETTE.yellow.light)
    : pill(15, 23, 6, 2.2, PALETTE.ink.light);

function rock(tone: Tone, detail: Detail): SpriteProto & { parts: { full: string; damaged: string } } {
  return {
    width: W,
    height: H,
    anchorX: BASE_X / W,
    anchorY: BASE_Y / H,
    parts: { full: boulder(tone, detail, true), damaged: boulder(tone, detail, false) },
  };
}

export const ROCK_STONE = rock('coral', stoneDetail);
export const ROCK_IRON = rock('cyan', ironDetail);
export const ROCK_COAL = rock('ink', coalDetail);
