/**
 * Pièces communes aux bâtiments de la colonie.
 *
 * Tous les bâtiments du joueur ont des murs **jaunes** — la teinte réservée
 * à la colonie — et se distinguent par leur toit, leur silhouette et leurs
 * détails : un drapeau, une échelle, une grue, une antenne. Chacun existe en
 * trois états, trois morceaux du même cadre :
 *
 * - `site` : le chantier. Des murs à mi-hauteur, un échafaudage, une grue
 *   corail qui soulève une caisse, un fanion — la maquette validée ;
 * - `built` : le bâtiment fini ;
 * - `damaged` : le même, cabossé par les mutants — un trou, des planches
 *   clouées en croix, des gravats au pied. Il reste debout : c'est gai, même
 *   cassé.
 *
 * Cadre large comme l'emprise, plus haut qu'elle ; ancre (0, 1).
 */

import {
  PALETTE,
  RADIUS,
  circle,
  flag,
  flower,
  group,
  ladder,
  line,
  pill,
  polygon,
  railing,
  rect,
  shadedBlock,
  vine,
  type Tone,
} from '../data/artDirection.ts';

const { ink, coral, orange, violet, yellow } = PALETTE;

/** Toit à deux pans : le pan gauche éclairé, le pan droit dans l'ombre. */
export function gableRoof(left: number, right: number, eave: number, peak: number, tone: Tone = 'coral'): string {
  const middle = (left + right) / 2;
  const colors = PALETTE[tone];

  return (
    polygon([left, eave, middle, peak, right, eave], colors.base) +
    polygon([middle, peak, right, eave, middle + (right - middle) * 0.35, eave], colors.shade) +
    polygon([left + (middle - left) * 0.35, eave - 1.5, middle - 2, peak + 4, middle - 0.5, peak + 6.5], colors.light)
  );
}

/** Une porte arrondie en creux, avec sa poignée. */
export function door(x: number, y: number, w: number, h: number): string {
  return (
    rect(x, y, w, h, violet.shade, w / 2) +
    pill(x + w * 0.2, y + 3, w * 0.35, 2, violet.light) +
    circle(x + w * 0.75, y + h * 0.6, 1.2, yellow.light)
  );
}

/** Une caisse en trois tons, et sa planche en travers. */
export function crate(x: number, y: number, size: number, tone: Tone = 'orange'): string {
  return shadedBlock(x, y, size, size, size * 0.25, tone, RADIUS.small) + line(x + 2, y + size * 0.38, x + size - 2, y + size * 0.38, PALETTE[tone].shade);
}

/** Une pile de planches. */
export function planks(x: number, y: number, w: number): string {
  return pill(x, y + 3.5, w, 3.5, orange.shade) + pill(x + 1, y, w - 2, 3.5, orange.base);
}

/**
 * Le chantier : la dalle, des murs à mi-hauteur, un échafaudage, une grue qui
 * soulève une caisse, une échelle, un fanion, des caisses et des planches.
 * `width × height` est le cadre ; l'emprise en occupe le bas.
 */
export function siteArt(width: number, height: number, footprint: number): string {
  const top = height - footprint;
  const wallTop = top + footprint * 0.45;
  const wallHeight = height - 6 - wallTop;
  const mast = width * 0.16;
  const jibEnd = width * 0.6;
  const craneTop = Math.max(4, top - footprint * 0.25);

  return (
    shadedBlock(3, height - 16, width - 6, 12, 4, 'yellow', RADIUS.block) +
    shadedBlock(5, wallTop, width - 10, wallHeight, 9, 'yellow', RADIUS.block) +
    // L'échafaudage : trois poteaux et une lisse, au trait.
    railing(8, wallTop - 12, width - 16, 12, 3, ink.base) +
    // La grue corail, sa flèche, son câble et la caisse.
    line(mast, craneTop, mast, height - 8, coral.shade) +
    line(mast, craneTop, jibEnd, craneTop, coral.shade) +
    line(mast, craneTop + 9, mast + 9, craneTop, coral.shade) +
    line(jibEnd - 4, craneTop, jibEnd - 4, craneTop + 14, ink.light) +
    crate(jibEnd - 9, craneTop + 14, 10) +
    flag(mast, craneTop - 12, 12, 'cyan') +
    ladder(width - 12, wallTop - 10, height - 8 - (wallTop - 10)) +
    crate(6, height - 20, 11) +
    planks(width * 0.45, height - 12, width * 0.3)
  );
}

/**
 * Les marques des mutants sur un mur (`x, y, w, h`) : un trou, deux planches
 * clouées en croix dessus, des gravats au pied.
 */
export function damageMarks(x: number, y: number, w: number, h: number): string {
  const hx = x + w * 0.62;
  const hy = y + h * 0.28;

  return (
    rect(hx, hy, w * 0.24, h * 0.3, ink.base, RADIUS.block) +
    rect(hx + 2, hy + 2, w * 0.24 - 4, h * 0.3 - 5, ink.light, RADIUS.small) +
    group(`translate(${hx - 3} ${hy + h * 0.08}) rotate(18)`, pill(0, 0, w * 0.34, 3.5, orange.base)) +
    group(`translate(${hx - 2} ${hy + h * 0.24}) rotate(-16)`, pill(0, 0, w * 0.32, 3.5, orange.shade)) +
    pill(x + 2, y + h - 3, 7, 4, yellow.shade) +
    pill(x + w * 0.4, y + h - 2, 5, 3.5, violet.light) +
    pill(x + w - 9, y + h - 3, 8, 4, yellow.shade)
  );
}

/** Deux fleurs et une liane au pied d'un mur : la vie reprend. */
export function lifeAt(x: number, y: number, vineHeight: number): string {
  return (
    vine([x, y - vineHeight, x + 2.5, y - vineHeight * 0.66, x, y - vineHeight * 0.33, x + 2.5, y], 3) +
    flower(x + 5, y - 2, 'coral') +
    flower(x + 10, y, 'violet')
  );
}
