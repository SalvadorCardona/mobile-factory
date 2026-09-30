/**
 * Le crabe des ruines : faible, nombreux, et vexé qu'on marche sur sa plage.
 *
 * Il se lit à trois choses : une carapace **corail** en capsule large, deux
 * yeux ronds au bout de pédoncules indigo, et deux grosses pinces **orange**
 * levées de chaque côté, comme pour se plaindre. Sur la carapace pousse une
 * petite fleur : la vie reprend ses droits jusque sur son dos.
 *
 * Vu de dessus, de face, toujours : un crabe ne se retourne pas, il file de
 * côté. Les morceaux : le corps et sa variante « touché » (yeux en croix,
 * bouche en O), les pattes — un peigne de trois, que le rendu pose de part
 * et d'autre et fait trottiner — et les pinces, que le rendu fait claquer à
 * l'attaque autour de leur pivot.
 */

import { PALETTE, circle, curve, flower, line, pill, shadedCircle, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 32;
const H = 32;
/** Sol dans le cadre : l'ancre (0.5, 0.8125). */
const GROUND = 26;

const { ink, coral, paper } = PALETTE;

/** Un œil au bout de son pédoncule. */
function stalkEye(x: number, top: number, hurt: boolean): string {
  const eye = hurt
    ? line(x - 1.6, top - 1.6, x + 1.6, top + 1.6, ink.base) + line(x - 1.6, top + 1.6, x + 1.6, top - 1.6, ink.base)
    : circle(x, top, 2.6, paper.base) + circle(x + 0.5, top + 0.6, 1.2, ink.base);

  return line(x, top + 2, x, 15, ink.light) + eye;
}

function body(hurt: boolean): string {
  return svg(
    W,
    H,
    // La carapace en trois tons, la fleur sur le dos, puis les yeux et la bouche.
    shadedPill(7, 13, 18, 12, 3.5, 'coral'),
    pill(10, 21.5, 12, 2.4, coral.light),
    flower(22, 15.5, 'violet', 0.7),
    stalkEye(12.5, 8.5, hurt),
    stalkEye(19.5, 8.5, hurt),
    hurt ? circle(16, 19, 1.8, ink.base) : curve('M13.2 18.2 Q16 20.6 18.8 18.2', ink.base),
  );
}

/** Trois pattes courtes, empilées : le rendu en pose un peigne de chaque côté de la carapace. */
function legs(): string {
  return svg(W, H, pill(11, 18.5, 10, 2.6, coral.shade), pill(11, 21, 10, 2.6, coral.shade), pill(11, 23.5, 10, 2.6, coral.shade));
}

/** Les deux pinces, levées de part et d'autre au bout d'un bras au trait ; la mâchoire est une capsule claire. */
function claws(): string {
  const claw = (cx: number): string =>
    line(cx < 16 ? cx + 2 : cx - 2, 16, cx < 16 ? 9 : 23, 19, PALETTE.orange.shade) +
    shadedCircle(cx, 13, 4.2, 'orange') +
    pill(cx - 2.4, 9.8, 4.8, 2.2, PALETTE.orange.light);

  return svg(W, H, claw(4.5), claw(27.5));
}

export const CRAB = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: GROUND / H,
  parts: {
    down: body(false),
    downHurt: body(true),
    foot: legs(),
    claws: claws(),
  },
  pivots: { claws: [16, 18] },
} satisfies SpriteProto;
