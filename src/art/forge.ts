/**
 * La forge : un four de pierre jaune colonie et sa haute cheminée.
 *
 * Un bloc trapu aux murs jaunes, la gueule du four en arche indigo où
 * brûle un feu orange et jaune, et la cheminée indigo — la couleur du
 * charbon, son accent — qui dépasse du toit et fume en petits nuages
 * blancs. Au pied, l'enclume, un tas de charbon et deux plaques de fer
 * cyan déjà forgées : on voit ce qui entre et ce qui sort.
 *
 * Son chantier : le four à mi-hauteur, le pied de la cheminée sous son
 * échafaudage, les briques qui attendent, et une flamme sur le panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, pill, rect, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, orange, yellow, paper } = PALETTE;

/** La cheminée, de `top` jusqu'au toit. */
function chimney(top: number): string {
  return (
    rect(40, top, 13, 58 - top, ink.shade, RADIUS.small) +
    rect(40, top, 10, 56 - top, ink.base, RADIUS.small) +
    pill(42, top + 4, 3, Math.max(4, (56 - top) * 0.4), ink.light) +
    pill(38, top - 2, 17, 6, ink.shade) +
    pill(38, top - 2, 17, 4, ink.light)
  );
}

/** La fumée : trois nuages blancs qui s'éloignent du haut de la cheminée. */
function smoke(): string {
  return (
    circle(47, 10, 5, paper.shade) +
    circle(46, 9, 4, paper.base) +
    circle(55, 6, 4, paper.shade) +
    circle(54.5, 5.5, 3.2, paper.base) +
    circle(60, 3.5, 2.5, paper.base)
  );
}

/** La gueule du four et son feu. */
function furnace(): string {
  return (
    rect(14, 60, 22, 22, ink.base, 11) +
    rect(16, 64, 18, 18, ink.light, 9) +
    circle(25, 77, 7, orange.base) +
    circle(25, 78, 4.5, yellow.base) +
    circle(24, 78.5, 2, yellow.light)
  );
}

/** Le fruit du travail : deux plaques de fer rivetées, empilées. */
function plates(x: number, y: number): string {
  return (
    shadedBlock(x, y + 4, 15, 7, 3, 'cyan', RADIUS.small) +
    shadedBlock(x + 2, y, 15, 7, 3, 'cyan', RADIUS.small) +
    circle(x + 5, y + 2, 1, ink.base) +
    circle(x + 14, y + 2, 1, ink.base)
  );
}

function forge(): string {
  return (
    chimney(16) +
    shadedBlock(3, 44, 52, 46, 9, 'yellow') +
    // Le toit plat, un ton plus foncé, et la cheminée qui le traverse.
    rect(1, 40, 56, 9, yellow.shade, RADIUS.small) +
    rect(1, 40, 56, 6, yellow.base, RADIUS.small) +
    pill(5, 41, 14, 2.4, yellow.light) +
    rect(40, 38, 13, 8, ink.base, RADIUS.small) +
    smoke() +
    furnace() +
    // L'enclume à gauche, le charbon et les plaques à droite.
    pill(2, 86, 13, 4, ink.base) +
    rect(6, 89, 5, 5, ink.shade, 2) +
    circle(40, 88, 3, ink.base) +
    circle(44, 89.5, 2.6, ink.shade) +
    circle(41.5, 86, 2, ink.light) +
    plates(46, 82) +
    lifeAt(38, 80, 22)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Le four monte : les murs à mi-hauteur, la gueule déjà voûtée.
    shadedBlock(3, 64, 52, 26, 7, 'yellow') +
    rect(14, 70, 22, 16, ink.base, 11) +
    // Le pied de la cheminée, sous son échafaudage.
    rect(40, 44, 13, 26, ink.shade, RADIUS.small) +
    rect(40, 44, 10, 24, ink.base, RADIUS.small) +
    scaffold(36, 40, 22, 20) +
    // Les briques de la cheminée attendent.
    shadedBlock(24, 86, 10, 6, 2, 'ink', 2) +
    siteClutter(W, H) +
    siteSign(6, 40, circle(13, 46, 3.5, orange.base) + circle(13, 47, 2, yellow.base))
  );
}

export const FORGE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, forge()),
    damaged: svg(W, H, forge(), damageMarks(3, 44, 52, 46)),
  },
} satisfies SpriteProto;
