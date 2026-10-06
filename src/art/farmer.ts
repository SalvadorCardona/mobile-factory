/**
 * Le fermier de la ferme.
 *
 * Il dérive du porteur : même humain, même taille, la tunique orange de la
 * famille. Ce qui le distingue du forestier au premier coup d'œil : **la
 * salopette** cyan à bretelles, **le chapeau de paille** au ruban corail
 * piqué d'une fleur, et **le panier** d'osier à la hanche, d'où dépassent
 * deux épis.
 *
 * La binette est un morceau à part, pivot dans la main, comme la bêche du
 * forestier : le rendu la fait gratter la terre à chaque coup, quand il
 * sème comme quand il récolte. La récolte rentre au coffre sur sa tête,
 * comme la charge d'un porteur (`load.<objet>`).
 */

import { PALETTE, flower, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, hoe, humanBody, idleParts, scaledAround, type Facing, type IdleLook } from './people.ts';
import { loadParts } from './worker.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme le porteur. */
const GROUND = 38.4;
/** La taille d'un porteur. */
const SCALE = 0.8;
/** La main qui tient la binette, en pixels du cadre : le pivot du coup. */
const HAND: readonly [number, number] = [20, 31];

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { yellow, coral, cyan, orange } = PALETTE;

/** Le chapeau de paille : un bord large aplati, la calotte ronde, le ruban corail et sa fleur. */
function hat(facing: Facing): string {
  const shift = facing === 'side' ? 1 : 0;

  return (
    pill(4 + shift, 7.5, 24, 4.2, yellow.shade) +
    pill(4 + shift, 7, 24, 3, yellow.base) +
    rect(10.5 + shift, 2, 11, 7, yellow.base, 5) +
    pill(10.5 + shift, 6.2, 11, 2, coral.base) +
    (facing === 'up' ? '' : pill(12.5 + shift, 2.8, 4, 1.5, yellow.light) + flower(20 + shift, 6.8, 'paper', 0.45))
  );
}

/** La salopette : la bavette et ses deux bretelles sur la tunique ; de dos, les bretelles croisées. */
function overalls(facing: Facing): string {
  switch (facing) {
    case 'down':
      return (
        rect(11.5, 25, 9, 10, cyan.shade, 3) +
        rect(11.5, 25, 9, 8.5, cyan.base, 3) +
        pill(12.5, 25.8, 3.5, 1.4, cyan.light) +
        line(12.5, 21.5, 13, 26, cyan.shade) +
        line(19.5, 21.5, 19, 26, cyan.shade) +
        rect(14.5, 28.5, 3, 2.5, cyan.shade, 1)
      );
    case 'up':
      return line(12, 21.5, 20, 30, cyan.shade) + line(20, 21.5, 12, 30, cyan.shade) + rect(10.5, 30, 11, 5, cyan.shade, 3);
    case 'side':
      return rect(14, 25, 7, 10, cyan.shade, 3) + rect(14, 25, 7, 8.5, cyan.base, 3) + line(17, 21.5, 17, 26, cyan.shade);
  }
}

/** Le panier d'osier à la hanche : deux épis qui dépassent, l'anse au trait, le tressage en deux bandes claires. */
function basket(facing: Facing): string {
  if (facing === 'up') return '';

  const x = facing === 'side' ? 7 : 4;
  const y = 28;

  return (
    line(x + 4.5, y + 0.5, x + 4.5, y - 4, yellow.shade) +
    pill(x + 3.4, y - 6.5, 2.4, 4, yellow.base) +
    line(x + 7, y + 0.5, x + 8, y - 3, yellow.shade) +
    pill(x + 7, y - 5.5, 2.4, 3.6, yellow.base) +
    rect(x, y, 11, 7.5, orange.shade, 3) +
    rect(x, y, 11, 6, yellow.shade, 3) +
    pill(x + 1.5, y + 1.6, 8, 1.4, yellow.base) +
    pill(x + 1.5, y + 3.8, 8, 1.4, yellow.base)
  );
}

/** Le corps d'adulte, avant réduction ; `look` : les bras levés ou le bâillement d'une pose de glande. */
function figure(facing: Facing, look: IdleLook = {}): string {
  return humanBody(facing, { ...OPTIONS, ...look }) + overalls(facing) + hat(facing) + basket(facing);
}

function body(facing: Facing): string {
  return svg(W, H, scaledAround(16, GROUND, SCALE, figure(facing)));
}

export const FARMER = {
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
    hoe: svg(W, H, hoe(...HAND)),
    // La récolte rapportée au coffre, posée sur le chapeau.
    ...loadParts(1.5),
  },
  pivots: { hoe: HAND },
} satisfies SpriteProto;
