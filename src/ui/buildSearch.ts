/**
 * La recherche du menu de construction : quelles cartes gardent ce qu'on tape.
 *
 * Une carte se cherche sur son nom, sur son métier (le nom court de sa
 * pancarte : « Bûcherons ») et sur ce qu'elle produit — sortie de sa recette,
 * filons d'une foreuse, bois d'une cabane de bûcheron : « bois » trouve la
 * cabane, « pierre » la carrière et la foreuse. Tout dans la langue du moment.
 *
 * Ni casse ni accents ne comptent (« foret » trouve « Forêt ») ; chaque mot
 * tapé doit se retrouver quelque part, en début de mot ou au milieu
 * (« cab bûch » trouve « Cabane de bûcheron »).
 *
 * La recherche ne fait que retirer des cartes : `buildMenu.ts` la croise avec
 * ce qui est au menu (`World.inMenu`), un bâtiment verrouillé n'y entre jamais.
 *
 * Fonctions pures, sans DOM : les tests les lisent en Node.
 */

import { BUILDINGS, type BuildingId, type BuildingProto } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { recipeOf } from '../data/recipes.ts';
import type { Messages } from '../i18n/messages.ts';

/** Ce qu'un bâtiment récolte sans recette : ses ouvriers rapportent l'objet à son coffre. */
const HARVESTS: Partial<Record<BuildingId, readonly ItemId[]>> = {
  lumberCamp: ['wood'],
};

/** Ce que produit un bâtiment : sortie de sa recette, filons qu'il exploite, récolte de ses ouvriers. */
export function productsOf(id: BuildingId): ItemId[] {
  const proto: BuildingProto = BUILDINGS[id];
  const outputs = Object.keys(recipeOf(id)?.outputs ?? {}) as ItemId[];

  return [...new Set([...outputs, ...(proto.deposits ?? []), ...(HARVESTS[id] ?? [])])];
}

/** Les textes où chercher une carte de bâtiment : nom, métier, produits. */
export function buildingTerms(id: BuildingId, text: Messages): string[] {
  const { label, sign } = text.buildings[id];

  return [label, sign, ...productsOf(id).map((item) => text.items[item])];
}

/** Sans casse ni accents : « Forêt » → « foret ». */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Chaque mot de la recherche se trouve dans l'un des textes. Une recherche vide garde tout. */
export function matchesSearch(query: string, terms: readonly string[]): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  const haystack = terms.map(foldText);

  return words.every((word) => haystack.some((term) => term.includes(word)));
}

/** Ce que fait une touche tapée dans le champ ; `null` : elle écrit, rien d'autre. */
export type SearchKey = 'pick' | 'clear' | 'close' | 'cards';

/**
 * Entrée choisit la première carte, Échap vide le champ puis, déjà vide,
 * ferme le tiroir, la flèche du bas descend dans les cartes.
 */
export function searchKey(code: string, query: string): SearchKey | null {
  switch (code) {
    case 'Enter':
    case 'NumpadEnter':
      return 'pick';
    case 'Escape':
      return query === '' ? 'close' : 'clear';
    case 'ArrowDown':
      return 'cards';
    default:
      return null;
  }
}
