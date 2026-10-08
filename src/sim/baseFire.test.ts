import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { WEAPONS } from '../data/weapons.ts';
import { ENEMY_BASE, ENEMY_BASE_LEVELS, FIREBALL, enemyBaseLevel } from '../data/enemyBases.ts';
import type { ItemId } from '../data/items.ts';
import { baseCenter } from './enemyBases.ts';
import { deserialize, serialize } from './save.ts';
import type { EnemyBase, Fireball } from './types.ts';
import { World } from './world.ts';

/** Une mairie debout (le monde ne tourne pas sans), et une base de niveau 1 seule, sans gardien pour troubler les mesures. */
function setup(): { world: World; base: EnemyBase } {
  const world = new World(7);
  const site = world.entities.get(world.townHallId);

  if (site?.kind !== 'site') throw new Error('pas de chantier de mairie');

  const cost = BUILDINGS[site.proto].cost as Partial<Record<ItemId, number>>;

  // Tout livré sauf un objet, que le sac apporte : le dernier objet achève la mairie.
  const [last] = Object.keys(cost) as ItemId[];

  site.delivered = { ...cost, [last!]: cost[last!]! - 1 };
  world.player.inventory.add(last!, 1);
  world.push({ type: 'transferToSite', id: world.townHallId });
  world.tick();

  const base = world.enemyBases.find((candidate) => candidate.level === 1)!;

  base.guards = 0;
  base.spitters = 0;
  base.chief = 0;
  return { world, base };
}

function place(world: World, base: EnemyBase, dx: number, dy = 0): void {
  const center = baseCenter(base);

  world.player.x = world.player.prevX = center.x + dx * TILE_SIZE;
  world.player.y = world.player.prevY = center.y + dy * TILE_SIZE;
}

function fireballs(world: World): Fireball[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Fireball => mobile.kind === 'fireball');
}

describe('boules de feu des bases', () => {
  it('ne tire pas tant qu’Adam est hors de portée', () => {
    const { world, base } = setup();
    const { fire } = enemyBaseLevel(base.level);
    let fired = 0;

    world.events.on('baseFired', () => (fired += 1));
    place(world, base, fire.range + 1);
    for (let i = 0; i < fire.cooldownTicks * 3; i += 1) world.tick();
    expect(fired).toBe(0);
    expect(base.fire).toBe(fire.cooldownTicks);
  });

  it('allume sa lueur puis tire à portée, à la cadence de son niveau', () => {
    const { world, base } = setup();
    const { fire } = enemyBaseLevel(base.level);
    const warned: number[] = [];
    const shots: number[] = [];
    let tick = 0;

    world.events.on('baseFireWarned', () => warned.push(tick));
    world.events.on('baseFired', () => shots.push(tick));
    place(world, base, fire.range - 1);
    for (tick = 1; tick <= fire.cooldownTicks * 2 + 2; tick += 1) {
      place(world, base, fire.range - 1);
      world.tick();
    }
    expect(shots).toHaveLength(2);
    expect(shots[1]! - shots[0]!).toBe(fire.cooldownTicks);
    expect(shots[0]! - warned[0]!).toBe(FIREBALL.tellTicks);
  });

  it('blesse Adam immobile du nombre de points de son niveau', () => {
    const { world, base } = setup();
    const { fire } = enemyBaseLevel(base.level);
    const hurt: number[] = [];

    world.events.on('playerHurt', ({ hp }) => hurt.push(hp));
    place(world, base, fire.range - 1);
    world.player.hp = 10;
    for (let i = 0; i < fire.cooldownTicks + 40; i += 1) {
      place(world, base, fire.range - 1);
      world.tick();
      if (hurt.length > 0) break;
    }
    expect(hurt[0]).toBe(10 - fire.damage);
  });

  it('s’esquive : Adam qui sort de la ligne de tir après le départ n’est pas touché', () => {
    const { world, base } = setup();
    const { fire } = enemyBaseLevel(base.level);
    const hurt: number[] = [];
    let dodged = false;

    world.events.on('playerHurt', ({ hp }) => hurt.push(hp));
    world.events.on('baseFired', () => {
      // Un pas de côté, perpendiculaire au tir : trois tuiles.
      world.player.y += 3 * TILE_SIZE;
      dodged = true;
    });
    place(world, base, fire.range - 1);
    for (let i = 0; i < fire.cooldownTicks + 80; i += 1) {
      if (!dodged) place(world, base, fire.range - 1);
      world.tick();
    }
    expect(dodged).toBe(true);
    expect(hurt).toEqual([]);
  });

  it('ne tire jamais plus loin que sa zone, et plus loin que l’arc d’Adam', () => {
    for (const level of ENEMY_BASE_LEVELS) {
      expect(level.fire.range).toBeLessThanOrEqual(level.zoneRadius);
      expect(level.fire.range).toBeGreaterThanOrEqual(WEAPONS.bow.range + ENEMY_BASE.reach);
    }
  });

  it('vise le bâtiment à portée quand Adam n’y est pas, et l’abîme', () => {
    const { world, base } = setup();
    const { fire } = enemyBaseLevel(base.level);
    const hall = world.entities.get(world.townHallId);

    if (hall?.kind === 'site' || !hall) throw new Error('mairie non bâtie');

    const before = hall.hp;

    // La base glissée à quatre tuiles de moins que sa portée de la mairie.
    base.tx = hall.tx - (fire.range - 4) - 1;
    base.ty = hall.ty;
    place(world, base, -60);
    for (let i = 0; i < 20 * 12; i += 1) world.tick();
    expect(hall.hp).toBeLessThan(before);
  });

  it('une sauvegarde sans délai de tir reprend avec le délai plein, et le délai se sauvegarde', () => {
    const { world, base } = setup();
    const state = JSON.parse(JSON.stringify(serialize(world))) as { enemyBases: Record<string, unknown>[] };

    for (const entry of state.enemyBases) delete entry['fire'];

    const loaded = deserialize(state);

    expect(loaded.enemyBases.every((entry) => entry.fire === enemyBaseLevel(entry.level).fire.cooldownTicks)).toBe(true);
    base.fire = 33;
    expect(deserialize(JSON.parse(JSON.stringify(serialize(world)))).enemyBases.find((entry) => entry.id === base.id)?.fire).toBe(33);
  });
});

describe('puissance des bases', () => {
  it('croît avec l’anneau : points de vie, boules de feu', () => {
    for (let i = 1; i < ENEMY_BASE_LEVELS.length; i += 1) {
      expect(ENEMY_BASE_LEVELS[i]!.hp).toBeGreaterThan(ENEMY_BASE_LEVELS[i - 1]!.hp);
      expect(ENEMY_BASE_LEVELS[i]!.fire.damage).toBeGreaterThanOrEqual(ENEMY_BASE_LEVELS[i - 1]!.fire.damage);
    }
  });

  it('une ancienne sauvegarde est lisible, fireballs en vol compris', () => {
    const { world } = setup();

    expect(fireballs(world)).toEqual([]);
    expect(() => deserialize(JSON.parse(JSON.stringify(serialize(world))))).not.toThrow();
  });
});
