/**
 * Objets du jeu — contenu pur, aucune logique.
 *
 * `as const satisfies Record<string, ItemProto>` : TypeScript vérifie la forme
 * de chaque entrée et dérive l'union des ids. Une faute de frappe dans un
 * ingrédient de recette devient une erreur de compilation.
 */

export interface ItemProto {
  /** Libellé affiché. */
  label: string;
  /** Taille de pile — sert aux coffres et à l'affichage, pas à l'inventaire du joueur. */
  stack: number;
}

export const ITEMS = {
  wood: { label: 'Bois', stack: 100 },
  stone: { label: 'Pierre', stack: 100 },
  coal: { label: 'Charbon', stack: 100 },
  ironOre: { label: 'Minerai de fer', stack: 100 },
} as const satisfies Record<string, ItemProto>;

export type ItemId = keyof typeof ITEMS;

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function isItemId(value: string): value is ItemId {
  return value in ITEMS;
}
