import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, REPAIR, buildingLevel } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Building, EntityId } from './types.ts';
import { World, repairCost } from './world.ts';

/**
 * Un chantier achevé d'office : son coût dans le sac, Adam à portée le temps
 * de « Transférer », puis il revient où il était. Ces tests portent sur la
 * défense, pas sur la récolte.
 */
function finish(world: World, id: EntityId): Building {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);
  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount - (site.delivered[item] ?? 0));
  }

  const { x, y } = world.player;

  world.player.x = (site.tx + site.width / 2) * TILE_SIZE;
  world.player.y = (site.ty + site.height + 0.5) * TILE_SIZE;
  world.push({ type: 'transferToSite', id });
  world.tick();
  world.player.x = world.player.prevX = x;
  world.player.y = world.player.prevY = y;

  const built = world.entities.get(id);

  if (!built || built.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
  return built;
}

function hallOf(world: World): Building {
  const hall = world.entities.get(world.townHallId);

  if (!hall || hall.kind === 'site') throw new Error('pas de mairie debout');
  return hall;
}

/** La mairie debout, Adam juste en dessous, qui pousse contre elle s'il marche vers le haut. */
function worldWithTownHall(seed: number): World {
  const world = new World(seed);
  const hall = finish(world, world.townHallId);

  world.player.x = world.player.prevX = (hall.tx + hall.width / 2) * TILE_SIZE;
  world.player.y = world.player.prevY = (hall.ty + hall.height + 0.5) * TILE_SIZE;
  return world;
}

/**
 * Pose `count` tours de guet au plus près de la mairie, en laissant libre
 * l'anneau autour d'elle où se tient Adam.
 */
function addTowers(world: World, count: number): void {
  const hall = hallOf(world);
  const cx = hall.tx + hall.width / 2;
  const cy = hall.ty + hall.height / 2;
  const spots: [number, number][] = [];

  for (let dy = -6; dy <= 6; dy += 1) {
    for (let dx = -6; dx <= 6; dx += 1) spots.push([hall.tx + dx, hall.ty + dy]);
  }
  spots.sort(([ax, ay], [bx, by]) => Math.hypot(ax + 1 - cx, ay + 1 - cy) - Math.hypot(bx + 1 - cx, by + 1 - cy));

  let placed = 0;

  for (const [tx, ty] of spots) {
    if (placed === count) return;
    if (tx >= hall.tx - 2 && tx <= hall.tx + hall.width && ty >= hall.ty - 2 && ty <= hall.ty + hall.height + 1) continue;

    const { x, y } = world.player;

    // À portée le temps de poser.
    world.player.x = (tx + 0.5) * TILE_SIZE;
    world.player.y = (ty + 3.5) * TILE_SIZE;
    if (world.canPlace('watchtower', tx, ty) !== null) {
      world.player.x = x;
      world.player.y = y;
      continue;
    }

    const before = new Set(world.entities.keys());

    world.push({ type: 'placeBuilding', building: 'watchtower', tx, ty });
    world.tick();
    world.player.x = world.player.prevX = x;
    world.player.y = world.player.prevY = y;

    const id = [...world.entities.keys()].find((key) => !before.has(key));

    if (id === undefined) throw new Error('le chantier n’a pas été ouvert');
    finish(world, id);
    placed += 1;
  }
  if (placed < count) throw new Error('pas assez de place pour les tours');
}

/** Joue jusqu'à l'aube de la nuit `night`, ou jusqu'à la défaite. */
function playThroughNight(world: World, night: number, between: () => void = () => {}): void {
  for (let i = 0; i < 20 * 60 * 5 * (night + 1) && !world.defeated; i += 1) {
    world.tick();
    between();
    if (world.night === night && world.clock()?.phase === 'dawn') return;
  }
}


