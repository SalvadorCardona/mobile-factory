/**
 * Le puits : un ouvrier y tire l'eau que boit la colonie.
 *
 * Une margelle ronde de pierres jaunes de la colonie, et dedans **l'eau
 * cyan** — la teinte de l'eau, que nul autre bâtiment ne montre en grand.
 * Au-dessus, deux montants indigo, un treuil et sa manivelle, sous un petit
 * toit à deux pans orange ; le seau pend au bout de la corde. Ce qui
 * raconte une vie : un seau plein posé au pied, une flaque, une liane qui
 * grimpe à un montant, deux fleurs.
 *
 * Son chantier : la margelle à moitié montée, les montants sans toit, et le
 * panneau porte une goutte.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, ellipse, line, pill, polygon, rect, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, gableRoof, lifeAt, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, cyan, yellow } = PALETTE;

/** La margelle : un gros anneau de pierres jaunes vu en 3/4, et l'eau dedans. `low` : à moitié montée. */
function curb(low: boolean): string {
  const top = low ? 66 : 56;

  return (
    shadedBlock(8, top, 48, 90 - top, 10, 'yellow', RADIUS.large) +
    // Les joints des pierres, sur la face avant.
    pill(14, 80, 8, 2, yellow.shade) +
    pill(28, 82, 8, 2, yellow.shade) +
    pill(42, 80, 8, 2, yellow.shade) +
    // Le trou, puis l'eau qui brille.
    ellipse(32, top + 7, 18, 6, ink.base) +
    ellipse(32, top + 8, 15.5, 4.5, cyan.shade) +
    ellipse(31, top + 7.6, 13, 3.4, cyan.base) +
    pill(22, top + 5.6, 7, 1.8, cyan.light)
  );
}

/** Le seau : un petit seau cyan plein. `x, y` : son coin haut gauche. */
function bucket(x: number, y: number): string {
  return (
    rect(x, y, 9, 8, cyan.shade, RADIUS.small) +
    rect(x, y, 8, 6.5, cyan.base, RADIUS.small) +
    pill(x + 1.5, y + 1.2, 3, 1.5, cyan.light) +
    line(x + 1, y, x + 8, y, ink.base)
  );
}

/** Les montants, le treuil, la manivelle et la corde ; `roof` : le petit toit posé dessus. */
function frame(roof: boolean): string {
  return (
    line(12, 30, 12, 64, ink.base) +
    line(52, 30, 52, 64, ink.base) +
    // Le treuil : un rouleau orange en travers, la manivelle à droite.
    shadedBlock(12, 34, 40, 6, 2, 'orange', RADIUS.small) +
    line(52, 37, 58, 37, ink.base) +
    line(58, 37, 58, 43, ink.base) +
    line(32, 40, 32, 50, ink.light) +
    (roof ? gableRoof(6, 58, 32, 14, 'orange') + bucket(28, 48) : '')
  );
}

function well(): string {
  return (
    frame(true) +
    curb(false) +
    lifeAt(48, 90, 20) +
    // Le seau plein au pied, sa flaque.
    ellipse(14, 93, 7, 2, cyan.shade) +
    bucket(6, 82) +
    circle(17, 93, 1.2, cyan.light)
  );
}

/** Le pictogramme du panneau : une goutte, autour de `x, y`. */
function dropGlyph(x: number, y: number): string {
  return polygon([x, y - 4, x + 3, y + 1, x - 3, y + 1], cyan.base) + circle(x, y + 1.5, 3, cyan.base);
}

function site(): string {
  return siteGround(W, H, FOOTPRINT) + frame(false) + curb(true) + siteClutter(W, H) + siteSign(44, 46, dropGlyph(51, 52));
}

export const WELL = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, well()),
    damaged: svg(W, H, well(), damageMarks(10, 68, 44, 22)),
  },
} satisfies SpriteProto;
