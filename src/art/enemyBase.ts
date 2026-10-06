/**
 * La base mutante : un campement drôle plus qu'effrayant, qu'on repère de loin.
 *
 * Emprise 3 × 3, cadre 96 × 128 ancré en (0, 1) comme un bâtiment. Une mare
 * vert fluo autour — le vert des mutants, qui dit « à eux » —, une palissade
 * de pieux indigo, et au milieu une hutte de ruine violette coiffée d'une
 * gelée qui coule, avec un gros œil qui regarde passer Adam. Un drapeau fluo
 * sur une hampe de ferraille, deux tonneaux qui suintent, une fleur qui
 * pousse quand même au pied de la palissade.
 *
 * Le badge est un morceau à part (`sign0` à `sign9`), posé par-dessus dans
 * le même cadre : une planche blanche sur un piquet, le nombre d'assaillants
 * que la base tient en réserve tracé au trait indigo — pas de texte dans un
 * sprite. Il monte le jour, retombe à zéro quand elle les lâche, la nuit.
 *
 * Morceaux : `built`, `damaged` (sous la moitié de ses points de vie : la
 * hutte trouée, des planches clouées dessus), `sign0` à `sign9`.
 */

import {
  PALETTE,
  RADIUS,
  circle,
  curve,
  ellipse,
  flag,
  flower,
  line,
  pill,
  polyline,
  rect,
  shadedBlock,
  svg,
  vine,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks } from './building.ts';

const W = 96;
const H = 128;

const { ink, toxic, paper, violet } = PALETTE;

/** La mare fluo sous le campement, bordée de terre retournée indigo, comme la flaque d'une vague. */
function pool(): string {
  return (
    ellipse(48, 106, 47, 21, ink.base) +
    ellipse(48, 107, 43, 18, toxic.shade) +
    ellipse(47, 105, 41, 15.5, toxic.base) +
    ellipse(72, 110, 7, 3, toxic.shade) +
    pill(16, 96, 18, 4, toxic.light)
  );
}

/** Les pieux de la palissade, derrière la hutte : ceux du fond plus clairs. */
function palisade(): string {
  let stakes = '';

  for (let i = 0; i < 10; i += 1) {
    const x = 6 + i * 9;
    const tall = i % 2 === 0 ? 0 : 5;

    stakes += rect(x, 48 + tall, 6, 40 - tall, ink.light, RADIUS.small) + pill(x + 1, 50 + tall, 2, 8, violet.light);
  }
  return stakes + line(6, 62, 90, 62, ink.base) + line(6, 74, 90, 74, ink.base);
}

/** La hutte : un bloc de ruine violette, sa gelée qui coule, sa porte, son œil. */
function hut(): string {
  return (
    shadedBlock(20, 54, 56, 50, 10, 'violet', RADIUS.large) +
    // La gelée posée dessus, en coussin, et ses coulures.
    pill(16, 46, 64, 20, toxic.shade) +
    pill(16, 46, 64, 15, toxic.base) +
    pill(24, 49, 22, 4, toxic.light) +
    pill(26, 58, 6, 14, toxic.shade) +
    pill(26, 58, 6, 11, toxic.base) +
    pill(62, 58, 5, 10, toxic.shade) +
    pill(62, 58, 5, 8, toxic.base) +
    // La porte, en creux.
    rect(40, 80, 16, 24, ink.shade, RADIUS.block) +
    rect(42, 83, 12, 6, ink.base, RADIUS.small) +
    // Le gros œil, qui louche un peu vers Adam.
    circle(48, 70, 7.5, paper.shade) +
    circle(47.5, 69.5, 6.8, paper.base) +
    circle(49.5, 71, 3.4, ink.base) +
    circle(48.4, 69.8, 1.2, paper.base)
  );
}

/** Deux tonneaux qui suintent, devant à droite. */
function barrels(): string {
  return (
    shadedBlock(70, 92, 14, 18, 4, 'violet', RADIUS.small) +
    pill(70, 91, 14, 5, toxic.base) +
    pill(76, 95, 3, 7, toxic.base) +
    shadedBlock(80, 98, 12, 15, 4, 'violet', RADIUS.small) +
    pill(80, 97, 12, 4, toxic.shade)
  );
}

function camp(): string {
  return (
    pool() +
    palisade() +
    // La hampe de ferraille et son drapeau fluo, au-dessus de tout : on voit la base de loin.
    flag(70, 12, 40, 'toxic') +
    line(70, 52, 70, 60, ink.base) +
    hut() +
    barrels() +
    vine([12, 50, 14, 62, 12, 74, 14, 86], 3) +
    flower(18, 90, 'coral') +
    flower(88, 88, 'yellow')
  );
}

