/**
 * La bulle « en pause » : au-dessus d'un producteur que le joueur a arrêté,
 * pour qu'on voie de loin qu'il ne tourne plus — et que c'est voulu.
 *
 * La même bulle blanche que « coffre plein », sa pointe vers le toit, et
 * dedans le signe pause de l'interface : deux barres indigo en capsule. Le
 * rendu la fait flotter.
 */

import { PALETTE, pill, polygon, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 26;
const H = 28;
const { paper, ink } = PALETTE;

export const PAUSED = {
  width: W,
  height: H,
  /** La pointe de la bulle tombe sur le point de position. */
  anchorX: 0.5,
  anchorY: 1,
  parts: {
    bubble: svg(
      W,
      H,
      polygon([9, 20, 17, 20, 13, 27], paper.shade),
      shadedPill(1, 1, 24, 22, 3, 'paper'),
      // Les deux barres, leur face avant, puis un reflet.
      pill(7.5, 5.5, 4.5, 12, ink.shade),
      pill(14, 5.5, 4.5, 12, ink.shade),
      pill(7.5, 5, 4.5, 11, ink.base),
      pill(14, 5, 4.5, 11, ink.base),
      pill(8.6, 6.4, 1.6, 4, ink.light),
      pill(15.1, 6.4, 1.6, 4, ink.light),
    ),
  },
} satisfies SpriteProto;
