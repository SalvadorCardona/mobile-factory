/**
 * Le chef d'une base mutante : le plus gros des mutants qu'on croise de
 * jour, et le plus fier de lui.
 *
 * Toujours le **vert fluo** des mutants — tête bosselée, un œil énorme et un
 * tout petit, un bras bien trop long —, mais une fois et demie plus large
 * qu'eux (cadre 48 × 72), le ventre rond. Il porte sa royauté de ruine : un
 * **cône de chantier corail** en guise de couronne, une **épaulière de bidon
 * violet** (le violet de sa base, comme le seau des gardiens), et traîne une
 * **massue** — un bloc de béton violet planté sur une tige de ferraille. Une
 * fleur coincée dans le cône : il a du goût.
 *
 * Morceaux : un corps par direction et sa variante « touché », les pieds,
 * le halo, et `slam` — la massue levée au-dessus de la tête, de face — que
 * le rendu montre pendant qu'il annonce son coup de zone.
 */

import { PALETTE, RADIUS, circle, curve, flower, group, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crossedEye } from './mutant.ts';
import type { Facing } from './people.ts';

const W = 48;
const H = 72;
/** Le chef est dessiné pieds à 51 ; le cadre le descend d'autant pour que son cône y tienne et ses pieds tombent sur l'ancre. */
const DROP = 6.4;
const GROUND = 51.2 + DROP;

const { toxic, ink, paper, violet, coral } = PALETTE;

/** Une grosse tête bosselée, en trois tons. */
function head(cx: number, cy: number, bumpX: number, bumpY: number): string {
  return (
    circle(cx + 1, cy + 1, 10.5, toxic.shade) +
    circle(bumpX + 0.8, bumpY + 0.8, 6, toxic.shade) +
    circle(cx, cy, 10, toxic.base) +
    circle(bumpX, bumpY, 5.4, toxic.base) +
    pill(cx - 7, cy - 8, 7, 2.6, toxic.light)
  );
}

/** Le ventre rond et le short en loques. */
function belly(x: number, w: number): string {
  return (
    rect(x, 27, w, 20, toxic.shade, 9) +
    rect(x, 27, w, 15.5, toxic.base, 9) +
    pill(x + 4, 30, w * 0.35, 3, toxic.light) +
    rect(x + 1, 40, w - 2, 7.5, ink.light, 3.5)
  );
}

/** Le cône de chantier, posé de travers sur la tête : trois étages corail, une bande blanche, la fleur. */
function cone(cx: number, bottom: number): string {
  return (
    pill(cx - 9, bottom - 3, 18, 4, coral.shade) +
    rect(cx - 6, bottom - 9, 12, 7, coral.shade, RADIUS.small) +
    rect(cx - 5.5, bottom - 9, 10.5, 6, coral.base, RADIUS.small) +
    rect(cx - 4, bottom - 14, 8, 6, coral.base, RADIUS.small) +
    pill(cx - 4, bottom - 12, 8, 2.4, paper.base) +
    pill(cx - 2.2, bottom - 18, 4.4, 6, coral.base) +
    pill(cx - 1.4, bottom - 17, 1.4, 3, coral.light) +
    flower(cx + 5, bottom - 12, 'yellow', 0.6)
  );
}

/** L'épaulière : un demi-bidon violet cerclé, sur l'épaule courte. */
function pauldron(x: number, y: number): string {
  return (
    rect(x, y, 13, 10, violet.shade, RADIUS.large) +
    rect(x, y, 12, 8, violet.base, RADIUS.large) +
    pill(x + 2, y + 1.5, 5, 2, violet.light) +
    line(x + 2, y + 5, x + 11, y + 5, violet.shade)
  );
}

/** La massue : une tige de ferraille, un bloc de béton violet au bout, une coulure fluo. */
function club(x: number, top: number, length: number): string {
  return (
    line(x, top + 6, x, top + length, ink.base) +
    rect(x - 6, top - 4, 12, 12, violet.shade, RADIUS.block) +
    rect(x - 6, top - 4, 11, 10, violet.base, RADIUS.block) +
    pill(x - 4, top - 2.5, 5, 2, violet.light) +
    pill(x + 1.5, top + 4, 2.4, 6, toxic.base)
  );
}

function eye(x: number, y: number, r: number): string {
  return circle(x, y, r, paper.base) + circle(x + r * 0.25, y + r * 0.3, r * 0.45, ink.base);
}

/** Le chef vu dans une direction, sans le cadre ; `slam` : la massue levée, de face. */
function chiefFigure(facing: Facing, hurt: boolean, slam = false): string {
  switch (facing) {
    case 'down':
      return [
        // La massue derrière le long bras, ou brandie bien haut au-dessus de son épaule.
        slam ? club(39, -2, 14) : club(41, 22, 24),
        pill(5, 30, 6, 11, toxic.shade),
        belly(10, 28),
        slam ? pill(35, 8, 6, 24, toxic.shade) + circle(38, 10, 3.6, toxic.base) : pill(34, 28, 6, 20, toxic.shade),
        slam ? '' : circle(37, 48, 3.6, toxic.base),
        head(23, 20, 31, 13),
        cone(19, 13),
        pauldron(3, 25),
        hurt ? crossedEye(19, 20, 2.8) + crossedEye(27.5, 21, 1.8) : eye(19, 20, 4.2) + eye(27.5, 21, 2.4),
        hurt
          ? circle(23, 27, 2.6, ink.base)
          : slam
            ? // Il rugit : la bouche grande ouverte, une dent qui pend.
              circle(23, 27.5, 3, ink.base) + rect(22, 25, 2, 2.2, paper.base, 0.8)
            : curve('M17 26 Q23 30 29 25.5', ink.base) + rect(21.5, 26.8, 2.4, 2.2, paper.base, 0.8),
      ].join('');

    case 'up':
      return [
        pill(37, 30, 6, 11, toxic.shade),
        belly(10, 28),
        pill(8, 28, 6, 20, toxic.shade),
        circle(11, 48, 3.6, toxic.base),
        club(7, 22, 24),
        head(24, 20, 15, 13),
        cone(28, 13),
        pauldron(32, 25),
        // De dos, le choc se voit à la bosse qui pâlit.
        hurt ? circle(15, 12, 3.2, toxic.light) : '',
      ].join('');

    case 'side':
      return [
        belly(12, 24),
        club(33, 22, 24),
        pill(26, 28, 6, 20, toxic.shade),
        circle(29, 48, 3.6, toxic.base),
        head(25, 20, 16, 14),
        cone(24, 13),
        pauldron(10, 25),
        hurt ? crossedEye(30, 20, 2.8) : eye(30, 20, 4),
        hurt ? circle(32, 27, 2.4, ink.base) : curve('M27 25.5 Q31 29 35 25', ink.base),
      ].join('');
  }
}

function body(facing: Facing, hurt: boolean, slam = false): string {
  return svg(W, H, group(`translate(0 ${DROP})`, chiefFigure(facing, hurt, slam)));
}

export const CHIEF_SPRITE = {
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
    slam: body('down', false, true),
    foot: svg(W, H, pill(24 - 4.5, GROUND - 5, 9, 5, toxic.shade)),
    /** Le halo : plein dans le SVG, c'est le rendu qui le fait respirer en transparence. */
    halo: svg(W, H, circle(24, 32 + DROP, 22, toxic.base)),
  },
  pivots: { halo: [24, 32 + DROP] },
} satisfies SpriteProto;
