import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DAY_CYCLE } from '../data/dayNight.ts';
import { AGES, COLONY, NURSERY_CARE } from '../data/inhabitants.ts';
import type { ItemId } from '../data/items.ts';
import { IDLE } from '../data/workers.ts';
import { CYCLE_TICKS, ticksToDawn } from './dayNight.ts';
import { ADAM_SALT, adultAge, nameOf, yearsToWork } from './inhabitants.ts';
import { SAVE_VERSION, decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Kid, Mobile, Nursery, Worker } from './types.ts';
import { World } from './world.ts';

type Stock = Partial<Record<ItemId, number>>;

/** Une seed dont la mairie a une plaine sans eau au sud. */
function landSeed(): { world: World; hx: number; hy: number } {
  for (let seed = 1; seed < 400; seed += 1) {
    const world = new World(seed);
    const hall = world.entities.get(world.townHallId)!;
    let dry = true;

    for (let ty = hall.ty - 1; ty < hall.ty + 16 && dry; ty += 1) {
      for (let tx = hall.tx - 10; tx < hall.tx + 10 && dry; tx += 1) {
        if (!isWalkable(terrainAt(world.seed, tx, ty))) dry = false;
      }
    }
    if (dry) return { world, hx: hall.tx, hy: hall.ty };
  }
  throw new Error('aucune seed testable — la génération de terrain a changé');
}

interface Layout {
  /** Un enfant de cet âge, devant la nurserie. */
  kidAge?: number;
  /** Une maison des constructeurs, et ses quatre porteurs. */
  house?: boolean;
  /** Une foreuse finie, coffre déjà garni : du travail pour les porteurs. */
  drill?: Stock;
  /** Les ouvriers de la colonie ; par défaut, ceux d'une nouvelle partie. */
  colonists?: number;
}

/** Une colonie posée d'un coup — mairie, nurserie, et ce que demande `layout` —, le cycle jour/nuit lancé. */
function colony(layout: Layout): World {
  const { world, hx, hy } = landSeed();
  const state = world.snapshot();
  let nextId = state.nextId;
  const at = (proto: 'nursery' | 'builderHouse' | 'drill', dx: number, dy: number) => ({
    id: nextId++,
    proto,
    tx: hx + dx,
    ty: hy + dy,
    width: BUILDINGS[proto].width,
    height: BUILDINGS[proto].height,
  });
  const built = { hp: 100, level: 1, paused: false };
  const nursery = at('nursery', -5, 5);
  const entities: SavedEntity[] = [
    { kind: 'townHall', id: world.townHallId, proto: 'townHall', tx: hx, ty: hy, width: 3, height: 3, store: {}, ...built, hp: BUILDINGS.townHall.hp, staff: 0 },
    { ...nursery, kind: 'nursery', store: {}, ...built, staff: BUILDINGS.nursery.workers, nextBirthTick: state.tick + 1_000_000, born: 1, hungry: false },
  ];

  if (layout.house) entities.push({ ...at('builderHouse', 2, 6), kind: 'house', store: {}, ...built, staff: BUILDINGS.builderHouse.workers });
  if (layout.drill) {
    entities.push({ ...at('drill', 6, 6), kind: 'drill', store: layout.drill, ...built, staff: BUILDINGS.drill.workers, output: 'ironOre', blocked: true });
  }

  const mobiles: Mobile[] = [];

  if (layout.kidAge !== undefined) {
    const x = (nursery.tx + 1) * TILE_SIZE;
    const y = (nursery.ty + nursery.height + 1) * TILE_SIZE;

    mobiles.push({ kind: 'kid', id: state.nextMobileId, age: layout.kidAge, x, y, prevX: x, prevY: y, facing: 'down', moving: false, homeId: nursery.id, homeX: x, homeY: y, dirX: 0, dirY: 0, wanderTicks: 0 });
  }

  // Adam à l'écart, immobile.
  state.player = { ...state.player, x: (hx - 20) * TILE_SIZE, y: (hy - 20) * TILE_SIZE };
  state.entities = entities;
  state.nextId = nextId;
  state.mobiles = mobiles;
  state.nextMobileId += mobiles.length;
  if (layout.colonists !== undefined) state.colonists = layout.colonists;
  // Plein jour, au début du premier cycle — 0 voudrait dire « pas de cycle ».
  state.tick = Math.max(state.tick, 1);
  state.cycleStartTick = state.tick;
  return World.restore(state);
}

