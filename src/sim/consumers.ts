/**
 * Les bâtiments qui consomment — la nurserie, la forge et le four à charbon,
 * une forge sur sa propre recette — et ce que leur
 * coffre accepte. Adam les remplit (sac, contact, « Transférer »), les
 * porteurs et les logisticiens aussi, depuis la mairie ou une ferme
 * voisine : tous décident sur ces fonctions.
 *
 * C'est la demande d'un consommateur : un stock visé par entrée (`demand`
 * de `data/buildings.ts`, sinon sa part du coffre). Sous ce niveau, il
 * demande la différence (`consumerDemands`) ; le tableau des jobs en fait
 * des transports, réservés à leur création.
 */

import type { ItemId } from '../data/items.ts';
import { BUILDINGS, type BuildingProto } from '../data/buildings.ts';
import { JOB_PRIORITY, type JobPriority } from '../data/workers.ts';
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
 * Combien d'unités de `item` le coffre prend encore, jusqu'à son stock
 * visé (`consumerTarget`).
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

/**
 * Le stock visé de `item` : la `demand` du bâtiment, sinon la part de
 * l'entrée dans le coffre, au prorata de la recette — le fer ne prend pas la
 * place du charbon. Zéro pour ce que la recette ne consomme pas.
 */
export function consumerTarget(consumer: Nursery | Forge, item: ItemId): number {
  const recipe = consumerRecipe(consumer);
  const needed = recipe.inputs[item] ?? 0;

  if (needed <= 0) return 0;

  const proto: BuildingProto = BUILDINGS[consumer.proto];
  const declared = proto.demand?.[item];

  if (declared !== undefined) return Math.min(declared, consumer.store.capacity);

  let total = 0;

  for (const amount of Object.values(recipe.inputs)) total += amount;

  return Math.floor((consumer.store.capacity * needed) / total);
}

function roomFor(consumer: Nursery | Forge, item: ItemId, promised: number): number {
  const target = consumerTarget(consumer, item);

  if (target <= 0) return 0;
  return Math.max(0, Math.min(target - consumer.store.count(item) - promised, consumer.store.freeSpace()));
}

/** Une demande de livraison : ce qui manque au stock visé et qu'aucun transport n'apporte encore. */
export interface Demand {
  item: ItemId;
  amount: number;
  priority: JobPriority;
}

/**
 * Les demandes du consommateur : une par entrée sous son stock visé. En
 * pause, il ne consomme rien et ne demande rien. En famine — pas de quoi
 * lancer le prochain cycle —, la demande passe avant un ravitaillement
 * préventif.
 */
export function consumerDemands(consumer: Nursery | Forge): Demand[] {
  if (consumer.paused) return [];

  const priority = isStarving(consumer) ? JOB_PRIORITY.starving : JOB_PRIORITY.refill;
  const demands: Demand[] = [];

  for (const item of Object.keys(consumerRecipe(consumer).inputs) as ItemId[]) {
    const amount = consumerWants(consumer, item);

    if (amount > 0) demands.push({ item, amount, priority });
  }
  return demands;
}

/** Il manque au coffre de quoi lancer le prochain cycle : la machine est en famine. */
export function isStarving(consumer: Nursery | Forge): boolean {
  const { inputs } = consumerRecipe(consumer);

  return (Object.entries(inputs) as [ItemId, number][]).some(([item, amount]) => consumer.store.count(item) < amount);
}
