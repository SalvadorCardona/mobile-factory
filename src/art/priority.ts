/**
 * La pastille de priorité de travail : au coin haut droit d'un bâtiment qui
 * emploie, quand le joueur l'a sortie de Moyenne. Rien pour Moyenne.
 *
 * Un petit disque, une flèche indigo dedans : jaune de la colonie et flèche
 * vers le haut pour Haute, blanc et flèche vers le bas pour Basse. Discrète :
 * plus petite que les bulles d'état, loin de la pancarte.
 */

import { PALETTE, pill, polygon, shadedCircle, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const S = 16;
const { ink } = PALETTE;

/** La flèche vers le haut : pointe en triangle, hampe en capsule, et sa face avant. */
const up = [
  pill(6.6, 7, 2.8, 5.5, ink.shade),
  polygon([3.5, 8.2, 8, 3.2, 12.5, 8.2], ink.shade),
  pill(6.6, 6.5, 2.8, 5.2, ink.base),
  polygon([3.5, 7.7, 8, 2.8, 12.5, 7.7], ink.base),
];

/** La flèche vers le bas, même dessin retourné. */
const down = [
  pill(6.6, 4, 2.8, 5.5, ink.shade),
  polygon([3.5, 8.3, 8, 13.3, 12.5, 8.3], ink.shade),
  pill(6.6, 3.5, 2.8, 5.2, ink.base),
  polygon([3.5, 7.8, 8, 12.8, 12.5, 7.8], ink.base),
];

export const PRIORITY = {
  width: S,
  height: S,
  /** Le coin haut droit tombe sur le point de position. */
  anchorX: 1,
  anchorY: 0,
  parts: {
    high: svg(S, S, shadedCircle(8, 8, 7.5, 'yellow'), ...up),
    low: svg(S, S, shadedCircle(8, 8, 7.5, 'paper'), ...down),
  },
} satisfies SpriteProto;
