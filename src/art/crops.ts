/**
 * Les cultures du fermier, une case du champ à trois stades :
 * - `sown` : la terre retournée en deux sillons, les graines dedans, et le
 *   petit piquet qui marque le rang — on voit qu'on vient d'y passer ;
 * - `growing` : les mêmes sillons, et trois pousses menthe qui en sortent ;
 * - `ripe` : des épis dorés, lourds, qui penchent — c'est mûr, à récolter.
 *
 * La terre (`soil`) est celle du champ de la ferme : le sable foncé en
 * sillons clairs. C'est un morceau à part, posé au sol sous tout le reste ;
 * les plants, eux, dépassent au-dessus de la case comme un arbre et se
 * trient en profondeur avec les personnages. Cadre 32 × 44, la case occupe
 * les 32 px du bas ; l'ancre est au milieu du bord bas de la case.
 */

import { GROUND, PALETTE, circle, flower, leaf, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 32;
const H = 44;
/** Le haut de la case, dans le cadre. */
const TOP = H - 32;

const { mint, yellow, orange } = PALETTE;

/** Les deux sillons, en y, et où pousse chaque plant le long d'un sillon, en x. */
const ROWS = [TOP + 13, TOP + 25] as const;
const PLANTS = [8, 16, 24] as const;

/** La terre retournée, comme le champ de la ferme : une planche de sable foncé à face avant ambrée, deux sillons clairs. */
function soil(): string {
  return (
    rect(3, TOP + 5, 26, 25, yellow.shade, 8) +
    rect(3, TOP + 5, 26, 23, GROUND.sand.shade, 8) +
    ROWS.map((y) => pill(5, y - 2, 22, 4, GROUND.sand.base)).join('')
  );
}

function sown(): string {
  return svg(
    W,
    H,
    ...ROWS.flatMap((y) => PLANTS.map((x) => circle(x, y - 0.5, 1.1, orange.shade))),
    // Le piquet du rang, son bout de ruban.
    line(26, TOP + 9, 26, TOP + 1, orange.shade),
    pill(26, TOP + 1.5, 4, 2, PALETTE.coral.base),
  );
}

/** Une pousse : une tige et deux feuilles. `x, y` : le pied de la tige. */
function sprout(x: number, y: number): string {
  return line(x, y, x, y - 5, mint.shade) + leaf(x, y - 4, -150, 0.7) + leaf(x, y - 4, -30, 0.7);
}

function growing(): string {
  return svg(W, H, ...ROWS.flatMap((y) => PLANTS.map((x) => sprout(x, y - 1))));
}

/** Un épi mûr : la tige penchée, une feuille, l'épi doré en capsule et son reflet. */
function ear(x: number, y: number, lean: number): string {
  const top = y - 13;

  return (
    line(x, y, x + lean, top + 4, mint.shade) +
    leaf(x, y - 5, lean > 0 ? -40 : -140, 0.6) +
    pill(x + lean - 1.8, top - 3, 3.6, 8, yellow.shade) +
    pill(x + lean - 1.8, top - 3, 3.6, 6.5, yellow.base) +
    pill(x + lean - 1, top - 2.2, 1.2, 2.6, yellow.light)
  );
}

function ripe(): string {
  return svg(
    W,
    H,
    ...ROWS.flatMap((y, row) => PLANTS.map((x, i) => ear(x, y - 1, (i + row) % 2 === 0 ? 1.5 : -1.5))),
    // Un coquelicot s'est invité dans le blé.
    flower(28, TOP + 27, 'coral', 0.5),
  );
}

export const CROP_SPRITE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 1,
  parts: { soil: svg(W, H, soil()), sown: sown(), growing: growing(), ripe: ripe() },
} satisfies SpriteProto;
