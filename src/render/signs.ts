/**
 * Ce que dit la pancarte d'un bâtiment, et quand elle se lit.
 *
 * Le nom vient de la définition du bâtiment (`BuildingProto.sign`, traduit
 * par `t().buildings[id].sign`) ; l'objet se déduit de ce qu'il fait : ce
 * qu'extrait une foreuse (le filon sous elle), ce que sort sa recette, sinon
 * ce qu'elle consomme (la nurserie et sa nourriture), et le bois des arbres
 * pour la cabane de bûcheron. Un bâtiment qui ne produit ni ne consomme rien
 * (mairie, tour, labo…) n'a que son nom.
 *
 * Ni Pixi ni DOM ici : `signboard.ts` dessine, ce module décide.
 */

import type { BuildingId, BuildingKind } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { recipeOf } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';

/**
 * Zoom à partir duquel la pancarte montre son nom, et en deçà duquel elle
 * disparaît ; entre les deux, elle ne garde que l'icône. Les crans de zoom
 * étant 0,64 · 0,8 · 1 · 1,25 · 1,5, le nom se lit dès le zoom par défaut.
 */
export const SIGN_ZOOM = { full: 0.9, icon: 0.7 } as const;

/** Nom et icône, icône seule, ou rien. */
export type SignMode = 'full' | 'icon' | 'none';

/** Ce que montre une pancarte à ce zoom ; sans objet, pas de pancarte « icône seule ». */
export function signMode(zoom: number, item: ItemId | null): SignMode {
  if (zoom >= SIGN_ZOOM.full) return 'full';
  if (zoom >= SIGN_ZOOM.icon && item !== null) return 'icon';
  return 'none';
}

/** L'objet qui dit la fonction d'un bâtiment ; `output` : ce qu'extrait une foreuse, `null` à sec. */
export function signItem(id: BuildingId, kind: BuildingKind, output: ItemId | null): ItemId | null {
  if (kind === 'drill') return output;
  if (kind === 'lumberCamp') return RESOURCES.tree.item;

  const recipe = recipeOf(id);

  if (!recipe) return null;
  return firstItem(recipe.outputs) ?? firstItem(recipe.inputs);
}

function firstItem(items: Partial<Record<ItemId, number>>): ItemId | null {
  return (Object.keys(items) as ItemId[])[0] ?? null;
}
