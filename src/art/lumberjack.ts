/**
 * Un bûcheron de la cabane.
 *
 * Il dérive du porteur : même humain, même taille, la tunique orange de la
 * famille. Ce qui le distingue au premier coup d'œil : **la chemise à
 * carreaux** — des bandes corail croisées sur la tunique —, **la barbe**
 * indigo, et **la hache** qu'il tient toujours en main, le fer cyan à
 * hauteur d'épaule.
 *
 * La hache est un morceau à part, pivot dans la main : le rendu la fait
 * s'abattre à chaque coup. La charge — le bois qu'il rapporte — est celle du
 * porteur, posée sur la tête.
 */

import { PALETTE, pill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { axe, foot, humanBody, humanParts, type Facing, type IdleLook, type SexLook } from './people.ts';
import { loadParts } from './worker.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme le porteur. */
const GROUND = 38.4;
/** La taille d'un porteur. */
const SCALE = 0.8;
/** La main qui tient la hache, en pixels du cadre : le pivot du coup. */
const HAND: readonly [number, number] = [18.5, 33];

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { ink, coral } = PALETTE;

/** Les carreaux : deux bandes verticales et deux horizontales sur la tunique (`x` à `x + w`). */
function plaid(x: number, w: number): string {
  const band = 1.6;

  return (
    pill(x + w * 0.3, 21.5, band, 10, coral.shade) +
    pill(x + w * 0.66, 21.5, band, 10, coral.shade) +
    pill(x + 0.5, 24.5, w - 1, band, coral.base) +
    pill(x + 0.5, 28.5, w - 1, band, coral.base)
  );
}

/** La barbe, sous les yeux ; de dos, elle ne se voit pas. */
function beard(facing: Facing): string {
  switch (facing) {
    case 'down':
      return pill(11, 16.5, 10, 5, ink.base) + pill(14, 18.5, 4, 2, ink.light);
    case 'up':
      return '';
    case 'side':
      return pill(17.5, 16.2, 6.5, 4.8, ink.base);
  }
}

/** Le corps d'adulte, avant réduction ; `look` : son sexe, les bras levés ou le bâillement d'une pose de glande. */
function figure(facing: Facing, look: IdleLook & SexLook = {}): string {
  const shirt = facing === 'side' ? plaid(11, 10) : plaid(10, 12);

  // Sa grande barbe tient lieu de barbe courte : un bûcheron en a une, une bûcheronne non.
  return humanBody(facing, { ...OPTIONS, ...look, beard: false }) + shirt + (look.beard ? beard(facing) : '');
}

export const LUMBERJACK = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...humanParts(W, H, GROUND, SCALE, figure),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
    axe: svg(W, H, axe(...HAND)),
    ...loadParts(),
  },
  pivots: { axe: HAND },
} satisfies SpriteProto;
