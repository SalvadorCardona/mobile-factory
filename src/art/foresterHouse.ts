/**
 * La maison du forestier : le logis d'un forestier, au milieu de sa forêt.
 *
 * Une maisonnette basse aux murs jaunes de la colonie, sous un **toit de
 * mousse** menthe — la vie a repris dessus, c'est son accent. Ce qui la
 * signe de loin : **la pancarte** plantée devant, une planche vue en 3/4 —
 * le dessus et la tranche — qui porte une pousse, et **les pots de semis**
 * alignés sous la fenêtre, avec **l'arrosoir** cyan. Une fleur au pied.
 *
 * Son chantier : le soubassement, les pots déjà là, la bêche plantée dans
 * la terre, et le panneau porte la pousse.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, circle, cushion, flower, group, leaf, line, pill, polygon, rect, shadedBlock, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, gableRoof, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, cyan, coral, mint, orange, paper } = PALETTE;

/** Le pictogramme de la pousse : une tige et deux feuilles, autour de `x, y`. */
function sproutGlyph(x: number, y: number): string {
  return line(x, y + 4, x, y - 1, mint.shade) + leaf(x, y + 1, 200, 0.75) + leaf(x, y - 1, -30, 0.85);
}

/** Un pot de semis : terre cuite corail, et sa pousse. */
function seedPot(x: number, bottom: number): string {
  return (
    rect(x, bottom - 6, 7, 6, coral.shade, 2) +
    rect(x, bottom - 6, 7, 4.5, coral.base, 2) +
    line(x + 3.5, bottom - 6, x + 3.5, bottom - 10, mint.shade) +
    leaf(x + 3.5, bottom - 9, -35, 0.6) +
    leaf(x + 3.5, bottom - 8, 215, 0.55)
  );
}

/** L'arrosoir : une panse cyan, son bec au trait, son anse. */
function wateringCan(x: number, bottom: number): string {
  return (
    line(x + 9, bottom - 5, x + 14, bottom - 10, cyan.shade) +
    line(x + 2, bottom - 9, x + 6, bottom - 11, ink.base) +
    shadedBlock(x, bottom - 9, 10, 9, 2.5, 'cyan', 3)
  );
}

/**
 * La pancarte, vue en 3/4 : deux piquets, une planche penchée — son dessus
 * blanc et sa tranche ombrée — et la pousse dessus. `x, y` : le haut gauche de la planche.
 */
function signboard(x: number, y: number): string {
  return (
    line(x + 3, y + 8, x + 3, y + 20, ink.base) +
    line(x + 14, y + 6, x + 14, y + 18, ink.base) +
    polygon([x, y + 3, x + 17, y, x + 17, y + 10, x, y + 13], paper.shade) +
    polygon([x, y + 2, x + 17, y - 1, x + 17, y + 8, x, y + 11], paper.base) +
    sproutGlyph(x + 8.5, y + 4.5)
  );
}

/** Le toit de mousse : le toit à deux pans menthe, et des coussins de mousse posés dessus. */
function mossRoof(): string {
  return gableRoof(0, 56, 50, 24, 'mint') + cushion(18, 40, 12, 5) + cushion(38, 44, 10, 4.5) + circle(29, 31, 1.6, coral.base);
}

function house(): string {
  return (
    shadedBlock(4, 50, 48, 38, 9, 'yellow') +
    mossRoof() +
    door(11, 64, 12, 24) +
    windowPane(31, 62, 11, 10, 'yellow') +
    seedPot(27, 86) +
    seedPot(35, 87) +
    wateringCan(4, 92) +
    signboard(45, 62) +
    flower(58, 88, 'violet')
  );
}

/** La bêche plantée dans la terre : le manche au trait, le fer cyan enfoncé. */
function spadeInGround(x: number, y: number): string {
  return (
    line(x, y, x - 2, y - 14, orange.shade) +
    pill(x - 5, y - 16, 6, 2.5, orange.base) +
    group(`translate(${x - 2.5} ${y}) rotate(4)`, rect(0, 0, 6, 7, cyan.shade, 2), rect(0, 0, 6, 5.5, cyan.base, 2))
  );
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    shadedBlock(4, 70, 48, 18, 6, 'yellow') +
    scaffold(7, 58, 40, 12) +
    seedPot(28, 86) +
    seedPot(36, 87) +
    spadeInGround(52, 82) +
    siteClutter(W, H) +
    siteSign(46, 42, sproutGlyph(53, 48))
  );
}

export const FORESTER_HOUSE = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, house()),
    damaged: svg(W, H, house(), damageMarks(4, 50, 48, 38)),
  },
} satisfies SpriteProto;
