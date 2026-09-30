/**
 * La tour de guet : une plateforme sur quatre poteaux, qui tire seule.
 *
 * La plus haute silhouette de la colonie (cadre 64 × 128 pour une emprise
 * 2 × 2) : des poteaux indigo contreventés, une échelle, une plateforme
 * jaune à rambarde, un toit pointu corail, une lanterne et le drapeau.
 * Des sacs de sable au pied.
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
import { damageMarks, gableRoof, siteArt } from './building.ts';

const W = 64;
const H = 128;
const FOOTPRINT = 64;

const { ink, orange, yellow } = PALETTE;

function sandbags(y: number): string {
  return (
    pill(4, y, 14, 7, orange.shade) +
    pill(5, y - 1, 12, 5, orange.base) +
    pill(46, y, 14, 7, orange.shade) +
    pill(47, y - 1, 12, 5, orange.base)
  );
}

function tower(): string {
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
    railing(6, 22, 52, 10, 6) +
    gableRoof(0, 64, 24, 8) +
    flag(32, 0, 10, 'cyan') +
    line(48, 24, 48, 27, ink.base) +
    circle(48, 29.5, 3, yellow.base) +
    circle(47.2, 28.7, 1.2, yellow.light) +
    sandbags(117) +
    flower(24, 121, 'coral') +
    flower(40, 122, 'yellow')
  );
}

export const WATCHTOWER = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, tower()),
    damaged: svg(W, H, tower(), damageMarks(3, 32, 58, 16)),
  },
} satisfies SpriteProto;
