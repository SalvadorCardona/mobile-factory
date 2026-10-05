import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { CLINIC } from '../data/clinic.ts';
import type { ItemId } from '../data/items.ts';
import { EX_MUTANT } from '../data/workers.ts';
import { doorOf } from './jobs.ts';
import { freshNeeds } from './needs.ts';
import { decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Mobile, Patient, Worker } from './types.ts';
import { World } from './world.ts';

/** Une seed dont la mairie a une plaine sans eau au sud : la clinique s'y pose, on y marche en ligne droite. */
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

interface Setup {
  /** Une clinique finie au sud de la mairie ? */
  clinic: boolean;
  /** Les mobiles de départ, posés une fois les ids connus. */
  mobiles?: (ids: { clinicId: number; hallId: number; siteId: number }) => Mobile[];
  /** Stock de départ de la mairie. */
  hall?: Partial<Record<ItemId, number>>;
  /** État du PRNG : c'est lui qui décide qui tombe assommé. */
  rng?: number;
  /** Ouvrir le chantier d'une nurserie, à livrer depuis la mairie. */
  site?: boolean;
}

/** Une colonie posée d'un coup : on retouche la sauvegarde d'un monde neuf, puis on la recharge. */
function colony(setup: Setup): { world: World; clinicId: number; siteId: number; hx: number; hy: number } {
  const { world, hx, hy } = landSeed();
  const state = world.snapshot();
  const clinicId = state.nextId;
  const siteId = state.nextId + 1;
  const entities: SavedEntity[] = [
    { kind: 'townHall', id: world.townHallId, proto: 'townHall', tx: hx, ty: hy, width: 3, height: 3, store: setup.hall ?? {}, hp: BUILDINGS.townHall.hp, level: 1, paused: false, staff: BUILDINGS.townHall.workers },
  ];

  if (setup.clinic) {
    entities.push({ kind: 'clinic', id: clinicId, proto: 'clinic', tx: hx + 4, ty: hy + 6, width: 2, height: 2, store: {}, hp: BUILDINGS.clinic.hp, level: 1, paused: false, staff: BUILDINGS.clinic.workers });
  }
  if (setup.site) {
    entities.push({ kind: 'site', id: siteId, proto: 'nursery', tx: hx - 4, ty: hy + 6, width: 2, height: 2, delivered: {}, work: 0 });
  }

  state.entities = entities;
  state.nextId = siteId + 1;
  state.mobiles = setup.mobiles?.({ clinicId, hallId: world.townHallId, siteId }) ?? [];
  state.nextMobileId = 1000;
  state.player = { ...state.player, x: (hx + 1.5) * TILE_SIZE, y: (hy + 4.5) * TILE_SIZE };
  if (setup.rng !== undefined) state.rng = setup.rng;
  return { world: World.restore(state), clinicId, siteId, hx, hy };
}

/** Un mutant debout, à `dx` tuiles à droite d'Adam, à qui il ne reste qu'un point de vie. */
function weakMutant(world: World, dx: number): Mobile {
  const x = world.player.x + dx * TILE_SIZE;
  const y = world.player.y;

  return { kind: 'mutant', id: 1, proto: 'mutant', x, y, prevX: x, prevY: y, facing: 'down', moving: false, hp: 1, attackCooldown: 0, emerge: 0 };
}

function patient(x: number, y: number, clinicId: number, state: Patient['state'], ticks: number): Patient {
  return { kind: 'patient', id: 2, x, y, prevX: x, prevY: y, facing: 'down', moving: false, state, clinicId, ticks };
}

function exMutant(id: number, clinicId: number, x: number, y: number): Worker {
  return { kind: 'worker', id, x, y, prevX: x, prevY: y, facing: 'down', moving: false, homeId: clinicId, exMutant: true, grown: false, age: 30, logistician: false, builder: false, survivor: false, build: null, inside: true, job: null, searchTicks: 1, wanderX: x, wanderY: y, wanderTicks: 0, ...freshNeeds() };
}

function mobilesOf<K extends Mobile['kind']>(world: World, kind: K): Extract<Mobile, { kind: K }>[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Extract<Mobile, { kind: K }> => mobile.kind === kind);
}

/** Abat le mutant avec l'arc d'Adam : renvoie ce qu'il est devenu. */
function knockDown(setup: Setup): { stunned: boolean; loot: number; world: World } {
  const base = colony(setup);
  const probe = weakMutant(base.world, 2);
  const { world } = colony({ ...setup, mobiles: (ids) => [...(setup.mobiles?.(ids) ?? []), probe] });

  for (let i = 0; i < 80 && mobilesOf(world, 'mutant').length > 0; i += 1) world.tick();
  expect(mobilesOf(world, 'mutant'), 'le mutant aurait dû tomber').toHaveLength(0);

  return { stunned: mobilesOf(world, 'patient').length > 0, loot: mobilesOf(world, 'pickup').length, world };
}

