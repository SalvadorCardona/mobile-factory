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
  flag,
  group,
  line,
  pill,
  polygon,
  polyline,
  rect,
  ring,
  shadedBlock,
  shadedCircle,
  shadedPill,
  shape,
  svg,
  windowPane,
  type Color,
  type Tone,
} from '../data/artDirection.ts';
import type { DAY_CYCLE } from '../data/dayNight.ts';

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

/**
 * Une feuille de confetti : une capsule en trois tons, penchée, et sa
 * nervure au trait. Les objectifs réussis en font pleuvoir.
 */
function confettiLeaf(tone: 'mint' | 'yellow' | 'coral'): string {
  const { base, shade, light } = PALETTE[tone];

  return group(
    'rotate(-35 12 12)',
    pill(3, 7.5, 18, 10, shade),
    pill(3, 7, 18, 9, base),
    pill(6, 8.5, 7, 2.6, light),
    line(6, 12, 18, 12, shade),
  );
}

/**
 * Une flèche pleine, vers le bas (`down`) ou vers le haut : une hampe en
 * capsule et sa pointe. Blanche sur les gros boutons de la zone d'échange,
 * posée sur son ombre de la teinte du bouton.
 */
function arrow(down: boolean, color: (typeof PALETTE)[keyof typeof PALETTE]['base' | 'shade']): string {
  const tip = down ? 21 : 3;
  const back = down ? 11 : 13;

  return rect(9.5, down ? 3 : 10, 5, 11, color, 2.5) + polygon([3.5, back, 20.5, back, 12, tip], color);
}

/** Une bande d'anneau de la part `from` à la part `to` du tour, partie d'en haut, dans le sens des aiguilles. */
function arcBand(cx: number, cy: number, outer: number, inner: number, from: number, to: number, color: Color): string {
  const angle = (part: number): number => (part - 0.25) * 2 * Math.PI;
  const at = (radius: number, part: number): string =>
    `${round(cx + radius * Math.cos(angle(part)))} ${round(cy + radius * Math.sin(angle(part)))}`;
  const large = to - from > 0.5 ? 1 : 0;

  return shape(
    `M${at(outer, from)}A${outer} ${outer} 0 ${large} 1 ${at(outer, to)}` +
      `L${at(inner, to)}A${inner} ${inner} 0 ${large} 0 ${at(inner, from)}Z`,
    color,
  );
}

export type DialPhase = keyof typeof DAY_CYCLE;

/** La teinte de chaque phase sur le cadran : l'aube rose, le jour jaune, le crépuscule orange, la nuit indigo. */
const DIAL_TONES = {
  dawn: 'coral',
  day: 'yellow',
  dusk: 'orange',
  night: 'ink',
} as const satisfies Record<DialPhase, Tone>;

/** Le côté du cadran de l'horloge, en pixels (le HUD le réduit à sa taille). */
const DIAL_SIZE = 32;

/**
 * Le cadran de l'horloge du HUD : un disque de papier, l'anneau des phases à
 * leurs vraies durées (cf. `DIAL_ARCS`, `sim/dayNight.ts`), et l'aiguille au
 * trait qui porte le soleil — la lune la nuit, le soleil corail quand la
 * nuit approche. `progress` va de 0 (l'aube, en haut) à 1.
 */
