import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { COLONY } from '../data/inhabitants.ts';
import type { TestScenarioProto } from '../data/testScenario.ts';
import { doorOf } from './jobs.ts';
import { decodeSave, encodeSave } from './save.ts';
import { stageScenario } from './testScenario.ts';
import type { Building, Entity, EntityId, Lumberjack, Mobile, Worker } from './types.ts';
import { World } from './world.ts';

/** La graine et les emprises de la partie de test : on sait qu'elles se posent. */
const BASE = { label: 'Colonie', seed: 100, town: { wood: 40, stone: 30, food: 40, water: 40 }, bag: {}, adam: { dx: 1, dy: 4 } } as const;
const CAMP = { building: 'lumberCamp', dx: -6, dy: 0 } as const;

function scenario(buildings: TestScenarioProto['buildings']): World {
  return stageScenario({ ...BASE, buildings });
}

function freeWorkers(world: World): Worker[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Worker => mobile.kind === 'worker' && mobile.free);
}

function lumberjacks(world: World): Lumberjack[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Lumberjack => mobile.kind === 'lumberjack');
}

/** Les humains de la colonie sur la carte : tous ceux qui ont un âge. */
function people(world: World): Mobile[] {
  return [...world.mobiles.values()].filter((mobile) => 'age' in mobile && mobile.kind !== 'eve');
}

function ids(mobiles: readonly Mobile[]): number[] {
  return mobiles.map((mobile) => mobile.id).sort((a, b) => a - b);
}

function only(world: World, proto: Entity['proto']): Entity {
  const found = [...world.entities.values()].find((entity) => entity.proto === proto);

  if (!found) throw new Error(`pas de ${proto}`);
  return found;
}

function built(world: World, proto: Entity['proto']): Building {
  const found = only(world, proto);

  if (found.kind === 'site') throw new Error(`${proto} encore en chantier`);
  return found;
}

