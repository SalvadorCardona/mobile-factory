/**
 * La nurserie : un abri chauffé où naissent les enfants.
 *
 * La maison la plus douce de la colonie : toit corail, fenêtre ronde et sa
 * jardinière, un cœur au-dessus de la porte, une couverture qui sèche sur
 * un fil et un berceau au pied du mur.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, circle, flower, line, pill, polygon, rect, shadedBlock, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, gableRoof, siteArt } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, violet, cyan } = PALETTE;

function nursery(): string {
  return (
    shadedBlock(6, 50, 52, 40, 10, 'yellow') +
    rect(44, 30, 7, 16, ink.light, 3) +
    gableRoof(2, 62, 54, 24) +
    // Fenêtre ronde et jardinière fleurie.
    circle(19, 64, 6, violet.shade) +
    pill(15.5, 60.5, 5, 2, violet.light) +
    pill(11, 71, 16, 4.5, coral.shade) +
    flower(14, 69, 'yellow') +
    flower(19, 68, 'violet') +
    flower(24, 69, 'yellow') +
    // Un cœur au-dessus de la porte.
    circle(38, 58, 2.2, coral.base) +
    circle(42.4, 58, 2.2, coral.base) +
    polygon([35.9, 58.8, 40.2, 63.4, 44.5, 58.8], coral.base) +
    door(33, 65, 14, 21) +
    // Le fil à linge et la couverture qui sèche.
    line(50, 76, 62, 70, ink.base) +
    rect(53, 72, 7, 8, cyan.base, 2) +
    // Le berceau.
    shadedPill(4, 82, 13, 8, 3, 'orange') +
    pill(6, 80.5, 8, 3, coral.light)
  );
}

export const NURSERY = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, nursery()),
    damaged: svg(W, H, nursery(), damageMarks(6, 50, 52, 40)),
  },
} satisfies SpriteProto;
