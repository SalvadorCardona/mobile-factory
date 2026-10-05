/**
 * Le forestier de la maison du forestier.
 *
 * Il dérive du porteur : même humain, même taille, la tunique orange de la
 * famille. Ce qui le distingue au premier coup d'œil : **le chapeau de
 * paille** jaune à large bord, son ruban menthe, et **le tablier** menthe
 * du jardinier, sa poche où dépasse une pousse.
 *
 * La bêche est un morceau à part, pivot dans la main, comme la hache du
 * bûcheron : le rendu la fait s'enfoncer à chaque coup quand il plante.
 */

import { PALETTE, leaf, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, humanBody, idleParts, scaledAround, spade, type Facing, type IdleLook } from './people.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme le porteur. */
const GROUND = 38.4;
/** La taille d'un porteur. */
const SCALE = 0.8;
/** La main qui tient la bêche, en pixels du cadre : le pivot du coup. */
const HAND: readonly [number, number] = [19, 31];

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { yellow, mint } = PALETTE;

/** Le chapeau de paille : un large bord aplati, la calotte, le ruban menthe. */
function hat(facing: Facing): string {
  const shift = facing === 'side' ? 1 : 0;

  return (
    pill(5 + shift, 7.5, 22, 4, yellow.shade) +
    pill(5 + shift, 7, 22, 3, yellow.base) +
    rect(10 + shift, 1.5, 12, 7.5, yellow.base, 4) +
    pill(10 + shift, 6, 12, 2.2, mint.base) +
    (facing === 'up' ? '' : pill(12 + shift, 2.6, 4.5, 1.6, yellow.light))
  );
}

/** Le tablier : une bavette menthe sur la tunique, sa poche et la pousse qui en dépasse ; de dos, les seuls liens. */
function apron(facing: Facing): string {
  switch (facing) {
    case 'down':
      return rect(11, 22, 10, 11, mint.shade, 3) + rect(11, 22, 10, 9.5, mint.base, 3) + rect(13, 27, 6, 3.5, mint.shade, 1.5) + leaf(16, 27, -60, 0.6);
    case 'up':
      return pill(10, 25, 12, 2, mint.shade);
    case 'side':
      return rect(16, 22, 6, 11, mint.shade, 3) + rect(16, 22, 6, 9.5, mint.base, 3);
  }
}

/** Le corps d'adulte, avant réduction ; `look` : les bras levés ou le bâillement d'une pose de glande. */
function figure(facing: Facing, look: IdleLook = {}): string {
  return humanBody(facing, { ...OPTIONS, ...look }) + apron(facing) + hat(facing);
}

function body(facing: Facing): string {
  return svg(W, H, scaledAround(16, GROUND, SCALE, figure(facing)));
}

export const FORESTER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down'),
    up: body('up'),
    side: body('side'),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
    ...idleParts(W, H, GROUND, SCALE, (look) => figure('down', look)),
    spade: svg(W, H, spade(...HAND)),
  },
  pivots: { spade: HAND },
} satisfies SpriteProto;
