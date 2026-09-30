/**
 * Le poste de logistique : le quai d'où partent les logisticiens.
 *
 * Un bloc bas aux murs jaunes, comme toute la colonie, sous un **auvent
 * rayé** blanc et corail, bordé de festons — l'étal d'un marché, son accent.
 * Ce qui le signe de loin : **le panneau fléché** planté à son flanc, deux
 * planches blanches pointées vers la mairie et vers les producteurs, **les
 * caisses empilées** au pied, et **la charrette** garée devant. Un fanion
 * cyan au poteau, une liane qui grimpe.
 *
 * Son chantier : le soubassement, les caisses déjà livrées et le panneau
 * fléché déjà planté — on sait ce qui se bâtit —, et le panneau du chantier
 * porte une flèche.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, flag, line, pill, polygon, rect, shadedBlock, svg, vine } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crate, damageMarks, door, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, paper } = PALETTE;

/** Une planche fléchée, pointe à droite (`dir = 1`) ou à gauche (`dir = -1`), depuis le poteau en `x`. */
function arrowBoard(x: number, y: number, w: number, dir: 1 | -1): string {
  const h = 6;
  const tip = x + dir * w;
  const neck = tip - dir * 4;
  const board = (dy: number): number[] => [x, y + dy, neck, y + dy, tip, y + h / 2 + dy, neck, y + h + dy, x, y + h + dy];

  return (
    polygon(board(1.5), paper.shade) +
    polygon(board(0), paper.base) +
    pill(Math.min(x, neck) + 1.5, y + 2.2, Math.abs(neck - x) - 3, 1.6, coral.base)
  );
}

/** Le panneau fléché : un poteau indigo, deux planches, un fanion au sommet. */
function signpost(x: number, top: number, bottom: number): string {
  return (
    flag(x, top - 12, 12, 'cyan') +
    line(x, top, x, bottom, ink.base) +
    arrowBoard(x - 1, top + 3, 13, 1) +
    arrowBoard(x + 1, top + 12, 12, -1)
  );
}

/** L'auvent rayé : une toile blanche, des bandes corail, des festons au bord, posée sur deux poteaux. */
function awning(x: number, y: number, w: number): string {
  const stripes = [];
  const scallops = [];

  for (let sx = x + 5; sx < x + w - 4; sx += 9) stripes.push(pill(sx, y + 1, 4.5, 9, coral.base));
  for (let cx = x + 4; cx <= x + w - 4; cx += 5) scallops.push(circle(cx, y + 12, 2.6, (cx - x) % 10 === 4 ? coral.shade : paper.shade));

  return (
    rect(x, y, w, 13, paper.shade, RADIUS.small) +
    rect(x, y, w, 11, paper.base, RADIUS.small) +
    stripes.join('') +
    scallops.join('') +
    pill(x + 3, y + 2, w * 0.3, 2, paper.light)
  );
}

/** La charrette : une caisse sur une roue, ses brancards levés. */
function cart(x: number, y: number): string {
  return (
    line(x + 17, y + 4, x + 24, y - 1, ink.base) +
    shadedBlock(x, y, 18, 10, 3, 'orange', RADIUS.small) +
    pill(x + 3, y - 3, 6, 4, coral.base) +
    pill(x + 9, y - 2.5, 5, 3.5, paper.shade) +
    circle(x + 6, y + 10, 4, ink.base) +
    circle(x + 6, y + 10, 1.5, ink.light)
  );
}

function post(): string {
  return (
    shadedBlock(4, 52, 40, 36, 9, 'yellow') +
    door(18, 64, 13, 24) +
    line(5, 46, 5, 84, ink.base) +
    line(43, 46, 43, 84, ink.base) +
    awning(0, 38, 48) +
    vine([43, 54, 45, 62, 43, 70, 45, 78], 3) +
    signpost(55, 44, 78) +
    crate(45, 77, 11) +
    crate(54, 79, 9) +
    crate(48, 67, 10) +
    cart(3, 76) +
    lifeAt(34, 89, 10)
  );
}

/** Le pictogramme du panneau de chantier : une flèche corail, autour de `x, y`. */
function arrowGlyph(x: number, y: number): string {
  return polygon([x - 4, y - 1.5, x + 1, y - 1.5, x + 1, y - 4, x + 5, y, x + 1, y + 4, x + 1, y + 1.5, x - 4, y + 1.5], coral.base);
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(4, 70, 40, 18, 6, 'yellow') +
    scaffold(6, 56, 34, 14) +
    signpost(55, 50, 84) +
    crate(44, 80, 10) +
    siteClutter(W, H) +
    siteSign(18, 40, arrowGlyph(25, 46))
  );
}

export const LOGISTICS_POST = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, post()),
    damaged: svg(W, H, post(), damageMarks(6, 52, 36, 36)),
  },
} satisfies SpriteProto;
