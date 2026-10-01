/**
 * Une flèche, pointée vers la droite ; le rendu la tourne dans sa direction.
 *
 * Hampe et pointe au trait indigo, d'une seule épaisseur, empennage corail :
 * elle se voit sur l'herbe comme sur le sable. Derrière elle, le rendu pose
 * trois fois `trail`, une capsule blanche de plus en plus effacée : la
 * traînée qui dit d'où vient le tir.
 *
 * Morceaux, dans le même cadre : `fly`, la flèche ; `trail`, un segment de
 * traînée centré dans le cadre.
 */

import { PALETTE, line, pill, polygon, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const { ink, coral, paper } = PALETTE;

export const ARROW = {
  width: 32,
  height: 32,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    fly: svg(
      32,
      32,
      line(6, 16, 24, 16, ink.base),
      polygon([22, 12, 30, 16, 22, 20], ink.base),
      polygon([2, 12, 9, 16, 2, 16], coral.base),
      polygon([2, 16, 9, 16, 2, 20], coral.shade),
    ),
    trail: svg(32, 32, pill(13, 15, 6, 2, paper.base)),
  },
} satisfies SpriteProto;
