import { describe, expect, it } from 'vitest';
import { TILE_SIZE, type TileCoord } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { ROADS, ROAD_LINK } from '../data/roads.ts';
import type { RoadRejection } from './commands.ts';
import { freshNeeds } from './needs.ts';
import { RoadNetwork, stepsBetween, type RoadTest } from './roads.ts';
import { decodeSave, encodeSave } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Mutant, Worker } from './types.ts';
import { STEP_MS, World } from './world.ts';
import { walkToward, wanderFrom } from './workers.ts';

/** Un monde neuf dont la mairie est bâtie : son coût passe du sac au chantier d'un coup. */
function withTown(seed = 11): World {
  const world = new World(seed);

  for (const [item, amount] of Object.entries(BUILDINGS.townHall.cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount);
  }
  world.push({ type: 'transferToSite', id: world.townHallId });
  world.tick();
  if (!world.townStock()) throw new Error('la mairie ne s’est pas achevée');
  return world;
}

/** `count` tuiles libres d'affilée vers l'est, au plus près sous la mairie : de quoi paver sans rien heurter. */
function freeRow(world: World, count: number): TileCoord[] {
  const hall = world.entities.get(world.townHallId)!;
  const centre = hall.tx + Math.floor(hall.width / 2) - Math.floor(count / 2);

  for (let ty = hall.ty + hall.height + 1; ty < hall.ty + 40; ty += 1) {
    for (let shift = 0; shift < 40; shift += 1) {
      for (const start of [centre - shift, centre + shift]) {
        const row = Array.from({ length: count }, (_, i) => ({ tx: start + i, ty }));

        if (row.every(({ tx, ty: y }) => world.roadBlock(tx, y) === null)) return row;
      }
    }
  }
  throw new Error('aucune rangée libre — la génération de terrain a changé');
}

/** `count` tuiles libres autour de la mairie, pas forcément d'affilée. */
function freeTiles(world: World, count: number): TileCoord[] {
  const hall = world.entities.get(world.townHallId)!;
  const tiles: TileCoord[] = [];

  for (let ty = hall.ty - 20; ty < hall.ty + 20 && tiles.length < count; ty += 1) {
    for (let tx = hall.tx - 20; tx < hall.tx + 20 && tiles.length < count; tx += 1) {
      if (world.roadBlock(tx, ty) === null) tiles.push({ tx, ty });
    }
  }
  return tiles;
}

function porter(x: number, y: number): Worker {
  return {
    kind: 'worker',
    id: 1,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'right',
    moving: false,
    homeId: 1,
    exMutant: false,
    grown: false,
    age: 30,
    logistician: false,
    builder: false,
    survivor: false,
    build: null,
    inside: false,
    job: null,
    searchTicks: 0,
    ...wanderFrom(x, y),
    ...freshNeeds(),
  };
}

/** Ticks qu'il faut à un porteur pour parcourir `tiles` tuiles vers l'est. */
function ticksToWalk(tiles: number, onRoad?: RoadTest): number {
  const walker = porter(0.5 * TILE_SIZE, 0.5 * TILE_SIZE);
  let ticks = 0;

  while (!walkToward(walker, (tiles + 0.5) * TILE_SIZE, 0.5 * TILE_SIZE, STEP_MS / 1000, onRoad)) ticks += 1;
  return ticks + 1;
}