/** Avance l'horloge jusqu'au tick qui précède l'aube, sans traverser la nuit et ses vagues. */
function toDawn(world: World): void {
  const clock = world.clock()!;
  const dawnOffset = DAY_CYCLE.day + DAY_CYCLE.dusk + DAY_CYCLE.night;

  world.cycleStartTick -= dawnOffset - clock.offset - 1;
  world.tick();
  expect(world.clock()?.phase).toBe('dawn');
}

function kids(world: World): Kid[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Kid => mobile.kind === 'kid');
}

function workers(world: World): Worker[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Worker => mobile.kind === 'worker');
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

describe('âge des habitants', () => {
  it('donne à Adam un âge d’adulte tiré de la seed, et à chaque ouvrier logé le sien', () => {
    const world = colony({ house: true });

    expect(world.player.age).toBe(adultAge(world.seed, ADAM_SALT));
    expect(world.player.age).toBeGreaterThanOrEqual(AGES.adultMin);
    expect(world.player.age).toBeLessThanOrEqual(AGES.adultMax);
    expect(workers(world)).toHaveLength(4);
    for (const worker of workers(world)) {
      expect(worker.age).toBe(adultAge(world.seed, worker.id));
      expect(worker.grown).toBe(false);
    }
  });

  it('une nouvelle partie compte dix ouvriers, sans un bâtiment pour les loger', () => {
    const world = new World(1);

    expect(world.colonists).toBe(COLONY.startingWorkers);
    expect(world.population().workers).toBe(10);
    expect(world.workforce()).toMatchObject({ total: 10, assigned: 0, free: 10 });
  });

  it('ajoute une année à chacun à chaque aube : un cycle jour/nuit, un an', () => {
    const world = colony({ house: true, kidAge: AGES.nursery });
    const adam = world.player.age;
    const before = new Map([...world.mobiles.values()].map((mobile) => [mobile.id, 'age' in mobile ? mobile.age : -1]));

    run(world, 100);
    expect(world.player.age).toBe(adam);

    toDawn(world);
    expect(world.player.age).toBe(adam + AGES.yearsPerCycle);
    for (const mobile of world.mobiles.values()) {
      if ('age' in mobile) expect(mobile.age).toBe(before.get(mobile.id)! + AGES.yearsPerCycle);
    }
  });

  it('fait sortir un enfant de la nurserie à 10 ans', () => {
    const world = colony({});
    const nursery = [...world.entities.values()].find((entity) => entity.kind === 'nursery')!;

    if (nursery.kind !== 'nursery') throw new Error('pas de nurserie');
    nursery.store.add('food', 20);
    nursery.nextBirthTick = world.tickCount + 1;
    world.push({ type: 'pauseBuilding', id: nursery.id, paused: true });
    world.tick();
    world.push({ type: 'pauseBuilding', id: nursery.id, paused: false });
    run(world, 5);

    expect(kids(world).map((kid) => kid.age)).toEqual([AGES.nursery]);
    expect(world.occupation(kids(world)[0]!)).toEqual({ kind: 'child', days: AGES.work - AGES.nursery });
  });
});