/** Le coup de mutant qui l'abat, porté directement par `damageBuilding`. */
function destroy(world: World, id: EntityId): void {
  (world as unknown as { damageBuilding(id: EntityId, amount: number): void }).damageBuilding(id, 10_000);
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

describe('ouvriers de la colonie', () => {
  it('une nouvelle partie part avec dix ouvriers libres, devant le chantier de la mairie', () => {
    const world = new World(7);
    const hall = world.entities.get(world.townHallId)!;
    const door = doorOf(hall);
    const free = freeWorkers(world);

    expect(free).toHaveLength(COLONY.startingWorkers);
    expect(people(world)).toHaveLength(COLONY.startingWorkers);
    expect(world.population()).toMatchObject({ adults: 1, children: 0, workers: COLONY.startingWorkers });
    expect(world.workforce()).toMatchObject({ total: 10, assigned: 0, free: 10 });
    for (const worker of free) {
      expect(worker.homeId).toBe(world.townHallId);
      expect(Math.hypot(worker.x - door.x, worker.y - door.y)).toBeLessThan(4 * TILE_SIZE);
    }
  });

  it('avant la mairie, ils n’ont ni faim ni soif : les provisions arrivent avec elle', () => {
    const world = new World(7);

    run(world, 20 * 60);
    for (const worker of freeWorkers(world)) expect(worker.needs).toEqual({ hunger: 1, thirst: 1 });
  });

  it('bâtir une cabane n’ajoute personne : deux ouvriers libres, les plus proches, y deviennent bûcherons', () => {
    const cost = BUILDINGS.lumberCamp.cost;
    const world = scenario([{ ...CAMP, delivered: { ...cost, wood: cost.wood - 1 } }]);
    const site = only(world, 'lumberCamp');
    const door = doorOf(site);
    const before = ids(people(world));
    const nearest = freeWorkers(world)
      .sort((a, b) => Math.hypot(a.x - door.x, a.y - door.y) - Math.hypot(b.x - door.x, b.y - door.y) || a.id - b.id)
      .slice(0, BUILDINGS.lumberCamp.workers);

    expect(world.workforce().free).toBe(COLONY.startingWorkers);

    // Adam au pied du chantier : « Transférer » prend le bois qui manque à la ville.
    world.player.x = world.player.prevX = door.x;
    world.player.y = world.player.prevY = door.y + TILE_SIZE;
    world.push({ type: 'transferToSite', id: site.id });
    run(world, 2);

    expect(world.entities.get(site.id)?.kind).toBe('lumberCamp');
    // Les mêmes humains, sous les mêmes ids : aucun n'est né de la cabane.
    expect(ids(people(world))).toEqual(before);
    expect(world.population().workers).toBe(COLONY.startingWorkers);
    expect(ids(lumberjacks(world))).toEqual(ids(nearest));
    expect(world.workforce()).toMatchObject({ assigned: 2, free: COLONY.startingWorkers - 2 });
    expect(freeWorkers(world)).toHaveLength(COLONY.startingWorkers - 2);
  });

  it('sans ouvrier libre, un poste reste vide ; un bâtiment tombé rend les siens, qui le pourvoient', () => {
    // Deux bûcherons, quatre fermiers, un puisatier : trois bâtisseurs pour quatre postes.
    const world = scenario([CAMP, { building: 'farm', dx: 6, dy: 0 }, { building: 'well', dx: 0, dy: 9 }, { building: 'constructionPost', dx: -5, dy: 5 }]);
    const post = built(world, 'constructionPost');
    const camp = only(world, 'lumberCamp');

    run(world, 2);
    expect(world.staffing(post)).toMatchObject({ wanted: 4, filled: 3 });
    expect(world.workforce()).toMatchObject({ free: 0, missing: 1 });
    expect(freeWorkers(world)).toHaveLength(0);

    const crew = ids(lumberjacks(world));
    const before = ids(people(world));

    // La cabane tombe : ses bûcherons redeviennent libres, et le poste prend celui qui lui manquait.
    destroy(world, camp.id);
    run(world, 3);

    expect(lumberjacks(world)).toHaveLength(0);
    expect(ids(people(world))).toEqual(before);
    expect(world.staffing(post)).toMatchObject({ wanted: 4, filled: 4 });
    expect(world.workforce()).toMatchObject({ free: 1, missing: 0 });

    const builders = [...world.mobiles.values()].filter((mobile) => mobile.kind === 'worker' && mobile.builder);

    expect(builders).toHaveLength(4);
    // Les deux ex-bûcherons : l'un bâtisseur, l'autre libre.
    expect(crew.map((id) => world.mobiles.get(id)?.kind)).toEqual(['worker', 'worker']);
  });

  it('une ferme fait entrer ses ouvriers ; abattue, elle les rend libres, à sa porte', () => {
    const world = scenario([{ building: 'farm', dx: 6, dy: 0 }]);
    const farm = only(world, 'farm');
    const door = doorOf(farm);
    const workers = BUILDINGS.farm.workers;

    run(world, 2);
    // Entrés aux champs : plus sur la carte, toujours dans la colonie.
    expect(freeWorkers(world)).toHaveLength(COLONY.startingWorkers - workers);
    expect(world.population().workers).toBe(COLONY.startingWorkers);
    expect(world.workforce()).toMatchObject({ assigned: workers, free: COLONY.startingWorkers - workers });

    destroy(world, farm.id);
    run(world, 1);

    const free = freeWorkers(world);

    expect(free).toHaveLength(COLONY.startingWorkers);
    expect(free.filter((worker) => Math.hypot(worker.x - door.x, worker.y - door.y) < TILE_SIZE)).toHaveLength(workers);
    expect(world.population().workers).toBe(COLONY.startingWorkers);
    expect(world.workforce()).toMatchObject({ assigned: 0, free: COLONY.startingWorkers });
  });

  it('une ancienne sauvegarde garde ses ouvriers à leurs bâtiments et pose les libres devant la mairie', () => {
    const world = scenario([CAMP, { building: 'farm', dx: 6, dy: 0 }]);

    run(world, 2);

    const file = JSON.parse(encodeSave(world, 1)) as { state: { mobiles: Record<string, unknown>[] } };
    const crew = ids(lumberjacks(world));

    // Avant les ouvriers libres sur la carte : seuls les employés existaient, sans le champ `free`.
    file.state.mobiles = file.state.mobiles
      .filter((mobile) => mobile['free'] !== true)
      .map((mobile) => {
        const old = { ...mobile };

        delete old['free'];
        return old;
      });

    const decoded = decodeSave(JSON.stringify(file));

    if (!decoded.ok) throw new Error(`ancienne sauvegarde refusée : ${decoded.reason}`);

    const loaded = decoded.world;
    const camp = only(loaded, 'lumberCamp');

    expect(ids(lumberjacks(loaded))).toEqual(crew);
    expect(lumberjacks(loaded).every((lumberjack) => lumberjack.homeId === camp.id)).toBe(true);
    // Les fermiers n'ont jamais été sur la carte : ils restent aux champs, les quatre autres attendent devant la mairie.
    expect(freeWorkers(loaded)).toHaveLength(COLONY.startingWorkers - 2 - BUILDINGS.farm.workers);
    expect(loaded.workforce()).toMatchObject({ total: 10, assigned: 6, free: 4 });
    run(loaded, 10);
    expect(people(loaded)).toHaveLength(COLONY.startingWorkers - BUILDINGS.farm.workers);
  });

  it('est déterministe : même seed, mêmes commandes, mêmes ouvriers', () => {
    const layout = [CAMP, { building: 'farm', dx: 6, dy: 0 }] as const;
    const a = scenario(layout);
    const b = scenario(layout);

    run(a, 1500);
    run(b, 1500);
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
