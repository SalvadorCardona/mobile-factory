/**
 * La flaque d'où sortent les mutants : une mare vert fluo qui bouillonne.
 *
 * Le vert fluo est réservé aux mutants ; leur flaque le porte aussi, c'est
 * elle qui dit « ils arrivent par ici ». Un bord de terre retournée indigo,
 * une ellipse aplatie en trois tons dedans — le bord avant plus sombre, le
 * reflet en haut à gauche — et une bulle, que
 * le rendu pose plusieurs fois, fait monter et éclater.
 *
 * Morceaux, dans le même cadre : `pool`, la mare ; `bubble`, une bulle
 * centrée dans le cadre.
 */

import { PALETTE, ellipse, pill, shadedCircle, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 48;
const H = 24;

const { toxic, ink } = PALETTE;

export const PUDDLE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    pool: svg(
      W,
      H,
      // La terre retournée autour : indigo, comme tout ce qui serait marron. Sans elle, le vert se perd dans l'herbe.
      ellipse(24, 13, 23, 10.5, ink.base),
      ellipse(24, 13.5, 19.5, 8, toxic.shade),
      ellipse(23.5, 12.5, 18, 6.8, toxic.base),
      // Deux îlots plus sombres : la mare n'est pas une assiette.
      ellipse(30.5, 14, 4.5, 2.2, toxic.shade),
      ellipse(16, 14.5, 3, 1.6, toxic.shade),
      pill(12, 8.2, 11, 2.6, toxic.light),
    ),
    bubble: svg(W, H, shadedCircle(24, 12, 3.6, 'toxic')),
  },
} satisfies SpriteProto;