describe('travail à 14 ans', () => {
  it('n’affecte jamais un enfant : il ne compte pas parmi les ouvriers, même quand une foreuse déborde', () => {
    const world = colony({ kidAge: AGES.work - 1, drill: { ironOre: 30 } });
    const pool = world.workforce();

    run(world, 400);

    expect(kids(world)).toHaveLength(1);
    expect(workers(world)).toHaveLength(0);
    expect(world.workforce()).toEqual(pool);
    expect(world.census()).toMatchObject({ children: 1, idle: 0 });
    expect(world.population().children).toBe(1);
  });

  it('à 14 ans, il rejoint les ouvriers de la colonie et prend le poste qui manquait', () => {
    // Trois ouvriers pour une maison qui en veut quatre : un poste vide.
    const world = colony({ house: true, kidAge: AGES.work - 1, colonists: 3 });
    const house = [...world.entities.values()].find((entity) => entity.kind === 'house')!;
    const [kid] = kids(world);
    const grown: { id: number; name: string }[] = [];

    world.events.on('kidGrewUp', ({ id, name }) => grown.push({ id, name }));
    expect(world.staffing(house)).toMatchObject({ wanted: 4, filled: 3 });
    expect(workers(world)).toHaveLength(3);
    const workersBefore = world.population().workers;

    toDawn(world);

    expect(grown).toEqual([{ id: kid!.id, name: nameOf(world.seed, kid!.id) }]);
    expect(kids(world)).toHaveLength(0);
    expect(world.colonists).toBe(4);
    expect(world.population()).toMatchObject({ children: 0, workers: workersBefore + 1 });
    expect(world.staffing(house)).toMatchObject({ wanted: 4, filled: 4 });

    // La maison loge le quatrième porteur.
    world.tick();
    expect(workers(world).filter((worker) => worker.homeId === house.id)).toHaveLength(4);
  });

  it('compte les jours qui restent à un enfant', () => {
    expect(yearsToWork(AGES.nursery)).toBe(4);
    expect(yearsToWork(AGES.work - 1)).toBe(1);
    expect(yearsToWork(AGES.work)).toBe(0);
  });
});

describe('nurserie', () => {
  it('pleine, elle n’a plus d’enfant ni ne mange, et repart quand un grand part travailler', () => {
    const world = colony({ kidAge: AGES.work - 1 });
    const nursery = [...world.entities.values()].find((entity): entity is Nursery => entity.kind === 'nursery')!;
    const [eldest] = kids(world);

    // Trois cadets de plus : la nurserie est pleine.
    for (let i = 1; i < NURSERY_CARE.capacity; i += 1) {
      const id = 10_000 + i;

      world.mobiles.set(id, { ...eldest!, id, age: AGES.nursery });
    }
    nursery.store.add('food', 12);
    nursery.nextBirthTick = world.tickCount + 1;
    world.push({ type: 'pauseBuilding', id: nursery.id, paused: true });
    world.tick();
    world.push({ type: 'pauseBuilding', id: nursery.id, paused: false });
    run(world, 5);

    expect(nursery.born).toBe(1);
    expect(nursery.store.count('food')).toBe(12);
    expect(world.nurseryKids(nursery)).toHaveLength(NURSERY_CARE.capacity);

    // L'aîné a 14 ans : il part travailler, sa place se libère, un bébé naît.
    toDawn(world);
    expect(world.mobiles.has(eldest!.id)).toBe(false);
    expect(nursery.born).toBe(2);
    expect(world.nurseryKids(nursery)).toHaveLength(NURSERY_CARE.capacity);
  });

  it('dit le temps avant le prochain ouvrier : l’aube où le plus âgé aura 14 ans', () => {
    const world = colony({ kidAge: AGES.work - 2 });
    const nursery = [...world.entities.values()].find((entity): entity is Nursery => entity.kind === 'nursery')!;
    const clock = world.clock()!;

    expect(world.nextAdultTicks(nursery)).toBe(ticksToDawn(clock) + CYCLE_TICKS);

    const empty = colony({});

    expect(empty.nextAdultTicks([...empty.entities.values()].find((entity): entity is Nursery => entity.kind === 'nursery')!)).toBeNull();
  });
});