describe('routes pavées', () => {
  it('un porteur parcourt 10 tuiles de route en 1/1,6 du temps sans route, à 5 % près', () => {
    const roads = new RoadNetwork();

    for (let tx = 0; tx <= 10; tx += 1) roads.add(tx, 0);

    const plain = ticksToWalk(10);
    const paved = ticksToWalk(10, (tx, ty) => roads.has(tx, ty));

    expect(paved / plain).toBeGreaterThan((1 / ROADS.speed) * 0.95);
    expect(paved / plain).toBeLessThan((1 / ROADS.speed) * 1.05);
  });

  it('paver 5 tuiles coûte 5 pierres, prises au sac', () => {
    const world = withTown();
    const row = freeRow(world, 5);

    world.player.inventory.add('stone', 8);
    world.push({ type: 'paveRoad', tiles: row });
    world.tick();

    expect(world.player.inventory.count('stone')).toBe(3);
    expect(world.roads.size()).toBe(5);
    for (const { tx, ty } of row) expect(world.roads.has(tx, ty)).toBe(true);
  });

  it('repasser sur une route ne coûte rien ; le sac vide, la ville paie dans son rayon', () => {
    const world = withTown();
    const row = freeRow(world, 6);
    const town = world.townStock()!;

    world.player.inventory.add('stone', 2);
    world.push({ type: 'paveRoad', tiles: row.slice(0, 2) });
    world.tick();
    town.add('stone', 10);
    world.push({ type: 'paveRoad', tiles: row });
    world.tick();

    expect(world.player.inventory.count('stone')).toBe(0);
    expect(town.count('stone')).toBe(6);
    expect(world.roads.size()).toBe(6);
  });

  it('sans pierre, le tracé s’arrête et le dit', () => {
    const world = withTown();
    const row = freeRow(world, 5);
    const refused: { reason: RoadRejection; paved: number }[] = [];

    world.events.on('roadRejected', (event) => refused.push(event));
    world.player.inventory.add('stone', 3);
    world.townStock()!.remove('stone', world.townStock()!.count('stone'));
    world.push({ type: 'paveRoad', tiles: row });
    world.tick();

    expect(world.roads.size()).toBe(3);
    expect(refused).toEqual([{ reason: 'noStone', paved: 3 }]);
  });

  it('un tracé ne pave pas plus de ROADS.maxTiles tuiles', () => {
    const world = withTown();
    const row = freeTiles(world, ROADS.maxTiles + 5);

    world.player.inventory.add('stone', 60);
    world.push({ type: 'paveRoad', tiles: row });
    world.tick();

    expect(world.roads.size()).toBe(ROADS.maxTiles);
  });

  it('ne pave ni l’eau, ni le bâti', () => {
    const world = withTown();
    const hall = world.entities.get(world.townHallId)!;
    let water: TileCoord | null = null;

    for (let r = 1; r < 200 && !water; r += 1) {
      for (let tx = hall.tx - r; tx <= hall.tx + r && !water; tx += 1) {
        if (!isWalkable(terrainAt(world.seed, tx, hall.ty + r))) water = { tx, ty: hall.ty + r };
      }
    }

    world.player.inventory.add('stone', 5);
    world.push({ type: 'paveRoad', tiles: [{ tx: hall.tx, ty: hall.ty }, ...(water ? [water] : [])] });
    world.tick();

    expect(world.roads.size()).toBe(0);
    expect(world.player.inventory.count('stone')).toBe(5);
  });

  it('une route bloque la pose d’un bâtiment ; le marteau la retire et rend sa pierre', () => {
    const world = withTown();
    const [tile] = freeRow(world, 1);

    world.player.inventory.add('stone', 1);
    world.push({ type: 'paveRoad', tiles: [tile!] });
    world.tick();
    expect(world.placementBlock('watchtower', tile!.tx, tile!.ty)?.reason).toBe('road');

    world.push({ type: 'removeRoad', tiles: [tile!] });
    world.tick();
    expect(world.roads.has(tile!.tx, tile!.ty)).toBe(false);
    expect(world.player.inventory.count('stone')).toBe(1);
    expect(world.placementBlock('watchtower', tile!.tx, tile!.ty)?.reason).not.toBe('road');
  });

  it('la route est sauvegardée et rechargée', () => {
    const world = withTown();
    const row = freeRow(world, 5);

    world.player.inventory.add('stone', 5);
    world.push({ type: 'paveRoad', tiles: row });
    world.tick();

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.world.roads.size()).toBe(5);
    for (const { tx, ty } of row) expect(decoded.world.roads.has(tx, ty)).toBe(true);
    expect(decoded.world.snapshot()).toEqual(world.snapshot());
  });

  it('une sauvegarde d’avant les routes se charge sans route', () => {
    const world = withTown();
    const file = JSON.parse(encodeSave(world, 0)) as { state: Record<string, unknown> };

    delete file.state['roads'];

    const decoded = decodeSave(JSON.stringify(file));

    expect(decoded.ok && decoded.world.roads.size()).toBe(0);
  });

  it('Adam va plus vite sur une route', () => {
    const walk = (paved: boolean): number => {
      const world = withTown();
      const row = freeRow(world, 12);

      if (paved) {
        world.player.inventory.add('stone', 12);
        world.push({ type: 'paveRoad', tiles: row });
        world.tick();
      }
      world.player.x = (row[0]!.tx + 0.5) * TILE_SIZE;
      world.player.y = (row[0]!.ty + 0.5) * TILE_SIZE;
      world.push({ type: 'setMoveAxis', x: 1, y: 0 });
      for (let i = 0; i < 20; i += 1) world.tick();
      return world.player.x;
    };
    const plain = walk(false);
    const paved = walk(true);

    expect(paved).toBeGreaterThan(plain);
  });

  it('un mutant ne va pas plus vite sur une route', () => {
    const run = (paved: boolean): number => {
      const world = withTown();
      const hall = world.entities.get(world.townHallId)!;
      const row = freeRow(world, 10);
      const y = (row[0]!.ty + 0.5) * TILE_SIZE;
      const mutant: Mutant = {
        kind: 'mutant',
        id: 999,
        proto: 'mutant',
        x: (row[0]!.tx + 0.5) * TILE_SIZE,
        y,
        prevX: 0,
        prevY: 0,
        facing: 'down',
        moving: false,
        hp: 1000,
        attackCooldown: 0,
        emerge: 0,
      };

      if (paved) {
        // Toutes les tuiles entre le mutant et la mairie : où qu'il passe, il marche sur la route.
        world.player.inventory.add('stone', 400);
        const tiles: TileCoord[] = [];

        for (let ty = hall.ty + hall.height; ty <= row[0]!.ty + 1; ty += 1) {
          for (let tx = Math.min(hall.tx, row[0]!.tx) - 2; tx <= Math.max(hall.tx + hall.width, row[0]!.tx) + 2; tx += 1) {
            tiles.push({ tx, ty });
          }
        }
        for (let i = 0; i < tiles.length; i += ROADS.maxTiles) {
          world.push({ type: 'paveRoad', tiles: tiles.slice(i, i + ROADS.maxTiles) });
        }
        world.tick();
        expect(world.roads.has(row[0]!.tx, row[0]!.ty)).toBe(true);
      }
      // Adam au loin : son arc n'y touche pas.
      world.player.x -= 60 * TILE_SIZE;
      world.mobiles.set(mutant.id, mutant);
      for (let i = 0; i < 30; i += 1) world.tick();
      return Math.hypot(mutant.x - (row[0]!.tx + 0.5) * TILE_SIZE, mutant.y - y);
    };

    const plain = run(false);

    expect(plain).toBeGreaterThan(0);
    expect(run(true)).toBeCloseTo(plain, 6);
  });
});

