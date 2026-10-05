/**
 * La bulle « affamé » : au-dessus d'un habitant qui n'a plus rien mangé
 * depuis trop longtemps, pour qu'on le repère de loin dans la foule.
 *
 * La bulle de « en pause », en corail — ça presse —, sa pointe vers la tête,
 * et dedans l'épi jaune de la nourriture, sur ses deux feuilles. Le rendu la
 * fait flotter.
 */

import { PALETTE, cushion, line, pill, polygon, rect, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 26;
const H = 28;
const { coral, yellow, mint } = PALETTE;

export const HUNGRY = {
  width: W,
  height: H,
  /** La pointe de la bulle tombe sur le point de position. */
  anchorX: 0.5,
  anchorY: 1,
  parts: {
    bubble: svg(
      W,
      H,
      polygon([9, 20, 17, 20, 13, 27], coral.shade),
      shadedPill(1, 1, 24, 22, 3, 'coral'),
      // L'épi : sa face avant, le dessus, un reflet ; deux feuilles au pied.
      rect(10, 3.5, 6, 12, yellow.shade, 3),
      rect(10, 3.5, 5.2, 10.5, yellow.base, 2.6),
      pill(11.1, 5, 1.8, 4.5, yellow.light),
      cushion(9, 15.5, 6.5, 4.5),
      cushion(16.5, 15.5, 6.5, 4.5),
      line(13, 17.5, 13, 19, mint.shade),
    ),
  },
} satisfies SpriteProto;
