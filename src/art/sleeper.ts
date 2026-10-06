/**
 * Un habitant qui dort dehors, faute de lit : allongé par terre, la tête sur
 * son baluchon, sous une petite couverture rapiécée.
 *
 * Vu en 3/4, couché de gauche à droite : les cheveux indigo et le visage
 * aux yeux clos sur le baluchon violet, la couverture orange — la teinte des
 * humains — et sa pièce menthe, les deux pieds qui dépassent. Au-dessus, le
 * « z » du dormeur, dans sa bulle blanche. Ça se voit, et ça se lit : il
 * n'a pas de maison.
 *
 * Cadre 40 × 30 ; le point de position tombe au milieu du corps, au sol.
 */

import { PALETTE, circle, groundShadow, pill, polyline, rect, shadedPill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 40;
const H = 30;
const { ink, skin, mint, coral, paper } = PALETTE;

function sleeper(): string {
  return (
    groundShadow(21, 24, 34, 6) +
    // Le baluchon sous la tête.
    shadedPill(1, 16, 12, 8, 2.5, 'violet') +
    // La tête : les cheveux, le visage, les yeux clos, la joue.
    circle(8, 16, 5, ink.base) +
    circle(9.6, 17.6, 4.2, skin.base) +
    pill(8.4, 17.4, 2.6, 1, ink.base) +
    circle(11.6, 19.2, 1, coral.light) +
    // La couverture : la face avant, le dessus, un reflet, la pièce menthe.
    shadedPill(12, 14, 25, 11, 3, 'orange') +
    rect(26, 16, 6, 5, mint.base, 1.5) +
    pill(27, 16.5, 3, 1.2, mint.light) +
    // Les pieds qui dépassent.
    pill(35, 15.5, 4, 3.4, ink.shade) +
    pill(35, 19.5, 4, 3.4, ink.shade) +
    // La bulle du dormeur : un « z ».
    circle(17, 7, 5.5, paper.shade) +
    circle(16.6, 6.6, 5.2, paper.base) +
    circle(12.5, 12, 1.3, paper.shade) +
    polyline([14.6, 4.6, 18.6, 4.6, 14.6, 8.6, 18.6, 8.6], ink.base)
  );
}

export const SLEEPER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.75,
  parts: {
    body: svg(W, H, sleeper()),
  },
} satisfies SpriteProto;
