/**
 * La bulle « malheureux » : au-dessus d'un habitant qui a trop dormi dehors,
 * et qui traîne les pieds.
 *
 * La bulle de « affamé » et de « assoiffé », en corail — ça presse —, sa
 * pointe vers la tête, et dedans un visage rond qui fait la moue : les
 * sourcils en accent circonflexe, la bouche à l'envers, une larme cyan. Le rendu la fait
 * flotter.
 */

import { PALETTE, circle, curve, line, pill, polygon, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 26;
const H = 28;
const { coral, skin, ink, cyan } = PALETTE;

export const UNHAPPY = {
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
      // Le visage : sa face avant, le dessus, un reflet.
      circle(13, 11.6, 7.4, skin.shade),
      circle(12.7, 11, 6.9, skin.base),
      pill(8.6, 6.4, 3.4, 1.6, skin.light),
      // Les sourcils relevés au milieu, les yeux, la moue.
      line(8.6, 8.8, 11, 7.4, ink.base),
      line(17, 8.8, 14.6, 7.4, ink.base),
      circle(10.4, 11, 1, ink.base),
      circle(15.4, 11, 1, ink.base),
      curve('M10 16 Q12.9 13.4 15.8 16', ink.base),
      // La larme.
      circle(9.2, 14.6, 1.3, cyan.base),
    ),
  },
} satisfies SpriteProto;
