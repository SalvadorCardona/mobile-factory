import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ENEMIES } from '../data/enemies.ts';
import { ITEM_IDS, type ItemId } from '../data/items.ts';
import { DAY_CYCLE } from '../data/dayNight.ts';
import { JOB_PRIORITY, WANDER } from '../data/workers.ts';
import { doorOf } from './jobs.ts';
import { decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { EntityId, Site, TownHall, Worker } from './types.ts';
import { clearLine } from './workers.ts';
import { World } from './world.ts';

type Stock = Partial<Record<ItemId, number>>;

interface Layout {
  /** Stock de départ de la mairie, déjà finie. */
  hall: Stock;
  houses: number;
  /** Chantiers à ouvrir, dans l'ordre. */
  sites?: BuildingId[];
  /** Foreuses finies, coffre déjà garni. */
  drills?: Stock[];
}

/** Les emplacements libres d'une colonie de test, en tuiles relatives à la mairie : une grille de 2 × 2 espacés. */
const SLOTS: [number, number][] = [];

for (let row = 0; row < 5; row += 1) {
  for (let col = 0; col < 8; col += 1) {
    const dx = -12 + col * 3;
    const dy = 5 + row * 3;

    SLOTS.push([dx, dy]);
  }
}

/** Une seed dont la mairie a une grande plaine sans eau au sud : les porteurs y vont partout en ligne droite. */
function landSeed(): { world: World; hx: number; hy: number } {
  for (let seed = 1; seed < 400; seed += 1) {
    const world = new World(seed);
    const hall = world.entities.get(world.townHallId)!;
    let dry = true;

    for (let ty = hall.ty - 1; ty < hall.ty + 22 && dry; ty += 1) {
      for (let tx = hall.tx - 14; tx < hall.tx + 14 && dry; tx += 1) {
        if (!isWalkable(terrainAt(world.seed, tx, ty))) dry = false;
      }
    }
    if (dry) return { world, hx: hall.tx, hy: hall.ty };
  }
  throw new Error('aucune seed testable — la génération de terrain a changé');
}

/**
 * Une colonie posée d'un coup : on retouche la sauvegarde d'un monde neuf,
 * puis on la recharge — les maisons se peuplent au chargement.
 */
function colony(layout: Layout): World {
  const { world, hx, hy } = landSeed();
  const state = world.snapshot();
  const slots = [...SLOTS];
  const entities: SavedEntity[] = [
    { kind: 'townHall', id: world.townHallId, proto: 'townHall', tx: hx, ty: hy, width: 3, height: 3, store: layout.hall, hp: BUILDINGS.townHall.hp, level: 1, paused: false, staff: BUILDINGS.townHall.workers },
  ];
  let nextId = state.nextId;

  const place = (proto: BuildingId): { id: EntityId; proto: BuildingId; tx: number; ty: number; width: number; height: number } => {
    const [dx, dy] = slots.shift()!;
    const { width, height } = BUILDINGS[proto];

    return { id: nextId++, proto, tx: hx + dx, ty: hy + dy, width, height };
  };

  for (let i = 0; i < layout.houses; i += 1) {
    entities.push({ ...place('builderHouse'), kind: 'house', store: {}, hp: BUILDINGS.builderHouse.hp, level: 1, paused: false, staff: BUILDINGS.builderHouse.workers });
  }
  for (const proto of layout.sites ?? []) entities.push({ ...place(proto), kind: 'site', delivered: {} });
  for (const store of layout.drills ?? []) {
    entities.push({ ...place('drill'), kind: 'drill', store, hp: BUILDINGS.drill.hp, level: 1, paused: false, staff: BUILDINGS.drill.workers, output: 'ironOre', blocked: true });
  }

  // Adam à l'écart, immobile : ce sont les porteurs qu'on regarde.
  state.player = { ...state.player, x: (hx - 20) * TILE_SIZE, y: (hy - 20) * TILE_SIZE };
  state.entities = entities;
  state.nextId = nextId;
  state.mobiles = [];
  return World.restore(state);
}

function hallOf(world: World): TownHall {
  const hall = world.entities.get(world.townHallId);

  if (hall?.kind !== 'townHall') throw new Error('pas de mairie');
  return hall;
}

function sites(world: World): Site[] {
  return [...world.entities.values()].filter((entity): entity is Site => entity.kind === 'site');
}

function workers(world: World): Worker[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Worker => mobile.kind === 'worker');
}

