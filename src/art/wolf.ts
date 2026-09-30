/**
 * Le loup indigo : un chien des bois un peu trop sûr de lui.
 *
 * Pelage **violet** en trois tons, crinière, oreilles et queue **indigo**,
 * museau clair, et un vieux collier au trait avec sa médaille jaune — il a eu
 * un maître, avant. Rapide et coriace, mais drôle plus qu'effrayant : de gros
 * yeux ronds et la langue qui dépasse.
 *
 * Morceaux : un corps par direction (face, dos, profil droit — le gauche est
 * le miroir), leur variante « touché » (yeux en croix), et une paire de
 * pattes indigo, que le rendu fait alterner au galop.
 */

import { PALETTE, circle, curve, line, pill, polygon, shadedCircle, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 36;
const H = 36;
/** Sol dans le cadre : l'ancre (0.5, 0.8333). */
const GROUND = 30;

const { ink, violet, paper, coral, yellow } = PALETTE;

function roundEye(x: number, y: number, hurt: boolean): string {
  return hurt
    ? line(x - 1.6, y - 1.6, x + 1.6, y + 1.6, ink.base) + line(x - 1.6, y + 1.6, x + 1.6, y - 1.6, ink.base)
    : circle(x, y, 2.4, paper.base) + circle(x + 0.5, y + 0.5, 1.2, ink.base);
}

/** La médaille du collier : on l'a aimé, un jour. */
function tag(x: number, y: number): string {
  return circle(x, y, 1.8, yellow.shade) + circle(x - 0.4, y - 0.4, 1.1, yellow.base);
}

function side(hurt: boolean): string {
  return svg(
    W,
    H,
    // La queue en panache, relevée derrière.
    pill(1.5, 11, 9, 5, ink.light),
    pill(1.5, 11, 4, 5, ink.base),
    // Le corps, la crinière, la tête tendue vers l'avant.
    shadedPill(6, 14, 20, 12, 3.5, 'violet'),
    pill(17, 11.5, 8, 7, ink.light),
    polygon([22, 5, 25, 1.5, 26.5, 7], ink.base),
    shadedCircle(26, 12, 6, 'violet'),
    pill(27, 12.5, 8, 5, violet.light),
    circle(34, 14, 1.6, ink.base),
    hurt ? '' : pill(29.5, 16.5, 3, 3, coral.base),
    roundEye(27.5, 10.2, hurt),
    curve('M18.5 16.5 Q22 19.5 25.5 17.5', ink.light),
    tag(23.5, 19.5),
  );
}

function down(hurt: boolean): string {
  return svg(
    W,
    H,
    pill(24, 12, 5, 11, ink.light),
    shadedPill(9, 15, 18, 12, 3.5, 'violet'),
    // Les oreilles pointues, puis la tête ronde, le museau, les yeux.
    polygon([10, 6, 11.5, 0.5, 15.5, 4.5], ink.base),
    polygon([26, 6, 24.5, 0.5, 20.5, 4.5], ink.base),
    shadedCircle(18, 9.5, 7.5, 'violet'),
    pill(13.5, 11.5, 9, 6, violet.light),
    circle(18, 12.4, 1.7, ink.base),
    roundEye(14.6, 8, hurt),
    roundEye(21.4, 8, hurt),
    hurt ? circle(18, 15.6, 1.4, ink.base) : pill(16.8, 14.5, 2.4, 3.2, coral.base),
    curve('M12.5 17 Q18 20.5 23.5 17', ink.light),
    tag(18, 20),
  );
}

function up(hurt: boolean): string {
  return svg(
    W,
    H,
    shadedPill(9, 13, 18, 13, 3.5, 'violet'),
    pill(13, 14, 10, 7, ink.light),
    polygon([10, 6, 11.5, 0.5, 15.5, 4.5], ink.base),
    polygon([26, 6, 24.5, 0.5, 20.5, 4.5], ink.base),
    shadedCircle(18, 8.5, 7, 'violet'),
    // De dos, le choc se voit aux oreilles qui se couchent : une capsule pâle entre elles.
    hurt ? pill(14, 3.5, 8, 2.6, violet.light) : '',
    // La queue en panache, qui remue vers nous.
    pill(15.5, 22, 5, 9, ink.light),
  );
}

export const WOLF = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: GROUND / H,
  parts: {
    down: down(false),
    up: up(false),
    side: side(false),
    downHurt: down(true),
    upHurt: up(true),
    sideHurt: side(true),
    /** Une patte avant et une patte arrière : deux exemplaires alternés font le galop. */
    foot: svg(W, H, pill(9, GROUND - 7, 4, 7, ink.base), pill(21, GROUND - 7, 4, 7, ink.base)),
  },
} satisfies SpriteProto;
