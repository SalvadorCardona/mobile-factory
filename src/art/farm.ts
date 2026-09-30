/**
 * La ferme : quelques sillons, une cabane à outils, un épouvantail.
 *
 * Le champ est de la terre ambrée (la teinte foncée du sable) en sillons,
 * clos d'une barrière au trait. Dans les coins, la cabane jaune au toit
 * corail et le tonneau d'eau cyan ; au milieu, l'épouvantail en tunique.
 * Les cultures sont un morceau à part (`crops`) : le rendu les fait onduler.
 * La seule silhouette basse et sans toit de la colonie.
 *
 * Son chantier : le champ piqueté, deux sillons sur quatre déjà tracés, la
 * croix de l'épouvantail encore nue, les sacs de graines, et une pousse sur
 * le panneau.
 *
 * Cadre 64 × 80 ; l'emprise occupe les 64 px du bas.
 */

import {
  GROUND,
  PALETTE,
  circle,
  cushion,
  flower,
  leaf,
  line,
  pill,
  railing,
  rect,
  shadedBlock,
  shadedPill,
  svg,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

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

/** Une pousse : une tige et deux feuilles. `x, y` : le pied de la tige. */
function sprout(x: number, y: number): string {
  return line(x, y, x, y - 5, PALETTE.mint.shade) + leaf(x, y - 4, -150, 0.7) + leaf(x, y - 4, -30, 0.7);
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Deux sillons tracés, les deux autres seulement piquetés.
    ROWS.slice(0, 2).map((y) => pill(9, y - 2, 46, 5, GROUND.sand.shade)).join('') +
    ROWS.slice(2).map((y) => line(10, y, 12, y, ink.base) + line(52, y, 54, y, ink.base)).join('') +
    // La croix de l'épouvantail, pas encore habillée.
    line(35, 12, 35, 36, ink.base) +
    line(28, 19, 42, 19, ink.base) +
    // Les sacs de graines.
    shadedPill(40, 56, 9, 11, 3, 'yellow') +
    shadedPill(48, 58, 9, 10, 3, 'yellow') +
    sprout(44.5, 58) +
    // La barrière, à moitié posée.
    scaffold(4, 70, 26, 6) +
    siteClutter(W, H) +
    siteSign(4, 16, sprout(11, 25))
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
    site: svg(W, H, site()),
    built: svg(W, H, field()),
    damaged: svg(W, H, field(), damageMarks(4, 30, 56, 42)),
    crops: svg(W, H, crops()),
  },
  pivots: { crops: [32, 72] },
} satisfies SpriteProto;
