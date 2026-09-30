/**
 * La maison des constructeurs : un dortoir pour quatre ouvriers.
 *
 * Murs jaunes de la colonie, toit plat en bâche cyan lestée de pierres
 * corail, une cheminée, l'enseigne au marteau au-dessus de la porte, des
 * planches et une pelle au pied du mur — on y vit, on y travaille.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, circle, line, pill, rect, shadedBlock, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, lifeAt, planks, siteArt } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, orange, cyan } = PALETTE;

function house(): string {
  return (
    shadedBlock(4, 46, 56, 44, 11, 'yellow') +
    // Cheminée, puis la bâche qui déborde, et ses pierres de lest.
    rect(44, 26, 8, 18, ink.light, 3) +
    pill(43, 25, 10, 4, ink.base) +
    shadedBlock(0, 34, 64, 18, 6, 'cyan') +
    circle(10, 38, 2.4, coral.base) +
    circle(54, 38, 2.4, coral.base) +
    windowPane(10, 58, 11, 12, 'yellow') +
    door(27, 60, 12, 26) +
    // L'enseigne : un marteau sur une planche.
    rect(40, 57, 17, 8, orange.base, 3) +
    line(44, 61, 53, 61, ink.base) +
    rect(49, 58.5, 5, 5, ink.base, 1.5) +
    planks(42, 82, 18) +
    line(58, 62, 60, 84, ink.base) +
    pill(57, 82, 5, 5, cyan.shade) +
    lifeAt(6, 86, 30)
  );
}

export const BUILDER_HOUSE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, house()),
    damaged: svg(W, H, house(), damageMarks(4, 46, 56, 44)),
  },
} satisfies SpriteProto;
