/**
 * Ève, l'ingénieure de la colonie.
 *
 * Même gabarit qu'Adam (32 × 48, pieds en y = 38,4), mais on ne les confond
 * pas, même petits : Ève a un **chignon** rond sur le haut de la tête, un
 * bandeau jaune et un carré court qui descend sur les joues ; elle porte une
 * **salopette cyan** sur une chemise orange (la teinte des humains reste sur
 * les bras et les épaules), et une clé à molette à la main. Pas de sac, pas
 * d'écharpe, pas d'arc : ce sont les signes d'Adam.
 */

import { PALETTE, circle, highlight, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, type Facing } from './people.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8) tombe ici. */
const GROUND = 38.4;

const { ink, orange, cyan, skin, yellow, coral, paper } = PALETTE;

/** La clé à molette : un manche au trait, une tête ronde ouverte. */
function wrench(x: number, y: number): string {
  return line(x, y, x + 3, y - 6, paper.shade) + circle(x + 3.4, y - 7, 2.2, paper.shade) + circle(x + 4.2, y - 7.8, 1, orange.base);
}

/** Le corps d'Ève dans une direction, dans le cadre 32 × 48. Aussi utilisé sur le vélo-cargo. */
export function eveBody(facing: Facing): string {
  switch (facing) {
    case 'down':
      return (
        // Bras orange, chemise, puis la salopette cyan par-dessus.
        pill(7.5, 22, 4.5, 10, orange.shade) +
        pill(20, 22, 4.5, 10, orange.shade) +
        rect(10, 21, 12, 8, orange.base, 4) +
        rect(10, 24, 12, 11, cyan.shade, 4.5) +
        rect(10, 24, 12, 8.5, cyan.base, 4.5) +
        rect(12, 21.5, 8, 6, cyan.base, 2) +
        highlight(12, 21.5, 8, 6, 'cyan') +
        line(12.5, 21, 11.5, 19.5, cyan.shade) +
        line(19.5, 21, 20.5, 19.5, cyan.shade) +
        circle(16, 27.5, 1.1, yellow.base) +
        circle(9.7, 32, 2, skin.base) +
        circle(22.3, 32, 2, skin.base) +
        wrench(22.3, 31) +
        headFront()
      );

    case 'up':
      return (
        pill(7.5, 22, 4.5, 10, orange.shade) +
        pill(20, 22, 4.5, 10, orange.shade) +
        rect(10, 21, 12, 8, orange.base, 4) +
        rect(10, 24, 12, 11, cyan.shade, 4.5) +
        rect(10, 24, 12, 8.5, cyan.base, 4.5) +
        // Les bretelles se croisent dans le dos.
        line(12, 20.5, 19, 25.5, cyan.shade) +
        line(20, 20.5, 13, 25.5, cyan.shade) +
        circle(9.7, 32, 2, skin.base) +
        circle(22.3, 32, 2, skin.base) +
        headBack()
      );

    case 'side':
      return (
        rect(11, 21, 10, 8, orange.base, 4) +
        rect(11, 24, 10, 11, cyan.shade, 4) +
        rect(11, 24, 10, 8.5, cyan.base, 4) +
        rect(16, 21.5, 5, 6, cyan.base, 2) +
        highlight(11, 24, 10, 8.5, 'cyan') +
        pill(14.5, 22, 4.5, 10, orange.shade) +
        circle(17, 32, 2, skin.base) +
        wrench(17, 31) +
        headSide()
      );
  }
}

/** De face : le carré indigo qui encadre le visage, le chignon, le bandeau jaune. */
function headFront(): string {
  return (
    circle(16, 4.2, 3.8, ink.base) +
    pill(14, 2, 3, 1.6, ink.light) +
    rect(8.5, 6, 15, 14, ink.base, 6) +
    rect(10.5, 11, 11, 9, skin.base, 4.5) +
    pill(9.5, 7.5, 13, 2.8, yellow.base) +
    pill(11, 7.9, 4, 1.2, yellow.light) +
    circle(13.4, 15, 1.1, ink.base) +
    circle(18.6, 15, 1.1, ink.base) +
    circle(12.3, 17.4, 1.1, coral.light) +
    circle(19.7, 17.4, 1.1, coral.light)
  );
}

/** De dos : le carré, le chignon, le nœud du bandeau. */
function headBack(): string {
  return (
    circle(16, 4.2, 3.8, ink.base) +
    rect(8.5, 6, 15, 14, ink.base, 6) +
    pill(11, 9, 5, 2, ink.light) +
    pill(9.5, 7.5, 13, 2.8, yellow.base) +
    pill(19, 9, 4.5, 2.4, yellow.shade)
  );
}

/** De profil droit : le visage vers la droite, le carré et le chignon vers l'arrière. */
function headSide(): string {
  return (
    circle(12.5, 5, 3.8, ink.base) +
    rect(8.5, 6, 13, 14, ink.base, 5.5) +
    rect(15.5, 10.5, 8, 9, skin.base, 3.5) +
    pill(10, 7.5, 13, 2.8, yellow.base) +
    pill(11, 7.9, 4, 1.2, yellow.light) +
    circle(20.8, 14.6, 1.1, ink.base) +
    circle(21.4, 17.2, 1.1, coral.light)
  );
}

export const EVE_SPRITE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: svg(W, H, eveBody('down')),
    up: svg(W, H, eveBody('up')),
    side: svg(W, H, eveBody('side')),
    foot: svg(W, H, foot(GROUND)),
  },
} satisfies SpriteProto;
