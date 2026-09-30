/**
 * La clinique : là où les mutants assommés redeviennent des habitants.
 *
 * Un bloc jaune de la colonie, un toit plat en toile blanche, et son accent,
 * que nul autre bâtiment ne porte : une **croix menthe** sur un grand
 * médaillon blanc, au-dessus de la porte. Pour la vie : des bandages qui
 * sèchent sur un fil, un brancard orange contre le mur, une plante en pot à
 * la fenêtre — une infirmerie de campagne, gaie plutôt que grave.
 *
 * Son chantier : les murs à mi-hauteur, le médaillon déjà posé sur un
 * piquet, le brancard qui attend, la croix sur le panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, flower, line, pill, rect, shadedBlock, shadedCircle, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, mint, paper, orange, coral } = PALETTE;

/** La croix menthe, en trois tons, centrée en `x, y`. */
function cross(x: number, y: number, size: number): string {
  const arm = size / 3;

  return (
    rect(x - arm / 2 + 0.8, y - size / 2 + 0.8, arm, size, mint.shade, arm / 3) +
    rect(x - size / 2 + 0.8, y - arm / 2 + 0.8, size, arm, mint.shade, arm / 3) +
    rect(x - arm / 2, y - size / 2, arm, size, mint.base, arm / 3) +
    rect(x - size / 2, y - arm / 2, size, arm, mint.base, arm / 3) +
    pill(x - arm / 2 + 1, y - size / 2 + 1, arm * 0.4, size * 0.3, mint.light)
  );
}

/** Le médaillon : un disque blanc, son ombre lavande, la croix dessus. */
function medallion(x: number, y: number, r: number): string {
  return shadedCircle(x, y, r, 'paper') + cross(x, y, r * 1.2);
}

/** Le brancard : une toile orange sur deux barres, posé contre le mur. */
function stretcher(x: number, y: number): string {
  return line(x, y + 7, x + 18, y + 7, ink.base) + rect(x + 2, y, 14, 6, orange.shade, RADIUS.small) + rect(x + 2, y, 14, 4.5, orange.base, RADIUS.small);
}

/** Le fil à linge et ses bandages qui sèchent. */
function bandages(x: number, y: number): string {
  return (
    line(x, y, x + 16, y - 4, ink.base) +
    rect(x + 2, y - 1, 4, 8, paper.shade, 2) +
    rect(x + 2, y - 1, 4, 6.5, paper.base, 2) +
    rect(x + 9, y - 3, 4, 10, paper.shade, 2) +
    rect(x + 9, y - 3, 4, 8.5, paper.base, 2)
  );
}

function clinic(): string {
  return (
    shadedBlock(5, 52, 54, 38, 9, 'yellow') +
    // Le toit plat, une toile blanche tendue qui déborde un peu.
    rect(2, 44, 60, 14, paper.shade, RADIUS.large) +
    rect(2, 44, 60, 11, paper.base, RADIUS.large) +
    pill(7, 46, 20, 3.5, paper.shade) +
    medallion(32, 40, 10) +
    windowPane(10, 64, 13, 11, 'yellow') +
    // La plante en pot, sur le rebord.
    rect(13, 73, 7, 5, coral.shade, RADIUS.small) +
    flower(16.5, 71, 'coral') +
    door(33, 68, 13, 18) +
    bandages(46, 64) +
    stretcher(6, 82) +
    circle(52, 88, 2, coral.light)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(6, 66, 52, 22, 7, 'yellow') +
    scaffold(8, 52, 22, 14) +
    // Le médaillon attend sur son piquet que le toit soit posé.
    line(44, 50, 44, 66, ink.base) +
    medallion(44, 44, 7) +
    stretcher(24, 82) +
    siteClutter(W, H) +
    siteSign(4, 50, cross(11, 55, 7))
  );
}

export const CLINIC_SPRITE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, clinic()),
    damaged: svg(W, H, clinic(), damageMarks(5, 52, 54, 38)),
  },
} satisfies SpriteProto;