describe('clinique', () => {
  it('assomme parfois un mutant vaincu, sans butin, tant qu’une clinique a une place', () => {
    const outcomes = Array.from({ length: 24 }, (_, rng) => knockDown({ clinic: true, rng: rng * 7919 + 1 }));
    const stunned = outcomes.filter((outcome) => outcome.stunned);

    expect(stunned.length).toBeGreaterThan(0);
    expect(stunned.length).toBeLessThan(outcomes.length);
    // Abattu, il lâche sa table (`ENEMIES.mutant.loot`, jamais vide) ; assommé, rien.
    for (const outcome of outcomes) {
      if (outcome.stunned) expect(outcome.loot).toBe(0);
      else expect(outcome.loot).toBeGreaterThan(0);
    }

    // Assommé, il n'est plus une menace : la vague est repoussée, et l'arc ne le vise plus.
    const { world } = stunned[0]!;

    world.tick();
    expect(world.player.target).toBeNull();
    expect(world.kills).toBe(1);
  });

  it('n’assomme personne sans clinique, ni quand elle est pleine', () => {
    for (let rng = 0; rng < 12; rng += 1) {
      expect(knockDown({ clinic: false, rng: rng * 7919 + 1 }).stunned).toBe(false);
      expect(
        knockDown({
          clinic: true,
          rng: rng * 7919 + 1,
          mobiles: ({ clinicId }) => Array.from({ length: CLINIC.beds }, (_, i) => exMutant(500 + i, clinicId, 0, 0)),
        }).stunned,
      ).toBe(false);
    }
  });

  it('ramène le mutant touché à la clinique, et l’en fait sortir ex-mutant', () => {
    const events: string[] = [];
    const base = colony({ clinic: true });
    const clinic = base.world.entities.get(base.clinicId)!;
    const door = doorOf(clinic);
    // Il tombe à trois tuiles de la porte ; Adam vient le toucher.
    const fallX = door.x + 3 * TILE_SIZE;
    const { world, clinicId } = colony({
      clinic: true,
      mobiles: ({ clinicId: id }) => [patient(fallX, door.y, id, 'stunned', CLINIC.stunTicks)],
    });

    world.events.on('patientFollowing', () => events.push('following'));
    world.events.on('patientAdmitted', () => events.push('admitted'));
    world.events.on('mutantHealed', () => events.push('healed'));

    world.player.x = world.player.prevX = fallX;
    world.player.y = world.player.prevY = door.y;
    world.tick();
    expect(events).toEqual(['following']);

    // Adam se poste devant la porte : le patient le rejoint en boitillant, et entre.
    world.player.x = world.player.prevX = door.x;
    world.player.y = world.player.prevY = door.y + TILE_SIZE;
    for (let i = 0; i < 80 && !events.includes('admitted'); i += 1) world.tick();
    expect(events).toEqual(['following', 'admitted']);
    expect(world.clinicBedsUsed(clinicId)).toBe(1);

    const before = world.population().workers;

    for (let i = 0; i < CLINIC.careTicks; i += 1) world.tick();
    expect(events).toEqual(['following', 'admitted', 'healed']);
    expect(mobilesOf(world, 'patient')).toHaveLength(0);

    const [healed] = mobilesOf(world, 'worker');

    expect(healed).toMatchObject({ exMutant: true, homeId: clinicId });
    expect(world.population().workers).toBe(before + 1);
    // Il garde sa place : la clinique loge ses ex-mutants.
    expect(world.clinicBedsUsed(clinicId)).toBe(1);
  });

  it('laisse s’évaporer un assommé qu’on ne vient pas chercher, avec son butin', () => {
    const { world } = colony({
      clinic: true,
      mobiles: ({ clinicId }) => [patient(0, 0, clinicId, 'stunned', CLINIC.stunTicks)],
    });
    let gone = false;

    world.events.on('mutantDied', () => (gone = true));
    for (let i = 0; i < CLINIC.stunTicks - 1; i += 1) world.tick();
    expect(gone).toBe(false);
    world.tick();
    expect(gone).toBe(true);
    expect(mobilesOf(world, 'patient')).toHaveLength(0);
    expect(mobilesOf(world, 'pickup').length).toBeGreaterThan(0);
  });

  it('fait porter l’ex-mutant plus lourd qu’un porteur', () => {
    const { world, siteId } = colony({
      clinic: true,
      site: true,
      hall: { wood: 20, stone: 10 },
      mobiles: ({ clinicId }) => [exMutant(500, clinicId, 0, 0)],
    });
    const worker = world.mobiles.get(500) as Worker;
    const clinic = [...world.entities.values()].find((entity) => entity.kind === 'clinic')!;
    const door = doorOf(clinic);

    worker.x = worker.prevX = door.x;
    worker.y = worker.prevY = door.y;
    world.tick();
    world.tick();

    expect(worker.job).toMatchObject({ to: siteId, amount: EX_MUTANT.carry });
    expect(EX_MUTANT.carry).toBeGreaterThan(5);
  });

  it('garde les patients à travers une sauvegarde', () => {
    const { world, clinicId } = colony({
      clinic: true,
      mobiles: ({ clinicId: id }) => [patient(40, 40, id, 'care', 123), exMutant(500, id, 0, 0)],
    });
    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error('sauvegarde illisible');
    expect(decoded.world.mobiles.get(2)).toMatchObject({ kind: 'patient', state: 'care', clinicId, ticks: 123 });
    expect(decoded.world.mobiles.get(500)).toMatchObject({ kind: 'worker', exMutant: true });
    expect(decoded.world.entities.get(clinicId)?.kind).toBe('clinic');
  });

});
