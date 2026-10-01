/**
 * Le poste de construction : le camp des bâtisseurs.
 *
 * Un atelier bas aux murs jaunes, comme toute la colonie, coiffé d'un toit
 * plat de planches, et, qui le signe de loin, **l'échafaudage** : une tour
 * de lisses et d'échelles qui monte plus haut que tout, un fanion corail au
 * sommet. Au pied : **l'établi** — un plateau de planches sur pieds indigo,
 * une scie et un casque jaune posé dessus —, **le tas de planches**, et **la
 * barrière rayée** indigo et blanc, son accent, que nul autre bâtiment ne
 * porte. Une liane grimpe à l'échafaudage.
 *
 * Son chantier : l'échafaudage est déjà monté — c'est lui qui bâtit le
 * reste —, l'établi aussi, les murs sortent à peine, et le panneau porte un
 * casque.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, flag, ladder, line, pill, polygon, rect, shadedBlock, svg, vine, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, lifeAt, planks, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, coral, cyan, orange, paper, yellow } = PALETTE;

/** L'échafaudage : deux montants, trois étages de lisses, une échelle, le fanion au sommet. */
function scaffolding(x: number, top: number, foot: number, w: number): string {
  const floors = [];

  for (let y = top; y < foot - 4; y += 14) floors.push(line(x, y, x + w, y, ink.base) + line(x, y + 14, x + w, y, ink.light));

  return (
    line(x, top, x, foot, ink.base) +
    line(x + w, top, x + w, foot, ink.base) +
    floors.join('') +
    // Le plancher du haut : une planche orange.
    pill(x - 2, top - 2.5, w + 4, 3.5, orange.base) +
    ladder(x + w / 2 - 3.5, top, foot - top, ink.base, 7) +
    flag(x + w, top - 14, 13, 'coral')
  );
}

/** L'établi : un plateau de planches sur deux pieds, une scie et un casque posés dessus. */
function workbench(x: number, y: number, w: number): string {
  return (
    line(x + 3, y + 4, x + 3, y + 12, ink.base) +
    line(x + w - 3, y + 4, x + w - 3, y + 12, ink.base) +
    shadedBlock(x, y, w, 6, 2, 'orange', RADIUS.small) +
    pill(x + 1.5, y + 0.8, w * 0.4, 1.6, orange.light) +
    // La scie : une lame cyan, sa poignée corail.
    rect(x + 2, y - 3.5, 9, 3, cyan.base, 1) +
    pill(x + 2.5, y - 3.2, 4, 1, cyan.light) +
    rect(x + 10, y - 4.5, 3.5, 4, coral.base, 1.5) +
    // Un casque de chantier qui attend sa tête.
    rect(x + w - 10, y - 5.5, 8, 5, yellow.base, 3) +
    pill(x + w - 11, y - 1.5, 10, 1.8, yellow.shade) +
    pill(x + w - 8.5, y - 4.8, 3, 1.2, yellow.light)
  );
}

/** La barrière rayée : une planche blanche à bandes indigo, sur deux pieds. */
function barrier(x: number, y: number, w: number): string {
  const stripes = [];

  // Des bandes en biais, comme sur toute barrière de chantier.
  for (let sx = x + 2; sx < x + w - 5; sx += 6) stripes.push(polygon([sx + 2, y, sx + 5, y, sx + 3, y + 5, sx, y + 5], ink.base));

  return (
    line(x + 3, y + 4, x + 1, y + 11, ink.base) +
    line(x + w - 3, y + 4, x + w - 1, y + 11, ink.base) +
    rect(x, y, w, 6, paper.shade, RADIUS.small) +
    rect(x, y, w, 5, paper.base, RADIUS.small) +
    stripes.join('')
  );
}

function post(): string {
  return (
    scaffolding(6, 18, 84, 16) +
    shadedBlock(20, 54, 40, 34, 9, 'yellow') +
    // Le toit plat : un plancher qui déborde.
    shadedBlock(17, 47, 46, 9, 3, 'orange', RADIUS.small) +
    pill(20, 48.5, 16, 2, orange.light) +
    line(30, 48, 30, 54, orange.shade) +
    line(46, 48, 46, 54, orange.shade) +
    door(25, 62, 13, 24) +
    windowPane(45, 58, 10, 9, 'yellow') +
    vine([22, 30, 20, 44, 22, 58, 20, 72], 4) +
    workbench(43, 70, 18) +
    planks(2, 84, 20) +
    planks(4, 80, 16) +
    barrier(40, 86, 22) +
    lifeAt(20, 91, 6)
  );
}

/** Le pictogramme du panneau de chantier : un casque jaune, autour de `x, y`. */
function helmetGlyph(x: number, y: number): string {
  return rect(x - 4, y - 3, 8, 5, yellow.base, 3) + pill(x - 5, y + 1, 10, 2, yellow.shade);
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    scaffolding(6, 30, 84, 16) +
    shadedBlock(24, 74, 34, 14, 5, 'yellow') +
    workbench(40, 64, 18) +
    siteClutter(W, H) +
    siteSign(26, 44, helmetGlyph(33, 50))
  );
}

export const CONSTRUCTION_POST = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, post()),
    damaged: svg(W, H, post(), damageMarks(20, 54, 40, 34)),
  },
} satisfies SpriteProto;
