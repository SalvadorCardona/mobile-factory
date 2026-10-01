/**
 * Recettes — contenu pur.
 *
 * `building` désigne le bâtiment capable d'exécuter la recette ;
 * `validatePrototypes()` vérifie au démarrage qu'il existe.
 *
 * Une foreuse n'a pas d'entrée : elle extrait ce que le gisement sous elle
 * fournit. La recette ne décrit donc que la cadence et la sortie de référence.
 *
 * La carrière n'a pas d'entrée non plus : ses ouvriers taillent la pierre
 * dans les ruines du vieux monde, où qu'elle soit posée. Comme la ferme,
 * elle va d'autant plus vite qu'elle a d'ouvriers.
 *
 * La nurserie a une recette sans sortie : ce qu'elle produit est un enfant,
 * pas un objet. Sa recette dit ce que coûte une naissance, et tous les
 * combien.
 *
 * Tout objet doit entrer quelque part — un coût de bâtiment ou une entrée de
 * recette : `validatePrototypes()` refuse une ressource qu'on récolterait
 * pour rien.
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
    duration: 80,
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
  cutStone: {
    label: 'Taille',
    building: 'quarry',
    duration: 20 * 15,
    inputs: {},
    outputs: { stone: 2 },
  },
  raiseChild: {
    label: 'Naissance',
    building: 'nursery',
    duration: 20 * 60 * 3,
    inputs: { food: 6 },
    outputs: {},
  },
  smeltPlate: {
    label: 'Fonte',
    building: 'forge',
    duration: 20 * 6,
    inputs: { ironOre: 2, coal: 1 },
    outputs: { ironPlate: 1 },
  },
} as const satisfies Record<string, RecipeProto>;

export type RecipeId = keyof typeof RECIPES;

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
