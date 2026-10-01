/**
 * La fissure d'un bâtiment frappé sous la moitié de ses points de vie.
 *
 * Deux segments indigo en zigzag, au trait unique : le rendu la pose sur la
 * façade de n'importe quel bâtiment, et l'y laisse jusqu'à la réparation.
 */

import { PALETTE, polyline, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 14;
const H = 18;

export const CRACK = {
  width: W,
  height: H,
  /** Le bas de la fissure tombe sur le point de position. */
  anchorX: 0.5,
  anchorY: 1,
  parts: {
    zigzag: svg(W, H, polyline([10, 1, 4, 11, 8, 17], PALETTE.ink.base)),
  },
} satisfies SpriteProto;
