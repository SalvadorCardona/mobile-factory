/**
 * Le mutant radioactif : drôle plus qu'effrayant.
 *
 * Tout ce qui se lit à petite taille : une tête déformée (une grosse bosse
 * de travers), un œil énorme et un tout petit, un sourire idiot, un bras bien
 * trop long qui traîne jusqu'au sol, et le **vert fluo** — la teinte réservée
 * aux mutants, que rien d'autre dans le jeu ne porte.
 *
 * Morceaux : un corps par direction, sa variante « touché » (yeux en croix,
 * bouche en O) que le rendu montre un instant à l'impact, les pieds nus, et
 * le halo, un disque vert que le rendu fait respirer derrière lui.
 */

import { PALETTE, circle, curve, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, type Facing } from './people.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;

const { toxic, ink, paper } = PALETTE;

/** Deux cercles fondus en une tête bosselée, en trois tons. */
export function lumpyHead(cx: number, cy: number, bumpX: number, bumpY: number): string {
  return (
    circle(cx + 0.8, cy + 0.8, 8, toxic.shade) +
    circle(bumpX + 0.6, bumpY + 0.6, 4.4, toxic.shade) +
    circle(cx, cy, 7.6, toxic.base) +
    circle(bumpX, bumpY, 4, toxic.base) +
    pill(cx - 5, cy - 6, 5.5, 2.2, toxic.light)
  );
}

/** Un œil rond, pupille qui louche vers le bas. */
function eye(x: number, y: number, r: number): string {
  return circle(x, y, r, paper.base) + circle(x + r * 0.25, y + r * 0.3, r * 0.45, ink.base);
}

/** Un œil fermé par le choc : une croix. */
export function crossedEye(x: number, y: number, r: number): string {
  return line(x - r, y - r, x + r, y + r, ink.base) + line(x - r, y + r, x + r, y - r, ink.base);
}

export function torso(x: number, w: number): string {
  return (
    rect(x, 21, w, 14, toxic.shade, 5) +
    rect(x, 21, w, 10.5, toxic.base, 5) +
    // Un short en loques, indigo : il faut bien s'habiller.
    rect(x + 0.5, 30, w - 1, 5.5, ink.light, 2.5)
  );
}

/** Le mutant vu dans une direction, sans le cadre : la clinique en réutilise la silhouette. */
export function mutantFigure(facing: Facing, hurt: boolean): string {
  switch (facing) {
    case 'down':
      return [
        // Le bras court, puis le tronc, puis le bras trop long qui traîne au sol.
        pill(7, 22, 4.5, 8, toxic.shade),
        torso(10, 13),
        pill(21.5, 21, 4.5, 15, toxic.shade),
        circle(23.8, 36, 2.8, toxic.base),
        lumpyHead(15, 12.5, 21.5, 7.5),
        hurt ? crossedEye(12.3, 12.6, 2.2) + crossedEye(18.8, 13.2, 1.4) : eye(12.3, 12.6, 3.2) + eye(18.8, 13.2, 1.8),
        hurt
          ? circle(15.5, 18, 2, ink.base)
          : curve('M11.5 17 Q15.2 20.2 19 17', ink.base) + rect(13.8, 17.6, 2, 1.8, paper.base, 0.6),
      ].join('');

    case 'up':
      return [
        pill(21, 22, 4.5, 8, toxic.shade),
        torso(9.5, 13),
        pill(6, 21, 4.5, 15, toxic.shade),
        circle(8.2, 36, 2.8, toxic.base),
        lumpyHead(16, 12.5, 10.5, 7.5),
        // De dos, le choc se voit à la bosse qui pâlit.
        hurt ? circle(10.5, 7.5, 2.4, toxic.light) : '',
      ].join('');

    case 'side':
      return [
        torso(10.5, 11.5),
        // De profil, le long bras pend devant lui jusqu'au sol.
        pill(16.5, 21, 4.5, 15, toxic.shade),
        circle(19, 36, 2.8, toxic.base),
        lumpyHead(17, 13, 11, 7),
        hurt ? crossedEye(21, 12.8, 2.2) : eye(21, 12.8, 3),
        hurt ? circle(22.5, 18.2, 1.8, ink.base) : curve('M19 17.5 Q21.5 19.6 24 17.2', ink.base),
      ].join('');
  }
}

function body(facing: Facing, hurt: boolean): string {
  return svg(W, H, mutantFigure(facing, hurt));
}

export const MUTANT = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down', false),
    up: body('up', false),
    side: body('side', false),
    downHurt: body('down', true),
    upHurt: body('up', true),
    sideHurt: body('side', true),
    foot: svg(W, H, foot(GROUND, 'toxic')),
    /** Le halo : plein dans le SVG, c'est le rendu qui le fait respirer en transparence. */
    halo: svg(W, H, circle(16, 24, 15, toxic.base)),
  },
  pivots: { halo: [16, 24] },
} satisfies SpriteProto;
