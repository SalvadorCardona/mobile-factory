/**
 * Le marqueur de cible : ce que l'arc d'Adam vise en ce moment.
 *
 * Discret : un anneau jaune aplati — la couleur de la colonie, donc d'Adam —
 * posé au sol sous les pieds de la cible, avec une petite pointe au-dessus
 * de la tête. Le rendu le fait respirer.
 */

import { PALETTE, polygon, ring, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const { yellow } = PALETTE;

export const TARGET = {
  width: 32,
  height: 16,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    ring: svg(32, 16, ring(16, 8.8, 14, 6, 2.6, yellow.shade), ring(16, 8, 14, 6, 2.6, yellow.base)),
    /** La pointe : un chevron qui désigne la tête. */
    pointer: svg(32, 16, polygon([11, 4, 21, 4, 16, 11], yellow.shade), polygon([11, 3, 21, 3, 16, 9.5], yellow.base)),
  },
} satisfies SpriteProto;
