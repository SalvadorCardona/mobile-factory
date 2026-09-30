/**
 * La tour de guet : une plateforme sur quatre poteaux, qui tire seule.
 *
 * La plus haute silhouette de la colonie (cadre 64 × 128 pour une emprise
 * 2 × 2) : des poteaux indigo contreventés, une échelle, une plateforme
 * jaune à rambarde, un auvent de toile blanche — son accent : le corail est
 * à la mairie —, une lanterne et le drapeau. Des sacs de sable au pied.
 *
 * Son chantier : les quatre pilotis déjà plantés et contreventés, l'échelle,
 * les planches de la plateforme en pile au pied, un fanion en haut d'un
 * poteau et un drapeau sur le panneau.
 */

import {
  PALETTE,
  circle,
  flag,
  flower,
  ladder,
  line,
  pill,
  railing,
  rect,
  shadedBlock,
  svg,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, gableRoof, planks, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 128;
const FOOTPRINT = 64;

const { ink, orange, yellow, cyan } = PALETTE;

function sandbags(y: number): string {
  return (
    pill(4, y, 14, 7, orange.shade) +
    pill(5, y - 1, 12, 5, orange.base) +
    pill(46, y, 14, 7, orange.shade) +
    pill(47, y - 1, 12, 5, orange.base)
  );
}

/** Plaques de fer vissées sur le devant de la plateforme : la tour renforcée. */
function armor(): string {
  return [7, 25, 43]
    .map(
      (x) =>
        rect(x, 35, 14, 10, cyan.shade, 3) +
        rect(x, 35, 14, 8, cyan.base, 3) +
        pill(x + 2, 36, 6, 2, cyan.light) +
        circle(x + 3, 41, 1, ink.base) +
        circle(x + 11, 41, 1, ink.base),
    )
    .join('');
}

/** `reinforced` : la même tour, blindée de fer, au drapeau jaune. */
function tower(reinforced = false): string {
  return (
    // Poteaux de derrière, plus clairs : ils sont plus loin.
    rect(17, 44, 4, 70, ink.light, 2) +
    rect(43, 44, 4, 70, ink.light, 2) +
    line(19, 60, 45, 96, ink.light) +
    line(45, 60, 19, 96, ink.light) +
    rect(9, 42, 5, 80, ink.base, 2.5) +
    rect(50, 42, 5, 80, ink.base, 2.5) +
    ladder(28.5, 48, 72) +
    shadedBlock(3, 32, 58, 16, 6, 'yellow', 6) +
    (reinforced ? armor() : '') +
    railing(6, 22, 52, 10, 6) +
    gableRoof(0, 64, 24, 8, 'paper') +
    flag(32, 0, 10, reinforced ? 'yellow' : 'cyan') +
    line(48, 24, 48, 27, ink.base) +
    circle(48, 29.5, 3, yellow.base) +
    circle(47.2, 28.7, 1.2, yellow.light) +
    sandbags(117) +
    flower(24, 121, 'coral') +
    flower(40, 122, 'yellow')
  );
}

function site(reinforced = false): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Les pilotis sont plantés à leur hauteur finale ; la plateforme manque.
    rect(17, 44, 4, 70, ink.light, 2) +
    rect(43, 44, 4, 70, ink.light, 2) +
    line(19, 60, 45, 96, ink.light) +
    line(45, 60, 19, 96, ink.light) +
    rect(9, 42, 5, 80, ink.base, 2.5) +
    rect(50, 42, 5, 80, ink.base, 2.5) +
    ladder(28.5, 70, 50) +
    flag(52.5, 30, 12, 'cyan') +
    // Les planches de la plateforme attendent au pied.
    planks(20, 116, 26) +
    siteClutter(W, H) +
    // Les plaques de fer de la tour renforcée attendent sur le panneau.
    siteSign(22, 92, reinforced ? rect(24, 94, 10, 6, cyan.base, 2) : flag(26, 93, 8, 'cyan'))
  );
}

export const WATCHTOWER = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, tower()),
    damaged: svg(W, H, tower(), damageMarks(3, 32, 58, 16)),
  },
} satisfies SpriteProto;

/**
 * La tour de guet renforcée : la même silhouette, la plateforme blindée de
 * plaques de fer cyan rivetées, le drapeau jaune. On la distingue de loin.
 */
export const REINFORCED_TOWER = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site(true)),
    built: svg(W, H, tower(true)),
    damaged: svg(W, H, tower(true), damageMarks(3, 32, 58, 16)),
  },
} satisfies SpriteProto;
