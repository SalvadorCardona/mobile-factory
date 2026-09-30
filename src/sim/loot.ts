/**
 * Le butin au sol : ce que lâche un ennemi abattu.
 *
 * Le tirage d'une table ne dépend que du PRNG du monde qu'on lui passe :
 * même seed, mêmes coups d'arc, même butin. Chaque ligne se tire à part,
 * puis sa quantité, bornes comprises — l'ordre des appels au PRNG est celui
 * de la table, et il ne doit pas changer sans raison : il fait partie de la
 * partie rejouable.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import type { Rng } from '../core/rng.ts';
import { LOOT_DROPS, type LootTable } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import type { Pickup } from './types.ts';

/** Les objets lâchés, un par exemplaire, dans l'ordre de la table. */
export function rollLoot(table: LootTable, rng: Rng): ItemId[] {
  const items: ItemId[] = [];

  for (const { item, min, max, chance } of table) {
    if (chance < 1 && rng() >= chance) continue;

    const amount = min + Math.floor(rng() * (max - min + 1));

    for (let i = 0; i < amount; i += 1) items.push(item);
  }
  return items;
}

/** Ce qui arrive à un butin pendant un tick. */
export type PickupStep = 'wait' | 'reached' | 'expired';

/**
 * Un tick d'un butin au sol. Il vieillit ; si Adam a de la place dans le sac
 * et passe à portée d'aimant, il glisse vers lui ; à portée de main, il est
 * `reached` — à l'appelant de le mettre dans le sac. Sac plein, il ne bouge
 * pas : il attend au sol, ni perdu ni avalé.
 */
export function stepPickup(pickup: Pickup, adam: { x: number; y: number }, room: boolean, stepSeconds: number): PickupStep {
  const reach = LOOT_DROPS.pickupRadius * TILE_SIZE;
  const magnet = LOOT_DROPS.magnetRadius * TILE_SIZE;

  pickup.prevX = pickup.x;
  pickup.prevY = pickup.y;
  pickup.moving = false;
  pickup.ttl -= 1;

  const sq = distanceSq(adam.x, adam.y, pickup.x, pickup.y);

  if (sq <= reach * reach) return 'reached';
  if (room && sq <= magnet * magnet) {
    const distance = Math.sqrt(sq);
    const step = Math.min(distance, LOOT_DROPS.magnetSpeed * TILE_SIZE * stepSeconds);

    pickup.x += ((adam.x - pickup.x) / distance) * step;
    pickup.y += ((adam.y - pickup.y) / distance) * step;
    pickup.moving = true;
  }
  return pickup.ttl <= 0 ? 'expired' : 'wait';
}
