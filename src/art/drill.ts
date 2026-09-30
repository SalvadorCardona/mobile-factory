/**
 * La foreuse : un derrick de récupération sur sa dalle.
 *
 * Un treillis indigo au trait qui monte au-dessus de l'emprise, la roue de
 * poulie en haut, le moteur orange à gauche, un tonneau cyan et un tas de
 * pierre corail à droite, la tige plongée dans son trou. La roue est un
 * morceau à part (`wheel`) : le rendu la fait tourner quand la foreuse
 * travaille.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, circle, line, pill, rect, shadedBlock, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, siteArt } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;
const WHEEL: readonly [number, number] = [32, 13];

const { ink, yellow } = PALETTE;

function derrick(): string {
  const truss = [
    [20, 66, 29, 14],
    [44, 66, 35, 14],
    [22, 56, 42, 56],
    [24, 44, 40, 44],
    [26.5, 32, 37.5, 32],
    [28, 22, 36, 22],
    [22, 56, 40, 44],
    [24, 44, 37.5, 32],
    [26.5, 32, 36, 22],
  ] as const;

  return (
    shadedBlock(3, 60, 58, 32, 8, 'yellow') +
    pill(24, 72, 16, 6, ink.base) +
    rect(30.5, 30, 3, 44, ink.light, 1.5) +
    truss.map(([x1, y1, x2, y2]) => line(x1, y1, x2, y2, ink.base)).join('') +
    // Le moteur et son pot d'échappement.
    line(11, 62, 11, 53, ink.base) +
    shadedBlock(5, 62, 17, 16, 5, 'orange', 4) +
    // Le tonneau et le tas de pierre extraite.
    shadedPill(46, 62, 12, 17, 4, 'cyan') +
    shadedPill(40, 80, 18, 9, 3, 'coral') +
    circle(15, 67, 1.8, yellow.light)
  );
}

function wheel(): string {
  const [x, y] = WHEEL;

  return (
    circle(x, y, 6.5, ink.base) +
    circle(x, y, 4.5, ink.light) +
    line(x - 4.5, y, x + 4.5, y, ink.base) +
    line(x, y - 4.5, x, y + 4.5, ink.base) +
    circle(x, y, 2, yellow.base)
  );
}

export const DRILL = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, derrick()),
    damaged: svg(W, H, derrick(), damageMarks(3, 60, 58, 32)),
    wheel: svg(W, H, wheel()),
  },
  pivots: { wheel: WHEEL },
} satisfies SpriteProto;
