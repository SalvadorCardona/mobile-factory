/**
 * La bulle « coffre plein » : au-dessus d'une foreuse ou d'une ferme dont le
 * coffre déborde, pour qu'on voie de loin qu'elle attend qu'Adam la vide.
 *
 * Une bulle blanche comme les cartes de l'interface, sa pointe vers le toit,
 * et dedans une caisse jaune de la colonie, pleine à ras bord : un bloc de
 * fer, un épi, un galet dépassent du couvercle. Le rendu la fait flotter.
 */

import { PALETTE, circle, pill, polygon, shadedBlock, shadedCircle, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 26;
const H = 28;
const { paper, yellow, orange } = PALETTE;

export const STORE_FULL = {
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
      // Ce qui déborde : fer, épi, galet.
      shadedCircle(9, 9.5, 3.4, 'cyan'),
      pill(12, 5.5, 3.6, 8, yellow.shade),
      pill(11.8, 5.2, 3, 7, yellow.base),
      shadedCircle(17.5, 10, 3, 'coral'),
      // La caisse, par-dessus.
      shadedBlock(5, 11, 16, 8, 2.5, 'yellow', 2.5),
      pill(7, 14, 12, 1.6, orange.base),
      circle(8, 17.2, 0.9, orange.shade),
      circle(18, 17.2, 0.9, orange.shade),
    ),
  },
} satisfies SpriteProto;
