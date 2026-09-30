import { describe, expect, it } from 'vitest';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Command } from './commands.ts';
import { BUILD_REACH_TILES } from './player.ts';
import { SAVE_VERSION, decodeSave, deserialize, encodeSave, serialize } from './save.ts';
import type { EntityId } from './types.ts';
import { World } from './world.ts';

/** Remplit le sac, colle Adam à l'emprise, livre au contact : le dernier objet achève le chantier. */
function completeSite(world: World, id: EntityId): void {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount);
  }

  // Sous l'emprise, au milieu : la tuile du dessous est libre dans la clairière comme ailleurs.
  const below = { tx: site.tx + Math.floor(site.width / 2), ty: site.ty + site.height };

  if (world.isSolid(below.tx, below.ty)) throw new Error('pied du chantier encombré');
  world.player.x = (below.tx + 0.5) * TILE_SIZE;
  world.player.y = (below.ty + 0.5) * TILE_SIZE;
  world.push({ type: 'setMoveAxis', x: 0, y: -1 });

  for (let i = 0; i < 400; i += 1) {
    world.tick();

    const current = world.entities.get(id);

    if (current?.kind !== 'site') break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  world.tick();

  if (world.entities.get(id)?.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
}

/** Pose et achève un bâtiment sur la première case posable à portée. */
function build(world: World, building: BuildingId): void {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (world.canPlace(building, tx, ty) !== null || world.isSolid(tx + 1, ty + BUILDINGS[building].height)) continue;

      const before = new Set(world.entities.keys());

      world.push({ type: 'placeBuilding', building, tx, ty });
      world.tick();

      const id = [...world.entities.keys()].find((key) => !before.has(key));

      if (id === undefined) throw new Error('le chantier n’a pas été ouvert');
      completeSite(world, id);
      return;
    }
  }
  throw new Error('aucune case posable à portée');
}

/** Un axe qui tourne lentement : Adam se promène, heurte, récolte. */
function wander(tick: number): Command {
  const angle = tick / 90;

  return { type: 'setMoveAxis', x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * Une partie bien remplie : mairie debout, nurserie, tour, une vague en
 * cours, un enfant, des ressources entamées et un chantier à moitié livré.
 */
function playedWorld(): World {
  const world = new World(4242);

  completeSite(world, world.townHallId);

  // Une mairie solide : la partie doit tenir jusqu'à la première naissance.
  const hall = world.entities.get(world.townHallId);

  if (hall && hall.kind !== 'site') hall.hp = 1_000_000;
  build(world, 'nursery');

  // De quoi nourrir le premier enfant : sans nourriture, la nurserie attend.
  const nursery = [...world.entities.values()].find((entity) => entity.kind === 'nursery');

  if (!nursery) throw new Error('pas de nurserie');
  world.player.inventory.add('food', 4);
  world.push({ type: 'supplyBuilding', id: nursery.id });
  world.tick();

  build(world, 'watchtower');
  build(world, 'drill');

  const hasKid = (): boolean => [...world.mobiles.values()].some((mobile) => mobile.kind === 'kid');
  const hasMutant = (): boolean => [...world.mobiles.values()].some((mobile) => mobile.kind === 'mutant');

  while (!(hasKid() && hasMutant()) && world.tickCount < 30_000) {
    if (world.tickCount % 60 === 0) world.push(wander(world.tickCount));
    world.tick();
  }

  // Un chantier entamé, pour que `delivered` voyage aussi.
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      if (world.canPlace('farm', origin.tx + dx, origin.ty + dy) !== null) continue;
      world.push({ type: 'placeBuilding', building: 'farm', tx: origin.tx + dx, ty: origin.ty + dy });
      world.tick();
      dy = dx = BUILD_REACH_TILES + 1;
    }
  }

  const site = [...world.entities.values()].find((entity) => entity.kind === 'site');

  if (site?.kind !== 'site') throw new Error('pas de chantier entamé');

  const [item] = Object.keys(BUILDINGS[site.proto].cost) as ItemId[];

  site.delivered[item!] = 1;

  return world;
}

/** Joue `ticks` ticks et renvoie la trace des événements. */
function play(world: World, ticks: number): string[] {
  const trace: string[] = [];

  world.events.on('mutantDied', ({ id }) => trace.push(`${world.tickCount}:mutantDied:${id}`));
  world.events.on('arrowShot', ({ x, y }) => trace.push(`${world.tickCount}:arrow:${x},${y}`));
  world.events.on('resourceHarvested', ({ tx, ty }) => trace.push(`${world.tickCount}:harvest:${tx},${ty}`));
  world.events.on('waveStarted', ({ wave }) => trace.push(`${world.tickCount}:wave:${wave}`));
  world.events.on('childBorn', ({ kidId }) => trace.push(`${world.tickCount}:kid:${kidId}`));
  world.events.on('drillProduced', ({ id }) => trace.push(`${world.tickCount}:drill:${id}`));

  for (let i = 0; i < ticks; i += 1) {
    if (world.tickCount % 60 === 0) world.push(wander(world.tickCount));
    world.tick();
  }
  return trace;
}

