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
  curve,
  group,
  line,
  pill,
  polygon,
  rect,
  shadedBlock,
  shadedCircle,
  shadedPill,
  shape,
  svg,
} from '../data/artDirection.ts';

const S = 24;
const { ink, coral, paper, yellow, orange, toxic, cyan, mint, violet } = PALETTE;

/** Un cœur : deux disques et une pointe. */
function heart(cx: number, cy: number, r: number, color: (typeof PALETTE)['coral']['base' | 'shade']): string {
  return (
    circle(cx - r * 0.95, cy, r, color) +
    circle(cx + r * 0.95, cy, r, color) +
    polygon([cx - r * 1.9, cy + r * 0.35, cx, cy + r * 2.3, cx + r * 1.9, cy + r * 0.35], color)
  );
}

/**
 * Une flèche qui tourne sur elle-même : un anneau plein ouvert en haut à
 * gauche, et sa pointe qui repart vers la droite. Formes pleines, pas de trait.
 */
function restartArrow(cx: number, cy: number, color: (typeof PALETTE)[keyof typeof PALETTE]['base' | 'shade']): string {
  const outer = 8;
  const inner = 4.4;
  const from = (-60 * Math.PI) / 180;
  const to = (200 * Math.PI) / 180;
  const at = (radius: number, angle: number): string =>
    `${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`;
  const band =
    `M${at(outer, from)}A${outer} ${outer} 0 1 1 ${at(outer, to)}` +
    `L${at(inner, to)}A${inner} ${inner} 0 1 0 ${at(inner, from)}Z`;

  // La pointe, au bout de l'anneau, suit la tangente du tour.
  const middle = (outer + inner) / 2;
  const baseX = cx + middle * Math.cos(to);
  const baseY = cy + middle * Math.sin(to);
  const [tangentX, tangentY] = [-Math.sin(to), Math.cos(to)];
  const [normalX, normalY] = [Math.cos(to), Math.sin(to)];
  const wing = 4.6;
  const reach = 5.2;

  return (
    shape(band, color) +
    polygon(
      [
        baseX + normalX * wing,
        baseY + normalY * wing,
        baseX + tangentX * reach,
        baseY + tangentY * reach,
        baseX - normalX * wing,
        baseY - normalY * wing,
      ].map(round),
      color,
    )
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
  /** Le portrait d'Ève — chignon, bandeau jaune, salopette cyan — devant ses répliques. */
  eve: svg(
    S,
    S,
    shadedPill(5, 17, 14, 7, 2, 'cyan'),
    circle(12, 3.6, 3, ink.base),
    rect(5, 5, 14, 13, ink.base, 5.5),
    rect(7, 9.5, 10, 8.5, PALETTE.skin.base, 4),
    pill(6, 6.2, 12, 2.6, yellow.base),
    circle(9.8, 13, 1, ink.base),
    circle(14.2, 13, 1, ink.base),
    circle(8.6, 15.4, 1, coral.light),
    circle(15.4, 15.4, 1, coral.light),
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
  /**
   * La flèche de l'annonce d'une vague, pointée vers la droite : le HUD la
   * tourne vers le point d'où surgissent les mutants. Blanche sur le corail
   * de l'alerte, sa face avant dessous.
   */
  direction: svg(
    S,
    S,
    polygon([4, 10.5, 13, 10.5, 13, 5.5, 21, 13, 13, 20.5, 13, 15.5, 4, 15.5], PALETTE.paper.shade),
    polygon([4, 9, 13, 9, 13, 4, 21, 11.5, 13, 19, 13, 14, 4, 14], PALETTE.paper.base),
  ),
  /** Le joystick : un disque et son bouton, pour « glissez le pouce ». */
  move: svg(S, S, circle(12, 12, 10, cyan.light), circle(12.8, 12.8, 5.5, cyan.shade), circle(12, 12, 5, cyan.base)),
  /** La flèche du bouton « Jouer ». */
  play: svg(S, S, polygon([8.5, 5.5, 19.5, 12.5, 8.5, 19.5], orange.shade), polygon([7.5, 4.5, 18.5, 11.5, 7.5, 18.5], paper.base)),
  /** « Recommencer », sur un bouton blanc : la flèche corail qui repart. */
  restart: svg(S, S, restartArrow(12.6, 13.6, coral.shade), restartArrow(12, 13, coral.base), pill(5, 11.5, 2, 3.4, coral.light)),
  /** Une graine qui germe : la monnaie du jardin des souvenirs. */
  seed: svg(
    S,
    S,
    line(12, 13, 12, 6.5, mint.shade),
    group('translate(12 8) rotate(-150)', pill(0, -1.8, 6.5, 3.6, mint.base)),
    group('translate(12 7) rotate(-35)', pill(0, -1.8, 6.5, 3.6, mint.base)),
    shadedPill(5.5, 12, 13, 9, 2.5, 'yellow'),
  ),
  /** Le sac à dos violet d'Adam, pour le bonus « Grand sac ». */
  bag: svg(
    S,
    S,
    curve('M8.5 7.5 C8.5 3 15.5 3 15.5 7.5', ink.base),
    shadedBlock(5, 6.5, 14, 15, 3, 'violet', 5),
    rect(8, 14, 8, 4.5, violet.shade, 2),
    pill(9.5, 15, 3, 1.6, violet.light),
  ),
  /** Une hache : manche indigo, fer bleu. */
  axe: svg(
    S,
    S,
    group('translate(13 12) rotate(25)', rect(-1.6, -10, 3.2, 20, ink.light, 1.6)),
    group('translate(13 12) rotate(25)', shadedBlock(-9, -8.5, 9, 9, 2.5, 'cyan', 3), rect(-9, -8.5, 2.5, 9, cyan.shade, 1.25)),
  ),
  /** La même, blanche, sur le bouton corail de la confirmation. */
  restartLight: svg(S, S, restartArrow(12.6, 13.6, orange.shade), restartArrow(12, 13, paper.base)),
} as const;

export type UiIcon = keyof typeof UI_ICONS;
