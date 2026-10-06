import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { WORK_PRIORITY } from '../data/workers.ts';
import { decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { allocateStaff, type StaffDemand, type StaffPost } from './staffing.ts';
import type { LumberCamp, Lumberjack } from './types.ts';
import { World } from './world.ts';

const HOLD = WORK_PRIORITY.holdTicks;

function filled(posts: Map<number, StaffPost>): Record<number, number> {
  return Object.fromEntries([...posts].map(([id, post]) => [id, post.filled]));
}

describe('priorité de travail : la répartition', () => {
  it('les postes Haute se pourvoient d’abord, puis Moyenne, puis Basse', () => {
    const posts = allocateStaff(
      [
        { id: 1, wanted: 2, priority: 'low' },
        { id: 2, wanted: 2, priority: 'normal' },
        { id: 3, wanted: 2, priority: 'high' },
      ],
      3,
    );

    expect(filled(posts)).toEqual({ 1: 0, 2: 1, 3: 2 });
  });

  it('des ouvriers qui se libèrent vont d’abord au poste Haute, même plus récent', () => {
    const demands: StaffDemand[] = [
      { id: 1, wanted: 2, priority: 'low' },
      { id: 2, wanted: 0, priority: 'normal' },
      { id: 3, wanted: 2, priority: 'high' },
    ];
    const before = new Map<number, StaffPost>([
      [1, { filled: 0, since: null }],
      [2, { filled: 2, since: 0 }],
      [3, { filled: 0, since: null }],
    ]);

    expect(filled(allocateStaff(demands, 2, before, 10))).toEqual({ 1: 0, 2: 0, 3: 2 });
  });

  it('un poste Haute vide reprend l’ouvrier d’un bâtiment plus bas, le Basse d’abord', () => {
    const demands: StaffDemand[] = [
      { id: 1, wanted: 2, priority: 'low' },
      { id: 2, wanted: 2, priority: 'normal' },
      { id: 3, wanted: 2, priority: 'high' },
    ];
    const before = new Map<number, StaffPost>([
      [1, { filled: 2, since: 0 }],
      [2, { filled: 2, since: 0 }],
    ]);
    const posts = allocateStaff(demands, 4, before, HOLD);

    expect(filled(posts)).toEqual({ 1: 0, 2: 2, 3: 2 });
    expect(posts.get(3)?.since).toBe(HOLD);
  });

  it('à priorité égale, personne ne reprend rien', () => {
    const demands: StaffDemand[] = [
      { id: 1, wanted: 2 },
      { id: 2, wanted: 2 },
    ];
    const before = new Map<number, StaffPost>([[2, { filled: 2, since: 0 }]]);

    expect(filled(allocateStaff(demands, 2, before, HOLD * 10))).toEqual({ 1: 0, 2: 2 });
  });

  it('un ouvrier qui vient de changer de poste y reste le temps du délai : pas d’allers-retours', () => {
    const demands: StaffDemand[] = [
      { id: 1, wanted: 2, priority: 'low' },
      { id: 2, wanted: 2, priority: 'high' },
    ];
    let posts = allocateStaff(demands, 2, new Map([[1, { filled: 2, since: 0 }]]), HOLD);

    expect(filled(posts)).toEqual({ 1: 0, 2: 2 });

    // Le joueur change d'avis aussitôt : le premier repasse devant, mais doit attendre.
    demands[0]!.priority = 'high';
    demands[1]!.priority = 'low';
    posts = allocateStaff(demands, 2, posts, HOLD + 1);
    expect(filled(posts)).toEqual({ 1: 0, 2: 2 });
    posts = allocateStaff(demands, 2, posts, HOLD * 2 - 1);
    expect(filled(posts)).toEqual({ 1: 0, 2: 2 });
    posts = allocateStaff(demands, 2, posts, HOLD * 2);
    expect(filled(posts)).toEqual({ 1: 2, 2: 0 });
  });

  it('un bâtiment en pause ne reçoit personne, même Haute, et cède ses ouvriers le premier', () => {
    const demands: StaffDemand[] = [
      { id: 1, wanted: 2, priority: 'high', paused: true },
      { id: 2, wanted: 2, priority: 'low' },
      { id: 3, wanted: 2, priority: 'low' },
    ];
    const free = allocateStaff(demands, 6, new Map([[1, { filled: 1, since: 0 }]]), HOLD);

    // Des ouvriers libres à revendre : il garde le sien, sans en prendre un second.
    expect(filled(free)).toEqual({ 1: 1, 2: 2, 3: 2 });

    // À court : un Basse vide le lui reprend.
    const short = allocateStaff(
      demands,
      3,
      new Map([
        [1, { filled: 1, since: 0 }],
        [2, { filled: 2, since: 0 }],
        [3, { filled: 0, since: null }],
      ]),
      HOLD,
    );

    expect(filled(short)).toEqual({ 1: 0, 2: 2, 3: 1 });
  });

  it('jamais plus que l’effectif voulu, quelle que soit la priorité', () => {
    const posts = allocateStaff(
      [
        { id: 1, wanted: 1, priority: 'high' },
        { id: 2, wanted: 2, priority: 'low' },
      ],
      10,
      new Map([[2, { filled: 2, since: 0 }]]),
      HOLD,
    );

    expect(filled(posts)).toEqual({ 1: 1, 2: 2 });
  });

  it('ne dépend que de ses entrées', () => {
    const demands: StaffDemand[] = [
      { id: 4, wanted: 3, priority: 'normal' },
      { id: 2, wanted: 2, priority: 'high' },
      { id: 9, wanted: 4, priority: 'low', paused: true },
    ];
    const before = new Map<number, StaffPost>([
      [4, { filled: 3, since: 5 }],
      [9, { filled: 2, since: 0 }],
    ]);

    expect(allocateStaff(demands, 5, before, HOLD)).toEqual(allocateStaff([...demands].reverse(), 5, before, HOLD));
  });
});

/**
 * Une colonie de `colonists` ouvriers, la mairie finie et deux cabanes de
 * bûcheron au bord du bois — la première plus ancienne —, sans personne sur
 * la carte : ils attendent, libres, devant la mairie, et vont aux postes.
 */
function twoCamps(colonists: number, first: Partial<SavedEntity> = {}, second: Partial<SavedEntity> = {}): World {
  const world = new World(1);
  const state = world.snapshot();
  const hall = world.entities.get(world.townHallId)!;
  let nextId = state.nextId;
  const base = (proto: BuildingId, dx: number) => ({
    id: nextId++,
    proto,
    tx: hall.tx + dx,
    ty: hall.ty + 8,
    width: BUILDINGS[proto].width,
    height: BUILDINGS[proto].height,
    hp: BUILDINGS[proto].hp,
    level: 1,
    paused: false,
    staff: BUILDINGS[proto].workers,
  });

  state.entities = [
    { ...base('townHall', 0), id: world.townHallId, tx: hall.tx, ty: hall.ty, kind: 'townHall', store: {} },
    { ...base('lumberCamp', -4), kind: 'lumberCamp', store: {}, ...first } as SavedEntity,
    { ...base('lumberCamp', 4), kind: 'lumberCamp', store: {}, ...second } as SavedEntity,
  ];
  state.nextId = nextId;
  state.mobiles = [];
  state.colonists = colonists;
  // Une partie en cours où personne n'avait encore de poste.
  state.staffPosts = [];
  return World.restore(state);
}

function camps(world: World): [LumberCamp, LumberCamp] {
  const found = [...world.entities.values()].filter((entity): entity is LumberCamp => entity.kind === 'lumberCamp');

  return [found[0]!, found[1]!];
}

function crewOf(world: World, camp: LumberCamp): Lumberjack[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Lumberjack => mobile.kind === 'lumberjack' && mobile.homeId === camp.id);
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

describe('priorité de travail : dans le monde', () => {
  it('deux ouvriers libres, une cabane Haute et une Basse : les deux vont à la Haute', () => {
    const world = twoCamps(2, { priority: 'low' }, { priority: 'high' });
    const [low, high] = camps(world);

    run(world, 5);
    expect(world.staffing(high)?.filled).toBe(2);
    expect(world.staffing(low)?.filled).toBe(0);
    expect(crewOf(world, high)).toHaveLength(2);
    expect(crewOf(world, low)).toHaveLength(0);
  });

  it('passée de Basse à Haute sans ouvrier libre, une cabane reprend ceux d’une Basse, après leur geste', () => {
    const world = twoCamps(2, { priority: 'low' }, { priority: 'low' });
    const [first, second] = camps(world);
    let stored = 0;

    world.events.on('woodStored', ({ id, amount }) => {
      if (id === first.id) stored += amount;
    });
    run(world, HOLD);
    expect(crewOf(world, first)).toHaveLength(2);

    // Jusqu'à ce qu'un bûcheron de la première ait du bois dans les bras.
    for (let i = 0; i < 4000 && !crewOf(world, first).some((lumberjack) => lumberjack.load > 0); i += 1) world.tick();

    const loaded = crewOf(world, first).find((lumberjack) => lumberjack.load > 0)!;
    const load = loaded.load;

    expect(load).toBeGreaterThan(0);
    stored = 0;
    world.push({ type: 'setPriority', id: second.id, priority: 'high' });
    world.tick();

    // Le poste a changé de cabane, mais il finit son geste : son bois rentre à la première.
    expect(world.staffing(second)?.filled).toBe(2);
    expect(world.staffing(first)?.filled).toBe(0);
    expect(world.mobiles.get(loaded.id)).toMatchObject({ kind: 'lumberjack', homeId: first.id });

    run(world, 1500);
    expect(stored).toBeGreaterThanOrEqual(load);
    expect(crewOf(world, second)).toHaveLength(2);
    expect(crewOf(world, first)).toHaveLength(0);
  });

  it('une cabane en pause ne reçoit personne, même Haute ; personne ne fait d’allers-retours', () => {
    const world = twoCamps(2, { priority: 'low' }, { priority: 'high', paused: true, staff: 2 });
    const [low, paused] = camps(world);

    // Personne ne change de cabane, tick après tick.
    let changes = 0;
    let last = '';

    for (let i = 0; i < HOLD * 4; i += 1) {
      world.tick();

      const now = `${crewOf(world, low).length}:${crewOf(world, paused).length}:${world.staffing(low)?.filled}`;

      if (i > 5 && now !== last) changes += 1;
      last = now;
    }
    expect(changes).toBe(0);
    expect(world.staffing(paused)?.filled).toBe(0);
    expect(world.staffing(low)?.filled).toBe(2);
    expect(crewOf(world, low)).toHaveLength(2);

    // Reprise : Haute, elle reprend les ouvriers de la Basse.
    world.push({ type: 'pauseBuilding', id: paused.id, paused: false });
    run(world, 1500);
    expect(crewOf(world, paused)).toHaveLength(2);
    expect(crewOf(world, low)).toHaveLength(0);
  });

  it('même partie, mêmes commandes : même répartition', () => {
    const play = (): string => {
      const world = twoCamps(3, {}, {});
      const [, second] = camps(world);

      run(world, HOLD);
      world.push({ type: 'setPriority', id: second.id, priority: 'high' });
      run(world, 600);
      world.push({ type: 'setPriority', id: second.id, priority: 'low' });
      run(world, 600);
      return encodeSave(world, 1);
    };

    expect(play()).toBe(play());
  });
});

describe('priorité de travail : sauvegarde', () => {
  it('garde la priorité de chaque bâtiment et la répartition en cours', () => {
    const world = twoCamps(2, {}, {});
    const [first, second] = camps(world);

    run(world, HOLD);
    world.push({ type: 'setPriority', id: second.id, priority: 'high' });
    world.push({ type: 'setPriority', id: first.id, priority: 'low' });
    run(world, 3);

    const reloaded = decodeSave(encodeSave(world, 1));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);

    const [again1, again2] = camps(reloaded.world);

    expect(again1.priority).toBe('low');
    expect(again2.priority).toBe('high');
    expect(reloaded.world.staffing(again2)?.filled).toBe(2);
    expect(reloaded.world.snapshot().staffPosts).toEqual(world.snapshot().staffPosts);
  });

  it('une sauvegarde d’avant les priorités se relit : tout en Moyenne', () => {
    const world = twoCamps(2, { priority: 'high' }, {});
    const file = JSON.parse(encodeSave(world, 1)) as { state: { entities: Record<string, unknown>[]; staffPosts?: unknown } };

    for (const entity of file.state.entities) delete entity['priority'];
    delete file.state.staffPosts;

    const reloaded = decodeSave(JSON.stringify(file));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);
    for (const entity of reloaded.world.entities.values()) {
      if (entity.kind !== 'site') expect(entity.priority).toBe('normal');
    }
    // La répartition se refait d'un coup : la plus ancienne d'abord.
    expect(reloaded.world.staffing(camps(reloaded.world)[0])?.filled).toBe(2);
  });

  it('une priorité illisible vaut Moyenne', () => {
    const world = twoCamps(2);
    const file = JSON.parse(encodeSave(world, 1)) as { state: { entities: Record<string, unknown>[] } };

    for (const entity of file.state.entities) entity['priority'] = 'urgent';

    const reloaded = decodeSave(JSON.stringify(file));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);
    expect(camps(reloaded.world)[0].priority).toBe('normal');
  });
});

describe('priorité de travail : la commande', () => {
  it('sans effet sur un bâtiment qui n’emploie personne', () => {
    const world = twoCamps(2);

    world.push({ type: 'setPriority', id: world.townHallId, priority: 'high' });
    world.tick();

    const hall = world.entities.get(world.townHallId)!;

    expect(hall.kind !== 'site' && hall.priority).toBe('normal');
  });
});
