/**
 * Les arbres : trois essences, une forêt.
 *
 * Règle de la direction : des **coussins de feuillage aplatis et empilés**
 * (base foncée, dessus menthe, reflet) sur un **tronc indigo qui se ramifie**.
 * Jamais de boule. Chaque essence a deux états : entier, et entamé — Adam en
 * a déjà arraché une partie, le houppier a fondu.
 *
 * Cadre 48 × 64 ; le pied du tronc est à (24, 58), l'ancre. L'arbre monte
 * bien au-dessus de sa tuile : c'est ce qui donne du volume à la forêt, et le
 * tri en profondeur fait passer Adam derrière lui.
 */

import {
  PALETTE,
  circle,
  cushion,
  flower,
  group,
  leaf,
  pill,
  polygon,
  rect,
  shadedBlock,
  svg,
  vine,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 48;
const H = 64;
const BASE_X = 24;
const BASE_Y = 58;

const { ink, orange, coral, yellow } = PALETTE;

/** Un tronc indigo en trois tons, évasé au pied. */
function trunk(top: number, width = 5): string {
  const x = BASE_X - width / 2;

  return (
    pill(BASE_X - 6, BASE_Y - 3.5, 12, 4, ink.base) +
    rect(x, top, width, BASE_Y - top, ink.base, width / 2) +
    rect(x + width * 0.55, top + 2, width * 0.45, BASE_Y - top - 3, ink.shade, width / 4) +
    pill(x + 0.8, top + 2, 1.4, Math.max(2, (BASE_Y - top) * 0.4), ink.light)
  );
}

/** Une branche : une capsule indigo partant de (x, y), inclinée de `angle` degrés. */
function branch(x: number, y: number, angle: number, length: number, thickness = 3): string {
  return group(`translate(${x} ${y}) rotate(${angle})`, pill(-thickness / 2, -thickness / 2, length, thickness, ink.base));
}

/** L'arrachement : une entaille claire sur le tronc et deux copeaux au pied. */
function chopped(y: number): string {
  return (
    polygon([BASE_X - 2.5, y, BASE_X + 3, y - 2.5, BASE_X + 3, y + 2.5], orange.light) +
    pill(BASE_X + 8, BASE_Y - 3, 4, 2, orange.base) +
    pill(BASE_X - 13, BASE_Y - 2, 3.5, 2, orange.shade)
  );
}

/* --------------------------------------------------------------- feuillu */

function broadleaf(full: boolean): string {
  return svg(
    W,
    H,
    trunk(34),
    branch(BASE_X, 44, -140, 12),
    branch(BASE_X, 40, -42, 12),
    full ? branch(BASE_X, 34, -95, 12) : '',
    cushion(13.5, 37, 20, 9),
    cushion(35, 34.5, 21, 9),
    full ? cushion(24, 25, 26, 10.5) + cushion(20, 15.5, 17, 8.5) + circle(31, 13, 1.8, coral.base) : '',
    full ? '' : chopped(48),
  );
}

/* ----------------------------------------------------------------- sapin */

function pine(full: boolean): string {
  const tiers = [
    [49, 30, 9],
    [40, 25, 8.5],
    [31.5, 20, 8],
    [23.5, 14, 7],
    [16.5, 8, 6],
  ] as const;
  const kept = full ? tiers : tiers.slice(0, 2);

  return svg(
    W,
    H,
    trunk(full ? 20 : 40, 4.5),
    ...kept.map(([y, w, h]) => cushion(BASE_X, y, w, h)),
    full ? '' : pill(BASE_X - 3, 34, 6, 3, orange.light) + chopped(52),
  );
}

/* ------------------------------------------------------------ arbre mort */

/**
 * L'arbre mort n'est pas triste : ses branches nues portent un nichoir jaune,
 * une liane y grimpe, et un premier coussin de feuilles repousse.
 */
function deadTree(full: boolean): string {
  if (!full) {
    return svg(
      W,
      H,
      pill(BASE_X - 6, BASE_Y - 3.5, 12, 4, ink.base),
      rect(BASE_X - 3.5, 46, 7, 12, ink.base, 3),
      pill(BASE_X - 3.5, 45.5, 7, 3, orange.light),
      flower(BASE_X + 7, 50, 'yellow'),
      leaf(BASE_X - 4, 50, 200),
      chopped(52),
    );
  }

  return svg(
    W,
    H,
    trunk(22, 5),
    branch(BASE_X, 40, -150, 14),
    branch(BASE_X - 11, 33, -110, 8, 2.5),
    branch(BASE_X, 32, -35, 15),
    branch(BASE_X + 11, 24, -80, 8, 2.5),
    branch(BASE_X, 24, -115, 10, 2.5),
    vine([BASE_X - 1, 30, BASE_X + 2, 38, BASE_X - 1, 46, BASE_X + 2, 54], 3),
    // Le nichoir, pendu à la branche droite.
    shadedBlock(31, 27, 9, 9, 2.5, 'yellow', 3),
    polygon([29.5, 28, 35.5, 22.5, 41.5, 28], coral.base),
    circle(35.5, 31, 1.5, ink.base),
    cushion(15, 20, 12, 6),
    circle(35.5, 21, 1.6, yellow.light),
  );
}

export const TREE = {
  width: W,
  height: H,
  anchorX: BASE_X / W,
  anchorY: BASE_Y / H,
  parts: { full: broadleaf(true), damaged: broadleaf(false) },
} satisfies SpriteProto;

export const TREE_PINE = {
  width: W,
  height: H,
  anchorX: BASE_X / W,
  anchorY: BASE_Y / H,
  parts: { full: pine(true), damaged: pine(false) },
} satisfies SpriteProto;

export const TREE_DEAD = {
  width: W,
  height: H,
  anchorX: BASE_X / W,
  anchorY: BASE_Y / H,
  parts: { full: deadTree(true), damaged: deadTree(false) },
} satisfies SpriteProto;
