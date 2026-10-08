/**
 * La caserne : là où l'on forme les compagnons d'Adam.
 *
 * Un fortin trapu à toit plat, un bloc violet clair — la teinte du labo et de
 * la logistique reste ailleurs : ici, des **créneaux** jaunes, un **grand
 * bouclier rond** cyan à croix corail au-dessus de la porte (son accent), un
 * râtelier de lances de fortune contre le mur et un fanion. Pour la vie : des
 * fleurs dans un seau, un mannequin d'entraînement en sacs et paille.
 *
 * Son chantier : la palissade à mi-hauteur, le bouclier qui attend sur son
 * piquet, le râtelier vide.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, flag, flower, line, pill, rect, shadedBlock, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, cyan, orange, yellow, paper } = PALETTE;

/** Le bouclier rond : un disque cyan en trois tons, la croix corail dessus. */
function shield(x: number, y: number, r: number): string {
  const arm = r * 0.4;

  return (
    circle(x + 0.8, y + 0.8, r, cyan.shade) +
    circle(x, y, r, cyan.base) +
    pill(x - r * 0.6, y - r * 0.7, r * 0.7, r * 0.3, cyan.light) +
    rect(x - arm / 2, y - r * 0.7, arm, r * 1.4, coral.base, arm / 3) +
    rect(x - r * 0.7, y - arm / 2, r * 1.4, arm, coral.base, arm / 3)
  );
}

/** Le râtelier : une barre, trois lances de fortune (manche de bois, pointe cyan). */
function rack(x: number, y: number): string {
  const spear = (dx: number): string => line(x + dx, y + 16, x + dx + 1.5, y, orange.shade) + pill(x + dx - 1, y - 4, 3.4, 5.5, cyan.base);

  return pill(x - 2, y + 10, 20, 3.4, ink.base) + spear(1) + spear(8) + spear(15);
}

/** Le mannequin d'entraînement : un sac de paille sur un poteau, une cible corail. */
function dummy(x: number, y: number): string {
  return (
    line(x + 6, y + 8, x + 6, y + 22, ink.base) +
    rect(x, y, 12, 13, yellow.shade, 5) +
    rect(x, y, 12, 11, yellow.base, 5) +
    circle(x + 6, y + 5.5, 3.2, coral.base) +
    circle(x + 6, y + 5.5, 1.3, paper.base)
  );
}

function barracks(): string {
  return (
    shadedBlock(4, 50, 56, 40, 9, 'violet') +
    // Le toit plat et ses créneaux jaunes.
    rect(1, 40, 62, 13, yellow.shade, RADIUS.large) +
    rect(1, 40, 62, 10.5, yellow.base, RADIUS.large) +
    pill(6, 42, 22, 3.4, yellow.light) +
    [5, 19, 33, 47].map((x) => rect(x, 33, 11, 9, yellow.shade, 3) + rect(x, 33, 11, 7, yellow.base, 3)).join('') +
    flag(52, 14, 20, 'coral') +
    shield(32, 55, 10) +
    windowPane(9, 64, 12, 10, 'violet') +
    door(31, 68, 13, 18) +
    rack(47, 62) +
    dummy(3, 70) +
    flower(24, 88, 'coral') +
    circle(58, 88, 2, coral.light)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(6, 66, 52, 22, 7, 'violet') +
    scaffold(8, 52, 22, 14) +
    // Le bouclier attend sur son piquet que le fortin soit monté.
    line(44, 54, 44, 68, ink.base) +
    shield(44, 48, 7) +
    rack(24, 70) +
    siteClutter(W, H) +
    siteSign(4, 50, shield(11, 55, 4.5))
  );
}

export const BARRACKS = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, barracks()),
    damaged: svg(W, H, barracks(), damageMarks(4, 50, 56, 40)),
  },
} satisfies SpriteProto;
