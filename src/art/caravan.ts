/**
 * La caravane de troc : une charrette tirée par un survivant.
 *
 * Vue de profil, tournée vers la droite (le rendu la retourne quand elle va
 * à gauche), à la manière du vélo-cargo d'Ève : une caisse de bois orange
 * sous une bâche corail en arceau, des marchandises qui dépassent à
 * l'arrière — une caisse cyan, un bocal jaune —, une lanterne au crochet,
 * un fanion jaune, et devant, entre les brancards, le marchand : un humain
 * en tunique orange, chapeau à large bord et écharpe. La roue est un
 * morceau à part, que le rendu fait tourner pendant qu'elle roule.
 */

import {
  PALETTE,
  RADIUS,
  circle,
  flag,
  flower,
  group,
  line,
  pill,
  rect,
  shadedBlock,
  shadedPill,
  svg,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { humanBody } from './people.ts';

const W = 84;
const H = 64;
/** Le sol dans le cadre : l'ancre (0.5, GROUND / H). */
const GROUND = 58;

const WHEEL = [27, GROUND - 9] as const;

const { ink, orange, coral, yellow, paper } = PALETTE;

function cart(): string {
  return (
    // Le brancard qui touche le sol à l'arrêt, la béquille.
    line(8, GROUND - 14, 6, GROUND - 2, ink.base) +
    // Ce qui dépasse à l'arrière : une caisse cyan, un bocal jaune.
    shadedBlock(2, 20, 12, 12, 3, 'cyan', RADIUS.small) +
    shadedPill(11, 16, 7, 12, 2, 'yellow') +
    // La bâche corail en arceau, deux cordes indigo.
    shadedPill(10, 12, 38, 26, 6, 'coral') +
    line(22, 14, 22, 30, coral.shade) +
    line(36, 14, 36, 30, coral.shade) +
    flag(29, 3, 11, 'yellow') +
    // La caisse de bois orange, ses planches, une fleur qui y a poussé.
    shadedBlock(6, 30, 44, 17, 5, 'orange', RADIUS.small) +
    line(12, 34, 44, 34, orange.shade) +
    line(12, 39, 44, 39, orange.shade) +
    flower(46, 27, 'violet', 0.8) +
    // La lanterne au crochet, à l'avant.
    line(50, 26, 50, 30, ink.base) +
    rect(47.5, 29, 5, 6, yellow.base, 2) +
    pill(48.5, 30, 2, 3, yellow.light) +
    // Les brancards, jusqu'aux mains du marchand.
    line(48, 41, 70, 37, ink.base) +
    line(46, 44, 68, 40, ink.light) +
    // Le marchand, chapeau à large bord.
    group(`translate(52 ${GROUND - 38})`, humanBody('side', { pack: false, scarf: true, cap: false }) + hat()) +
    // Ses pieds, pris dans le pas.
    pill(62, GROUND - 3.6, 6, 3.6, ink.shade) +
    pill(69, GROUND - 3.6, 6, 3.6, ink.shade)
  );
}

/** Un chapeau de voyageur : un large bord jaune et sa calotte, posés sur les cheveux. */
function hat(): string {
  return pill(7, 7, 20, 4, yellow.shade) + rect(11, 2, 11, 7, yellow.base, 3.5) + pill(12.5, 3, 5, 2, yellow.light);
}

/** La roue : pneu indigo, jante lavande, deux rayons (pour qu'on la voie tourner), moyeu jaune. */
function wheel([x, y]: readonly [number, number], r: number): string {
  return (
    circle(x, y, r, ink.base) +
    circle(x, y, r - 2.2, paper.shade) +
    line(x - r + 2.2, y, x + r - 2.2, y, ink.base) +
    line(x, y - r + 2.2, x, y + r - 2.2, ink.base) +
    circle(x, y, 2.2, yellow.base)
  );
}

export const CARAVAN_SPRITE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: GROUND / H,
  parts: {
    cart: svg(W, H, cart()),
    wheel: svg(W, H, wheel(WHEEL, 9)),
  },
  pivots: { wheel: WHEEL },
} satisfies SpriteProto;
