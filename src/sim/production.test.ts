import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES } from '../data/recipes.ts';
import { decodeSave, encodeSave } from './save.ts';
import type { Nursery } from './types.ts';
import { World, timerText } from './world.ts';

function fill(world: World, amounts: Partial<Record<ItemId, number>>): void {
  for (const [item, amount] of Object.entries(amounts) as [ItemId, number][]) world.player.inventory.add(item, amount);
}

function spot(world: World, building: BuildingId): { tx: number; ty: number } {
  const px = Math.floor(world.player.x / TILE_SIZE);
  const py = Math.floor(world.player.y / TILE_SIZE);

  for (let r = 2; r <= 8; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (world.canPlace(building, px + dx, py + dy) === null) return { tx: px + dx, ty: py + dy };
      }
    }
  }
  throw new Error(`aucune place pour ${building}`);
}

function build(world: World, building: BuildingId): number {
  const { tx, ty } = spot(world, building);
  let id = -1;
  const off = world.events.on('buildingPlaced', (event) => (id = event.id));

  world.push({ type: 'placeBuilding', building, tx, ty });
  world.tick();
  off();
  fill(world, BUILDINGS[building].cost);
  world.push({ type: 'transferToSite', id });
  world.tick();
  return id;
}

function colony(): { world: World; nurseries: Nursery[] } {
  const world = new World(7);

  fill(world, BUILDINGS.townHall.cost);
  world.push({ type: 'transferToSite', id: world.townHallId });
  world.tick();

  const nurseries = [build(world, 'nursery'), build(world, 'nursery')].map((id) => world.entities.get(id) as Nursery);

  for (const nursery of nurseries) nursery.store.add('food', RECIPES.raiseChild.inputs.food);
  return { world, nurseries };
}

describe('production à durée — nurserie', () => {
  it('le compte à rebours part de la durée configurée et s’écoule', () => {
    const { world, nurseries } = colony();
    const timer = world.productionTimer(nurseries[0]!);

    expect(timer?.total).toBe(RECIPES.raiseChild.duration);
    expect(timer!.left).toBeGreaterThan(RECIPES.raiseChild.duration - 10);
    world.tick();
    expect(world.productionTimer(nurseries[0]!)!.left).toBeLessThan(timer!.left);
  });

  it('un enfant naît à l’échéance, pas avant', () => {
    const { world, nurseries } = colony();
    const nursery = nurseries[0]!;

    for (let i = 0; i < RECIPES.raiseChild.duration - 20; i += 1) world.tick();
    expect(nursery.born).toBe(0);
    for (let i = 0; i < 40; i += 1) world.tick();
    expect(nursery.born).toBe(1);
  });

  it('deux nurseries produisent deux bébés en parallèle', () => {
    const { world, nurseries } = colony();

    for (let i = 0; i < RECIPES.raiseChild.duration + 40; i += 1) world.tick();
    expect(nurseries.map((nursery) => nursery.born)).toEqual([1, 1]);
  });

  it('pause, faim : plus de compte à rebours affiché', () => {
    const { world, nurseries } = colony();
    const nursery = nurseries[0]!;

    nursery.paused = true;
    expect(world.productionTimer(nursery)).toBeNull();
  });

  it('le compte à rebours reprend au chargement', () => {
    const { world, nurseries } = colony();

    for (let i = 0; i < 100; i += 1) world.tick();

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);

    const again = decoded.world.entities.get(nurseries[0]!.id) as Nursery;

    expect(again.nextBirthTick).toBe(nurseries[0]!.nextBirthTick);
    expect(decoded.world.productionTimer(again)!.left).toBe(world.productionTimer(nurseries[0]!)!.left);
  });
});

describe('timerText', () => {
  it('écrit m:ss, arrondi à la seconde supérieure', () => {
    expect(timerText(0)).toBe('0:00');
    expect(timerText(1)).toBe('0:01');
    expect(timerText(20 * 65)).toBe('1:05');
    expect(timerText(RECIPES.raiseChild.duration)).toBe('3:00');
  });
});
