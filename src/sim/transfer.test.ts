import { describe, expect, it } from 'vitest';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { TransferRejection } from './commands.ts';
import { BUILD_REACH_TILES, INVENTORY_CAPACITY } from './player.ts';
import { deserialize, serialize } from './save.ts';
import { Store } from './store.ts';
import { transferAllPlan, transferAmount, transferView, type TransferRules } from './transfer.ts';
import type { Entity, EntityId, TownHall } from './types.ts';
import { World } from './world.ts';

/** Un coffre de ville : tout son disponible se prend, tout s'y dépose. */
function townRules(store: Store): TransferRules {
  return { takeable: (item) => store.available(item), accepts: () => Infinity };
}

/** Un coffre qui ne prend que du bois, au plus `room`, et ne rend rien. */
function woodOnly(room: number): TransferRules {
  return { takeable: () => 0, accepts: (item) => (item === 'wood' ? room : 0) };
}

describe('transferAmount', () => {
  it('passe 1, 10 ou tout', () => {
    const chest = new Store(Infinity);
    const bag = new Store(60);

    chest.add('wood', 25);
    expect(transferAmount('take', 'wood', 1, townRules(chest), bag)).toBe(1);
    expect(transferAmount('take', 'wood', 10, townRules(chest), bag)).toBe(10);
    expect(transferAmount('take', 'wood', 'all', townRules(chest), bag)).toBe(25);
  });

  it('le sac ne prend que ce qui y rentre : prise partielle, puis rien', () => {
    const chest = new Store(Infinity);
    const bag = new Store(20);

    chest.add('wood', 51);
    bag.add('stone', 12);
    expect(transferAmount('take', 'wood', 10, townRules(chest), bag)).toBe(8);
    expect(transferAmount('take', 'wood', 'all', townRules(chest), bag)).toBe(8);

    bag.add('stone', 8);
    expect(transferAmount('take', 'wood', 1, townRules(chest), bag)).toBe(0);
  });

  it('ce qui est réservé reste au coffre', () => {
    const chest = new Store(Infinity);
    const bag = new Store(INVENTORY_CAPACITY);

    chest.add('wood', 51);
    chest.reserveOut('wood', 20);
    expect(transferAmount('take', 'wood', 'all', townRules(chest), bag)).toBe(31);

    chest.reserveOut('wood', 31);
    expect(transferAmount('take', 'wood', 1, townRules(chest), bag)).toBe(0);
  });

  it('un coffre filtré refuse les autres objets, et ne prend que sa place', () => {
    const bag = new Store(INVENTORY_CAPACITY);

    bag.add('wood', 30);
    bag.add('stone', 5);
    expect(transferAmount('deposit', 'stone', 'all', woodOnly(12), bag)).toBe(0);
    expect(transferAmount('deposit', 'wood', 10, woodOnly(12), bag)).toBe(10);
    expect(transferAmount('deposit', 'wood', 'all', woodOnly(12), bag)).toBe(12);
    expect(transferAmount('take', 'wood', 'all', woodOnly(12), bag)).toBe(0);
  });
});

describe('transferAllPlan', () => {
  it('« Tout prendre » remplit le sac objet par objet, sans le dépasser', () => {
    const chest = new Store(Infinity);
    const bag = new Store(20);

    chest.add('wood', 15);
    chest.add('stone', 15);
    chest.reserveOut('stone', 2);
    bag.add('food', 3);

    const plan = transferAllPlan('take', chest, townRules(chest), bag);

    expect(plan).toEqual([
      ['wood', 15],
      ['stone', 2],
    ]);
    expect(plan.reduce((sum, [, amount]) => sum + amount, 0)).toBe(bag.freeSpace());
  });

  it('« Tout déposer » ne pose que ce que le coffre accepte', () => {
    const bag = new Store(INVENTORY_CAPACITY);

    bag.add('stone', 4);
    bag.add('wood', 30);
    expect(transferAllPlan('deposit', new Store(12), woodOnly(12), bag)).toEqual([['wood', 12]]);
  });
});

