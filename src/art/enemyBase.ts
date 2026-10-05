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
 * La pancarte du niveau est un morceau à part (`sign1`, `sign2`, `sign3`),
 * posé par-dessus dans le même cadre : une planche blanche sur un piquet, le
 * chiffre tracé au trait indigo — pas de texte dans un sprite.
 *
 * Morceaux : `built`, `damaged` (sous la moitié de ses points de vie : la
 * hutte trouée, des planches clouées dessus), `sign1` à `sign3`.
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

/** Le chiffre du niveau, au trait, centré en (cx, cy) dans une case de 8 × 11. */
function digit(level: 1 | 2 | 3, cx: number, cy: number): string {
  switch (level) {
    case 1:
      return polyline([cx - 2.5, cy - 3, cx + 0.5, cy - 5.5, cx + 0.5, cy + 5.5], ink.base);
    case 2:
      return curve(
        `M${cx - 3.5} ${cy - 2.5}C${cx - 3.5} ${cy - 7} ${cx + 3.5} ${cy - 7} ${cx + 3.5} ${cy - 2.5}` +
          `C${cx + 3.5} ${cy} ${cx - 3.5} ${cy + 2.5} ${cx - 3.5} ${cy + 5.5}L${cx + 3.5} ${cy + 5.5}`,
        ink.base,
      );
    case 3:
      return curve(
        `M${cx - 3.5} ${cy - 5.5}L${cx + 3.5} ${cy - 5.5}L${cx - 0.5} ${cy - 1}` +
          `C${cx + 5} ${cy - 1} ${cx + 5} ${cy + 6.5} ${cx - 3.5} ${cy + 4.5}`,
        ink.base,
      );
  }
}

/** La pancarte du niveau : un piquet, une planche blanche, un crâne rond à gauche du chiffre. */
function sign(level: 1 | 2 | 3): string {
  return svg(
    W,
    H,
    line(14, 86, 14, 114, ink.base),
    rect(2, 70, 26, 20, paper.shade, RADIUS.small),
    rect(2, 70, 26, 17, paper.base, RADIUS.small),
    pill(5, 72, 8, 2.5, paper.shade),
    // Le crâne : une tête de mutant en fluo, pour dire à qui est la base.
    circle(9.5, 79, 3.6, toxic.base),
    circle(8.3, 78.5, 0.9, ink.base),
    circle(10.9, 78.5, 0.9, ink.base),
    digit(level, 20.5, 78.5),
  );
}

export const ENEMY_BASE_SPRITE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    built: svg(W, H, camp()),
    damaged: svg(W, H, camp(), damageMarks(20, 54, 56, 50)),
    sign1: sign(1),
    sign2: sign(2),
    sign3: sign(3),
  },
} satisfies SpriteProto;
