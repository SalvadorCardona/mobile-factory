/**
 * La ferme : quelques sillons, une cabane à outils, un épouvantail.
 *
 * Le champ est de la terre ambrée (la teinte foncée du sable) en sillons,
 * clos d'une barrière au trait. Dans les coins, la cabane jaune au toit
 * corail et le tonneau d'eau cyan ; au milieu, l'épouvantail en tunique.
 * Les cultures sont un morceau à part (`crops`) : le rendu les fait onduler.
 *
 * Cadre 64 × 80 ; l'emprise occupe les 64 px du bas.
 */

import {
  GROUND,
  PALETTE,
  circle,
  cushion,
  flower,
  line,
  pill,
  railing,
  rect,
  shadedBlock,
  shadedPill,
  svg,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, siteArt } from './building.ts';

const W = 64;
const H = 80;
const FOOTPRINT = 64;

const { ink, coral, orange, yellow } = PALETTE;

/** Les sillons : quatre rangs de terre claire sur la terre foncée. */
const ROWS = [38, 48, 58, 68] as const;

function field(): string {
  return (
    rect(4, 30, 56, 46, yellow.shade, 8) +
    rect(4, 30, 56, 42, GROUND.sand.shade, 8) +
    ROWS.map((y) => pill(9, y - 2, 46, 5, GROUND.sand.base)).join('') +
    // La cabane à outils, en haut à gauche.
    shadedBlock(4, 12, 20, 20, 6, 'yellow', 4) +
    pill(2, 8, 24, 8, coral.base) +
    pill(4, 9, 8, 2.4, coral.light) +
    rect(10, 21, 7, 9, PALETTE.violet.shade, 3) +
    // Le tonneau d'eau, en haut à droite.
    shadedPill(46, 14, 13, 17, 4, 'cyan') +
    // L'épouvantail : une croix, une tunique, un chapeau.
    line(35, 12, 35, 36, ink.base) +
    line(28, 19, 42, 19, ink.base) +
    rect(31, 18, 8, 10, orange.base, 3) +
    circle(35, 13, 3.5, PALETTE.skin.base) +
    pill(30, 9, 10, 3.5, yellow.base) +
    // La barrière de devant.
    railing(4, 72, 56, 6, 8)
  );
}

function crops(): string {
  return ROWS.map((y, row) =>
    [14, 26, 38, 50]
      .map((x, i) => ((row + i) % 3 === 0 ? flower(x, y - 4, row % 2 === 0 ? 'yellow' : 'coral') : cushion(x, y - 2, 8, 5.5)))
      .join(''),
  ).join('');
}

export const FARM = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, field()),
    damaged: svg(W, H, field(), damageMarks(4, 30, 56, 42)),
    crops: svg(W, H, crops()),
  },
  pivots: { crops: [32, 72] },
} satisfies SpriteProto;
