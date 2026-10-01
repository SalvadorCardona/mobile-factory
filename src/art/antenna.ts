/**
 * L'Antenne : le projet de l'acte II, un pylône qui monte d'un étage à chaque
 * livraison et finit par appeler d'autres survivants.
 *
 * La plus haute silhouette du jeu (cadre 96 × 176 pour une emprise 3 × 3) :
 * un socle jaune de la colonie, parementé de blocs de pierre corail et de
 * plaques de fer cyan rivetées aux angles, une porte de technicien ; dessus,
 * un pylône indigo en treillis, une échelle au milieu.
 *
 * - **étage 1** (`ANTENNA`) : le pylône s'arrête à mi-hauteur sur une
 *   plateforme à rambarde, une lampe de chantier et un fanion corail ;
 * - **étage 2** (`ANTENNA_2`) : il monte plus haut, cerclé d'un collier de
 *   plaques de fer, et sa cage tient un cœur de la Reine — cerclé d'indigo,
 *   la vitre cyan : le vert fluo reste aux mutants ;
 * - **étage 3** (`ANTENNA_3`) : la parabole blanche et son émetteur corail au
 *   sommet, deux cages. `lit` : l'émetteur allumé, deux ondes cyan claires
 *   autour de lui et la lampe jaune — l'antenne parle, après le Signal.
 *
 * Son chantier : le socle à moitié monté, des blocs de pierre en pile, les
 * pieds du pylône qui attendent, une grue, et un pylône sur le panneau.
 */

import {
  PALETTE,
  RADIUS,
  circle,
  ellipse,
  flag,
  flower,
  groundShadow,
  ladder,
  line,
  pill,
  polygon,
  railing,
  rect,
  ring,
  shadedBlock,
  svg,
  vine,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crate, damageMarks, door, planks, siteClutter, siteGround, siteSign } from './building.ts';

const W = 96;
const H = 176;
const FOOTPRINT = 96;

/** Le haut du socle : le pylône part de là. */
const PLINTH_TOP = 118;
const CENTER = W / 2;

const { ink, coral, cyan, yellow, paper } = PALETTE;

/** Une plaque de fer rivetée. */
function plate(x: number, y: number, w: number, h: number): string {
  return (
    rect(x, y, w, h, cyan.shade, 3) +
    rect(x, y, w, h - 2, cyan.base, 3) +
    pill(x + 2, y + 1.5, w * 0.4, 2, cyan.light) +
    circle(x + 3, y + h - 4, 1, ink.base) +
    circle(x + w - 3, y + h - 4, 1, ink.base)
  );
}

/** Le socle : le bloc jaune, sa rangée de pierres, ses plaques d'angle, sa porte. */
function plinth(): string {
  return (
    groundShadow(CENTER, H - 6, 90, 12) +
    shadedBlock(6, PLINTH_TOP, 84, 52, 14, 'yellow', RADIUS.large) +
    // Les blocs de pierre du parement : une rangée de capsules corail.
    [12, 30, 48, 66]
      .map((x) => pill(x, 152, 16, 8, coral.shade) + pill(x, 151, 16, 6, coral.base) + pill(x + 2, 152, 6, 2, coral.light))
      .join('') +
    plate(8, 124, 14, 12) +
    plate(74, 124, 14, 12) +
    door(40, 128, 16, 24) +
    vine([10, 132, 12, 142, 10, 152, 12, 162], 3) +
    flower(80, 166, 'yellow') +
    flower(86, 164, 'coral')
  );
}

/**
 * Le pylône, du socle jusqu'à `top` : deux pieds indigo qui se rapprochent,
 * des croisillons au trait, l'échelle au milieu.
 */
function mast(top: number): string {
  const spread = (y: number): number => 8 + ((y - top) / (PLINTH_TOP - top)) * 18;
  const foot = spread(PLINTH_TOP);
  const head = spread(top);
  let braces = '';

  for (let y = top + 8; y < PLINTH_TOP - 8; y += 16) {
    const a = spread(y);
    const b = spread(y + 16);

    braces += line(CENTER - a, y, CENTER + b, y + 16, ink.light) + line(CENTER + a, y, CENTER - b, y + 16, ink.light);
  }

  return (
    braces +
    polygon([CENTER - foot - 3, PLINTH_TOP + 2, CENTER - foot + 2, PLINTH_TOP + 2, CENTER - head + 2, top, CENTER - head - 1, top], ink.base) +
    polygon([CENTER + foot - 2, PLINTH_TOP + 2, CENTER + foot + 3, PLINTH_TOP + 2, CENTER + head + 1, top, CENTER + head - 2, top], ink.base) +
    ladder(CENTER - 3.5, top + 4, PLINTH_TOP - top - 2)
  );
}

/** Une plateforme jaune en travers du pylône, sa rambarde. */
function platform(y: number, w: number): string {
  return shadedBlock(CENTER - w / 2, y, w, 9, 4, 'yellow', RADIUS.small) + railing(CENTER - w / 2 + 2, y - 8, w - 4, 8, 4);
}

