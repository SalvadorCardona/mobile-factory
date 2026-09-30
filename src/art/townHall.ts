/**
 * La mairie : le premier toit de la colonie, et ce que les mutants visent.
 *
 * Le plus grand volume du jeu (emprise 3 × 3) : un grand bloc jaune aux
 * angles larges, un toit corail à deux pans, une terrasse à rambarde, une
 * échelle, une antenne, et le drapeau cyan tout en haut — on la retrouve de
 * loin. Son chantier est celui de la maquette validée.
 *
 * Cadre 96 × 128 ; l'emprise occupe les 96 px du bas.
 */

import {
  PALETTE,
  RADIUS,
  circle,
  flag,
  flower,
  ladder,
  line,
  railing,
  shadedBlock,
  svg,
  windowPane,
} from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, gableRoof, lifeAt, siteArt } from './building.ts';

const W = 96;
const H = 128;
const FOOTPRINT = 96;

const { ink, coral, yellow } = PALETTE;

function hall(): string {
  return (
    shadedBlock(6, 58, 84, 64, 14, 'yellow', RADIUS.large) +
    gableRoof(4, 62, 64, 30) +
    flag(33, 8, 24, 'cyan') +
    // La terrasse du toit, sa rambarde, l'antenne de radio.
    railing(62, 50, 26, 10, 4) +
    line(80, 30, 80, 50, ink.base) +
    line(75, 37, 85, 37, ink.base) +
    circle(80, 29, 2.6, coral.base) +
    windowPane(14, 72, 12, 15, 'yellow') +
    windowPane(68, 72, 12, 15, 'yellow') +
    door(40, 82, 16, 30) +
    // L'horloge arrêtée, au-dessus de la porte.
    circle(48, 72, 5, yellow.light) +
    line(48, 72, 48, 69, ink.base) +
    ladder(86, 50, 62) +
    lifeAt(9, 116, 44) +
    flower(62, 118, 'cyan') +
    flower(70, 116, 'coral')
  );
}

export const TOWN_HALL = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, siteArt(W, H, FOOTPRINT)),
    built: svg(W, H, hall()),
    damaged: svg(W, H, hall(), damageMarks(6, 58, 84, 64)),
  },
} satisfies SpriteProto;
