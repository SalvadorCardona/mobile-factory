/**
 * Le cracheur d'une base mutante, son crachat, et le cercle du coup de zone
 * de son chef.
 *
 * Le cracheur est un mutant maigre — toujours le **vert fluo**, tête
 * bosselée, bras trop long — au **jabot** énorme, une poche de gelée sous le
 * menton, plus claire, où il fait monter sa bave. Il porte des **lunettes
 * de piscine violettes** (le violet de sa base) remontées sur la bosse, et
 * fait la moue : sa bouche est un petit rond. `spit` le montre jabot gonflé,
 * joues pleines : le rendu l'affiche juste avant qu'il crache — c'est ce qui
 * dit au joueur de bouger.
 *
 * Le crachat (`SPIT`) est une boule de gelée fluo, son reflet et une goutte
 * qui pend ; `drop` en fait la traînée. Le cercle (`SLAM_MARK`) est l'anneau
 * corail que trace au sol le chef qui lève sa massue, et `fill` le disque
 * qui s'y remplit : pleins dans le SVG, c'est le rendu qui les pose en
 * transparence sur le sol.
 */

import { PALETTE, circle, pill, rect, ring, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { crossedEye, lumpyHead } from './mutant.ts';
import { foot, type Facing } from './people.ts';

const W = 32;
const H = 48;
const GROUND = 38.4;

const { toxic, ink, paper, violet, coral } = PALETTE;

/** Le tronc maigre et le short en loques. */
function chest(x: number): string {
  return rect(x, 23, 10, 12, toxic.shade, 4.5) + rect(x, 23, 10, 9, toxic.base, 4.5) + rect(x + 0.5, 30.5, 9, 5, ink.light, 2.5);
}

/** Le jabot sous le menton, en (cx, cy) ; gonflé, il double. */
function pouch(cx: number, cy: number, full: boolean): string {
  const r = full ? 6.4 : 4;

  return circle(cx + 0.6, cy + 0.6, r, toxic.shade) + circle(cx, cy, r - 0.4, toxic.light) + circle(cx - r * 0.35, cy - r * 0.35, r * 0.28, paper.base);
}

/** Les lunettes de piscine, sur la bosse : deux verres violets, un élastique. */
function goggles(x: number, y: number): string {
  return (
    pill(x - 1, y + 1.4, 13, 2, violet.shade) +
    circle(x + 2.5, y + 2, 2.8, violet.base) +
    circle(x + 8.5, y + 2, 2.8, violet.base) +
    circle(x + 1.8, y + 1.3, 0.9, violet.light) +
    circle(x + 7.8, y + 1.3, 0.9, violet.light)
  );
}

function eye(x: number, y: number, r: number): string {
  return circle(x, y, r, paper.base) + circle(x + r * 0.25, y + r * 0.3, r * 0.45, ink.base);
}

/** Le cracheur vu dans une direction, sans le cadre ; `full` : jabot gonflé, prêt à cracher. */
function spitterFigure(facing: Facing, hurt: boolean, full = false): string {
  switch (facing) {
    case 'down':
      return [
        pill(8, 23, 4, 8, toxic.shade),
        chest(11),
        pill(20.5, 22, 4, 14, toxic.shade),
        circle(22.5, 36, 2.4, toxic.base),
        lumpyHead(16, 13, 10, 7),
        goggles(4.5, 4),
        pouch(16, 21.5, full),
        hurt ? crossedEye(13, 13, 2) + crossedEye(19.5, 13.5, 1.4) : eye(13, 13, 3) + eye(19.5, 13.5, 1.8),
        // La moue : un petit rond, plus grand quand il va cracher.
        hurt ? circle(16.5, 17.6, 1.8, ink.base) : circle(16.5, 17.4, full ? 1.8 : 1.2, ink.base),
      ].join('');

    case 'up':
      return [
        pill(20, 23, 4, 8, toxic.shade),
        chest(11),
        pill(7.5, 22, 4, 14, toxic.shade),
        circle(9.5, 36, 2.4, toxic.base),
        lumpyHead(16, 13, 22, 7),
        goggles(16.5, 4),
        hurt ? circle(22, 7, 2.2, toxic.light) : '',
      ].join('');

    case 'side':
      return [
        chest(10.5),
        pill(15.5, 22, 4, 14, toxic.shade),
        circle(17.5, 36, 2.4, toxic.base),
        lumpyHead(16, 13.5, 10, 7.5),
        goggles(4, 4.5),
        pouch(21, 20.5, full),
        hurt ? crossedEye(20, 12.6, 2) : eye(20, 12.6, 2.8),
        // De profil, la bouche en tuyau pointe vers Adam.
        hurt ? circle(23, 16.8, 1.6, ink.base) : pill(22, 15.6, full ? 4.5 : 3.5, 2.6, toxic.shade) + circle(25.5, 16.9, 0.9, ink.base),
      ].join('');
  }
}

function body(facing: Facing, hurt: boolean): string {
  return svg(W, H, spitterFigure(facing, hurt));
}

export const SPITTER_SPRITE = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down', false),
    up: body('up', false),
    side: body('side', false),
    downHurt: body('down', true),
    upHurt: body('up', true),
    sideHurt: body('side', true),
    spit: svg(W, H, spitterFigure('down', false, true)),
    spitSide: svg(W, H, spitterFigure('side', false, true)),
    foot: svg(W, H, foot(GROUND, 'toxic')),
    /** Le halo : plein dans le SVG, c'est le rendu qui le fait respirer en transparence. */
    halo: svg(W, H, circle(16, 24, 13, toxic.base)),
  },
  pivots: { halo: [16, 24] },
} satisfies SpriteProto;

/** Le crachat en vol : une boule de gelée, centrée dans son cadre de 16 × 16. */
export const SPIT_SPRITE = {
  width: 16,
  height: 16,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    fly: svg(
      16,
      16,
      circle(8.6, 8.6, 5.6, toxic.shade),
      circle(8, 8, 5.2, toxic.base),
      pill(4.6, 4.6, 4, 2, toxic.light),
      pill(9.6, 11, 2, 4.2, toxic.shade),
    ),
    /** Une goutte de la traînée. */
    drop: svg(16, 16, circle(8, 8, 2.6, toxic.shade), circle(7.6, 7.6, 2.1, toxic.base)),
  },
} satisfies SpriteProto;

/** Le cercle du coup de zone : rayon 30 dans un cadre de 64 × 64 — le rendu le met à l'échelle. */
export const SLAM_MARK = {
  width: 64,
  height: 64,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    ring: svg(64, 64, ring(32, 32, 30, 30, 3, coral.base)),
    fill: svg(64, 64, circle(32, 32, 30, coral.base)),
  },
} satisfies SpriteProto;

/** Rayon du cercle dans son cadre, en pixels. */
export const SLAM_MARK_RADIUS = 30;
