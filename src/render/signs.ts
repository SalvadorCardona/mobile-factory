/**
 * Ce que dit la pancarte d'un bâtiment, et quand elle se lit.
 *
 * Elle porte toujours, à gauche, le médaillon de son métier
 * (`data/jobIcons.ts`) : la hache des bûcherons, l'éprouvette du labo. Puis
 * son nom (`BuildingProto.sign`, traduit par `t().buildings[id].sign`). Une
 * foreuse y ajoute, à droite, le filon qu'elle extrait : c'est le seul
 * bâtiment dont le produit change d'un exemplaire à l'autre, son métier ne
 * le dit pas.
 *
 * Les bulles d'état (pause, coffre plein) flottent au-dessus du toit : la
 * pancarte, au pied de la façade, ne les cache jamais.
 *
 * Ni Pixi ni DOM ici : `signboard.ts` dessine, ce module décide.
 */

import type { BuildingKind } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';

/**
 * Zoom à partir duquel la pancarte montre son nom, et en deçà duquel elle
 * disparaît ; entre les deux, elle ne garde que le médaillon, agrandi pour
 * rester lisible. Les crans de zoom étant 0,64 · 0,8 · 1 · 1,25 · 1,5, le
 * nom se lit dès le zoom par défaut ; au plus loin, plutôt rien qu'une tache.
 */
export const SIGN_ZOOM = { full: 0.9, icon: 0.7 } as const;

/** Médaillon et nom, médaillon seul, ou rien. */
export type SignMode = 'full' | 'icon' | 'none';

/** Ce que montre une pancarte à ce zoom : tout bâtiment a son médaillon. */
export function signMode(zoom: number): SignMode {
  if (zoom >= SIGN_ZOOM.full) return 'full';
  if (zoom >= SIGN_ZOOM.icon) return 'icon';
  return 'none';
}

/** L'objet affiché à côté du nom : ce qu'extrait une foreuse (`output`, `null` à sec), rien pour les autres. */
export function signItem(kind: BuildingKind, output: ItemId | null): ItemId | null {
  return kind === 'drill' ? output : null;
}
