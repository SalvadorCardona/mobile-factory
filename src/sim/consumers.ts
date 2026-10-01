/**
 * Les bâtiments qui consomment — la nurserie, la forge et le four à charbon,
 * une forge sur sa propre recette — et ce que leur
 * coffre accepte. Adam les remplit (sac, contact, « Transférer »), les
 * porteurs aussi, depuis la mairie : les deux décident sur ces fonctions.
 */

import type { ItemId } from '../data/items.ts';
import { RECIPES, recipeOf, type RecipeProto } from '../data/recipes.ts';
import type { Entity, Forge, Nursery } from './types.ts';

/** Un bâtiment qui consomme les entrées de sa recette. */
export function isConsumer(entity: Entity): entity is Nursery | Forge {
  return entity.kind === 'nursery' || entity.kind === 'forge';
}

/** La recette d'un bâtiment qui consomme : une forge a celle de son id — fonte, ou cuisson du charbon. */
export function consumerRecipe(consumer: Nursery | Forge): RecipeProto {
  if (consumer.kind === 'nursery') return RECIPES.raiseChild;
  return forgeRecipe(consumer);
}

const FORGE_RECIPES = new Map<Forge['proto'], RecipeProto>();

/** La recette d'une forge, cherchée une fois par bâtiment : `validatePrototypes()` garantit qu'elle existe. */
export function forgeRecipe(forge: Forge): RecipeProto {
  let recipe = FORGE_RECIPES.get(forge.proto);

  if (!recipe) {
    recipe = recipeOf(forge.proto) ?? RECIPES.smeltPlate;
    FORGE_RECIPES.set(forge.proto, recipe);
  }
  return recipe;
}

/** Ce que les porteurs emportent d'une forge à la mairie : ses sorties — plaques, charbon —, jamais ses entrées. */
export function forgeOutputs(forge: Forge): ItemId[] {
  return Object.keys(forgeRecipe(forge).outputs) as ItemId[];
}

/**
 * Combien d'unités de `item` le coffre prend encore. Chaque entrée de la
 * recette a sa part du coffre, au prorata de la recette — le fer ne prend
 * pas la place du charbon.
 */
export function consumerRoom(consumer: Nursery | Forge, item: ItemId): number {
  return roomFor(consumer, item, 0);
}

/**
 * La place que la ville peut encore promettre : la part du coffre, moins ce
 * que les porteurs apportent déjà. Le sac, lui, livre sur `consumerRoom` —
 * comme sur un chantier, ce qu'un porteur apporte en trop repart à la mairie.
 */
export function consumerWants(consumer: Nursery | Forge, item: ItemId): number {
  return roomFor(consumer, item, consumer.store.expected(item));
}

function roomFor(consumer: Nursery | Forge, item: ItemId, promised: number): number {
  const recipe = consumerRecipe(consumer);
  const needed = recipe.inputs[item] ?? 0;

  if (needed <= 0) return 0;

  let total = 0;

  for (const amount of Object.values(recipe.inputs)) total += amount;

  const share = Math.floor((consumer.store.capacity * needed) / total);

  return Math.max(0, Math.min(share - consumer.store.count(item) - promised, consumer.store.freeSpace()));
}

/** Il manque au coffre de quoi lancer le prochain cycle : la machine est en famine. */
export function isStarving(consumer: Nursery | Forge): boolean {
  const { inputs } = consumerRecipe(consumer);

  return (Object.entries(inputs) as [ItemId, number][]).some(([item, amount]) => consumer.store.count(item) < amount);
}
