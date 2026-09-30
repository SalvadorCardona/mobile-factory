/**
 * Le butin posé au sol : l'icône de l'objet, telle que le sac la montre.
 *
 * Une ressource = une icône (`data/icons.ts`) ; le butin n'invente pas un
 * deuxième dessin, il pose la même au sol, et le rendu la fait sautiller
 * au-dessus de son ombre. Un morceau par objet, du cadre des icônes.
 *
 * `glint` : l'étincelle qui scintille par-dessus, pour qu'un butin se
 * repère dans l'herbe — une croix de deux capsules jaunes et un cœur blanc,
 * au centre du cadre ; le rendu la pose au coin de l'icône et la fait
 * éclore et s'éteindre.
 */

import { PALETTE, circle, pill, svg } from '../data/artDirection.ts';
import { ICON_SIZE, ITEM_ICONS } from '../data/icons.ts';
import type { ItemId } from '../data/items.ts';
import type { SpriteProto } from '../data/sprites.ts';

const C = ICON_SIZE / 2;

const GLINT = svg(
  ICON_SIZE,
  ICON_SIZE,
  pill(C - 1.75, C - 7, 3.5, 14, PALETTE.yellow.base),
  pill(C - 7, C - 1.75, 14, 3.5, PALETTE.yellow.base),
  pill(C - 1, C - 5, 2, 6, PALETTE.yellow.light),
  circle(C, C, 1.6, PALETTE.paper.base),
);

export const LOOT = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  anchorX: 0.5,
  anchorY: 0.85,
  parts: { ...(ITEM_ICONS satisfies Record<ItemId, string>), glint: GLINT },
  pivots: { glint: [C, C] },
} satisfies SpriteProto;