describe('réseau de routes', () => {
  it('dit comment une dalle se raccorde à ses voisines', () => {
    const roads = new RoadNetwork();

    for (const [tx, ty] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -40]] as const) roads.add(tx, ty);

    expect(roads.links(0, 0)).toBe(ROAD_LINK.left | ROAD_LINK.right | ROAD_LINK.bottom);
    expect(roads.links(0, -40)).toBe(0);
    expect(roads.size()).toBe(5);
    expect(roads.remove(0, -40)).toBe(true);
    expect(roads.remove(0, -40)).toBe(false);
  });

  it('range les tuiles par chunk, coordonnées négatives comprises, et les relit telles quelles', () => {
    const roads = new RoadNetwork();

    roads.add(-1, -1);
    roads.add(31, 0);
    roads.add(32, 0);

    const copy = new RoadNetwork();

    copy.restore(roads.toJSON());
    expect(Object.keys(roads.toJSON()).sort()).toEqual(['-1,-1', '0,0', '1,0']);
    expect([...copy.tiles()]).toEqual(expect.arrayContaining([{ tx: -1, ty: -1 }, { tx: 31, ty: 0 }, { tx: 32, ty: 0 }]));
    expect(copy.has(0, 0)).toBe(false);
  });

  it('trace un doigt tuile à tuile, sans diagonale', () => {
    const steps = stepsBetween({ tx: 0, ty: 0 }, { tx: 2, ty: 1 });

    expect(steps).toHaveLength(3);
    expect(steps.at(-1)).toEqual({ tx: 2, ty: 1 });
    for (const [i, step] of steps.entries()) {
      const before = i === 0 ? { tx: 0, ty: 0 } : steps[i - 1]!;

      expect(Math.abs(step.tx - before.tx) + Math.abs(step.ty - before.ty)).toBe(1);
    }
  });
});
