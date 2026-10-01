/**
 * Le four à charbon : un dôme de briques où le bois couve à l'étouffée.
 *
 * Un socle de pierre jaune de la colonie porte un **dôme de briques
 * corail**, joints en capsules plus sombres ; sa porte ronde, cerclée
 * d'indigo, rougeoie orange et jaune. Une cheminée indigo — la couleur du
 * charbon — sort du dôme sur la droite. À gauche, les bûches qui attendent ;
 * à droite, le tas de charbon déjà cuit et la pelle plantée dedans.
 *
 * `smoke` : trois bouffées rondes indigo clair au-dessus de la cheminée,
 * dans le même cadre. Le rendu ne les affiche, et ne les fait monter, que
 * lorsque le four cuit.
 *
 * Son chantier : le socle posé, la moitié basse du dôme sous son
 * échafaudage, les briques qui attendent, une flamme sur le panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, line, pill, rect, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, orange, yellow } = PALETTE;

/** La cheminée, de `top` jusqu'au dôme. */
function chimney(top: number): string {
  return (
    rect(42, top, 11, 46 - top, ink.shade, RADIUS.small) +
    rect(42, top, 8.5, 44 - top, ink.base, RADIUS.small) +
    pill(43.5, top + 4, 2.6, Math.max(4, (46 - top) * 0.4), ink.light) +
    pill(40, top - 2, 15, 6, ink.shade) +
    pill(40, top - 2, 15, 4, ink.light)
  );
}

/** Le dôme de briques : trois tons, puis les joints, rang par rang. */
function dome(x: number, y: number, w: number, h: number): string {
  const joints = [
    // Chaque rang : sa hauteur et les briques qu'il aligne, décalées d'un rang à l'autre.
    [y + 12, [x + 14, x + 26]],
    [y + 21, [x + 8, x + 20, x + 32]],
    [y + 30, [x + 5, x + 14, x + 38]],
  ] as const;

  return (
    rect(x, y, w, h, coral.shade, w / 2) +
    rect(x, y, w, h - 5, coral.base, w / 2) +
    pill(x + w * 0.18, y + 5, w * 0.3, 3.4, coral.light) +
    joints.map(([row, starts]) => starts.map((start) => pill(start, row, 8, 2.4, coral.shade)).join('')).join('')
  );
}

/** La porte ronde, cerclée d'indigo, où le feu rougeoie. */
function mouth(cx: number, cy: number): string {
  return (
    circle(cx, cy, 10, ink.base) +
    circle(cx, cy + 1, 8, orange.shade) +
    circle(cx - 0.5, cy + 1.5, 6.4, orange.base) +
    circle(cx - 0.5, cy + 2.5, 4, yellow.base) +
    pill(cx - 4, cy - 3.5, 4.5, 2.2, orange.light)
  );
}

/** Une bûche couchée, son bout rond tourné vers nous. */
function log(x: number, y: number, w: number): string {
  return (
    pill(x, y, w, 6, orange.shade) +
    pill(x, y, w, 4.6, orange.base) +
    circle(x + w - 3, y + 3, 3, orange.shade) +
    circle(x + w - 3.2, y + 2.8, 2.2, yellow.light)
  );
}

/** Le charbon cuit, en tas, et la pelle plantée dedans. */
function coalPile(x: number, y: number): string {
  return (
    line(x + 10, y - 9, x + 6, y + 2, ink.base) +
    rect(x + 8, y - 13, 5, 5, ink.light, 2) +
    circle(x + 3, y + 3, 3.2, ink.shade) +
    circle(x + 8, y + 3.5, 3, ink.shade) +
    circle(x + 5.5, y + 0.5, 2.8, ink.base) +
    circle(x + 4.8, y - 0.2, 1.1, ink.light)
  );
}

function kiln(): string {
  return (
    chimney(14) +
    dome(6, 34, 48, 46) +
    // Le socle de pierre de la colonie, sur lequel le dôme repose.
    shadedBlock(2, 72, 58, 20, 7, 'yellow') +
    mouth(28, 72) +
    log(3, 84, 14) +
    log(6, 79, 12) +
    coalPile(46, 84) +
    lifeAt(57, 78, 20)
  );
}

/** Trois bouffées rondes qui s'éloignent du haut de la cheminée. */
function smoke(): string {
  return (
    circle(47, 9, 4.6, ink.base) +
    circle(46.4, 8.4, 3.8, ink.light) +
    circle(53, 4.5, 3.6, ink.base) +
    circle(52.6, 4, 2.9, ink.light) +
    circle(58.5, 1.8, 2.4, ink.light)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Le socle posé, la moitié basse du dôme qui monte.
    shadedBlock(2, 72, 58, 20, 7, 'yellow') +
    rect(8, 56, 44, 22, coral.shade, RADIUS.block) +
    rect(8, 56, 44, 18, coral.base, RADIUS.block) +
    circle(28, 72, 8, ink.base) +
    scaffold(6, 44, 48, 18) +
    // Les briques du dôme attendent.
    shadedBlock(40, 84, 10, 6, 2, 'coral', 2) +
    shadedBlock(44, 79, 10, 6, 2, 'coral', 2) +
    siteClutter(W, H) +
    siteSign(4, 40, circle(11, 46, 3.5, orange.base) + circle(11, 47, 2, yellow.base))
  );
}

export const CHARCOAL_KILN = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, kiln()),
    damaged: svg(W, H, kiln(), damageMarks(6, 40, 48, 46)),
    smoke: svg(W, H, smoke()),
  },
  pivots: { smoke: [46, 12] },
} satisfies SpriteProto;
