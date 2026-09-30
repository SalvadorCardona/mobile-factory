/**
 * Le vélo-cargo d'Ève : trois grille-pain et une brouette.
 *
 * Vu de profil, tourné vers la droite (le rendu le retourne quand elle va à
 * gauche) : un long cadre indigo au trait, une caisse jaune de récup à
 * l'avant — des fleurs en pot, une antenne bricolée —, un fanion corail à
 * l'arrière, et Ève en selle. Les deux roues sont des morceaux à part, que
 * le rendu fait tourner pendant qu'elle roule.
 */

import { PALETTE, RADIUS, circle, flag, flower, group, line, pill, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { eveBody } from './eve.ts';

const W = 64;
const H = 60;
/** Le sol dans le cadre : l'ancre (0.5, GROUND / H). */
const GROUND = 52;

const BACK = [14, GROUND - 7] as const;
const FRONT = [52, GROUND - 6] as const;

const { ink, orange, coral } = PALETTE;

function frame(): string {
  const y = BACK[1];

  return (
    flag(3, 26, 19, 'coral') +
    // Le cadre : la barre basse, le tube de selle, la longue barre de la caisse, la potence.
    line(BACK[0], y, 30, y - 1, ink.base) +
    line(20, y - 9, 27, y - 1, ink.base) +
    line(30, y - 1, FRONT[0], FRONT[1], ink.base) +
    line(36, y - 1, 37, 30, ink.base) +
    pill(33, 28.5, 7, 3, ink.base) +
    pill(15, 33, 10, 3, ink.light) +
    shadedBlock(40, 32, 22, 11, 3, 'yellow', RADIUS.small) +
    flower(46, 29, 'coral') +
    flower(51, 30, 'violet', 0.8) +
    line(57, 33, 59, 24, ink.base) +
    circle(59, 23.5, 1.6, coral.base) +
    // Ève en selle, le pied sur la pédale, la main au guidon.
    group('translate(4 0)', eveBody('side')) +
    line(22, 29, 34, 30, orange.shade) +
    circle(28, y, 2.5, ink.light) +
    pill(25, y - 2, 6, 3.6, ink.shade)
  );
}

/** Une roue : pneu indigo, jante lavande, deux rayons (pour qu'on la voie tourner), moyeu jaune. */
function wheel([x, y]: readonly [number, number], r: number): string {
  return (
    circle(x, y, r, ink.base) +
    circle(x, y, r - 2.2, PALETTE.paper.shade) +
    line(x - r + 2.2, y, x + r - 2.2, y, ink.base) +
    line(x, y - r + 2.2, x, y + r - 2.2, ink.base) +
    circle(x, y, 1.8, PALETTE.yellow.base)
  );
}

export const CARGO_BIKE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: GROUND / H,
  parts: {
    frame: svg(W, H, frame()),
    wheelBack: svg(W, H, wheel(BACK, 7)),
    wheelFront: svg(W, H, wheel(FRONT, 6)),
  },
  pivots: { wheelBack: BACK, wheelFront: FRONT },
} satisfies SpriteProto;
