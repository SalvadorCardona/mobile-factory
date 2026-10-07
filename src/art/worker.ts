/**
 * Un ouvrier de la maison des constructeurs : un porteur.
 *
 * Un humain, donc la tunique orange de la famille — mais ni sac, ni
 * écharpe, ni arc : la silhouette la plus simple, pour qu'Adam reste
 * celui qu'on repère. Plus petit qu'Adam, un bandeau corail au front
 * pour le distinguer d'un coup d'œil.
 *
 * La charge est un morceau à part, un par objet : l'icône de l'objet, portée
 * au-dessus de la tête. Le rendu l'affiche quand l'ouvrier porte, et la fait
 * rebondir avec le pas.
 */

import { ICON_SIZE, ITEM_ICONS } from '../data/icons.ts';
import { ITEM_IDS, type ItemId } from '../data/items.ts';
import { PALETTE, embed, pill, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, humanBody, humanParts, type Facing, type IdleLook, type SexLook } from './people.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme Adam. */
const GROUND = 38.4;
/** Plus petit qu'Adam : la charge posée sur la tête tient dans le même cadre. */
const SCALE = 0.8;
/** Côté de la charge, en pixels monde. */
const LOAD = 13;
const LOAD_TOP = 3;

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

/** Le bandeau corail, noué sur les cheveux indigo. */
function band(facing: Facing): string {
  switch (facing) {
    case 'down':
      return pill(9.5, 8, 13, 3, PALETTE.coral.base);
    case 'up':
      return pill(9.5, 8.5, 13, 3, PALETTE.coral.base) + pill(14.5, 10.5, 3, 5, PALETTE.coral.shade);
    case 'side':
      return pill(9, 8, 13.5, 3, PALETTE.coral.base) + pill(8, 9.5, 3, 5, PALETTE.coral.shade);
  }
}

/** Le corps d'adulte, avant réduction ; `look` : son sexe, les bras levés ou le bâillement d'une pose de glande. */
function figure(facing: Facing, look: IdleLook & SexLook = {}): string {
  return humanBody(facing, { ...OPTIONS, ...look }) + band(facing);
}

/** La charge : l'icône de l'objet, posée en équilibre sur la tête. */
function load(item: ItemId, top: number): string {
  // L'icône a une marge dans son cadre : descendue de `top`, elle touche les cheveux.
  return embed(ITEM_ICONS[item], 16 - LOAD / 2, top, LOAD / ICON_SIZE);
}

/**
 * Un morceau `load.<objet>` par objet, la charge posée à `top` du haut du
 * cadre : l'ex-mutant, plus grand, la porte plus haut.
 */
export function loadParts(top: number = LOAD_TOP): Record<`load.${ItemId}`, string> {
  return Object.fromEntries(ITEM_IDS.map((item) => [`load.${item}`, svg(W, H, load(item, top))])) as Record<
    `load.${ItemId}`,
    string
  >;
}

export const WORKER = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...humanParts(W, H, GROUND, SCALE, figure),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
    ...loadParts(),
  },
} satisfies SpriteProto;