describe('transferView', () => {
  it('dit le compte, la part réservée, et grise ce qui ne passe pas', () => {
    const chest = new Store(Infinity);
    const bag = new Store(20);

    chest.add('wood', 51);
    chest.reserveOut('wood', 20);
    chest.add('stone', 4);
    chest.reserveOut('stone', 4);
    bag.add('food', 12);

    const view = transferView(chest, townRules(chest), bag, 10);

    expect(view.chest).toEqual([
      { item: 'wood', count: 51, reserved: 20, movable: 8 },
      { item: 'stone', count: 4, reserved: 4, movable: 0 },
    ]);
    expect(view.bag).toEqual([{ item: 'food', count: 12, movable: 10 }]);
    expect(view.takeAll).toBe(8);
    expect(view.depositAll).toBe(12);
  });
});

/* ----------------------------------------------------------------- en jeu */

/** Un chantier livré d'office sauf un objet, que le sac apporte : le dernier objet l'achève. */
function finish(world: World, id: EntityId): Entity {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  const cost = BUILDINGS[site.proto].cost as Partial<Record<ItemId, number>>;
  const [last] = Object.keys(cost) as ItemId[];

  site.delivered = { ...cost, [last!]: cost[last!]! - 1 };
  world.player.inventory.add(last!, 1);
  world.push({ type: 'transferToSite', id });
  world.tick();

  const built = world.entities.get(id);

  if (!built || built.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
  return built;
}

function withTown(seed = 11): { world: World; hall: TownHall } {
  const world = new World(seed);
  const hall = finish(world, world.townHallId);

  if (hall.kind !== 'townHall') throw new Error('pas de mairie');
  return { world, hall };
}

/** Pose et achève un bâtiment sur la première case posable à portée. */
function build(world: World, building: BuildingId): Entity {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES + 2; dy <= BUILD_REACH_TILES - 2; dy += 1) {
    for (let dx = -BUILD_REACH_TILES + 2; dx <= BUILD_REACH_TILES - 2; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (world.canPlace(building, tx, ty) !== null) continue;

      const before = new Set(world.entities.keys());

      world.push({ type: 'placeBuilding', building, tx, ty });
      world.tick();

      const id = [...world.entities.keys()].find((key) => !before.has(key));

      if (id === undefined) throw new Error('le chantier n’a pas été ouvert');
      return finish(world, id);
    }
  }
  throw new Error('aucune case posable à portée');
}

function rejections(world: World): TransferRejection[] {
  const found: TransferRejection[] = [];

  world.events.on('transferRejected', ({ reason }) => found.push(reason));
  return found;
}