/** La lampe de chantier : un bras, un globe jaune. `on` : allumée, un halo clair autour. */
function lamp(x: number, y: number, on: boolean): string {
  return (
    line(x - 6, y, x, y, ink.base) +
    (on ? circle(x + 2, y + 3, 6, yellow.light) : '') +
    circle(x + 2, y + 3, 3.4, yellow.shade) +
    circle(x + 1.6, y + 2.6, 2.4, yellow.base)
  );
}

/** Une cage à cœur radioactif : un cerceau indigo, la vitre cyan, le reflet. */
function cage(x: number, y: number): string {
  return (
    circle(x, y, 7, ink.base) +
    circle(x, y, 5.4, cyan.shade) +
    circle(x - 0.5, y - 0.6, 4.4, cyan.base) +
    pill(x - 3.5, y - 3.6, 3.6, 1.8, cyan.light) +
    line(x, y - 7, x, y - 10, ink.base)
  );
}

/** Le collier de plaques de fer du deuxième étage. */
function collar(y: number): string {
  return plate(CENTER - 22, y, 14, 12) + plate(CENTER - 7, y, 14, 12) + plate(CENTER + 8, y, 14, 12);
}

/** La parabole blanche, tournée vers le ciel en haut à gauche, et son émetteur. */
function dish(lit: boolean): string {
  return (
    (lit ? ring(26, 14, 22, 12, 3, cyan.light) + ring(26, 14, 14, 8, 3, cyan.light) : '') +
    ellipse(34, 26, 20, 11, paper.shade) +
    ellipse(32, 24, 18, 9, paper.base) +
    pill(20, 19, 12, 3, paper.light) +
    line(34, 26, 46, 34, ink.base) +
    line(32, 24, 26, 14, ink.base) +
    circle(26, 13, lit ? 4 : 3.2, coral.shade) +
    circle(25.5, 12.5, lit ? 3.2 : 2.4, lit ? yellow.light : coral.base)
  );
}

/** L'antenne à son étage `floor` (1 à 3) ; `lit` : l'émetteur allumé, après le Signal. */
function antenna(floor: 1 | 2 | 3, lit = false): string {
  switch (floor) {
    case 1:
      return plinth() + mast(70) + platform(66, 40) + lamp(70, 72, false) + flag(CENTER, 40, 18, 'coral');

    case 2:
      return plinth() + mast(38) + collar(84) + cage(30, 100) + platform(34, 30) + lamp(64, 42, false) + flag(CENTER, 8, 18, 'coral');

    case 3:
      return (
        plinth() +
        mast(38) +
        collar(84) +
        cage(30, 100) +
        cage(66, 100) +
        platform(34, 30) +
        lamp(64, 42, lit) +
        dish(lit) +
        flag(62, 8, 18, lit ? 'yellow' : 'coral')
      );
  }
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Le socle à mi-hauteur : la pierre se coule, le pylône attend.
    shadedBlock(10, 138, 76, 30, 10, 'yellow', RADIUS.large) +
    [16, 34, 52].map((x) => pill(x, 152, 16, 8, coral.shade) + pill(x, 151, 16, 6, coral.base)).join('') +
    // Les pieds du pylône, couchés au pied, et deux poutres déjà dressées.
    rect(22, 104, 4, 36, ink.base, 2) +
    rect(70, 104, 4, 36, ink.base, 2) +
    line(24, 112, 72, 132, ink.light) +
    // La grue, son câble, la caisse de plaques.
    line(84, 70, 84, 160, coral.shade) +
    line(84, 70, 48, 70, coral.shade) +
    line(52, 70, 52, 86, ink.light) +
    crate(46, 86, 12, 'cyan') +
    flag(84, 54, 14, 'coral') +
    planks(54, 166, 26) +
    siteClutter(W, H) +
    siteSign(30, 118, line(37, 120, 37, 128, ink.base) + line(33, 128, 37, 120, ink.base) + line(41, 128, 37, 120, ink.base) + circle(37, 120, 1.6, coral.base))
  );
}

/** Les marques des mutants, sur le socle. */
const DAMAGE = damageMarks(6, PLINTH_TOP, 84, 38);

export const ANTENNA = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, antenna(1)),
    damaged: svg(W, H, antenna(1), DAMAGE),
  },
} satisfies SpriteProto;

/** Le deuxième étage : sans chantier, le pylône monte sur place. */
export const ANTENNA_2 = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    built: svg(W, H, antenna(2)),
    damaged: svg(W, H, antenna(2), DAMAGE),
  },
} satisfies SpriteProto;

/** L'émetteur : le troisième étage, et sa version allumée après le Signal. */
export const ANTENNA_3 = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    built: svg(W, H, antenna(3)),
    damaged: svg(W, H, antenna(3), DAMAGE),
    lit: svg(W, H, antenna(3, true)),
  },
} satisfies SpriteProto;
