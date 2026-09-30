/**
 * La cabane de bûcheron : le logis de deux bûcherons, et le coffre de leur bois.
 *
 * Une cabane basse aux murs de rondins — des bûches couchées, jaunes comme
 * toute la colonie —, sous un toit à deux pans en bardeaux orange, son
 * accent. Ce qui la signe de loin : **la pile de bûches** à son flanc, les
 * bouts ronds tournés vers nous, et **la hache plantée dans la souche**
 * devant. Un fanion au faîte, une liane et deux fleurs au pied.
 *
 * Son chantier : les deux premiers rangs de rondins, la souche et sa hache
 * déjà là — on sait ce qui se bâtit —, et le panneau porte la hache.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, circle, ellipse, flag, group, line, pill, rect, shadedBlock, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, gableRoof, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, orange, cyan, yellow } = PALETTE;

/** Des murs de rondins : un bloc jaune, et les joints des bûches couchées. */
function logWall(x: number, y: number, w: number, h: number): string {
  const joints = [];

  for (let row = y + 9; row < y + h - 6; row += 8) joints.push(pill(x + 3, row, w - 6, 2, yellow.shade));
  return shadedBlock(x, y, w, h, 9, 'yellow') + joints.join('');
}

/** Un bout de bûche vu de face : l'écorce, le bois clair et son cœur. */
function logEnd(cx: number, cy: number, r: number): string {
  return circle(cx + 0.6, cy + 0.8, r, orange.shade) + circle(cx, cy, r - 0.6, orange.base) + circle(cx, cy, r * 0.45, yellow.light);
}

/** La pile de bûches : trois, deux, une, en pyramide. */
function logPile(x: number, bottom: number): string {
  const r = 3.8;
  const step = r * 2;

  return (
    [0, 1, 2].map((i) => logEnd(x + r + i * step, bottom - r, r)).join('') +
    [0, 1].map((i) => logEnd(x + r * 2 + i * step, bottom - r - step * 0.85, r)).join('') +
    logEnd(x + r * 3, bottom - r - step * 1.7, r)
  );
}

/**
 * La souche et sa hache plantée : le manche au trait, penché vers la
 * droite, le fer cyan enfoncé dans le bois. `x, y` : le haut de la souche.
 */
function stumpWithAxe(x: number, y: number): string {
  return (
    rect(x - 7, y, 14, 9, orange.shade, 4) +
    ellipse(x, y + 1.8, 7, 3, orange.base) +
    ellipse(x, y + 1.8, 4, 1.6, yellow.light) +
    line(x - 1, y - 1, x + 6, y - 13, orange.shade) +
    group(
      `translate(${x - 1} ${y + 1}) rotate(-30)`,
      rect(-6, -5, 8, 6, cyan.shade, 1.5),
      rect(-6, -5, 8, 4.8, cyan.base, 1.5),
      pill(-5, -4.3, 3.5, 1.4, cyan.light),
    )
  );
}

/** Le pictogramme du panneau : une hache, autour de `x, y`. */
function axeGlyph(x: number, y: number): string {
  return line(x - 3, y + 4, x + 3, y - 3, ink.base) + rect(x + 0.5, y - 5, 4, 4.5, cyan.shade, 1.5);
}

function camp(): string {
  return (
    flag(22, 22, 14, 'coral') +
    logWall(3, 54, 38, 34) +
    gableRoof(0, 44, 60, 36, 'orange') +
    door(12, 66, 12, 22) +
    windowPane(28, 66, 9, 9, 'yellow') +
    logPile(41, 78) +
    stumpWithAxe(52, 81) +
    lifeAt(4, 88, 20)
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    logWall(3, 68, 38, 20) +
    scaffold(6, 56, 30, 12) +
    stumpWithAxe(52, 74) +
    siteClutter(W, H) +
    siteSign(45, 44, axeGlyph(52, 50))
  );
}

export const LUMBER_CAMP = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, camp()),
    damaged: svg(W, H, camp(), damageMarks(3, 54, 38, 34)),
  },
} satisfies SpriteProto;
