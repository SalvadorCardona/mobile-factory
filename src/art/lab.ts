/**
 * Le labo de recherche : une cabane de savant bricoleur.
 *
 * Un bloc jaune de la colonie, coiffé d'une **coupole violette** — son
 * accent, que nul autre bâtiment ne porte — percée d'une fente cyan comme un
 * observatoire. Une antenne indigo bricolée au sommet, sa boule corail et une
 * liane qui s'y enroule ; une petite cheminée indigo sur le côté. Devant, sur
 * une étagère, trois fioles rondes (cyan, corail, violette) : on voit à qui
 * on a affaire. Par la fenêtre ronde, une fiole qui bout.
 *
 * `smoke` : trois petits nuages blancs au-dessus de la cheminée, dans le
 * même cadre. Le rendu ne l'affiche, et ne le fait monter, que lorsqu'une
 * recherche tourne.
 *
 * Son chantier : les murs à mi-hauteur, l'arceau de la coupole sous son
 * échafaudage, les fioles qui attendent sur une caisse, une fiole sur le
 * panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, line, pill, rect, shadedBlock, svg, vine, windowPane, type Tone } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crate, damageMarks, door, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, violet, cyan, coral, paper } = PALETTE;

/** Une fiole ronde : la panse en trois tons, le col, le bouchon indigo. */
function flask(x: number, y: number, r: number, tone: Tone): string {
  const colors = PALETTE[tone];

  return (
    rect(x - r * 0.35, y - r * 2, r * 0.7, r * 1.4, paper.shade, RADIUS.small) +
    rect(x - r * 0.45, y - r * 2.3, r * 0.9, r * 0.5, ink.base, 1) +
    circle(x, y, r, colors.shade) +
    circle(x - r * 0.1, y - r * 0.12, r * 0.84, colors.base) +
    pill(x - r * 0.6, y - r * 0.55, r * 0.55, Math.max(1.5, r * 0.3), colors.light)
  );
}

/** La coupole : un dôme violet, sa fente cyan d'observatoire, son reflet. */
function dome(x: number, y: number, w: number, h: number): string {
  return (
    rect(x, y, w, h, violet.shade, w / 2) +
    rect(x, y, w, h - 4, violet.base, w / 2) +
    pill(x + w * 0.16, y + 4, w * 0.3, 3, violet.light) +
    rect(x + w * 0.58, y + 3, 5, h - 8, cyan.shade, 2.5) +
    pill(x + w * 0.58 + 1, y + 5, 2, 5, cyan.light)
  );
}

/** L'antenne bricolée : un mât, deux barres, une boule corail, une liane qui grimpe. */
function antenna(x: number, top: number, bottom: number): string {
  return (
    line(x, top, x, bottom, ink.base) +
    line(x - 5, top + 6, x + 5, top + 6, ink.base) +
    line(x - 3.5, top + 12, x + 3.5, top + 12, ink.base) +
    circle(x, top - 2, 3, coral.shade) +
    circle(x - 0.4, top - 2.4, 2.3, coral.base) +
    vine([x, bottom, x + 2, bottom - 6, x, bottom - 12], 2)
  );
}

/** La petite cheminée indigo, sur la droite du toit. */
function chimney(): string {
  return (
    rect(46, 30, 9, 22, ink.shade, RADIUS.small) +
    rect(46, 30, 7, 20, ink.base, RADIUS.small) +
    pill(47.5, 33, 2.4, 8, ink.light) +
    pill(44, 27, 13, 5, ink.shade) +
    pill(44, 27, 13, 3.5, ink.light)
  );
}

/** La fumée d'une recherche qui tourne : trois nuages blancs qui s'éloignent de la cheminée. */
function smoke(): string {
  return (
    circle(51, 20, 4.5, paper.shade) +
    circle(50.4, 19.4, 3.7, paper.base) +
    circle(57, 14, 3.6, paper.shade) +
    circle(56.6, 13.6, 2.9, paper.base) +
    circle(61, 8.5, 2.4, paper.base)
  );
}

function lab(): string {
  return (
    antenna(22, 12, 40) +
    chimney() +
    dome(8, 30, 40, 30) +
    shadedBlock(3, 50, 54, 40, 9, 'yellow') +
    // La corniche sous la coupole.
    rect(1, 47, 58, 7, violet.shade, RADIUS.small) +
    rect(1, 47, 58, 5, violet.base, RADIUS.small) +
    // Par la fenêtre ronde, une fiole qui bout.
    windowPane(8, 58, 16, 14, 'yellow') +
    flask(16, 68, 3, 'mint') +
    circle(18, 61.5, 1, paper.base) +
    door(34, 66, 13, 18) +
    // L'étagère des fioles, devant le mur.
    rect(4, 86, 26, 3, ink.base, 1.5) +
    flask(9, 82, 3.6, 'cyan') +
    flask(17.5, 82.5, 3, 'coral') +
    flask(25, 82, 3.4, 'violet') +
    circle(52, 88, 2, coral.light)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(4, 64, 54, 24, 7, 'yellow') +
    // L'arceau de la coupole, sous son échafaudage.
    rect(10, 48, 36, 18, violet.shade, 18) +
    rect(14, 52, 28, 14, violet.light, 14) +
    scaffold(8, 42, 42, 20) +
    // Les fioles attendent sur une caisse.
    crate(40, 76, 12) +
    flask(44, 73, 2.6, 'cyan') +
    flask(50, 73.5, 2.2, 'coral') +
    siteClutter(W, H) +
    siteSign(4, 46, flask(11, 54, 2.4, 'violet'))
  );
}

export const LAB = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, lab()),
    damaged: svg(W, H, lab(), damageMarks(3, 50, 54, 40)),
    smoke: svg(W, H, smoke()),
  },
  pivots: { smoke: [50, 22] },
} satisfies SpriteProto;