describe('réparer', () => {
  it('répare un bâtiment abîmé qu’Adam heurte avec du bois dans le sac, avant que la mairie n’avale le reste', () => {
    const world = worldWithTownHall(7);
    const hall = hallOf(world);
    const repaired: number[] = [];

    world.events.on('playerRepaired', ({ amount, fromBag }) => repaired.push(amount, fromBag));
    const max = buildingLevel(hall.proto, hall.level).hp;

    hall.hp = max - 3 * REPAIR.hp;
    world.player.inventory.add('wood', 5);

    // Adam est juste sous la mairie : il pousse vers le haut.
    world.push({ type: 'setMoveAxis', x: 0, y: -1 });
    for (let i = 0; i < 40; i += 1) world.tick();

    expect(repaired).toEqual([3, 3]);
    expect(hall.hp).toBe(max);
    // Le bois en trop est parti en ville, comme tout le sac.
    expect(world.player.inventory.count('wood')).toBe(0);
    expect(world.townStock()!.available('wood')).toBeGreaterThanOrEqual(2);
  });

  it('ne prend rien pour réparer quand le bâtiment est intact', () => {
    const world = worldWithTownHall(7);
    const repaired: number[] = [];

    world.events.on('playerRepaired', ({ amount }) => repaired.push(amount));
    world.player.inventory.add('wood', 5);
    world.push({ type: 'setMoveAxis', x: 0, y: -1 });
    for (let i = 0; i < 40; i += 1) world.tick();

    expect(repaired).toEqual([]);
  });

  it('« Réparer » pose d’un coup le bois qu’il faut, le sac puis la ville, sans dépasser le maximum', () => {
    const world = worldWithTownHall(7);
    const hall = hallOf(world);
    const max = buildingLevel(hall.proto, hall.level).hp;

    hall.hp = max - 4 * REPAIR.hp - 3;
    expect(repairCost(hall)).toBe(5);
    world.player.inventory.add('wood', 2);
    world.townStock()!.add('wood', 10 - world.townStock()!.available('wood'));

    world.push({ type: 'repairBuilding', id: hall.id });
    world.tick();

    expect(hall.hp).toBe(max);
    expect(world.player.inventory.count('wood')).toBe(0);
    expect(world.townStock()!.available('wood')).toBe(7);
  });

  it('refuse de réparer un bâtiment intact, sans bois, ou de loin', () => {
    const world = worldWithTownHall(7);
    const hall = hallOf(world);
    const reasons: string[] = [];

    world.events.on('repairRejected', ({ reason }) => reasons.push(reason));
    world.townStock()!.remove('wood', world.townStock()!.available('wood'));

    world.push({ type: 'repairBuilding', id: hall.id });
    world.tick();

    hall.hp = 10;
    world.push({ type: 'repairBuilding', id: hall.id });
    world.tick();

    world.player.inventory.add('wood', 1);
    world.player.x += 40 * TILE_SIZE;
    world.push({ type: 'repairBuilding', id: hall.id });
    world.tick();

    expect(reasons).toEqual(['intact', 'noMaterial', 'outOfReach']);
    expect(hall.hp).toBe(10);
  });
});

/*
 * L'équilibre, mesuré, en nuits. La défaite doit venir d'un choix du joueur —
 * négliger les tours, partir trop loin — et plus de l'usure. Adam reste
 * planté sous la mairie : son arc tire seul, il ne répare pas ; Ève, arrivée
 * après la nuit 3, répare entre deux vagues.
 */
describe('courbe des nuits', () => {
  const SEEDS = [7, 42, 99];

  it.each(SEEDS)('seed %i : Adam immobile et une tour passent la nuit 10', (seed) => {
    const world = worldWithTownHall(seed);

    addTowers(world, 1);
    playThroughNight(world, 10);

    expect(world.defeated).toBe(false);
    expect(world.night).toBe(10);
  }, 60_000);

  it.each(SEEDS)('seed %i : sans tour, la mairie tient les premières nuits mais tombe avant l’aube de la nuit 10', (seed) => {
    const world = worldWithTownHall(seed);

    playThroughNight(world, 10);

    expect(world.defeated).toBe(true);
    expect(world.night).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it.each(SEEDS)('seed %i : deux tours et des réparations passent la nuit 10 en bonne santé', (seed) => {
    const world = worldWithTownHall(seed);
    const hall = hallOf(world);
    let lowest = hall.hp;

    addTowers(world, 2);
    world.player.inventory.add('wood', 30);
    playThroughNight(world, 10, () => {
      lowest = Math.min(lowest, hall.hp);
      if (world.tickCount % 100 === 0 && repairCost(hall) > 0) world.push({ type: 'repairBuilding', id: hall.id });
    });

    expect(world.defeated).toBe(false);
    expect(world.night).toBe(10);
    expect(lowest).toBeGreaterThan(BUILDINGS.townHall.hp / 3);
  }, 60_000);
});
