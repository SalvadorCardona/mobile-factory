/**
 * Le butin posé au sol : l'icône de l'objet, telle que le sac la montre.
 *
 * Une ressource = une icône (`data/icons.ts`) ; le butin n'invente pas un
 * deuxième dessin, il pose la même au sol, et le rendu la fait sautiller
 * au-dessus de son ombre. Un morceau par objet, du cadre des icônes.
 */

import { ICON_SIZE, ITEM_ICONS } from '../data/icons.ts';
import type { ItemId } from '../data/items.ts';
import type { SpriteProto } from '../data/sprites.ts';

export const LOOT = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  anchorX: 0.5,
  anchorY: 0.85,
  parts: ITEM_ICONS satisfies Record<ItemId, string>,
} satisfies SpriteProto;
