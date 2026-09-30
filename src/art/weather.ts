/**
 * La météo : ce qui tombe, souffle, traîne ou brille au-dessus de la carte.
 *
 * Des morceaux minuscules, faits pour être répétés par dizaines dans un
 * `ParticleContainer` (`render/weatherLayer.ts`) : une goutte de pluie acide
 * vert pâle — la menthe claire, le vert fluo reste aux mutants —, un trait de
 * vent, une bouffée de brouillard en coussins, une touffe de fleurs qui
 * pousse sous l'arc-en-ciel. L'arc-en-ciel lui-même est un sprite à part,
 * large : des bandes pastel posées sur deux nuages.
 *
 * Aucune transparence ici : c'est le rendu qui estompe, pas le SVG.
 */

import { PALETTE, cushion, flower, leaf, pill, shape, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const T = 32;

const { mint, paper, coral, orange, yellow, cyan, violet } = PALETTE;

export const WEATHER_FX = {
  width: T,
  height: T,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    /** Une goutte de pluie acide : une capsule étirée, menthe claire, son ombre dessous. */
    drop: svg(T, T, pill(14.5, 7, 3.5, 17, mint.base), pill(14.5, 7, 3.5, 15, mint.light), pill(15.3, 9, 1.4, 5, paper.base)),
    /** Un trait de vent : deux capsules blanches décalées, la plus courte en retrait. */
    gust: svg(
      T,
      T,
      pill(2, 12, 26, 4.5, paper.shade),
      pill(2, 12, 26, 3.2, paper.base),
      pill(10, 18, 18, 3.8, paper.shade),
      pill(10, 18, 18, 2.6, paper.base),
    ),
    /** Une bouffée de brouillard : trois coussins blancs, ombrés de lavande. */
    puff: svg(T, T, cushion(11, 19, 18, 10, 'paper'), cushion(21, 20, 18, 9, 'paper'), cushion(16, 14, 16, 9, 'paper')),
    /** Une touffe qui pousse sous l'arc-en-ciel : deux feuilles, trois fleurs. */
    bloom: svg(
      T,
      T,
      leaf(15, 23, -160, 1.1),
      leaf(17, 23, -20, 1.1),
      flower(10, 19, 'coral', 1.1),
      flower(16, 16, 'yellow', 1.2),
      flower(22, 19, 'violet', 1.1),
    ),
  },
} satisfies SpriteProto;

/** Largeur et hauteur de l'arc-en-ciel, en pixels monde : le rendu l'agrandit à l'écran. */
const RW = 256;
const RH = 128;

/** Une demi-couronne de rayon extérieur `outer`, épaisse de `band`, posée sur la base du cadre. */
function band(outer: number, width: number, color: Parameters<typeof shape>[1]): string {
  const cx = RW / 2;
  const cy = RH - 14;
  const inner = outer - width;

  return shape(
    `M${cx - outer} ${cy}A${outer} ${outer} 0 0 1 ${cx + outer} ${cy}` +
      `L${cx + inner} ${cy}A${inner} ${inner} 0 0 0 ${cx - inner} ${cy}Z`,
    color,
  );
}

export const RAINBOW = {
  width: RW,
  height: RH,
  anchorX: 0.5,
  anchorY: 1,
  parts: {
    /** Six bandes pastel, les tons clairs de la palette ; un nuage à chaque pied. */
    arc: svg(
      RW,
      RH,
      band(108, 8, coral.light),
      band(100, 8, orange.light),
      band(92, 8, yellow.light),
      band(84, 8, mint.light),
      band(76, 8, cyan.light),
      band(68, 8, violet.light),
      cushion(RW / 2 - 88, RH - 16, 44, 20, 'paper'),
      cushion(RW / 2 - 104, RH - 10, 34, 16, 'paper'),
      cushion(RW / 2 + 88, RH - 16, 44, 20, 'paper'),
      cushion(RW / 2 + 106, RH - 10, 34, 16, 'paper'),
    ),
  },
} satisfies SpriteProto;
