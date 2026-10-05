/**
 * La bulle « assoiffé » : au-dessus d'un habitant qui n'a plus rien bu
 * depuis trop longtemps, pour qu'on le repère de loin dans la foule.
 *
 * La bulle de « affamé », en corail — ça presse —, sa pointe vers la tête,
 * et dedans la goutte cyan de l'eau. Le rendu la fait flotter.
 */

import { PALETTE, circle, pill, polygon, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 26;
const H = 28;
const { coral, cyan } = PALETTE;

export const THIRSTY = {
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
      // La goutte : sa pointe, son ventre rond, un reflet.
      polygon([13, 3.5, 17.6, 12, 8.4, 12], cyan.shade),
      circle(13, 13.5, 5.4, cyan.shade),
      polygon([12.6, 4.5, 16.6, 11.6, 8.8, 11.6], cyan.base),
      circle(12.6, 13, 4.7, cyan.base),
      pill(9.6, 10.5, 1.8, 4.2, cyan.light),
    ),
  },
} satisfies SpriteProto;
