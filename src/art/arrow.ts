/**
 * Une flèche, pointée vers la droite ; le rendu la tourne dans sa direction.
 *
 * Hampe au trait indigo, pointe corail, empennage jaune : elle se voit sur
 * l'herbe comme sur le sable.
 */

import { PALETTE, line, polygon, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const { ink, coral, yellow } = PALETTE;

export const ARROW = {
  width: 32,
  height: 32,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    fly: svg(
      32,
      32,
      line(7, 16, 23, 16, ink.base),
      polygon([21, 12, 29, 16, 21, 20], coral.base),
      polygon([3, 12.5, 9, 16, 3, 16], yellow.base),
      polygon([3, 16, 9, 16, 3, 19.5], yellow.shade),
    ),
  },
} satisfies SpriteProto;
