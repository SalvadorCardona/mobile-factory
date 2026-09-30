/**
 * La nurserie : un abri chauffé où naissent les enfants.
 *
 * La maison la plus douce de la colonie, et la plus basse : un toit en dôme
 * rose pêche — son accent, que nul autre bâtiment ne porte — posé sur des
 * murs jaunes, une fenêtre ronde et sa jardinière, un cœur au-dessus de la
 * porte, du linge d'enfant qui sèche sur un fil, un berceau et un ballon au
 * pied du mur.
 *
 * Son chantier : les murs à mi-hauteur, les arceaux du dôme au trait, le
 * berceau qui attend déjà, et le cœur sur le panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import {
  PALETTE,
  RADIUS,
  circle,
  flower,
  line,
  pill,
  polygon,
  rect,
  shadedBlock,
  shadedCircle,
  shadedPill,
  svg,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, violet, cyan, orange, skin } = PALETTE;

/** Un cœur plein, centré en `x, y`. */
function heart(x: number, y: number, r: number, color: (typeof PALETTE)['coral']['base']): string {
  return (
    circle(x - r, y, r, color) +
    circle(x + r, y, r, color) +
    polygon([x - r * 1.95, y + r * 0.4, x, y + r * 2.5, x + r * 1.95, y + r * 0.4], color)
  );
}

/** Le berceau à bascule, sa couverture. */
function cradle(x: number, y: number): string {
  return shadedPill(x, y, 14, 8, 3, 'orange') + pill(x + 2, y - 1.5, 9, 3.5, coral.light) + line(x + 2, y + 9, x + 12, y + 9, orange.shade);
}

function nursery(): string {
  return (
    shadedBlock(6, 56, 52, 34, 9, 'yellow') +
    // Le dôme : une grande capsule pêche qui déborde des murs.
    rect(1, 34, 62, 30, skin.shade, 15) +
    rect(1, 34, 62, 26, skin.base, 13) +
    pill(9, 38, 22, 5, skin.light) +
    circle(32, 34, 3, coral.base) +
    // Fenêtre ronde et jardinière fleurie.
    circle(18, 70, 5.5, violet.shade) +
    pill(14.5, 66.5, 5, 2, violet.light) +
    pill(10.5, 76, 15, 4.5, coral.shade) +
    flower(13.5, 74, 'yellow') +
    flower(18, 73, 'violet') +
    flower(22.5, 74, 'yellow') +
    // Un cœur au-dessus de la porte.
    heart(40, 64, 1.8, coral.base) +
    door(34, 70, 12, 16) +
    // Le fil à linge : une brassière et une chaussette qui sèchent.
    line(48, 72, 62, 66, ink.base) +
    rect(50, 70, 6, 7, cyan.base, 2) +
    rect(57, 67.5, 4, 6, coral.base, 1.5) +
    cradle(3, 84) +
    // Le ballon, oublié devant la porte.
    shadedCircle(52, 88, 3.5, 'coral')
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(6, 66, 52, 22, 7, 'yellow') +
    // Les arceaux du dôme, montés au trait avant la toiture.
    line(6, 64, 10, 46, ink.base) +
    line(10, 46, 22, 38, ink.base) +
    line(22, 38, 42, 38, ink.base) +
    line(42, 38, 54, 46, ink.base) +
    line(54, 46, 58, 64, ink.base) +
    line(32, 38, 32, 64, ink.base) +
    // Un premier lé de toiture pêche, posé sur l'arceau.
    rect(10, 42, 16, 8, skin.shade, RADIUS.small) +
    rect(10, 42, 16, 6, skin.base, RADIUS.small) +
    scaffold(40, 50, 18, 14) +
    cradle(22, 82) +
    siteClutter(W, H) +
    siteSign(4, 50, heart(11, 53.5, 1.7, coral.base))
  );
}

export const NURSERY = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, nursery()),
    damaged: svg(W, H, nursery(), damageMarks(6, 56, 52, 34)),
  },
} satisfies SpriteProto;
