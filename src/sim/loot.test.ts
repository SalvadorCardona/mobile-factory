import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { mulberry32 } from '../core/rng.ts';
import { ENEMIES, LOOT_DROPS, WILDLIFE, type LootTable, type WildlifeId } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { validatePrototypes } from '../data/validate.ts';
import { rollLoot, stepPickup } from './loot.ts';
import type { Beast, Pickup } from './types.ts';
import { deserialize, serialize } from './save.ts';
import { World } from './world.ts';

const SEED = 7;

function pickupAt(x: number, y: number, id = 700, item: ItemId = 'food'): Pickup {
  return { kind: 'pickup', id, x, y, prevX: x, prevY: y, facing: 'down', moving: false, item, amount: 1, waitForLeave: false, ttl: LOOT_DROPS.lifetimeTicks };
}

function pickups(world: World): Pickup[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Pickup => mobile.kind === 'pickup');
}

/** Une bête posée à la main, immobile, à `tiles` tuiles à droite d'Adam. */
function beastNextTo(world: World, proto: WildlifeId, tiles = 3, id = 9001): Beast {
  const x = world.player.x + tiles * TILE_SIZE;
  const y = world.player.y;
  const beast: Beast = {
    kind: 'beast',
    id,
    proto,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    hp: WILDLIFE[proto].hp,
    age: 3,
    denId: 0,
    homeX: x,
    homeY: y,
    state: 'return',
    dirX: 0,
    dirY: 0,
    wanderTicks: 0,
    attackCooldown: 0,
  };

  world.mobiles.set(id, beast);
  return beast;
}

/** Laisse l'arc d'Adam abattre la bête posée ; renvoie le butin qu'elle a lâché. */
function killNextTo(world: World, proto: WildlifeId): Pickup[] {
  const dropped: Pickup[] = [];
  const beast = beastNextTo(world, proto);
  const off = world.events.on('lootDropped', ({ id }) => dropped.push(world.mobiles.get(id) as Pickup));

  for (let i = 0; i < 200 && world.mobiles.has(beast.id); i += 1) world.tick();
  off();
  expect(world.mobiles.has(beast.id)).toBe(false);
  return dropped;
}

describe('tables de butin', () => {
  it('sont valides : objets connus, quantités entières, un butin garanti', () => {
    expect(validatePrototypes().filter((error) => /butin|LOOT_DROPS/.test(error))).toEqual([]);
  });

  it('tirent entre min et max de chaque ligne, et toujours les lignes garanties', () => {
    const tables: LootTable[] = [ENEMIES.mutant.loot, WILDLIFE.crab.loot, WILDLIFE.wolf.loot];
    const rng = mulberry32(SEED);

    for (const table of tables) {
      for (let i = 0; i < 500; i += 1) {
        const items = rollLoot(table, rng);

        for (const { item, max, chance, min } of table) {
          const count = items.filter((got) => got === item).length;

          expect(count).toBeLessThanOrEqual(max * table.filter((entry) => entry.item === item).length);
          if (chance >= 1) expect(count).toBeGreaterThanOrEqual(min);
        }
        expect(items.every((item) => table.some((entry) => entry.item === item))).toBe(true);
      }
    }
  });

  it('respectent à peu près leurs probabilités', () => {
    const table: LootTable = [
      { item: 'food', min: 1, max: 1, chance: 1 },
      { item: 'ironPlate', min: 1, max: 1, chance: 0.25 },
    ];
    const rng = mulberry32(SEED);
    let plates = 0;

    for (let i = 0; i < 4000; i += 1) plates += rollLoot(table, rng).filter((item) => item === 'ironPlate').length;
    expect(plates / 4000).toBeGreaterThan(0.2);
    expect(plates / 4000).toBeLessThan(0.3);
  });

  it('sont déterministes : même PRNG, même butin', () => {
    const a = mulberry32(SEED);
    const b = mulberry32(SEED);

    for (let i = 0; i < 50; i += 1) expect(rollLoot(ENEMIES.mutant.loot, a)).toEqual(rollLoot(ENEMIES.mutant.loot, b));
  });
});

