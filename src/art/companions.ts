/**
 * Les compagnons d'Adam : guerrier, archer, soigneur.
 *
 * Des humains, donc la tunique orange de la famille — et ce qui dit la
 * classe d'un coup d'œil, même à 32 px, **par la silhouette** :
 *
 * - le **guerrier** est le plus large : casque cyan à cimier corail, gros
 *   bouclier rond sur le bras, et son épée, un morceau à part qui s'abat à
 *   chaque coup ;
 * - l'**archer** est le plus mince : capuchon menthe qui pointe, carquois
 *   violet dans le dos, son arc à la main (qu'il tend de profil) ;
 * - le **soigneur** est tout de blanc vêtu : surplis blanc, croix menthe sur
 *   la poitrine, bandeau menthe — la croix de la clinique.
 *
 * Les pieds sont un morceau à part, que le rendu fait alterner.
 */

import { PALETTE, circle, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { bow, foot, humanBody, humanParts, type Facing, type IdleLook, type SexLook } from './people.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { coral, cyan, mint, violet, paper, orange } = PALETTE;

/* --------------------------------------------------------------- guerrier */

/** Le casque : un dôme cyan en trois tons, le cimier corail dessus. */
function helm(facing: Facing): string {
  switch (facing) {
    case 'down':
      return (
        rect(8.5, 3, 15, 9, cyan.shade, 5) +
        rect(8.5, 3, 15, 7.4, cyan.base, 5) +
        pill(11, 4.4, 5, 1.8, cyan.light) +
        pill(14.2, 0.5, 3.6, 9, coral.base)
      );
    case 'up':
      return rect(8.5, 3, 15, 9, cyan.shade, 5) + rect(8.5, 3, 15, 7.4, cyan.base, 5) + pill(14.2, 0.5, 3.6, 9, coral.base);
    case 'side':
      return rect(9, 3, 15, 9, cyan.shade, 5) + rect(9, 3, 15, 7.4, cyan.base, 5) + pill(11.5, 4.4, 5, 1.8, cyan.light) + pill(13.5, 0.5, 9, 3.6, coral.base);
  }
}

/** Le bouclier rond au bras, croix corail. */
function buckler(facing: Facing): string {
  const disc = (x: number): string => circle(x + 0.7, 28.7, 6.2, cyan.shade) + circle(x, 28, 6.2, cyan.base) + pill(x - 3.6, 24, 4, 1.6, cyan.light) + rect(x - 1, 24.4, 2, 7.2, coral.base, 1) + rect(x - 3.6, 27, 7.2, 2, coral.base, 1);

  switch (facing) {
    case 'down':
      return disc(7);
    case 'up':
      return disc(25);
    case 'side':
      return disc(15);
  }
}

function warriorFigure(facing: Facing, look: IdleLook & SexLook = {}): string {
  return humanBody(facing, { ...OPTIONS, ...look }) + buckler(facing) + helm(facing);
}

/** L'épée, tenue en (x, y) : lame claire vers le haut, garde jaune. */
function sword(x: number, y: number): string {
  return (
    rect(x - 1.4, y - 17, 3.6, 17, paper.shade, 1.6) +
    rect(x - 1.4, y - 17, 2.6, 16, paper.base, 1.6) +
    pill(x - 4, y - 1, 9, 2.6, PALETTE.yellow.base) +
    line(x + 0.4, y + 0.5, x + 0.4, y + 4, orange.shade)
  );
}

const SWORD_HAND: readonly [number, number] = [24, 33];

/* ----------------------------------------------------------------- archer */

/** Le capuchon menthe, pointu, qui encadre le visage. */
function hood(facing: Facing): string {
  switch (facing) {
    case 'down':
      return rect(8.5, 4, 15, 9, mint.shade, 5) + rect(8.5, 4, 15, 7.4, mint.base, 5) + pill(14.4, 0.5, 3.2, 6, mint.base) + pill(11, 5.2, 5, 1.8, mint.light);
    case 'up':
      return rect(8.5, 4, 15, 9, mint.shade, 5) + rect(8.5, 4, 15, 7.6, mint.base, 5) + pill(14.4, 0.5, 3.2, 6, mint.base);
    case 'side':
      return rect(9, 4, 15, 9, mint.shade, 5) + rect(9, 4, 15, 7.4, mint.base, 5) + pill(10, 1, 7, 3.4, mint.base) + pill(12, 5.2, 5, 1.8, mint.light);
  }
}

/** Le carquois, dans le dos : un tube violet, trois empennages qui dépassent. */
function quiver(facing: Facing): string {
  const flights = (x: number): string => circle(x, 15.4, 1.5, coral.base) + circle(x + 3, 15, 1.5, paper.base) + circle(x + 6, 15.6, 1.5, coral.base);

  switch (facing) {
    case 'down':
      return pill(20, 16, 5, 14, violet.shade) + flights(17.6);
    case 'up':
      return pill(11, 17, 10, 13, violet.shade) + pill(11, 17, 8.5, 11, violet.base) + flights(12);
    case 'side':
      return pill(7, 16, 5, 14, violet.shade) + flights(4.6);
  }
}

function archerFigure(facing: Facing, look: IdleLook & SexLook = {}): string {
  const arc = facing === 'side' ? bow(23.5, 17, 37) : facing === 'down' ? bow(5, 20, 37) : '';

  return quiver(facing) + humanBody(facing, { ...OPTIONS, ...look }) + hood(facing) + arc;
}

/* -------------------------------------------------------------- soigneur */

/** Le surplis blanc par-dessus la tunique : il descend en tablier, la croix menthe dessus. */
function surplice(facing: Facing): string {
  const cross = (x: number): string => rect(x - 1.1, 23, 2.2, 7, mint.base, 1) + rect(x - 3.2, 25.2, 6.4, 2.2, mint.base, 1);

  switch (facing) {
    case 'down':
      return rect(10.5, 21, 11, 15, paper.shade, 5) + rect(10.5, 21, 11, 13, paper.base, 5) + pill(12, 22.4, 4, 1.4, paper.light) + cross(16);
    case 'up':
      return rect(10.5, 21, 11, 15, paper.shade, 5) + rect(10.5, 21, 11, 13, paper.base, 5);
    case 'side':
      return rect(11.5, 21, 9, 15, paper.shade, 4.5) + rect(11.5, 21, 9, 13, paper.base, 4.5) + cross(16);
  }
}

/** Le bandeau menthe, noué sur le front. */
function headband(facing: Facing): string {
  switch (facing) {
    case 'down':
      return pill(9.5, 8, 13, 3, mint.base) + rect(14.6, 6.6, 2.8, 6, mint.shade, 1);
    case 'up':
      return pill(9.5, 8.5, 13, 3, mint.base);
    case 'side':
      return pill(9, 8, 13.5, 3, mint.base) + pill(8, 9.5, 3, 5, mint.shade);
  }
}

function healerFigure(facing: Facing, look: IdleLook & SexLook = {}): string {
  return humanBody(facing, { ...OPTIONS, ...look }) + surplice(facing) + headband(facing);
}

/* ---------------------------------------------------------------- sprites */

export const WARRIOR = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...humanParts(W, H, GROUND, 0.88, warriorFigure),
    foot: svg(W, H, foot(GROUND, 'ink', 1)),
    sword: svg(W, H, sword(...SWORD_HAND)),
  },
  pivots: { sword: SWORD_HAND },
} satisfies SpriteProto;

export const ARCHER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...humanParts(W, H, GROUND, 0.76, archerFigure),
    foot: svg(W, H, foot(GROUND, 'ink', 0.85)),
  },
} satisfies SpriteProto;

export const HEALER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...humanParts(W, H, GROUND, 0.8, healerFigure),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
  },
} satisfies SpriteProto;
