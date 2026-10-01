/**
 * Un bâtisseur du poste de construction.
 *
 * Il dérive du porteur : même humain, même taille, la tunique orange de la
 * famille. Ce qui le distingue au premier coup d'œil : **le casque de
 * chantier jaune**, un dôme à visière qui brille, et **la ceinture à
 * outils** indigo, sa sacoche corail sur la hanche.
 *
 * Le marteau est un morceau à part, pivot dans la main, comme la hache du
 * bûcheron : le rendu le fait s'abattre à chaque coup quand il bâtit. La
 * charge — ce qu'il apporte de la mairie au chantier — est celle du porteur,
 * posée sur le casque.
 */

import { PALETTE, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { hammer, foot, humanBody, scaledAround, type Facing } from './people.ts';
import { loadParts } from './worker.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme le porteur. */
const GROUND = 38.4;
/** La taille d'un porteur. */
const SCALE = 0.8;
/** La main qui tient le marteau, en pixels du cadre : le pivot du coup. */
const HAND: readonly [number, number] = [18.5, 33];

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { ink, coral, yellow } = PALETTE;

/** Le casque : un dôme jaune, sa visière plus sombre, un reflet en haut à gauche. */
function helmet(facing: Facing): string {
  switch (facing) {
    case 'down':
      return rect(9, 3.5, 14, 8, yellow.base, 5) + pill(7.5, 9, 17, 3, yellow.shade) + pill(11, 4.8, 5, 1.8, yellow.light) + pill(15.2, 3.5, 1.6, 6, yellow.shade);
    case 'up':
      return rect(9, 3.5, 14, 8, yellow.base, 5) + pill(8, 9.5, 16, 2.6, yellow.shade) + pill(15.2, 3.5, 1.6, 6, yellow.shade);
    case 'side':
      return rect(9.5, 3.5, 14, 8, yellow.base, 5) + pill(19, 9, 8, 2.8, yellow.shade) + pill(12, 4.8, 5, 1.8, yellow.light);
  }
}

/** La ceinture à outils : une sangle indigo à la taille, la sacoche corail sur la hanche. */
function belt(facing: Facing): string {
  switch (facing) {
    case 'down':
      return pill(10, 29, 12, 2.4, ink.base) + rect(10.5, 29.5, 4.5, 4.5, coral.shade, 1.5) + pill(11, 30, 2.5, 1.2, coral.light);
    case 'up':
      return pill(10, 29, 12, 2.4, ink.base) + rect(17, 29.5, 4.5, 4.5, coral.shade, 1.5);
    case 'side':
      return pill(11, 29, 10, 2.4, ink.base) + rect(11.5, 29.5, 4.5, 4.5, coral.shade, 1.5);
  }
}

function body(facing: Facing): string {
  return svg(W, H, scaledAround(16, GROUND, SCALE, humanBody(facing, OPTIONS) + belt(facing) + helmet(facing)));
}

export const BUILDER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down'),
    up: body('up'),
    side: body('side'),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
    hammer: svg(W, H, hammer(...HAND)),
    // Le casque rehausse la tête : la charge se pose un peu plus haut.
    ...loadParts(1.5),
  },
  pivots: { hammer: HAND },
} satisfies SpriteProto;