/** Où se trouve chaque objet : mairie, foreuses, mains des porteurs, chantiers. Rien d'autre n'en crée ni n'en détruit ici. */
function census(world: World, built: ReadonlySet<EntityId> = new Set()): Record<ItemId, number> {
  const total = Object.fromEntries(ITEM_IDS.map((item) => [item, 0])) as Record<ItemId, number>;

  for (const entity of world.entities.values()) {
    if (entity.kind === 'site') {
      for (const [item, amount] of Object.entries(entity.delivered) as [ItemId, number][]) total[item] += amount;
    } else if (built.has(entity.id)) {
      // Un chantier achevé par son dernier objet : son coût est dans les murs.
      for (const [item, amount] of Object.entries(BUILDINGS[entity.proto].cost) as [ItemId, number][]) total[item] += amount;
    } else {
      for (const [item, amount] of entity.store.entries()) total[item] += amount;
    }
  }
  for (const worker of workers(world)) {
    if (worker.job?.carried) total[worker.job.item] += worker.job.amount;
  }
  return total;
}

/** Les promesses ne dépassent jamais ce qui existe, ni ce qui est attendu. */
function expectCoveredPromises(world: World): void {
  const hall = hallOf(world);
  const promisedOut = new Map<ItemId, number>();

  for (const worker of workers(world)) {
    const job = worker.job;

    if (job && !job.carried && job.from === hall.id) promisedOut.set(job.item, (promisedOut.get(job.item) ?? 0) + job.amount);
  }

  for (const item of ITEM_IDS) {
    // Ce que la mairie a promis, c'est exactement ce que les porteurs en route vont chercher.
    expect(hall.store.available(item), `mairie : ${item} promis plus qu'en stock`).toBeGreaterThanOrEqual(0);
    expect(hall.store.count(item) - hall.store.available(item)).toBe(promisedOut.get(item) ?? 0);
  }

  for (const site of sites(world)) {
    for (const [item, needed] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
      const delivered = site.delivered[item] ?? 0;

      expect(delivered, `${site.proto} : ${item} livré en trop`).toBeLessThanOrEqual(needed);
      expect(delivered + world.siteIncoming(site.id, item), `${site.proto} : ${item} promis deux fois`).toBeLessThanOrEqual(needed);
    }
  }
}

/** À portée de flânerie de sa porte. */
function nearHome(world: World, worker: Worker): boolean {
  const door = doorOf(world.entities.get(worker.homeId)!);

  return Math.hypot(worker.x - door.x, worker.y - door.y) <= WANDER.radius * TILE_SIZE + 1;
}

function run(world: World, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i += 1) {
    world.tick();
    each?.();
  }
}

