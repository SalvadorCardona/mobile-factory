/**
 * Pictogrammes de l'interface : pause, son, marteau, fermer, conseil…
 *
 * Mêmes règles que les sprites — formes pures, trois tons, palette, trait
 * unique pour les détails — dans un carré de 24 × 24. Ils remplacent les
 * emojis, dont le dessin change d'un téléphone à l'autre et ne suit aucune
 * direction.
 */

import {
  PALETTE,
  circle,
  group,
  line,
  pill,
  polygon,
  rect,
  shadedCircle,
  shadedPill,
  svg,
} from '../data/artDirection.ts';

const S = 24;
const { ink, coral, paper, yellow, orange, toxic, cyan } = PALETTE;

/** Un cœur : deux disques et une pointe. */
function heart(cx: number, cy: number, r: number, color: (typeof PALETTE)['coral']['base' | 'shade']): string {
  return (
    circle(cx - r * 0.95, cy, r, color) +
    circle(cx + r * 0.95, cy, r, color) +
    polygon([cx - r * 1.9, cy + r * 0.35, cx, cy + r * 2.3, cx + r * 1.9, cy + r * 0.35], color)
  );
}

export const UI_ICONS = {
  pause: svg(S, S, pill(6, 5, 4.5, 14, ink.base), pill(13.5, 5, 4.5, 14, ink.base)),
  soundOn: svg(
    S,
    S,
    rect(3, 9, 5, 6, ink.base, 1.5),
    polygon([6, 9, 12, 4, 12, 20, 6, 15], ink.base),
    line(15.5, 9, 16.5, 12, cyan.shade),
    line(16.5, 12, 15.5, 15, cyan.shade),
    line(19, 6.5, 20.5, 12, cyan.shade),
    line(20.5, 12, 19, 17.5, cyan.shade),
  ),
  soundOff: svg(
    S,
    S,
    rect(3, 9, 5, 6, ink.base, 1.5),
    polygon([6, 9, 12, 4, 12, 20, 6, 15], ink.base),
    line(15, 9, 21, 15, coral.shade),
    line(21, 9, 15, 15, coral.shade),
  ),
  /** Le marteau blanc du bouton de construction, comme sur la maquette. */
  hammer: svg(
    S,
    S,
    group('translate(12 12) rotate(-45)', rect(-2, -2, 4, 13, paper.shade, 2), rect(-2, -2, 3.2, 12, paper.base, 1.6)),
    group('translate(12 12) rotate(-45)', pill(-7, -8, 14, 7, paper.shade), pill(-7, -8.5, 14, 6, paper.base)),
  ),
  close: svg(S, S, line(7, 7, 17, 17, ink.base), line(17, 7, 7, 17, ink.base)),
  /** L'ampoule du conseil. */
  hint: svg(
    S,
    S,
    shadedCircle(12, 10, 7, 'yellow'),
    rect(8.5, 16, 7, 5, ink.light, 2),
    line(9.5, 18.5, 14.5, 18.5, ink.base),
    circle(14.5, 7.5, 1.3, yellow.light),
  ),
  heart: svg(S, S, heart(12, 9.5, 4.6, coral.shade), heart(11.6, 9, 4.2, coral.base), pill(6.5, 6.5, 4, 2, coral.light)),
  /** Un habitant : la tête et la tunique orange des humains. */
  people: svg(S, S, shadedPill(5, 12, 14, 10, 3, 'orange'), circle(12, 8, 5, PALETTE.skin.base), pill(7, 3, 10, 5, ink.base)),
  /** Une tête de mutant, pour les mutants abattus. */
  mutant: svg(
    S,
    S,
    circle(12.6, 13.6, 8, toxic.shade),
    circle(12, 13, 7.6, toxic.base),
    circle(17.5, 6.5, 3.4, toxic.base),
    circle(9.5, 12.5, 3, paper.base),
    circle(10.1, 13.1, 1.3, ink.base),
    circle(15.5, 13.5, 1.6, paper.base),
    line(9, 17.5, 15, 17.5, ink.base),
  ),
  /** La flèche du bouton « Jouer ». */
  play: svg(S, S, polygon([8, 5, 19, 12, 8, 19], orange.shade), polygon([7.5, 4.5, 18, 11.5, 7.5, 18], paper.base)),
} as const;

export type UiIcon = keyof typeof UI_ICONS;