/** Un chiffre, au trait, centré en (cx, cy) dans une case de 8 × 11. */
function digit(value: number, cx: number, cy: number): string {
  const top = cy - 5.5;
  const bottom = cy + 5.5;
  const left = cx - 3.5;
  const right = cx + 3.5;

  switch (value) {
    case 0:
      return curve(`M${cx} ${top}C${cx + 4.8} ${top} ${cx + 4.8} ${bottom} ${cx} ${bottom}C${cx - 4.8} ${bottom} ${cx - 4.8} ${top} ${cx} ${top}Z`, ink.base);
    case 1:
      return polyline([cx - 2.5, cy - 3, cx + 0.5, top, cx + 0.5, bottom], ink.base);
    case 2:
      return curve(
        `M${left} ${cy - 2.5}C${left} ${cy - 7} ${right} ${cy - 7} ${right} ${cy - 2.5}` +
          `C${right} ${cy} ${left} ${cy + 2.5} ${left} ${bottom}L${right} ${bottom}`,
        ink.base,
      );
    case 3:
      return curve(`M${left} ${top}L${right} ${top}L${cx - 0.5} ${cy - 1}C${cx + 5} ${cy - 1} ${cx + 5} ${cy + 6.5} ${left} ${cy + 4.5}`, ink.base);
    case 4:
      return polyline([cx + 1.5, bottom, cx + 1.5, top, left, cy + 2, right, cy + 2], ink.base);
    case 5:
      return curve(`M${cx + 3} ${top}L${cx - 2.5} ${top}L${cx - 3} ${cy - 0.5}C${cx + 4.5} ${cy - 2.5} ${cx + 4.5} ${cy + 6.5} ${left} ${cy + 4.5}`, ink.base);
    case 6:
      return curve(
        `M${cx + 2.5} ${top}Q${left} ${cy - 3} ${left} ${cy + 2}C${left} ${cy + 6.5} ${right} ${cy + 6.5} ${right} ${cy + 2}` +
          `C${right} ${cy - 1.5} ${left} ${cy - 1.5} ${left} ${cy + 2}`,
        ink.base,
      );
    case 7:
      return polyline([left, top, right, top, cx - 1, bottom], ink.base);
    case 8:
      return curve(
        `M${cx} ${cy - 0.5}C${cx - 4.5} ${cy - 0.5} ${cx - 4.5} ${top} ${cx} ${top}C${cx + 4.5} ${top} ${cx + 4.5} ${cy - 0.5} ${cx} ${cy - 0.5}` +
          `C${cx - 5} ${cy - 0.5} ${cx - 5} ${bottom} ${cx} ${bottom}C${cx + 5} ${bottom} ${cx + 5} ${cy - 0.5} ${cx} ${cy - 0.5}`,
        ink.base,
      );
    default:
      return curve(
        `M${cx - 2.5} ${bottom}Q${right} ${cy + 3} ${right} ${cy - 2}C${right} ${cy - 6.5} ${left} ${cy - 6.5} ${left} ${cy - 2}` +
          `C${left} ${cy + 1.5} ${right} ${cy + 1.5} ${right} ${cy - 2}`,
        ink.base,
      );
  }
}

/** Le badge : un piquet, une planche blanche, un crâne de mutant à gauche du nombre d'assaillants en réserve. */
function sign(count: number): string {
  return svg(
    W,
    H,
    line(14, 86, 14, 114, ink.base),
    rect(2, 70, 26, 20, paper.shade, RADIUS.small),
    rect(2, 70, 26, 17, paper.base, RADIUS.small),
    pill(5, 72, 8, 2.5, paper.shade),
    // Le crâne : une tête de mutant en fluo, pour dire ce qui attend dedans.
    circle(9.5, 79, 3.6, toxic.base),
    circle(8.3, 78.5, 0.9, ink.base),
    circle(10.9, 78.5, 0.9, ink.base),
    digit(count, 20.5, 78.5),
  );
}

/** Les badges de 0 à 9 assaillants (`RAIDS.capacityMax`) : `sign0` à `sign9`. */
const SIGNS = Object.fromEntries(Array.from({ length: 10 }, (_, count) => [`sign${count}`, sign(count)]));

export const ENEMY_BASE_SPRITE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    built: svg(W, H, camp()),
    damaged: svg(W, H, camp(), damageMarks(20, 54, 56, 50)),
    ...SIGNS,
  },
} satisfies SpriteProto;
