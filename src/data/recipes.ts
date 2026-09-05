/**
 * Recettes — contenu pur.
 *
 * `building` désigne le bâtiment capable d'exécuter la recette ;
 * `validatePrototypes()` vérifie au démarrage qu'il existe.
 *
 * Une foreuse n'a pas d'entrée : elle extrait ce que le gisement sous elle
 * fournit. La recette ne décrit donc que la cadence et la sortie de référence.
 */

import type { BuildingId } from './buildings.ts';
import type { ItemId } from './items.ts';

export interface RecipeProto {
  label: string;
  /** Bâtiment capable d'exécuter la recette. */
  building: BuildingId;
  /** Durée d'un cycle, en ticks de simulation (20 ticks = 1 s). */
  duration: number;
  inputs: Partial<Record<ItemId, number>>;
  outputs: Partial<Record<ItemId, number>>;
}

export const RECIPES = {
  mineOre: {
    label: 'Extraction',
    building: 'drill',
    duration: 40,
    inputs: {},
    outputs: { ironOre: 1 },
  },
  growFood: {
    label: 'Culture',
    building: 'farm',
    duration: 20 * 30,
    inputs: {},
    outputs: { food: 4 },
  },
} as const satisfies Record<string, RecipeProto>;

export type RecipeId = keyof typeof RECIPES;

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
