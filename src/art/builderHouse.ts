/**
 * La maison des constructeurs : l'atelier et le dortoir de quatre ouvriers.
 *
 * Un atelier bas et large sous une bâche cyan — son accent — lestée de
 * pierres corail, et, qui la signe de loin, **la grue** : un mât en treillis
 * dont la flèche passe au-dessus du toit et soulève une caisse. Au mur, le
 * tableau à outils (marteau, scie) ; au pied, des planches et une pelle.
 *
 * Son chantier : la grue est déjà montée — c'est elle qui construit le
 * reste —, les murs sont à mi-hauteur, la bâche attend roulée, et le panneau
 * porte le marteau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, line, pill, rect, shadedBlock, shadedPill, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crate, damageMarks, door, lifeAt, planks, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, cyan, orange } = PALETTE;

/** Un marteau : le manche au trait, la tête en bloc. `x, y` : le haut du manche. */
function hammer(x: number, y: number): string {
  return line(x, y + 1, x, y + 8, ink.base) + rect(x - 3.5, y - 1.5, 7, 3.5, ink.base, 1.5);
}

/**
 * La grue : un mât en treillis au trait, sa flèche vers la gauche, le
 * contrepoids, le câble et ce qu'elle soulève. Le mât se dresse en `x`.
 */
function crane(x: number, top: number, foot: number, load: string): string {
  const rungs = [];

  for (let y = top + 8; y < foot - 2; y += 8) rungs.push(line(x - 3, y, x + 3, y - 6, cyan.shade));

  return (
    line(x - 3, top, x - 3, foot, ink.base) +
    line(x + 3, top, x + 3, foot, ink.base) +
    rungs.join('') +
    line(x - 32, top, x + 8, top, ink.base) +
    line(x - 3, top - 6, x - 30, top, cyan.shade) +
    line(x - 3, top - 6, x + 6, top, cyan.shade) +
    rect(x + 3, top + 1, 7, 6, ink.light, 2) +
    line(x - 26, top, x - 26, top + 12, ink.light) +
    load
  );
}

function house(): string {
  return (
    crane(50, 12, 58, crate(19, 24, 10)) +
    shadedBlock(3, 52, 58, 38, 10, 'yellow') +
    // La bâche qui déborde, et ses pierres de lest.
    shadedBlock(0, 44, 64, 14, 5, 'cyan', 6) +
    circle(8, 47, 2.4, coral.base) +
    circle(34, 46, 2.4, coral.base) +
    circle(56, 47, 2.4, coral.base) +
    windowPane(8, 62, 10, 10, 'yellow') +
    door(22, 62, 13, 24) +
    // Le tableau à outils : un marteau et une scie accrochés.
    rect(39, 61, 19, 13, orange.base, RADIUS.small) +
    pill(41, 62.5, 7, 2, orange.light) +
    hammer(44, 64) +
    rect(49.5, 65, 6, 4.5, cyan.light, 1.5) +
    line(52.5, 69, 52.5, 72, ink.base) +
    planks(40, 82, 18) +
    line(59, 64, 61, 84, ink.base) +
    pill(58, 82, 5, 5, cyan.shade) +
    lifeAt(5, 86, 26)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    crane(50, 12, 66, crate(19, 24, 10)) +
    shadedBlock(3, 66, 52, 22, 7, 'yellow') +
    scaffold(6, 54, 30, 12) +
    // La bâche roulée, prête à être tendue.
    shadedPill(12, 84, 30, 7, 2.5, 'cyan') +
    siteClutter(W, H) +
    siteSign(46, 70, hammer(53, 73))
  );
}

export const BUILDER_HOUSE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, house()),
    damaged: svg(W, H, house(), damageMarks(3, 52, 58, 38)),
  },
} satisfies SpriteProto;
