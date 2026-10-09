/**
 * Le coffre de la carte : une caisse de récup d'avant la fin du monde,
 * oubliée dans l'herbe, que la vie a commencé à reprendre.
 *
 * Violette comme les ruines (`FAMILY_TONES.ruins`) — elle vient du monde
 * d'avant —, cerclée de deux bandes jaunes et d'un gros cadenas, une liane
 * qui grimpe sur le flanc et une fleur sur le couvercle.
 *
 * Morceaux, tous du même cadre :
 * - `closed` : la caisse fermée ;
 * - `box` : la caisse ouverte, sans couvercle — son fond indigo et la
 *   lumière jaune de ce qu'elle cache encore ;
 * - `empty` : la caisse ouverte une fois vidée — elle reste ainsi sur la carte ;
 * - `lid` : le couvercle fermé seul, que le rendu écrase vers sa charnière ;
 * - `lidOpen` : le couvercle relevé derrière la caisse, qui pousse depuis
 *   sa charnière — les deux font l'ouverture ;
 * - `rays` : la gerbe de lumière qui jaillit à l'ouverture, puis s'éteint.
 */

import { PALETTE, circle, flower, group, pill, rect, shadedBlock, shadedCircle, svg, vine } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 32;
const H = 36;
/** La charnière, au dos du couvercle : le couvercle bascule autour d'elle. */
const HINGE: readonly [number, number] = [16, 13];

const { ink, violet, yellow, paper } = PALETTE;

/** La caisse, sans couvercle. */
const BODY = shadedBlock(5, 16, 22, 15, 4, 'violet', 4) + pill(8.6, 16, 3, 15, yellow.shade) + pill(20.4, 16, 3, 15, yellow.shade) + pill(8.6, 16, 3, 11, yellow.base) + pill(20.4, 16, 3, 11, yellow.base);

/** La liane qui grimpe sur le flanc gauche, et sa fleur. */
const VINE = vine([4.6, 30, 5.6, 25, 4.8, 20], 2);

/** Le cadenas, sur la face avant. */
const LOCK = shadedBlock(13.4, 17.4, 5.2, 6.2, 1.6, 'yellow', 1.6) + circle(16, 19.8, 0.9, ink.base) + pill(15.6, 20, 0.8, 2, ink.base);

/** Le couvercle fermé : bombé, cerclé, une fleur posée dessus. */
const LID =
  shadedBlock(4, 9, 24, 9, 3, 'violet', 4.5) +
  pill(8.6, 9, 3, 9, yellow.shade) +
  pill(20.4, 9, 3, 9, yellow.shade) +
  pill(8.6, 9, 3, 6, yellow.base) +
  pill(20.4, 9, 3, 6, yellow.base) +
  flower(24.6, 10.4, 'coral', 0.7);

/** Le couvercle relevé, vu de dessous : son revers sombre, ses bandes, debout derrière la caisse. */
const LID_OPEN =
  rect(4, 4, 24, 10, violet.shade, 4.5) +
  rect(5.6, 5.4, 20.8, 7, ink.light, 3.5) +
  pill(8.6, 4, 3, 10, yellow.shade) +
  pill(20.4, 4, 3, 10, yellow.shade) +
  flower(24.6, 4.6, 'coral', 0.7);

/** L'intérieur ouvert : le fond indigo, et ce qui brille dedans. */
const INSIDE = rect(6.4, 13.4, 19.2, 5.6, ink.base, 2.8) + pill(9, 14.4, 14, 3, yellow.base) + pill(11, 14.8, 6, 1.4, yellow.light) + shadedCircle(21.4, 15.6, 1.5, 'yellow');

/** L'intérieur vidé : le fond indigo seul. */
const EMPTY = rect(6.4, 13.4, 19.2, 5.6, ink.base, 2.8) + pill(9, 14.4, 8, 1.6, ink.light);

/** La gerbe : des capsules jaunes en éventail depuis l'ouverture, une étoile blanche au centre. */
const RAYS =
  [-60, -30, 0, 30, 60].map((angle) => group(`rotate(${angle} 16 15)`, pill(14.6, 0, 2.8, 11, yellow.light))).join('') +
  circle(16, 12, 3, yellow.base) +
  circle(16, 12, 1.6, paper.base);

export const CHEST = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 31 / H,
  parts: {
    closed: svg(W, H, BODY, VINE, LID, LOCK),
    box: svg(W, H, BODY, INSIDE, VINE, LOCK),
    empty: svg(W, H, BODY, EMPTY, VINE, LOCK),
    lid: svg(W, H, LID),
    lidOpen: svg(W, H, LID_OPEN),
    rays: svg(W, H, RAYS),
  },
  pivots: { lid: HINGE, lidOpen: HINGE, rays: [16, 15] },
} satisfies SpriteProto;
