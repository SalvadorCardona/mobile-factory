/**
 * Le patient : un mutant vaincu que la clinique peut accueillir.
 *
 * Toujours un mutant — la peau vert fluo, la tête bosselée, le bras trop
 * long — mais plus menaçant du tout, et sans halo : on l'a calmé.
 *
 * - `dazed` : assommé, affalé sur son derrière, les yeux en croix et la
 *   langue pendante ; le rendu fait tourner au-dessus de lui les `stars` ;
 * - `down`, `up`, `side` : il suit Adam en boitillant, un pansement en croix
 *   collé sur sa bosse — il sait déjà où il va.
 *
 * Très cartoon, jamais glauque : pas de sang, pas de plaie, des étoiles.
 */

import { PALETTE, group, pill, polygon, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { mutantFigure } from './mutant.ts';
import { foot, type Facing } from './people.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;

const { paper, yellow, coral } = PALETTE;

/** Un pansement en croix, collé de travers, centré en `x, y`. */
function plaster(x: number, y: number): string {
  const strip = (angle: number): string =>
    group(`translate(${x} ${y}) rotate(${angle})`, pill(-4, -1.1, 8, 3.2, paper.shade), pill(-4, -1.6, 8, 2.8, paper.base));

  return strip(40) + strip(-40);
}

/** Où tombe la bosse du mutant, selon la direction : c'est elle qu'on a pansée. */
const BUMP: Record<Facing, readonly [number, number]> = {
  down: [21.5, 7.5],
  up: [10.5, 7.5],
  side: [11, 7],
};

function limping(facing: Facing): string {
  const [x, y] = BUMP[facing];

  return svg(W, H, mutantFigure(facing, false), plaster(x, y));
}

/** Affalé : le même mutant, tassé sur le sol, sonné, la langue qui pend. */
function dazed(): string {
  return svg(
    W,
    H,
    group(`translate(16 ${GROUND}) scale(1.15 0.78) translate(-16 ${-GROUND})`, mutantFigure('down', true)),
    pill(14.6, 22.6, 3, 4, coral.base),
  );
}

/** Une étoile à cinq branches, en deux tons, centrée en `x, y`. */
function star(x: number, y: number, r: number): string {
  const points = (dx: number, dy: number): number[] =>
    Array.from({ length: 10 }, (_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? r : r * 0.45;

      return [x + dx + Math.cos(angle) * radius, y + dy + Math.sin(angle) * radius];
    }).flat();

  return polygon(points(0.6, 0.8), yellow.shade) + polygon(points(0, 0), yellow.base);
}

/** Trois étoiles en ronde : le rendu les fait tourner au-dessus de la tête. */
function stars(): string {
  return svg(W, H, star(16, 2.5, 3.2), star(23.4, 10.5, 2.6), star(8.6, 10.5, 2.6));
}

export const PATIENT = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: limping('down'),
    up: limping('up'),
    side: limping('side'),
    dazed: dazed(),
    stars: stars(),
    foot: svg(W, H, foot(GROUND, 'toxic')),
  },
  pivots: { stars: [16, 8] },
} satisfies SpriteProto;
