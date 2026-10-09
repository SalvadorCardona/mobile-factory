/**
 * La station de dépollution : elle rend sa terre saine à la terre polluée.
 *
 * Un socle jaune de la colonie, et dessus son accent, que nul autre
 * bâtiment ne porte : une **grande cuve violette** cerclée d'indigo, sa
 * pompe et son tuyau menthe qui plonge dans le sol. La menthe dit le
 * résultat, la vie qui revient : une pousse sort de la terre nettoyée au
 * pied du tuyau. Pour la vie : un bidon de bouillie violette posé contre le
 * socle, une flaque, deux fleurs.
 *
 * Son chantier : le socle à mi-hauteur, la cuve vide posée à côté, le
 * tuyau qui attend, une goutte sur le panneau.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, ellipse, flower, line, pill, polygon, rect, shadedBlock, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, mint, violet } = PALETTE;

/** La cuve : un cylindre violet debout, deux cerceaux indigo, et dedans la bouillie qui brille. */
function tank(x: number, top: number, full: boolean): string {
  return (
    shadedPill(x, top, 26, 50, 8, 'violet') +
    pill(x + 2, top + 16, 22, 3.4, ink.base) +
    pill(x + 2, top + 30, 22, 3.4, ink.base) +
    // Le hublot : on voit le niveau monter ou rester vide.
    rect(x + 8, top + 5, 10, 8, ink.base, RADIUS.small) +
    (full ? rect(x + 9, top + 8, 8, 4.5, violet.light, 2) : '')
  );
}

/** La pompe : un boîtier indigo sur le socle, un volant corail à son flanc. */
function pump(x: number, y: number): string {
  return shadedBlock(x, y, 12, 12, 3, 'ink', RADIUS.small) + circle(x + 6, y + 5, 2.6, PALETTE.coral.base) + pill(x + 2, y + 1.6, 4, 1.4, ink.light);
}

/** Le tuyau menthe qui sort de la pompe et plonge dans la terre, à droite. */
function pipe(): string {
  return (
    line(44, 66, 54, 66, mint.shade) +
    line(54, 66, 54, 82, mint.shade) +
    pill(52, 80, 5, 4, mint.base) +
    // La pousse qui renaît au pied du tuyau.
    line(54, 90, 54, 85, mint.shade) +
    polygon([54, 87, 50, 84, 52, 90], mint.base) +
    polygon([54, 86, 59, 83, 57, 90], mint.light)
  );
}

/** Le bidon de bouillie violette posé contre le socle. */
function barrel(x: number, y: number): string {
  return shadedPill(x, y, 9, 12, 3, 'violet') + pill(x + 1.5, y + 4, 6, 2, ink.base);
}

function purifier(): string {
  return (
    shadedBlock(5, 60, 54, 30, 8, 'yellow') +
    tank(8, 12, true) +
    pump(38, 62) +
    pipe() +
    barrel(10, 78) +
    ellipse(24, 93, 7, 2, violet.shade) +
    lifeAt(8, 90, 18) +
    flower(48, 92, 'coral', 0.8)
  );
}

/** Le pictogramme du panneau : une goutte violette, autour de `x, y`. */
function dropGlyph(x: number, y: number): string {
  return polygon([x, y - 4, x + 3, y + 1, x - 3, y + 1], violet.base) + circle(x, y + 1.5, 3, violet.base);
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(6, 68, 52, 20, 7, 'yellow') +
    scaffold(8, 52, 22, 16) +
    // La cuve vide attend sur le socle ; le tuyau n'est pas encore raccordé.
    tank(34, 40, false) +
    siteClutter(W, H) +
    siteSign(4, 50, dropGlyph(11, 55))
  );
}

export const PURIFIER_SPRITE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, purifier()),
    damaged: svg(W, H, purifier(), damageMarks(5, 60, 54, 30)),
  },
} satisfies SpriteProto;