describe('ouvriers inactifs', () => {
  it('passe inactif l’ouvrier sans travail, dehors, et repart dès qu’un poste se libère', () => {
    const world = colony({ house: true });

    run(world, 200);
    expect(world.clock()?.phase).toBe('day');
    expect(world.idleWorkers()).toHaveLength(4);
    expect(world.census()).toMatchObject({ idle: 4, children: 0 });
    for (const worker of workers(world)) expect(world.occupation(worker)).toEqual({ kind: 'idle' });
  });

  it('retire de son poste l’ouvrier, qui rentre libre ; le lui rendre le remet au travail', () => {
    const world = colony({ house: true, drill: { ironOre: 40 } });
    const house = [...world.entities.values()].find((entity) => entity.kind === 'house')!;

    world.push({ type: 'setWorkers', id: house.id, count: 0 });
    run(world, 200);
    // Retirés de leur poste, ils sont rentrés : des ouvriers libres de la colonie, pas des oisifs dehors.
    expect(workers(world)).toHaveLength(0);
    expect(world.workforce()).toMatchObject({ assigned: 0, free: world.colonists });

    world.push({ type: 'setWorkers', id: house.id, count: 4 });
    run(world, 60);
    expect(workers(world)).toHaveLength(4);
    expect(workers(world).some((worker) => world.occupation(worker).kind === 'working')).toBe(true);
  });

  it('n’appelle pas inactif un porteur entre deux livraisons', () => {
    const world = colony({ house: true });

    world.tick();
    for (const worker of workers(world)) worker.inside = false;
    run(world, IDLE.graceTicks - 5);
    expect(world.idleWorkers()).toHaveLength(0);
  });

  it('ne compte pas inactif l’ouvrier qui dort chez lui', () => {
    const world = colony({ house: true });

    run(world, 200);
    expect(world.idleWorkers()).toHaveLength(4);
    for (const worker of workers(world)) {
      worker.inside = true;
    }
    world.cycleStartTick -= DAY_CYCLE.day;
    run(world, 2);
    expect(world.clock()?.phase).toBe('dusk');
    expect(world.idleWorkers()).toHaveLength(0);
    for (const worker of workers(world)) expect(world.occupation(worker)).toEqual({ kind: 'home' });
  });
});

describe('sauvegarde des âges', () => {
  it('sauvegarde et restaure l’âge de chacun', () => {
    const world = colony({ house: true, kidAge: 12 });

    world.player.age = 41;
    run(world, 10);

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error('sauvegarde illisible');
    expect(decoded.world.player.age).toBe(41);
    for (const mobile of world.mobiles.values()) {
      if ('age' in mobile) expect(decoded.world.mobiles.get(mobile.id)).toMatchObject({ age: mobile.age });
    }
    expect(kids(decoded.world).map((kid) => kid.age)).toEqual([12]);
    expect(decoded.world.colonists).toBe(world.colonists);
  });

  it('charge une sauvegarde d’avant les âges : tout le monde est adulte, l’enfant est devenu ouvrier', () => {
    const world = colony({ house: true, kidAge: 11 });
    const [kid] = kids(world);
    const file = JSON.parse(encodeSave(world, 0)) as { version: number; state: Record<string, unknown> };

    // Une version 6 : ni âge, ni `grown`.
    file.version = 6;
    delete (file.state['player'] as Record<string, unknown>)['age'];
    delete file.state['colonists'];
    for (const mobile of file.state['mobiles'] as Record<string, unknown>[]) {
      delete mobile['age'];
      delete mobile['grown'];
    }
    expect(SAVE_VERSION).toBe(8);

    const decoded = decodeSave(JSON.stringify(file));

    if (!decoded.ok) throw new Error(`ancienne sauvegarde refusée : ${decoded.reason}`);

    const loaded = decoded.world;

    expect(loaded.player.age).toBe(adultAge(loaded.seed, ADAM_SALT));
    expect(kids(loaded)).toHaveLength(0);
    expect(loaded.mobiles.has(kid!.id)).toBe(false);
    // Les ouvriers de la maison, gardés, et l'enfant devenu grand.
    expect(loaded.colonists).toBe(BUILDINGS.builderHouse.workers + 1);
    expect(workers(loaded)).toHaveLength(BUILDINGS.builderHouse.workers);
    for (const mobile of loaded.mobiles.values()) {
      if (!('age' in mobile)) continue;
      expect(mobile.age).toBeGreaterThanOrEqual(AGES.adultMin);
      expect(mobile.age).toBeLessThanOrEqual(AGES.adultMax);
    }
    loaded.tick();
  });

  it('refuse un âge négatif', () => {
    const world = colony({});
    const file = JSON.parse(encodeSave(world, 0)) as { state: { player: { age: number } } };

    file.state.player.age = -3;
    expect(decodeSave(JSON.stringify(file))).toEqual({ ok: false, reason: 'corrupt' });
  });
});