describe('échanges sac ⇄ coffre en jeu', () => {
  it('à la mairie : reprendre 1, 10 ou tout le bois, puis le redéposer', () => {
    const { world, hall } = withTown();
    const { inventory } = world.player;

    inventory.remove('wood', inventory.count('wood'));
    hall.store.add('wood', 40 - hall.store.count('wood'));

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 1, item: 'wood' });
    world.tick();
    expect(inventory.count('wood')).toBe(1);
    expect(hall.store.count('wood')).toBe(39);

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 10, item: 'wood' });
    world.tick();
    expect(inventory.count('wood')).toBe(11);

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 'all', item: 'wood' });
    world.tick();
    expect(inventory.count('wood')).toBe(40);
    expect(hall.store.count('wood')).toBe(0);

    world.push({ type: 'transferItems', id: hall.id, direction: 'deposit', quantity: 10, item: 'wood' });
    world.tick();
    expect(inventory.count('wood')).toBe(30);
    expect(hall.store.count('wood')).toBe(10);

    // « Tout déposer » : le sac entier passe en ville.
    world.push({ type: 'transferItems', id: hall.id, direction: 'deposit', quantity: 'all' });
    world.tick();
    expect(inventory.isEmpty()).toBe(true);
    expect(hall.store.count('wood')).toBe(40);
  });

  it('le sac ne dépasse jamais sa capacité, et un sac plein refuse', () => {
    const { world, hall } = withTown();
    const { inventory } = world.player;
    const refused = rejections(world);

    hall.store.add('stone', 200);
    inventory.add('food', inventory.freeSpace() - 7);

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 10, item: 'stone' });
    world.tick();
    expect(inventory.freeSpace()).toBe(0);
    expect(inventory.total()).toBe(inventory.capacity);

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 'all' });
    world.tick();
    expect(inventory.total()).toBe(inventory.capacity);
    expect(refused).toEqual(['bagFull']);
  });

  it('ce que les bâtisseurs ont réservé pour un chantier ne se prend pas', () => {
    const { world, hall } = withTown();
    const { inventory } = world.player;

    inventory.remove('wood', inventory.count('wood'));
    hall.store.add('wood', 51 - hall.store.count('wood'));
    // Un job de livraison réserve à sa création, comme `JobBoard`.
    hall.store.reserveOut('wood', 20);

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 'all', item: 'wood' });
    world.tick();
    expect(inventory.count('wood')).toBe(31);
    expect(hall.store.count('wood')).toBe(20);
    expect(hall.store.available('wood')).toBe(0);
  });

  it('un bâtiment filtré : la nurserie ne prend que sa nourriture, et ne la rend pas', () => {
    const { world } = withTown();
    const nursery = build(world, 'nursery');
    const { inventory } = world.player;
    const refused = rejections(world);

    if (nursery.kind !== 'nursery') throw new Error('pas une nurserie');
    inventory.add('wood', 5);
    inventory.add('food', 30);

    world.push({ type: 'transferItems', id: nursery.id, direction: 'deposit', quantity: 'all', item: 'wood' });
    world.tick();
    expect(refused).toEqual(['nothing']);
    expect(nursery.store.count('wood')).toBe(0);

    world.push({ type: 'transferItems', id: nursery.id, direction: 'deposit', quantity: 'all' });
    world.tick();
    expect(nursery.store.count('food')).toBe(BUILDINGS.nursery.storage);
    expect(inventory.count('wood')).toBe(5);

    world.push({ type: 'transferItems', id: nursery.id, direction: 'take', quantity: 'all', item: 'food' });
    world.tick();
    expect(refused).toEqual(['nothing', 'nothing']);
  });

  it('même distance que le dépôt : loin du bâtiment, rien ne passe', () => {
    const { world, hall } = withTown();
    const refused = rejections(world);

    world.player.inventory.add('wood', 3);
    world.player.x += (BUILD_REACH_TILES + 4) * TILE_SIZE;
    world.push({ type: 'transferItems', id: hall.id, direction: 'deposit', quantity: 'all' });
    world.tick();
    expect(refused).toEqual(['outOfReach']);
    expect(world.player.inventory.count('wood')).toBeGreaterThanOrEqual(3);
  });

  it('un chantier n’a pas de coffre où échanger', () => {
    const world = new World(11);
    const refused = rejections(world);

    world.push({ type: 'transferItems', id: world.townHallId, direction: 'take', quantity: 'all' });
    world.tick();
    expect(refused).toEqual(['missing']);
  });

  it('la sauvegarde reflète les échanges', () => {
    const { world, hall } = withTown();
    const { inventory } = world.player;

    hall.store.add('stone', 30);
    const before = inventory.count('stone');

    world.push({ type: 'transferItems', id: hall.id, direction: 'take', quantity: 10, item: 'stone' });
    world.tick();

    const restored = deserialize(JSON.parse(JSON.stringify(serialize(world))));

    expect(restored.player.inventory.count('stone')).toBe(before + 10);
    expect(restored.townStock()?.count('stone')).toBe(hall.store.count('stone'));
  });
});
