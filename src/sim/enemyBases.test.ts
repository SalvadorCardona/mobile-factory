import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId, type BuildingProto } from '../data/buildings.ts';
import { ENEMY_BASE, ENEMY_BASE_RINGS, enemyBaseLevel } from '../data/enemyBases.ts';
import { MAX_GEAR, gearOf } from '../data/gear.ts';
import type { ItemId } from '../data/items.ts';
import { baseCenter, inBaseZone, isStanding } from './enemyBases.ts';
import { deserialize, serialize } from './save.ts';
import type { EnemyBase, EntityId } from './types.ts';
import { World } from './world.ts';

/** Un chantier livré d'office sauf un objet, que le sac apporte : le dernier objet l'achève. */
function finish(world: World, id: EntityId): void {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  const cost = BUILDINGS[site.proto].cost as Partial<Record<ItemId, number>>;
  const [last] = Object.keys(cost) as ItemId[];

  site.delivered = { ...cost, [last!]: cost[last!]! - 1 };
  world.player.inventory.add(last!, 1);
  world.push({ type: 'transferToSite', id });
  world.tick();
  if (world.entities.get(id)?.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
}

/** Une partie dont la mairie est debout : le menu s'ouvre. */
function withTownHall(seed = 7): World {
  const world = new World(seed);

  finish(world, world.townHallId);
  return world;
}

/** Centre de la mairie, en tuiles. */
function hallCenter(world: World): { x: number; y: number } {
  const hall = world.entities.get(world.townHallId)!;

  return { x: hall.tx + hall.width / 2, y: hall.ty + hall.height / 2 };
}

function centerTiles(base: EnemyBase): { x: number; y: number } {
  const { x, y } = baseCenter(base);

  return { x: x / TILE_SIZE, y: y / TILE_SIZE };
}

/** Un bâtiment du menu, 1 × 1 ou plus, et une origine dans la zone de `base` où seule la base empêche de bâtir. */
function spotInZone(world: World, base: EnemyBase): { building: BuildingId; tx: number; ty: number } {
  const building = (Object.keys(BUILDINGS) as BuildingId[]).find(
    (id) => world.isUnlocked(id) && !BUILDINGS[id].unique && BUILDINGS[id].kind !== 'drill' && (BUILDINGS[id] as BuildingProto).hallDistance === undefined,
  )!;
  const radius = enemyBaseLevel(base.level).zoneRadius;
  const { x, y } = centerTiles(base);

  for (let ty = Math.floor(y - radius); ty <= y + radius; ty += 1) {
    for (let tx = Math.floor(x - radius); tx <= x + radius; tx += 1) {
      if (world.placementBlock(building, tx, ty)?.reason === 'enemyZone') return { building, tx, ty };
    }
  }
  throw new Error('aucune case de la zone n’est libre');
}

/** Adam juste sous l'emprise du bâtiment à poser, à portée de construction. */
function standNear(world: World, spot: { building: BuildingId; tx: number; ty: number }): void {
  const proto = BUILDINGS[spot.building];

  world.player.x = (spot.tx + proto.width / 2) * TILE_SIZE;
  world.player.y = (spot.ty + proto.height + 1) * TILE_SIZE;
}

/** Adam juste sous la base, à portée d'arc, immobile. */
function standBelow(world: World, base: EnemyBase): void {
  world.player.x = (base.tx + ENEMY_BASE.width / 2) * TILE_SIZE;
  world.player.y = (base.ty + ENEMY_BASE.height + 1.5) * TILE_SIZE;
}

/** La base de l'anneau 1 la plus proche d'Adam. */
function firstRingBase(world: World): EnemyBase {
  const hall = hallCenter(world);

  return world.enemyBases
    .filter((base) => base.level === 1)
    .sort((a, b) => {
      const ca = centerTiles(a);
      const cb = centerTiles(b);

      return Math.hypot(ca.x - hall.x, ca.y - hall.y) - Math.hypot(cb.x - hall.x, cb.y - hall.y);
    })[0]!;
}

describe('bases mutantes', () => {
  it('se posent en anneaux autour de la mairie, de plus en plus fortes, et laissent la ville de départ libre', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const world = new World(seed);
      const hall = hallCenter(world);

      ENEMY_BASE_RINGS.forEach((ring) => {
        const bases = world.enemyBases.filter((base) => base.level === ring.level);

        // Un lac peut trouer un anneau, jamais le vider.
        expect(bases.length).toBeGreaterThanOrEqual(Math.ceil(ring.count / 2));
        for (const base of bases) {
          const { x, y } = centerTiles(base);
          const distance = Math.hypot(x - hall.x, y - hall.y);

          expect(Math.abs(distance - ring.radius)).toBeLessThanOrEqual(ENEMY_BASE.search + 2);
          expect(base.hp).toBe(enemyBaseLevel(ring.level).hp);
        }

        // Tout autour : les bases d'un anneau couvrent au moins trois quadrants.
        const quadrants = new Set(bases.map((base) => {
          const { x, y } = centerTiles(base);

          return `${Math.sign(Math.round(x - hall.x))}:${Math.sign(Math.round(y - hall.y))}`;
        }));

        expect(quadrants.size).toBeGreaterThanOrEqual(3);
      });

      // Plus loin, plus coriace.
      expect(enemyBaseLevel(2).hp).toBeGreaterThan(enemyBaseLevel(1).hp);
      expect(enemyBaseLevel(3).hp).toBeGreaterThan(enemyBaseLevel(2).hp);

      // Rien ne tient la clairière (fer à 20 tuiles du départ) : 20 tuiles autour de la mairie restent à bâtir.
      for (let dy = -20; dy <= 20; dy += 1) {
        for (let dx = -20; dx <= 20; dx += 1) {
          if (dx * dx + dy * dy > 400) continue;
          expect(world.enemyZoneAt(Math.floor(hall.x + dx), Math.floor(hall.y + dy))).toBeNull();
        }
      }
    }
  });

  it('interdit de bâtir et de récolter dans sa zone', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const spot = spotInZone(world, base);
    const { building, tx, ty } = spot;
    let refused: string | null = null;

    world.events.on('placementRejected', ({ reason }) => (refused = reason));
    standNear(world, spot);
    expect(world.canPlace(building, tx, ty)).toBe('enemyZone');
    world.push({ type: 'placeBuilding', building, tx, ty });
    world.tick();
    expect(refused).toBe('enemyZone');
    expect([...world.entities.values()].some((entity) => entity.tx === tx && entity.ty === ty)).toBe(false);

    // Un arbre dans la zone : Adam à côté n'en tire rien.
    const radius = enemyBaseLevel(base.level).zoneRadius;
    const { x, y } = centerTiles(base);
    let tree: { tx: number; ty: number } | null = null;

    for (let ty2 = Math.floor(y - radius); ty2 <= y + radius && !tree; ty2 += 1) {
      for (let tx2 = Math.floor(x - radius); tx2 <= x + radius && !tree; tx2 += 1) {
        if (world.resources.at(tx2, ty2) && inBaseZone(base, tx2, ty2) && inBaseZone(base, tx2, ty2 + 1)) tree = { tx: tx2, ty: ty2 };
      }
    }
    if (!tree) return;

    const before = world.resources.at(tree.tx, tree.ty)!.remaining;

    for (const [item, amount] of world.player.inventory.entries()) world.player.inventory.remove(item, amount);
    world.player.x = (tree.tx + 0.5) * TILE_SIZE;
    world.player.y = (tree.ty + 1.6) * TILE_SIZE;
    for (let i = 0; i < 60; i += 1) world.tick();
    expect(world.resources.at(tree.tx, tree.ty)?.remaining).toBe(before);
  });

  it('ne bouge pas sous un arc trop faible, et le dit', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    let resisted = 0;

    world.events.on('enemyBaseResisted', () => (resisted += 1));
    expect(world.player.gear).toBeLessThan(base.level);
    standBelow(world, base);
    for (let i = 0; i < 400; i += 1) world.tick();

    expect(base.hp).toBe(enemyBaseLevel(base.level).hp);
    expect(resisted).toBeGreaterThan(0);
    expect(world.prestige).toBe(0);
  });

  it('tombe sous un arc de son niveau : sa zone se libère, le Prestige monte, son butin tombe, et elle ne revient pas', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const spot = spotInZone(world, base);
    const { building, tx, ty } = spot;
    const destroyed: number[] = [];
    let loot = 0;

    world.events.on('enemyBaseDestroyed', ({ id }) => destroyed.push(id));
    world.events.on('lootDropped', () => (loot += 1));
    world.player.gear = base.level;
    standBelow(world, base);
    for (let i = 0; i < 4000 && isStanding(base); i += 1) world.tick();

    expect(destroyed).toEqual([base.id]);
    expect(world.prestige).toBe(enemyBaseLevel(base.level).prestige);
    expect(loot).toBeGreaterThan(0);
    expect(world.enemyZoneAt(tx, ty)).toBeNull();
    standNear(world, spot);
    expect(world.canPlace(building, tx, ty)).toBeNull();

    // Ni au chargement, ni plus tard : elle reste à terre.
    const copy = deserialize(JSON.parse(JSON.stringify(serialize(world))));

    for (let i = 0; i < 200; i += 1) copy.tick();
    expect(copy.enemyBase(base.id)?.hp).toBe(0);
    expect(copy.prestige).toBe(world.prestige);
    expect(copy.enemyZoneAt(tx, ty)).toBeNull();
  });

  it('se forge à la forge : chaque arc entame un niveau de plus', () => {
    expect(gearOf(0).cost).toEqual({});
    for (let level = 1; level <= MAX_GEAR; level += 1) expect(Object.keys(gearOf(level).cost).length).toBeGreaterThan(0);
    expect(MAX_GEAR).toBeGreaterThanOrEqual(ENEMY_BASE_RINGS[ENEMY_BASE_RINGS.length - 1]!.level);
  });

  it('une ancienne sauvegarde sans bases les découvre au chargement, hors des zones déjà bâties', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const spot = spotInZone(world, base);
    const { building, tx, ty } = spot;

    // Une partie d'avant les bases : un chantier là où la base aurait tenu sa zone.
    base.hp = 0;
    standNear(world, spot);
    world.push({ type: 'placeBuilding', building, tx, ty });
    world.tick();
    expect([...world.entities.values()].some((entity) => entity.tx === tx && entity.ty === ty)).toBe(true);

    const state = JSON.parse(JSON.stringify(serialize(world))) as Record<string, unknown>;

    delete state['enemyBases'];
    delete state['prestige'];
    delete (state['player'] as Record<string, unknown>)['gear'];

    const copy = deserialize(state);

    expect(copy.enemyBases.length).toBeGreaterThan(0);
    expect(copy.enemyBase(base.id)).toBeUndefined();
    expect(copy.prestige).toBe(0);
    expect(copy.player.gear).toBe(0);
    for (const other of copy.enemyBases) {
      for (const entity of copy.entities.values()) expect(inBaseZone(other, entity.tx, entity.ty)).toBe(false);
    }
    for (let i = 0; i < 100; i += 1) copy.tick();
  });
});