describe('butin au sol', () => {
  it('un crabe abattu lâche sa nourriture au sol, pas dans le sac', () => {
    const world = new World(SEED);
    const before = world.player.inventory.count('food');
    const dropped = killNextTo(world, 'crab');

    expect(dropped.map((loot) => loot.item)).toEqual(['food']);
    expect(world.player.inventory.count('food')).toBe(before);
    expect(world.mobiles.get(dropped[0]!.id)).toBe(dropped[0]);
  });

  it('un loup lâche plus de nourriture qu’un crabe, tout près de là où il est tombé', () => {
    const world = new World(SEED);
    let x = 0;
    let y = 0;

    // Touché, le loup charge : il tombe ailleurs que là où il était.
    world.events.on('beastDied', (died) => ({ x, y } = died));
    const dropped = killNextTo(world, 'wolf');
    const food = dropped.filter((loot) => loot.item === 'food');

    expect(food.length).toBeGreaterThanOrEqual(2);
    for (const loot of dropped) {
      expect(Math.abs(loot.x - x)).toBeLessThanOrEqual(LOOT_DROPS.scatter * TILE_SIZE);
      expect(Math.abs(loot.y - y)).toBeLessThanOrEqual(LOOT_DROPS.scatter * TILE_SIZE);
    }
  });

  it('même seed, même butin', () => {
    const run = (): { item: ItemId; x: number; y: number }[] => {
      const world = new World(SEED);

      return [...killNextTo(world, 'wolf'), ...killNextTo(world, 'crab')].map(({ item, x, y }) => ({ item, x, y }));
    };

    expect(run()).toEqual(run());
  });

  it('Adam le ramasse en passant dessus : l’objet arrive dans le sac', () => {
    const world = new World(SEED);
    const [loot] = killNextTo(world, 'crab');
    const picked: ItemId[] = [];
    const before = world.player.inventory.count('food');

    world.events.on('lootPicked', ({ item }) => picked.push(item));
    world.player.x = loot!.x;
    world.player.y = loot!.y;
    world.tick();

    expect(picked).toEqual(['food']);
    expect(world.player.inventory.count('food')).toBe(before + 1);
    expect(world.mobiles.has(loot!.id)).toBe(false);
  });

  it('glisse vers Adam à portée d’aimant, s’il a de la place', () => {
    const adam = { x: 0, y: 0 };
    const near = pickupAt((LOOT_DROPS.magnetRadius - 0.2) * TILE_SIZE, 0);
    const far = pickupAt((LOOT_DROPS.magnetRadius + 0.5) * TILE_SIZE, 0);
    const full = pickupAt((LOOT_DROPS.magnetRadius - 0.2) * TILE_SIZE, 0);

    expect(stepPickup(near, adam, true, 1 / 20)).toBe('wait');
    expect(near.x).toBeLessThan(near.prevX);
    expect(stepPickup(far, adam, true, 1 / 20)).toBe('wait');
    expect(far.x).toBe(far.prevX);
    expect(stepPickup(full, adam, false, 1 / 20)).toBe('wait');
    expect(full.x).toBe(full.prevX);

    let step = stepPickup(near, adam, true, 1 / 20);

    for (let i = 0; i < 40 && step === 'wait'; i += 1) step = stepPickup(near, adam, true, 1 / 20);
    expect(step).toBe('reached');
  });

  it('sac plein : il reste au sol, compté nulle part, et le HUD l’apprend', () => {
    const world = new World(SEED);
    const [loot] = killNextTo(world, 'crab');
    const { inventory } = world.player;
    let full = 0;

    inventory.add('wood', inventory.freeSpace());
    const total = inventory.total();

    world.events.on('inventoryFull', () => (full += 1));
    world.player.x = loot!.x;
    world.player.y = loot!.y;
    for (let i = 0; i < 40; i += 1) world.tick();

    expect(world.mobiles.has(loot!.id)).toBe(true);
    expect(inventory.total()).toBe(total);
    expect(full).toBeGreaterThan(0);

    // De la place : il part dans le sac.
    inventory.remove('wood', 1);
    world.tick();
    expect(world.mobiles.has(loot!.id)).toBe(false);
    expect(inventory.count('food')).toBeGreaterThan(0);
  });

  it('disparaît s’il est oublié', () => {
    const world = new World(SEED);
    const [loot] = killNextTo(world, 'crab');

    world.player.x += 10 * TILE_SIZE;
    for (let i = 0; i < LOOT_DROPS.lifetimeTicks - 5; i += 1) world.tick();
    expect(world.mobiles.has(loot!.id)).toBe(true);
    for (let i = 0; i < 10; i += 1) world.tick();
    expect(world.mobiles.has(loot!.id)).toBe(false);
  });

  it('est plafonné : au-delà, le plus ancien s’efface', () => {
    const world = new World(SEED);
    const [first] = killNextTo(world, 'crab');

    for (let i = 0; i < LOOT_DROPS.cap; i += 1) killNextTo(world, 'crab');

    expect(pickups(world)).toHaveLength(LOOT_DROPS.cap);
    expect(world.mobiles.has(first!.id)).toBe(false);
  });

  it('se sauvegarde avec la partie', () => {
    const world = new World(SEED);
    const dropped = killNextTo(world, 'crab');
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(world))));

    for (const loot of dropped) expect(restored.mobiles.get(loot.id)).toMatchObject({ kind: 'pickup', item: loot.item, ttl: loot.ttl });
  });
});
