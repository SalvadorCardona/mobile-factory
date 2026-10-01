/**
 * La Reine des flaques : un mutant de trois tuiles sur trois, qui se lit de
 * loin.
 *
 * Une goutte de gelée vert fluo — trois lobes fondus, du plus gros en bas au
 * plus petit en pointe —, une couronne de trois bulles qui lui flotte sur le
 * crâne, deux gros yeux qui louchent et un troisième, minuscule, un sourire
 * satisfait à une dent, un jupon indigo en loques, et le bras trop long des
 * mutants qui traîne au sol.
 * Drôle plus qu'effrayante, comme toute la famille.
 *
 * Morceaux : un corps par direction et sa variante « touchée » (yeux en
 * croix, bouche en O), le pied — un pseudopode de gelée, que le pantin fait
 * alterner comme des pieds —, et le halo, que le rendu fait respirer.
 */

import { PALETTE, circle, curve, ellipse, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import type { Facing } from './people.ts';

const W = 96;
const H = 120;
/** Le sol, à l'ancre (0.5, 0.8) : les pieds de la Reine. */
const GROUND = 96;
const CX = W / 2;

const { toxic, ink, paper } = PALETTE;

/** La goutte : trois lobes en ombre, les mêmes en base un peu plus haut et à gauche, et les reflets. */
function droplet(): string {
  return [
    circle(CX + 1.5, 66, 30, toxic.shade),
    circle(CX + 1.5, 41, 20, toxic.shade),
    circle(CX + 1.5, 25, 11.5, toxic.shade),
    circle(CX - 0.5, 63, 27.5, toxic.base),
    circle(CX - 0.5, 39.5, 18.5, toxic.base),
    circle(CX - 0.5, 24, 10.5, toxic.base),
    // Un jupon en loques, indigo, comme le short des mutants : il faut bien s'habiller, même reine.
    rect(CX - 21, 79, 41, 11, ink.light, 5.5),
    pill(CX - 22, 46, 12, 5, toxic.light),
    pill(CX - 13, 29, 8, 4, toxic.light),
    pill(CX - 6, 17, 5, 2.6, toxic.light),
  ].join('');
}

/** Une bulle de la couronne : ombre, bulle claire, et un point de lumière. */
function bubble(x: number, y: number, r: number): string {
  return circle(x + 0.8, y + 0.8, r, toxic.shade) + circle(x, y, r * 0.86, toxic.light) + circle(x - r * 0.35, y - r * 0.35, r * 0.25, paper.base);
}

/** La couronne : trois bulles qui flottent au-dessus de la pointe, la plus grosse au milieu. */
function crown(shift: number): string {
  return bubble(CX - 13 + shift, 11, 5) + bubble(CX + shift, 6, 6.5) + bubble(CX + 13 + shift, 11, 5);
}

/** Un œil rond, pupille qui louche vers le bas. */
function eye(x: number, y: number, r: number): string {
  return circle(x, y, r, paper.base) + circle(x + r * 0.25, y + r * 0.3, r * 0.45, ink.base);
}

function crossedEye(x: number, y: number, r: number): string {
  return line(x - r, y - r, x + r, y + r, ink.base) + line(x - r, y + r, x + r, y - r, ink.base);
}

/** Le bras court d'un côté, le bras trop long de l'autre, qui traîne jusqu'au sol. */
function arms(longOnLeft: boolean): string {
  const short = longOnLeft ? CX + 24 : CX - 32;
  const long = longOnLeft ? CX - 34 : CX + 26;

  return pill(short, 58, 8, 16, toxic.shade) + pill(long, 54, 8, 36, toxic.shade) + circle(long + 4, GROUND - 5, 5, toxic.base);
}

function body(facing: Facing, hurt: boolean): string {
  switch (facing) {
    case 'down':
      return svg(
        W,
        H,
        arms(false),
        droplet(),
        crown(0),
        hurt ? crossedEye(CX - 9, 52, 5) + crossedEye(CX + 10, 54, 4) : eye(CX - 9, 52, 7) + eye(CX + 10, 54, 5.5),
        hurt ? '' : eye(CX + 1, 42, 2.4),
        hurt
          ? circle(CX + 1, 69, 4, ink.base)
          : curve(`M${CX - 11} 66 Q${CX + 1} 75 ${CX + 13} 65`, ink.base) + rect(CX - 1, 68.6, 4, 3.4, paper.base, 1),
      );

    case 'up':
      // De dos : la goutte, la couronne, et la bosse du crâne qui pâlit au choc.
      return svg(W, H, arms(true), droplet(), crown(0), hurt ? circle(CX - 2, 26, 6, toxic.light) : '');

    case 'side':
      // De profil, le regard file vers la droite, le long bras devant elle.
      return svg(
        W,
        H,
        droplet(),
        pill(CX + 20, 54, 8, 36, toxic.shade),
        circle(CX + 24, GROUND - 5, 5, toxic.base),
        crown(-3),
        hurt ? crossedEye(CX + 12, 50, 5) : eye(CX + 12, 50, 6.5),
        hurt ? circle(CX + 15, 66, 3.6, ink.base) : curve(`M${CX + 5} 64 Q${CX + 13} 71 ${CX + 21} 62`, ink.base),
      );
  }
}

export const QUEEN_SPRITE = {
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
    /** Un pseudopode de gelée : le pantin en fait deux pieds qui se lèvent tour à tour. */
    foot: svg(W, H, ellipse(CX, GROUND - 3, 11, 4.5, toxic.shade), ellipse(CX - 1, GROUND - 4.5, 9, 3, toxic.base)),
    /** Le halo : plein dans le SVG, c'est le rendu qui le fait respirer en transparence. */
    halo: svg(W, H, circle(CX, 58, 46, toxic.base)),
  },
  pivots: { halo: [CX, 58] },
} satisfies SpriteProto;
