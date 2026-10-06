/**
 * Le gardien d'une base mutante : un mutant qui monte la garde, fier de son
 * équipement de récupération.
 *
 * Toujours le **vert fluo** des mutants — tête bosselée, œil énorme, bras
 * trop long —, mais trapu, coiffé d'un **seau de ruine violet** enfoncé de
 * travers (la bosse dépasse), une fleur plantée dedans, et armé d'un
 * **couvercle** violet pour bouclier et d'un bout de tuyau cyan qui traîne
 * au bout du long bras. Le casque et le bouclier sont violets comme sa
 * base : on lit d'un coup d'œil qu'il en est le gardien, pas un assaillant.
 *
 * Morceaux : un corps par direction, sa variante « touché », les pieds nus,
 * et le halo, comme le mutant (`art/mutant.ts`).
 */

import { PALETTE, RADIUS, circle, curve, flower, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crossedEye, lumpyHead, torso } from './mutant.ts';
import { foot, type Facing } from './people.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;

const { toxic, ink, paper, violet, cyan } = PALETTE;

/** Le seau renversé sur la tête, de `x` à `x + w`, son bord en bas à `bottom` ; une coulure de gelée sur le bord. */
function bucket(x: number, w: number, bottom: number, drip: number): string {
  return (
    rect(x, bottom - 9, w, 9, violet.shade, RADIUS.small) +
    rect(x + 0.5, bottom - 9, w - 1, 7, violet.base, RADIUS.small) +
    pill(x + 2, bottom - 8, w * 0.4, 2, violet.light) +
    // Le bord roulé du seau, et la gelée qui en coule.
    pill(x - 1, bottom - 2.5, w + 2, 3, violet.shade) +
    pill(drip, bottom - 2, 2.4, 5, toxic.base)
  );
}

/** Le couvercle-bouclier, de face : un disque violet, son bouton indigo, une coulure fluo. */
function lid(cx: number, cy: number, r: number): string {
  return (
    circle(cx, cy, r, violet.shade) +
    circle(cx - 0.4, cy - 0.5, r - 0.9, violet.base) +
    pill(cx - r * 0.6, cy - r * 0.65, r * 0.7, 1.8, violet.light) +
    circle(cx, cy, 1.4, ink.light) +
    pill(cx + r * 0.3, cy + r * 0.2, 2, 5, toxic.base)
  );
}

/** Le bout de tuyau, debout dans la main du long bras, qui dépasse de l'épaule ; un coude rouillé en haut. */
function pipe(x: number, top: number): string {
  return (
    pill(x, top, 3.6, 22, cyan.shade) +
    pill(x, top, 3.6, 19, cyan.base) +
    pill(x + 0.8, top + 2, 1.4, 9, cyan.light) +
    pill(x - 0.6, top - 1, 4.8, 3.4, cyan.shade)
  );
}

function eye(x: number, y: number, r: number): string {
  return circle(x, y, r, paper.base) + circle(x + r * 0.25, y + r * 0.3, r * 0.45, ink.base);
}

/** Le gardien vu dans une direction, sans le cadre. */
export function guardianFigure(facing: Facing, hurt: boolean): string {
  switch (facing) {
    case 'down':
      return [
        // Le tuyau derrière le long bras, puis le tronc trapu, le bras qui le tient, le bouclier devant le bras court.
        pipe(25.6, 15),
        torso(8.5, 15),
        pill(21.5, 21, 4.5, 15, toxic.shade),
        circle(23.8, 36, 2.8, toxic.base),
        lumpyHead(15, 13, 21.5, 8),
        bucket(7.5, 15, 10, 9),
        flower(11, 1.5, 'coral', 0.7),
        hurt ? crossedEye(12.3, 13.4, 2.2) + crossedEye(18.8, 14, 1.4) : eye(12.3, 13.4, 3.2) + eye(18.8, 14, 1.8),
        hurt ? circle(15.5, 18.6, 2, ink.base) : curve('M11.8 18 Q15.2 20.4 18.8 17.6', ink.base),
        lid(7, 27, 6.2),
      ].join('');

    case 'up':
      return [
        lid(25, 27, 6.2),
        torso(8.5, 15),
        pill(6, 21, 4.5, 15, toxic.shade),
        circle(8.2, 36, 2.8, toxic.base),
        pipe(2.6, 15),
        lumpyHead(16, 13, 10.5, 8),
        bucket(8.5, 15, 10, 19),
        flower(20, 1.5, 'coral', 0.7),
        // De dos, le choc se voit à la bosse qui pâlit.
        hurt ? circle(10.5, 8, 2.4, toxic.light) : '',
      ].join('');

    case 'side':
      return [
        pipe(13.6, 15),
        torso(9.5, 13),
        pill(16.5, 21, 4.5, 15, toxic.shade),
        circle(19, 36, 2.8, toxic.base),
        lumpyHead(17, 13.5, 11, 7.5),
        bucket(10, 14, 10.5, 21),
        flower(13, 2, 'coral', 0.7),
        hurt ? crossedEye(21, 13.6, 2.2) : eye(21, 13.6, 3),
        hurt ? circle(22.5, 18.8, 1.8, ink.base) : curve('M19 18.2 Q21.5 20.2 24 17.8', ink.base),
        // Le bouclier tenu devant lui, vu par la tranche : une capsule.
        pill(23, 21, 5, 13, violet.shade) + pill(23, 21, 3.6, 11.5, violet.base) + pill(23.6, 22.5, 1.2, 4, violet.light),
      ].join('');
  }
}

function body(facing: Facing, hurt: boolean): string {
  return svg(W, H, guardianFigure(facing, hurt));
}

export const GUARDIAN = {
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
