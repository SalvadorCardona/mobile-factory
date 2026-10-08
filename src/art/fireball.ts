/**
 * La boule de feu d'une base mutante.
 *
 * `fly` est la boule en vol : un cœur jaune dans une flamme orange, son
 * reflet en capsule et une langue qui s'étire vers le bas ; `ember` en fait
 * la traînée. `glow` est la lueur que la base charge avant de tirer : un
 * disque plein dans le SVG, c'est le rendu qui le fait grossir et battre en
 * transparence au-dessus du campement.
 */

import { PALETTE, circle, pill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const { orange, yellow } = PALETTE;

export const FIREBALL_SPRITE = {
  width: 20,
  height: 20,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    fly: svg(
      20,
      20,
      circle(10.8, 10.8, 7.6, orange.shade),
      circle(10, 10, 7.2, orange.base),
      pill(8.4, 14.2, 3.2, 5.2, orange.shade),
      circle(10.4, 10.4, 4, yellow.base),
      pill(6, 5.6, 5, 2.4, yellow.light),
    ),
    ember: svg(20, 20, circle(10, 10, 3.2, orange.shade), circle(9.6, 9.6, 2.6, orange.base)),
    glow: svg(20, 20, circle(10, 10, 9, yellow.base)),
  },
} satisfies SpriteProto;
