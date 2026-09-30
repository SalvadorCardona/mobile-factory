/**
 * Un ex-mutant : un mutant soigné à la clinique, devenu habitant et porteur.
 *
 * C'est un humain — la tunique orange de la famille — et il se lit comme
 * tel au premier coup d'œil. Mais la clinique n'a pas tout effacé : il lui
 * reste une **touffe vert fluo** sur le crâne, un œil qui louche, et un
 * pansement sur la joue. Le vert des mutants, sur un humain, en un seul
 * détail : c'est l'exception à la réserve de la teinte, validée pour lui
 * seul (`docs/art-direction.md`).
 *
 * Plus grand qu'un porteur (il porte plus lourd), sans bandeau : la touffe
 * suffit à le reconnaître. Sa charge se porte sur la tête, comme un porteur.
 */

import { PALETTE, circle, group, pill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, humanBody, scaledAround, type Facing } from './people.ts';
import { loadParts } from './worker.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;
/** Plus grand qu'un porteur (0,8), moins qu'Adam : il a gardé sa carrure. */
const SCALE = 0.9;
/** La charge, posée sur la touffe. */
const LOAD_TOP = 0;

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { toxic, paper, ink } = PALETTE;

/** La touffe fluo : trois mèches en capsule qui se dressent sur le crâne, penchées vers `lean`. */
function tuft(x: number, lean: number): string {
  const lock = (dx: number, h: number, angle: number): string =>
    group(`translate(${x + dx} 6) rotate(${angle + lean})`, pill(-1.4, -h, 2.8, h + 1, toxic.shade), pill(-1.4, -h, 2.2, h, toxic.base));

  return lock(-2.5, 4, -25) + lock(0, 5.5, 0) + lock(2.5, 4, 25);
}

/** L'œil qui louche : plus grand que l'autre, la pupille tournée vers le nez. */
function squint(x: number, y: number, towardX: number): string {
  return circle(x, y, 2.2, paper.base) + circle(x + towardX, y + 0.4, 1.1, ink.base);
}

/** Un pansement sur la joue. */
function plaster(x: number, y: number): string {
  return pill(x, y + 0.4, 4.5, 2.4, paper.shade) + pill(x, y, 4.5, 2.2, paper.base);
}

function marks(facing: Facing): string {
  switch (facing) {
    case 'down':
      return tuft(16, 0) + squint(18.6, 14.8, -0.9) + plaster(10, 16.5);
    case 'up':
      return tuft(16, 0);
    case 'side':
      return tuft(15, -10) + squint(20.8, 14.4, 0.9) + plaster(17.5, 16.8);
  }
}

function body(facing: Facing): string {
  return svg(W, H, scaledAround(16, GROUND, SCALE, humanBody(facing, OPTIONS) + marks(facing)));
}

export const EX_MUTANT_SPRITE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down'),
    up: body('up'),
    side: body('side'),
    foot: svg(W, H, foot(GROUND, 'ink', 0.95)),
    ...loadParts(LOAD_TOP),
  },
} satisfies SpriteProto;