export function dayDialSvg(
  arcs: readonly { phase: DialPhase; from: number; to: number }[],
  progress: number,
  night: boolean,
  warning: boolean,
): string {
  const c = DIAL_SIZE / 2;
  const cy = c - 0.5;
  const outer = 14;
  const inner = 9;
  const angle = (progress - 0.25) * 2 * Math.PI;
  const reach = (outer + inner) / 2;
  const x = round(c + reach * Math.cos(angle));
  const y = round(cy + reach * Math.sin(angle));
  const tip = 3.8;

  const marker = night
    ? circle(x + 0.4, y + 0.6, tip, paper.shade) +
      circle(x, y, tip, paper.base) +
      // La lune : le disque mordu par la nuit, en haut à droite.
      circle(x + 1.6, y - 1.2, tip * 0.68, ink.base)
    : shadedCircle(x, y, tip, warning ? 'coral' : 'yellow');

  return svg(
    DIAL_SIZE,
    DIAL_SIZE,
    circle(c, cy + 1, 15, paper.shade),
    circle(c, cy, 15, paper.base),
    ...arcs.map(({ phase, from, to }) => arcBand(c, cy + 0.8, outer, inner, from, to, PALETTE[DIAL_TONES[phase]].shade)),
    ...arcs.map(({ phase, from, to }) => arcBand(c, cy, outer, inner + 0.8, from, to, PALETTE[DIAL_TONES[phase]].base)),
    pill(c - 6, cy - 4.5, 4, 2, paper.shade),
    line(c, cy, round(c + (reach - tip) * Math.cos(angle)), round(cy + (reach - tip) * Math.sin(angle)), ink.base),
    circle(c, cy, 2.4, ink.base),
    marker,
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
  /** Deux croches liées : la musique de fond. */
  musicOn: svg(
    S,
    S,
    polygon([8, 4.5, 19, 2.5, 19, 6, 8, 8], ink.base),
    line(9, 6, 9, 16.5, ink.base),
    line(18, 4, 18, 14.5, ink.base),
    circle(6.5, 17, 3.2, ink.base),
    circle(15.5, 15, 3.2, ink.base),
    circle(5.6, 16.1, 1, ink.light),
    circle(14.6, 14.1, 1, ink.light),
  ),
  musicOff: svg(
    S,
    S,
    polygon([8, 4.5, 19, 2.5, 19, 6, 8, 8], ink.base),
    line(9, 6, 9, 16.5, ink.base),
    line(18, 4, 18, 14.5, ink.base),
    circle(6.5, 17, 3.2, ink.base),
    circle(15.5, 15, 3.2, ink.base),
    line(3.5, 3.5, 20.5, 20.5, coral.shade),
  ),
  /** Une pancarte : un panneau jaune de la colonie sur son piquet indigo, deux mots au trait. */
  signOn: svg(
    S,
    S,
    rect(11, 12, 2.5, 9, ink.base, 1.25),
    shadedPill(2.5, 4, 19, 10, 2.5, 'yellow'),
    line(7, 8.5, 11, 8.5, ink.base),
    line(13.5, 8.5, 17, 8.5, ink.base),
  ),
  /** Les pancartes masquées : la même, barrée de corail. */
  signOff: svg(
    S,
    S,
    rect(11, 12, 2.5, 9, ink.base, 1.25),
    shadedPill(2.5, 4, 19, 10, 2.5, 'yellow'),
    line(7, 8.5, 11, 8.5, ink.base),
    line(13.5, 8.5, 17, 8.5, ink.base),
    line(3.5, 3.5, 20.5, 20.5, coral.shade),
  ),
  /** Le marteau blanc du bouton de construction, comme sur la maquette. */
  hammer: svg(
    S,
    S,
    group('translate(12 12) rotate(-45)', rect(-2, -2, 4, 13, paper.shade, 2), rect(-2, -2, 3.2, 12, paper.base, 1.6)),
    group('translate(12 12) rotate(-45)', pill(-7, -8, 14, 7, paper.shade), pill(-7, -8.5, 14, 6, paper.base)),
  ),
  close: svg(S, S, line(7, 7, 17, 17, ink.base), line(17, 7, 7, 17, ink.base)),
  /**
   * L'engrenage des réglages : huit dents en capsules autour d'un moyeu
   * indigo, l'ombre en bas à droite, un reflet en haut à gauche, et le trou
   * blanc du bouton au milieu.
   */
  settings: svg(
    S,
    S,
    ...[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => group(`rotate(${angle} 12 12)`, rect(9.75, 1.5, 4.5, 6, ink.base, 1.6))),
    circle(12.5, 12.5, 7.6, ink.shade),
    circle(12, 12, 7.4, ink.base),
    pill(6.6, 7.4, 4.4, 2, ink.light),
    circle(12, 12, 3, paper.base),
  ),
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
  /** Un ouvrier : l'habitant, et le bandeau corail des porteurs noué au front. */
  worker: svg(
    S,
    S,
    shadedPill(5, 12, 14, 10, 3, 'orange'),
    circle(12, 8, 5, PALETTE.skin.base),
    pill(7, 3, 10, 5, ink.base),
    pill(6.5, 5.5, 11, 2.6, coral.base),
  ),
  /** Un ouvrier au travail : le marteau, tête indigo, manche orange. */
  toil: svg(
    S,
    S,
    group('translate(12 12) rotate(-40)', rect(-1.8, -3, 3.6, 14, orange.shade, 1.8), rect(-1.8, -3, 2.6, 13, orange.base, 1.3)),
    group('translate(12 12) rotate(-40)', rect(-7, -9, 14, 7.5, ink.shade, 2.5), rect(-7, -9, 14, 6, ink.base, 2.5), pill(-5.5, -8, 5, 1.6, ink.light)),
  ),
  /** Un ouvrier qui glande : deux « z » de dormeur, le grand devant. */
  idle: svg(
    S,
    S,
    polyline([13, 4, 19, 4, 13, 10, 19, 10], ink.light),
    polyline([4, 11, 12, 11, 4, 19, 12, 19], ink.base),
  ),
  /** Un enfant : la tête, la casquette jaune des enfants de la colonie, la tunique orange. */
  child: svg(
    S,
    S,
    shadedPill(6.5, 14, 11, 8, 2.5, 'orange'),
    circle(12, 10, 5, PALETTE.skin.base),
    pill(6.5, 4.5, 11, 4.5, yellow.base),
    pill(8, 5.2, 4, 1.4, yellow.light),
    circle(10.2, 11, 0.9, ink.base),
    circle(13.8, 11, 0.9, ink.base),
  ),
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
  /**
   * La ville : la mairie en petit — murs jaunes de la colonie, toit corail,
   * porte indigo et fanion. Devant le stock commun, face au sac d'Adam.
   */
  town: svg(
    S,
    S,
    flag(12, 1, 6, 'mint'),
    shadedBlock(4, 11, 16, 11, 3, 'yellow', 3),
    polygon([2.5, 12.5, 12, 5, 21.5, 12.5], coral.shade),
    polygon([3.5, 11.5, 12, 4.8, 20.5, 11.5], coral.base),
    pill(8, 8, 4, 1.8, coral.light),
    rect(10, 14.5, 4, 5, ink.base, 2),
    windowPane(5.5, 13, 3, 3, 'yellow'),
    windowPane(15.5, 13, 3, 3, 'yellow'),
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
  /** Les confettis d'un objectif réussi : des feuilles — la vie reprend. */
  leafMint: svg(S, S, confettiLeaf('mint')),
  leafYellow: svg(S, S, confettiLeaf('yellow')),
  petal: svg(S, S, confettiLeaf('coral')),
  /** Un croissant de lune et son étoile : les nuits affrontées. */
  moon: svg(
    S,
    S,
    shape('M14 3.5A9 9 0 1 0 21 16.5A7 7 0 1 1 14 3.5Z', yellow.shade),
    shape('M13.2 3A8.6 8.6 0 1 0 20.2 15.6A6.8 6.8 0 1 1 13.2 3Z', yellow.base),
    pill(5.5, 8, 2.6, 5, yellow.light),
    circle(18.5, 6, 1.6, cyan.base),
  ),
  /** Le cercle de portée et son rayon : jusqu'où un bâtiment sert. */
  range: svg(
    S,
    S,
    ring(12.4, 12.4, 10, 10, 2.6, yellow.shade),
    ring(12, 12, 9.6, 9.6, 2.4, yellow.base),
    line(12, 12, 19, 12, ink.base),
    circle(12, 12, 2.4, ink.base),
  ),
  /**
   * Le coffre d'un bâtiment : une malle jaune de la colonie, couvercle
   * corail comme les toits, fermoir indigo. Face au sac, dans la zone d'échange.
   */
  chest: svg(
    S,
    S,
    shadedBlock(3, 10, 18, 11, 3, 'yellow', 3),
    shadedBlock(2.5, 5, 19, 7, 2, 'coral', 3),
    pill(5, 6.5, 6, 1.8, coral.light),
    rect(10.5, 9.5, 3, 5, ink.base, 1.5),
  ),
  /** « Tout prendre » : une flèche blanche qui descend vers le sac. */
  takeAll: svg(S, S, group('translate(0.6 0.8)', arrow(true, violet.shade)), arrow(true, paper.base)),
  /** « Tout déposer » : une flèche blanche qui remonte vers le coffre. */
  depositAll: svg(S, S, group('translate(0.6 0.8)', arrow(false, mint.shade)), arrow(false, paper.base)),
  /** Le « i » qui déplie un texte d'ambiance. */
  info: svg(S, S, shadedCircle(12, 12, 10, 'cyan'), circle(12, 7.3, 1.7, paper.base), rect(10.5, 10.3, 3, 8.2, paper.base, 1.5)),
  /** Un drapeau planté : l'objectif en cours. */
  goal: svg(
    S,
    S,
    line(7, 4, 7, 20, ink.base),
    shape('M8 4.5h10.5a1.5 1.5 0 0 1 1.1 2.5L17 10l2.6 3a1.5 1.5 0 0 1-1.1 2.5H8Z', coral.shade),
    shape('M8 4.5h10a1.5 1.5 0 0 1 1.1 2.5L16.5 9.5l2.6 3a1.5 1.5 0 0 1-1.1 2.5H8Z', coral.base),
    pill(9, 6, 5, 2, coral.light),
    pill(3.5, 18.5, 9, 3, mint.base),
  ),
  /** Zoomer : une croix en capsules indigo, comme les deux barres de la pause. */
  zoomIn: svg(S, S, pill(4, 9.75, 16, 4.5, ink.base), pill(9.75, 4, 4.5, 16, ink.base), pill(5.5, 10.5, 4, 1.4, ink.light)),
  /** Dézoomer : la barre seule. */
  zoomOut: svg(S, S, pill(4, 9.75, 16, 4.5, ink.base), pill(5.5, 10.5, 4, 1.4, ink.light)),
  /** Revenir sur Adam : une mire indigo, son cœur corail au centre. */
  recenter: svg(
    S,
    S,
    circle(12, 12, 8, ink.base),
    circle(12, 12, 5.5, paper.base),
    pill(10.75, 1.5, 2.5, 5, ink.base),
    pill(10.75, 17.5, 2.5, 5, ink.base),
    pill(1.5, 10.75, 5, 2.5, ink.base),
    pill(17.5, 10.75, 5, 2.5, ink.base),
    shadedCircle(12, 12, 3, 'coral'),
  ),
} as const;

export type UiIcon = keyof typeof UI_ICONS;
