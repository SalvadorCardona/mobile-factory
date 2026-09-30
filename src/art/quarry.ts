/**
 * La carrière : trois ouvriers y taillent la pierre dans les ruines du vieux monde.
 *
 * Un pan de ruine violette — un vieux parking effondré, deux piliers de
 * hauteurs inégales — entamé à coups de pioche ; à son pied, un abri jaune
 * de la colonie sous un toit plat orange. Ce qui la signe de loin : **la pile
 * de moellons corail** (la couleur de la pierre) au premier plan, et **la
 * grue au trait** qui soulève un bloc. Une pioche plantée dans la ruine, un
 * fanion en haut de la grue, une liane et deux fleurs sur le pilier.
 *
 * Son chantier : la ruine déjà là, la grue montée sans son bloc, et le
 * panneau porte la pioche.
 *
 * Cadre 64 × 96 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, flag, group, line, pill, rect, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, lifeAt, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 96;
const FOOTPRINT = 64;

const { ink, orange, cyan } = PALETTE;

/** Le pan de ruine violette : deux piliers inégaux, et les entailles de la taille. */
function ruin(): string {
  return (
    shadedBlock(4, 40, 18, 44, 8, 'violet') +
    shadedBlock(20, 52, 16, 32, 7, 'violet') +
    // Les marches taillées dans le béton : là où la pierre est partie.
    rect(24, 52, 10, 5, PALETTE.violet.shade, RADIUS.small) +
    rect(8, 60, 8, 4, PALETTE.violet.shade, RADIUS.small)
  );
}

/** Un moellon taillé : un petit bloc corail en trois tons. */
function block(x: number, y: number, w: number): string {
  return shadedBlock(x, y, w, w * 0.75, w * 0.22, 'coral', RADIUS.small);
}

/** La pile de moellons : trois, puis deux dessus. */
function blockPile(x: number, bottom: number): string {
  const w = 9;
  const h = w * 0.75;

  return (
    block(x, bottom - h, w) +
    block(x + w + 1, bottom - h, w) +
    block(x + 2 * (w + 1), bottom - h, w) +
    block(x + w * 0.5, bottom - 2 * h, w) +
    block(x + w * 1.5 + 1, bottom - 2 * h, w)
  );
}

/** La grue au trait : son mât, sa flèche, son hauban et le câble ; `load` y pend un bloc. */
function crane(load: boolean): string {
  const mast = 50;
  const top = 18;
  const tip = 28;

  return (
    line(mast, top, mast, 64, ink.base) +
    line(tip, top, mast + 8, top, ink.base) +
    line(mast, top + 9, mast - 9, top, ink.base) +
    line(tip + 3, top, tip + 3, top + 12, ink.light) +
    (load ? block(tip - 1, top + 12, 8) : '') +
    flag(mast, top - 12, 12, 'cyan')
  );
}

/** Une pioche plantée : le manche au trait, le fer cyan. `x, y` : le fer. */
function pickaxe(x: number, y: number): string {
  return (
    line(x, y, x + 7, y + 10, orange.shade) +
    group(`translate(${x} ${y}) rotate(-25)`, pill(-6, -1.6, 12, 3.2, cyan.shade), pill(-6, -1.6, 11, 2.2, cyan.base))
  );
}

/** Le pictogramme du panneau : une pioche, autour de `x, y`. */
function pickGlyph(x: number, y: number): string {
  return line(x - 2, y + 4, x + 2, y - 3, ink.base) + pill(x - 4, y - 4, 10, 2.6, cyan.shade);
}

function shed(): string {
  return (
    shadedBlock(34, 66, 26, 24, 7, 'yellow') +
    shadedBlock(31, 60, 32, 9, 3, 'orange', RADIUS.small) +
    door(40, 72, 10, 18)
  );
}

function quarry(): string {
  return (
    crane(true) +
    ruin() +
    lifeAt(5, 82, 18) +
    pickaxe(28, 46) +
    shed() +
    blockPile(4, 92)
  );
}

function site(): string {
  return siteGround(W, H, FOOTPRINT) + crane(false) + ruin() + siteClutter(W, H) + siteSign(40, 62, pickGlyph(47, 68));
}

export const QUARRY = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, quarry()),
    damaged: svg(W, H, quarry(), damageMarks(34, 66, 26, 24)),
  },
} satisfies SpriteProto;
