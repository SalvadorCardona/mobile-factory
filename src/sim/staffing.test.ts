import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { COLONY } from '../data/inhabitants.ts';
import { RECIPES } from '../data/recipes.ts';
import { decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { allocateStaff, canPause, clampStaff } from './staffing.ts';
import type { Drill, Entity, Farm, Forge, Nursery } from './types.ts';
import { World } from './world.ts';

/**
 * Une colonie posée d'un coup : la mairie finie, et une foreuse, une ferme,
 * une forge et une nurserie en marche, chacune avec son réveil planifié au
 * tick suivant — comme si elles venaient d'être achevées.
 */
function colony(): World {
  const world = new World(1);
  const state = world.snapshot();
  const hall = world.entities.get(world.townHallId)!;
  let nextId = state.nextId;
  const base = (proto: BuildingId, slot: number) => ({
    id: nextId++,
    proto,
    tx: hall.tx - 8 + slot * 4,
    ty: hall.ty + 8,
    width: BUILDINGS[proto].width,
    height: BUILDINGS[proto].height,
    hp: BUILDINGS[proto].hp,
    level: 1,
    paused: false,
    staff: BUILDINGS[proto].workers,
  });
  const entities: SavedEntity[] = [
    { ...base('townHall', 0), id: world.townHallId, tx: hall.tx, ty: hall.ty, kind: 'townHall', store: {} },
    { ...base('drill', 0), kind: 'drill', store: {}, output: 'ironOre', blocked: false },
    { ...base('farm', 1), kind: 'farm', store: {}, blocked: false },
    { ...base('forge', 2), kind: 'forge', store: { ironOre: 10, coal: 10 }, blocked: false },
    {
      ...base('nursery', 3),
      kind: 'nursery',
      store: { food: 8 },
      nextBirthTick: state.tick + 1,
      born: 0,
      hungry: false,
    },
  ];

  state.entities = entities;
  state.nextId = nextId;
  state.mobiles = [];
  state.scheduler = { near: [[state.tick + 1, entities.slice(1).map((entity) => entity.id)]], far: [] };
  return World.restore(state);
}

function find<K extends Entity['kind']>(world: World, kind: K): Extract<Entity, { kind: K }> {
  const found = [...world.entities.values()].find((entity) => entity.kind === kind);

  if (!found) throw new Error(`pas de ${kind}`);
  return found as Extract<Entity, { kind: K }>;
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

describe('répartition des ouvriers', () => {
  it('les plus anciens bâtiments servis d’abord ; ce qui manque reste un poste vide', () => {
    const filled = allocateStaff(
      [
        { id: 7, wanted: 2 },
        { id: 3, wanted: 4 },
      ],
      5,
    );

    expect(filled.get(3)).toBe(4);
    expect(filled.get(7)).toBe(1);
  });

  it('un poste vide se remplit dès qu’un ouvrier est rendu ailleurs', () => {
    const demands = [
      { id: 3, wanted: 4 },
      { id: 7, wanted: 2 },
    ];

    expect(allocateStaff(demands, 4).get(7)).toBe(0);
    demands[0]!.wanted = 2;
    expect(allocateStaff(demands, 4).get(7)).toBe(2);
  });

  it('l’effectif reste dans les bornes du bâtiment', () => {
    expect(clampStaff('lumberCamp', 5)).toBe(BUILDINGS.lumberCamp.workers);
    expect(clampStaff('lumberCamp', -1)).toBe(BUILDINGS.lumberCamp.minWorkers);
    expect(clampStaff('farm', Number.NaN)).toBe(BUILDINGS.farm.workers);
  });

  it('seuls les producteurs se mettent en pause', () => {
    expect(canPause('drill')).toBe(true);
    expect(canPause('lumberCamp')).toBe(true);
    expect(canPause('watchtower')).toBe(false);
    expect(canPause('builderHouse')).toBe(false);
  });

  it('un bâtiment neuf emploie son maximum', () => {
    const world = colony();
    const farm = find(world, 'farm');

    expect(world.staffing(farm)).toEqual({ min: 0, max: BUILDINGS.farm.workers, wanted: 4, filled: 4 });
    expect(world.staffing(find(world, 'drill'))).toBeNull();
  });
});

describe('pause', () => {
  it('une foreuse en pause ne produit plus, et repart au même rythme quand on la reprend', () => {
    const world = colony();
    const drill: Drill = find(world, 'drill');
    const cycle = RECIPES.mineOre.duration;

    run(world, cycle * 3);

    const before = drill.store.total();

    expect(before).toBeGreaterThan(0);
    world.push({ type: 'pauseBuilding', id: drill.id, paused: true });
    run(world, cycle * 4);
    expect(drill.store.total()).toBe(before);
    expect(world.stopped(drill)).toBe(true);

    world.push({ type: 'pauseBuilding', id: drill.id, paused: false });
    run(world, cycle * 3 + 1);
    // Un seul réveil à la fois : trois cycles, trois extractions — pas six.
    expect(drill.store.total() - before).toBe(3);
  });

  it('reprendre juste après la pause ne double pas le réveil', () => {
    const world = colony();
    const drill: Drill = find(world, 'drill');
    const cycle = RECIPES.mineOre.duration;

    run(world, 2);
    world.push({ type: 'pauseBuilding', id: drill.id, paused: true });
    world.tick();
    world.push({ type: 'pauseBuilding', id: drill.id, paused: false });
    run(world, cycle * 4);
    expect(drill.store.total()).toBeLessThanOrEqual(5);
  });

  it('une ferme en pause ne récolte plus ; sans ouvrier, c’est une pause de fait ; à moitié d’ouvriers, deux fois plus lente', () => {
    const world = colony();
    const farm: Farm = find(world, 'farm');
    const cycle = RECIPES.growFood.duration;

    world.push({ type: 'pauseBuilding', id: farm.id, paused: true });
    run(world, cycle * 3);
    expect(farm.store.total()).toBe(0);

    world.push({ type: 'pauseBuilding', id: farm.id, paused: false });
    world.push({ type: 'setWorkers', id: farm.id, count: 0 });
    run(world, cycle * 3);
    expect(farm.store.total()).toBe(0);
    expect(world.stopped(farm)).toBe(true);
    expect(farm.paused).toBe(false);

    world.push({ type: 'setWorkers', id: farm.id, count: 2 });
    run(world, cycle * 4 + 1);
    expect(farm.store.total()).toBe(2 * (RECIPES.growFood.outputs.food ?? 1));
  });

  it('une forge en pause ne consomme ni fer ni charbon', () => {
    const world = colony();
    const forge: Forge = find(world, 'forge');

    world.push({ type: 'pauseBuilding', id: forge.id, paused: true });
    run(world, RECIPES.smeltPlate.duration * 3);
    expect(forge.store.count('ironOre')).toBe(10);
    expect(forge.store.count('coal')).toBe(10);
    expect(forge.store.count('ironPlate')).toBe(0);

    world.push({ type: 'pauseBuilding', id: forge.id, paused: false });
    run(world, RECIPES.smeltPlate.duration + 1);
    expect(forge.store.count('ironPlate')).toBeGreaterThan(0);
  });

  it('une nurserie en pause ne fait pas naître et ne mange pas ; elle repart à la reprise', () => {
    const world = colony();
    const nursery: Nursery = find(world, 'nursery');

    world.push({ type: 'pauseBuilding', id: nursery.id, paused: true });
    run(world, 5);
    expect(nursery.born).toBe(0);
    expect(nursery.store.count('food')).toBe(8);

    world.push({ type: 'pauseBuilding', id: nursery.id, paused: false });
    world.tick();
    expect(nursery.born).toBe(1);
  });

  it('la mairie ne se met pas en pause', () => {
    const world = colony();
    const hall = find(world, 'townHall');

    world.push({ type: 'pauseBuilding', id: hall.id, paused: true });
    world.tick();
    expect(hall.paused).toBe(false);
  });
});

describe('ouvriers de la ville', () => {
  it('retirer des ouvriers les rend libres ; les remettre les réaffecte', () => {
    const world = colony();
    const farm = find(world, 'farm');

    const free = COLONY.startingWorkers - BUILDINGS.farm.workers;

    expect(world.workforce()).toMatchObject({ total: COLONY.startingWorkers, assigned: 4, free, missing: 0 });

    world.push({ type: 'setWorkers', id: farm.id, count: 1 });
    world.tick();
    expect(world.workforce()).toMatchObject({ total: COLONY.startingWorkers, assigned: 1, free: free + 3, missing: 0 });

    world.push({ type: 'setWorkers', id: farm.id, count: 4 });
    world.tick();
    expect(world.workforce()).toMatchObject({ assigned: 4, free });
  });

  it('une colonie à court d’ouvriers laisse des postes vides', () => {
    const state = colony().snapshot();

    state.colonists = 2;

    const world = World.restore(state);
    const farm = find(world, 'farm');

    expect(world.staffing(farm)).toMatchObject({ wanted: 4, filled: 2 });
    expect(world.workforce()).toMatchObject({ total: 2, assigned: 2, free: 0, missing: 2 });
  });
});

describe('sauvegarde', () => {
  it('garde la pause et l’effectif', () => {
    const world = colony();
    const farm = find(world, 'farm');
    const drill = find(world, 'drill');

    world.push({ type: 'pauseBuilding', id: drill.id, paused: true });
    world.push({ type: 'setWorkers', id: farm.id, count: 3 });
    world.tick();

    const reloaded = decodeSave(encodeSave(world, 1));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);

    const again = reloaded.world;

    expect(find(again, 'drill').paused).toBe(true);
    expect(find(again, 'farm').staff).toBe(3);
    expect(again.staffing(find(again, 'farm'))?.filled).toBe(3);
  });

  it('une sauvegarde d’avant la pause se relit : tout tourne, au complet', () => {
    const world = colony();
    const file = JSON.parse(encodeSave(world, 1)) as { state: { entities: Record<string, unknown>[] } };

    for (const entity of file.state.entities) {
      delete entity['paused'];
      delete entity['staff'];
    }

    const reloaded = decodeSave(JSON.stringify(file));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);
    expect(find(reloaded.world, 'drill').paused).toBe(false);
    expect(find(reloaded.world, 'farm').staff).toBe(BUILDINGS.farm.workers);
  });
});