describe('sauvegarde', () => {
  const original = playedWorld();
  const state = serialize(original);

  it('contient ce que la partie a construit', () => {
    const kinds = new Set(state.entities.map((entity) => entity.kind));

    expect(kinds).toEqual(new Set(['townHall', 'nursery', 'tower', 'drill', 'site']));
    expect(state.mobiles.some((mobile) => mobile.kind === 'kid')).toBe(true);
    expect(state.mobiles.some((mobile) => mobile.kind === 'mutant')).toBe(true);
    expect(state.night).toBeGreaterThan(0);
    expect(Object.keys(state.resources).length).toBeGreaterThan(0);
  });

  it('aller-retour : deserialize(serialize(world)) redonne le même état', () => {
    const copy = deserialize(JSON.parse(JSON.stringify(state)));

    expect(serialize(copy)).toEqual(state);
    expect(copy.population()).toEqual(original.population());
    expect(copy.pendingWakes()).toBe(original.pendingWakes());
    expect(copy.player.inventory.entries()).toEqual(original.player.inventory.entries());
  });

  it('le monde rechargé joue exactement la même suite de ticks', () => {
    const reference = deserialize(JSON.parse(JSON.stringify(state)));
    const reloaded = decodeSave(encodeSave(reference, 1));

    if (!reloaded.ok) throw new Error(`sauvegarde refusée : ${reloaded.reason}`);

    const expected = play(reference, 4000);
    const actual = play(reloaded.world, 4000);

    expect(expected.length).toBeGreaterThan(0);
    expect(actual).toEqual(expected);
    expect(serialize(reloaded.world)).toEqual(serialize(reference));
  });

  it('le monde restauré est bien celui que la partie originale devient', () => {
    const copy = deserialize(JSON.parse(JSON.stringify(state)));

    play(original, 600);
    play(copy, 600);
    expect(serialize(copy)).toEqual(serialize(original));
  });

  it('enveloppe versionnée : version, date, état', () => {
    const file = JSON.parse(encodeSave(new World(7), 1234)) as Record<string, unknown>;

    expect(file['version']).toBe(SAVE_VERSION);
    expect(file['savedAt']).toBe(1234);
    expect(file['state']).toBeTypeOf('object');
  });

  it('reprend une sauvegarde de la version 4 : la vague devient la nuit, un jour se lève', () => {
    const world = new World(7);

    for (let i = 0; i < 5; i += 1) world.tick();

    const file = JSON.parse(encodeSave(world, 1)) as { state: Record<string, unknown> };
    const state = { ...file.state };

    delete state['night'];
    delete state['cycleStartTick'];
    const v4 = (wave: number, nextWaveTick: number): string =>
      JSON.stringify({ version: 4, savedAt: 1, state: { ...state, wave, nextWaveTick } });

    const standing = decodeSave(v4(3, 900));

    if (!standing.ok) throw new Error(`sauvegarde refusée : ${standing.reason}`);
    expect(standing.world.night).toBe(3);
    expect(standing.world.cycleStartTick).toBe(world.tickCount);
    expect(standing.world.clock()?.phase).toBe('day');

    const building = decodeSave(v4(0, 0));

    if (!building.ok) throw new Error(`sauvegarde refusée : ${building.reason}`);
    expect(building.world.clock()).toBeNull();
  });

  it('ignore sans lever une sauvegarde d’une autre version', () => {
    const file = JSON.parse(encodeSave(new World(7), 1)) as Record<string, unknown>;

    expect(decodeSave(JSON.stringify({ ...file, version: SAVE_VERSION + 1 }))).toEqual({ ok: false, reason: 'version' });
    expect(decodeSave(JSON.stringify({ ...file, version: 0 }))).toEqual({ ok: false, reason: 'version' });
  });

  it('ignore sans lever une sauvegarde corrompue', () => {
    const text = encodeSave(new World(7), 1);
    const file = JSON.parse(text) as { state: Record<string, unknown> };
    const broken = (patch: Record<string, unknown>): string =>
      JSON.stringify({ ...file, state: { ...file.state, ...patch } });

    for (const input of [
      '',
      '{',
      'null',
      '42',
      '[]',
      text.slice(0, text.length / 2),
      JSON.stringify({ version: SAVE_VERSION }),
      JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: null }),
      broken({ seed: 'abc' }),
      broken({ tick: 1.5 }),
      broken({ player: { ...(file.state['player'] as object), x: null } }),
      broken({ entities: [{ kind: 'site', id: 1, proto: 'castle', tx: 0, ty: 0, delivered: {} }] }),
      broken({ entities: [{ kind: 'drill', id: 1, proto: 'townHall', tx: 0, ty: 0, store: {}, hp: 10 }] }),
      broken({ mobiles: [{ kind: 'dragon', id: 1 }] }),
      broken({ resources: { nimporte: 3 } }),
      broken({ scheduler: { near: 'x', far: [] } }),
    ]) {
      expect(decodeSave(input)).toEqual({ ok: false, reason: 'corrupt' });
    }
  });
});