describe('porteurs', () => {
  it('la maison des constructeurs loge ses ouvriers ; sans rien à porter, ils flânent devant chez eux', () => {
    const world = colony({ hall: {}, houses: 1 });

    expect(workers(world)).toHaveLength(BUILDINGS.builderHouse.workers);

    let walked = 0;

    run(world, 600, () => {
      for (const worker of workers(world)) {
        expect(worker.job).toBeNull();
        if (worker.x !== worker.prevX || worker.y !== worker.prevY) walked += 1;
      }
    });
    // Visibles, à deux pas de leur porte, et ils bougent.
    expect(workers(world).every((worker) => !worker.inside && nearHome(world, worker))).toBe(true);
    expect(walked).toBeGreaterThan(0);
  });

  it('au crépuscule, les ouvriers sans travail rentrent dormir', () => {
    const world = colony({ hall: {}, houses: 1 });

    run(world, 200);
    expect(workers(world).some((worker) => !worker.inside)).toBe(true);

    // Le cycle démarre juste avant le crépuscule.
    world.cycleStartTick = world.tickCount - DAY_CYCLE.day + 1;
    run(world, 250);
    expect(workers(world).every((worker) => worker.inside)).toBe(true);
  });

  it('un chantier se remplit seul si la mairie a le stock — et le dernier objet porté l’achève', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 1, sites: ['farm'] });
    const [site] = sites(world);
    const completed: EntityId[] = [];

    world.events.on('buildingCompleted', ({ id }) => completed.push(id));

    run(world, 60);
    // Ils sont sortis porter.
    expect(workers(world).some((worker) => !worker.inside && worker.job !== null)).toBe(true);

    run(world, 3000);

    const current = world.entities.get(site!.id);

    expect(current?.kind).toBe('farm');
    expect(completed).toEqual([site!.id]);
    expect(hallOf(world).store.count('wood')).toBe(40 - BUILDINGS.farm.cost.wood);
    expect(hallOf(world).store.count('stone')).toBe(40 - BUILDINGS.farm.cost.stone);
    // Le travail fini, tout le monde revient flâner devant chez soi.
    run(world, 600);
    expect(workers(world).every((worker) => worker.job === null && nearHome(world, worker))).toBe(true);
  });

  it('sous charge — 10 ouvriers, 5 chantiers, un stock trop court : aucune double réservation, rien de perdu ni de dupliqué', () => {
    const world = colony({
      hall: { wood: 30, stone: 20, ironOre: 4 },
      houses: 3,
      sites: ['farm', 'nursery', 'watchtower', 'builderHouse', 'drill'],
    });

    // Trois maisons en logent douze : on en garde dix.
    for (const worker of workers(world).slice(10)) world.mobiles.delete(worker.id);
    expect(workers(world)).toHaveLength(10);

    const built = new Set<EntityId>();

    world.events.on('buildingCompleted', ({ id }) => built.add(id));

    // Les matériaux en jeu : une ferme achevée récolte, sa nourriture n'entre pas dans le compte.
    const materials = (): Stock => {
      const { wood, stone, ironOre } = census(world, built);

      return { wood, stone, ironOre };
    };
    const before = materials();
    let busiest = 0;

    run(world, 4000, () => {
      expect(materials()).toEqual(before);
      expectCoveredPromises(world);
      busiest = Math.max(busiest, workers(world).filter((worker) => worker.job !== null).length);
    });

    // La charge était réelle : les dix étaient dehors en même temps.
    expect(busiest).toBe(10);

    // Tout le stock utile est parti sur les chantiers, et pas un objet de plus.
    const hall = hallOf(world);
    const delivered = (item: ItemId): number =>
      [...world.entities.values()].reduce(
        (sum, entity) =>
          sum +
          (entity.kind === 'site'
            ? (entity.delivered[item] ?? 0)
            : built.has(entity.id)
              ? ((BUILDINGS[entity.proto].cost as Partial<Record<ItemId, number>>)[item] ?? 0)
              : 0),
        0,
      );

    expect(hall.store.count('wood')).toBe(0);
    expect(delivered('wood')).toBe(30);
    expect(hall.store.count('stone')).toBe(0);
    expect(delivered('stone')).toBe(20);
    expect(delivered('ironOre')).toBe(4);
  });

  it('vide une foreuse pleine dans la mairie, et la foreuse repart', () => {
    const world = colony({ hall: {}, houses: 1, drills: [{ ironOre: BUILDINGS.drill.storage }] });
    const drill = [...world.entities.values()].find((entity) => entity.kind === 'drill')!;

    run(world, 400);

    expect(drill.kind === 'drill' && drill.blocked).toBe(false);
    expect(hallOf(world).store.count('ironOre')).toBeGreaterThan(0);
  });

  it('un chantier en attente passe avant une foreuse à vider', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 1, sites: ['farm'], drills: [{ ironOre: 20 }] });

    run(world, 2);

    const first = workers(world).find((worker) => worker.job !== null);

    expect(first?.job?.priority).toBe(JOB_PRIORITY.site);
  });

  it('ce qu’Adam a livré entre-temps repart à la mairie : la charge ne se perd pas', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 1, sites: ['farm'] });
    const site = sites(world)[0]!;
    const cost = BUILDINGS.farm.cost;

    const carrying = (): boolean => workers(world).some((worker) => worker.job?.carried === true && worker.job.to === site.id);

    // Un porteur a ramassé sa charge…
    for (let i = 0; i < 2000 && !carrying(); i += 1) world.tick();
    expect(carrying()).toBe(true);

    // … et Adam termine la livraison avant lui.
    site.delivered = { ...cost };

    const before = census(world);

    run(world, 3000);

    // Ce qu'Adam a posé est apparu de nulle part pour ce monde de test : le reste est à l'identique.
    expect(census(world)).toEqual(before);
    expect(site.delivered).toEqual(cost);
    expect(workers(world).every((worker) => worker.job === null)).toBe(true);
  });

  it('pendant une vague, tout le monde rentre ; la vague passée, le travail reprend', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 1, sites: ['farm'] });
    const hall = hallOf(world);

    run(world, 80);
    expect(workers(world).some((worker) => !worker.inside)).toBe(true);

    // Un mutant loin au nord, qui mettra longtemps à arriver.
    const x = (hall.tx + 1.5) * TILE_SIZE;
    const y = (hall.ty - 60) * TILE_SIZE;

    world.mobiles.set(9999, {
      kind: 'mutant',
      id: 9999,
      proto: 'mutant',
      x,
      y,
      prevX: x,
      prevY: y,
      facing: 'down',
      moving: false,
      hp: ENEMIES.mutant.hp,
      attackCooldown: 0,
      emerge: 0,
    });

    const before = census(world);

    run(world, 400);
    expect(workers(world).every((worker) => worker.inside)).toBe(true);
    // À l'abri avec leur charge : rien ne s'est perdu.
    expect(census(world)).toEqual(before);

    world.mobiles.delete(9999);
    run(world, 3000);
    // Le travail a repris jusqu'au bout : le dernier objet porté a achevé la ferme.
    expect(sites(world)).toHaveLength(0);
  });

  it('une sauvegarde en plein transport se recharge avec ses réservations', () => {
    const world = colony({ hall: { wood: 30, stone: 20 }, houses: 2, sites: ['farm', 'nursery', 'watchtower'] });

    run(world, 150);
    expect(workers(world).some((worker) => worker.job !== null)).toBe(true);

    const reloaded = decodeSave(encodeSave(world, 1));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);

    const copy = reloaded.world;

    expectCoveredPromises(copy);
    expect(census(copy)).toEqual(census(world));

    run(world, 2000);
    run(copy, 2000, () => expectCoveredPromises(copy));
    expect(copy.snapshot()).toEqual(world.snapshot());
  });

  it('compte les ouvriers de la ville : total, par bâtiment, porteurs occupés ou en attente', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 2, sites: ['farm'] });
    const houses = BUILDINGS.builderHouse.workers * 2;

    // Un chantier n'emploie personne.
    expect(world.workforce()).toEqual({
      total: houses,
      byBuilding: [{ proto: 'builderHouse', count: houses }],
      porters: { busy: 0, idle: houses },
      assigned: houses,
      free: 0,
      missing: 0,
    });

    run(world, 60);

    const { busy, idle } = world.workforce().porters;

    expect(busy).toBeGreaterThan(0);
    expect(busy + idle).toBe(houses);

    run(world, 3000);

    // La ferme finie embauche : le compte suit, et reste celui de la population.
    const after = world.workforce();

    expect(after.total).toBe(houses + BUILDINGS.farm.workers);
    expect(after.total).toBe(world.population().workers);
    expect(after.byBuilding).toEqual([
      { proto: 'builderHouse', count: houses },
      { proto: 'farm', count: BUILDINGS.farm.workers },
    ]);

    // Une maison tombée : ses ouvriers quittent la ville.
    const house = [...world.entities.values()].find((entity) => entity.kind === 'house')!;

    world.entities.delete(house.id);
    expect(world.workforce().total).toBe(BUILDINGS.builderHouse.workers + BUILDINGS.farm.workers);
    expect(world.workforce().porters.busy + world.workforce().porters.idle).toBe(BUILDINGS.builderHouse.workers);
  });

  it('une maison réglée à 2 ouvriers : deux porteurs travaillent, les autres flânent', () => {
    const world = colony({ hall: { wood: 40, stone: 40 }, houses: 1, sites: ['farm', 'nursery'] });
    const house = [...world.entities.values()].find((entity) => entity.kind === 'house')!;
    const busy = new Set<number>();

    world.push({ type: 'setWorkers', id: house.id, count: 2 });
    run(world, 1500, () => {
      for (const worker of workers(world)) if (worker.job) busy.add(worker.id);
    });

    const ids = workers(world)
      .map((worker) => worker.id)
      .sort((a, b) => a - b);

    expect([...busy].sort((a, b) => a - b)).toEqual(ids.slice(0, 2));
    expect(world.workforce().free).toBe(BUILDINGS.builderHouse.workers - 2);
  });

  it('ne trace jamais une ligne droite à travers l’eau', () => {
    let water: { tx: number; ty: number } | null = null;

    for (let ty = -60; ty < 60 && !water; ty += 1) {
      for (let tx = -60; tx < 60 && !water; tx += 1) {
        if (!isWalkable(terrainAt(1, tx, ty))) water = { tx, ty };
      }
    }
    if (!water) throw new Error('pas d’eau autour de l’origine');

    const x = (water.tx + 0.5) * TILE_SIZE;
    const y = (water.ty + 0.5) * TILE_SIZE;

    expect(clearLine(1, x - 5 * TILE_SIZE, y, x + 5 * TILE_SIZE, y)).toBe(false);
    expect(clearLine(1, x, y - 5 * TILE_SIZE, x, y + 5 * TILE_SIZE)).toBe(false);
  });
});
