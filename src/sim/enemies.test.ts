import { describe, expect, it } from 'vitest';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS, NURSERY_BIRTH_TICKS } from '../data/buildings.ts';
import { ENEMIES, WAVES, waveSize } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { WEAPONS } from '../data/weapons.ts';
import { BUILD_REACH_TILES } from './player.ts';
import type { Entity, EntityId, Mutant } from './types.ts';
import { World } from './world.ts';

/** Place Adam sur une tuile libre collée à l'emprise, et renvoie l'axe qui pousse vers elle. */
function standNextTo(world: World, tx: number, ty: number, width: number, height: number): { x: number; y: number } {
  const candidates: [number, number, number, number][] = [];

  for (let x = tx; x < tx + width; x += 1) {
    candidates.push([x, ty + height, 0, -1], [x, ty - 1, 0, 1]);
  }
  for (let y = ty; y < ty + height; y += 1) {
    candidates.push([tx + width, y, -1, 0], [tx - 1, y, 1, 0]);
  }

  for (const [x, y, axisX, axisY] of candidates) {
    if (world.isSolid(x, y)) continue;

    world.player.x = (x + 0.5) * TILE_SIZE;
    world.player.y = (y + 0.5) * TILE_SIZE;
    return { x: axisX, y: axisY };
  }
  throw new Error('emprise cernée');
}

/** Remplit le sac avec le coût, va au contact du chantier, et pousse jusqu'à l'achèvement. */
function completeSite(world: World, id: EntityId): Entity {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount);
  }

  world.push({ type: 'setMoveAxis', ...standNextTo(world, site.tx, site.ty, site.width, site.height) });

  for (let i = 0; i < 400; i += 1) {
    world.tick();
    if (world.entities.get(id)?.kind !== 'site') break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  world.tick();

  const built = world.entities.get(id);

  if (!built || built.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
  return built;
}

/** Pose et achève un bâtiment sur la première case posable à portée. */
function build(world: World, building: 'nursery' | 'watchtower' | 'drill'): Entity {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (world.canPlace(building, tx, ty) !== null) continue;

      const before = new Set(world.entities.keys());

      world.push({ type: 'placeBuilding', building, tx, ty });
      world.tick();

      const id = [...world.entities.keys()].find((key) => !before.has(key));

      if (id === undefined) throw new Error('le chantier n’a pas été ouvert');
      return completeSite(world, id);
    }
  }
  throw new Error('aucune case posable à portée');
}

function mutants(world: World): Mutant[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Mutant => mobile.kind === 'mutant');
}

/** Un monde dont la mairie est debout, et le tick où elle l'est devenue. */
function worldWithTownHall(seed = 7): World {
  const world = new World(seed);

  completeSite(world, world.townHallId);
  return world;
}

function townHallCenter(world: World): { x: number; y: number } {
  const hall = world.entities.get(world.townHallId)!;

  return { x: (hall.tx + hall.width / 2) * TILE_SIZE, y: (hall.ty + hall.height / 2) * TILE_SIZE };
}

describe('vagues', () => {
  it('n’envoie aucun mutant tant que la mairie est en chantier', () => {
    const world = new World(7);

    for (let i = 0; i < WAVES.firstDelay + WAVES.interval; i += 1) world.tick();

    expect(mutants(world)).toHaveLength(0);
    expect(world.wave).toBe(0);
  });

  it('lance la première vague un délai après l’achèvement de la mairie, puis les suivantes à cadence fixe', () => {
    const world = worldWithTownHall();
    const waves: number[] = [];

    world.events.on('waveStarted', ({ wave, count }) => waves.push(wave * 100 + count));

    for (let i = 0; i < WAVES.firstDelay - 2; i += 1) world.tick();
    expect(mutants(world)).toHaveLength(0);

    for (let i = 0; i < 2; i += 1) world.tick();
    expect(mutants(world)).toHaveLength(waveSize(1));
    expect(waves).toEqual([100 + waveSize(1)]);

    for (let i = 0; i < WAVES.interval; i += 1) world.tick();
    expect(world.wave).toBe(2);
    expect(waves).toHaveLength(2);
  });

  it('fait apparaître les mutants à distance de la mairie, jamais sur elle', () => {
    const world = worldWithTownHall();
    const center = townHallCenter(world);

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    for (const mutant of mutants(world)) {
      const distance = Math.hypot(mutant.x - center.x, mutant.y - center.y) / TILE_SIZE;

      expect(distance).toBeGreaterThanOrEqual(WAVES.minDistance - 0.01);
      expect(distance).toBeLessThanOrEqual(WAVES.maxDistance + 0.01);
    }
  });

  it('grossit l’effectif avec les vagues, jusqu’au plafond', () => {
    expect(waveSize(1)).toBe(1);
    expect(waveSize(1 + WAVES.growEvery)).toBe(2);
    expect(waveSize(1000)).toBe(WAVES.maxSize);
  });
});

describe('mutants', () => {
  it('marche droit sur la mairie, sans que rien d’autre ne l’arrête', () => {
    const world = worldWithTownHall();
    const center = townHallCenter(world);

    // Adam loin : son arc ne doit pas fausser la mesure.
    world.player.x += 40 * TILE_SIZE;

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    const [mutant] = mutants(world);
    const before = Math.hypot(mutant!.x - center.x, mutant!.y - center.y);

    for (let i = 0; i < 20; i += 1) world.tick();

    const after = Math.hypot(mutant!.x - center.x, mutant!.y - center.y);

    expect(after).toBeLessThan(before);
    expect(after).toBeCloseTo(before - ENEMIES.mutant.speed * TILE_SIZE, 0);
    expect(mutant!.moving).toBe(true);
  });

  it('atteint la mairie, la frappe à cadence fixe, et la fait tomber', () => {
    const world = worldWithTownHall();
    const hall = world.entities.get(world.townHallId)!;
    const damaged: number[] = [];
    let destroyed = 0;

    world.player.x += 40 * TILE_SIZE;
    world.events.on('buildingDamaged', ({ hp }) => damaged.push(hp));
    world.events.on('townHallDestroyed', () => (destroyed += 1));

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    // Le trajet : au plus 20 tuiles à 1,7 tuile/s, puis les coups.
    for (let i = 0; i < 20 * 15 && damaged.length === 0; i += 1) world.tick();
    expect(damaged).toEqual([BUILDINGS.townHall.hp - ENEMIES.mutant.damage]);

    for (let i = 0; i < ENEMIES.mutant.attackTicks; i += 1) world.tick();
    expect(damaged).toHaveLength(2);

    for (let i = 0; i < 20 * 120 && !world.defeated; i += 1) world.tick();

    expect(world.defeated).toBe(true);
    expect(destroyed).toBe(1);
    expect(world.entities.has(world.townHallId)).toBe(false);
    expect(world.chunks.occupantAt(hall.tx, hall.ty)).toBeUndefined();
    expect(damaged.at(-1)).toBe(0);
  });
});

describe('arc d’Adam', () => {
  it('tire seul sur le mutant à portée, et le tue en autant de flèches que de points de vie', () => {
    const world = worldWithTownHall();
    let shots = 0;
    const hits: number[] = [];
    let deaths = 0;

    world.events.on('arrowShot', () => (shots += 1));
    world.events.on('mutantHit', ({ hp }) => hits.push(hp));
    world.events.on('mutantDied', () => (deaths += 1));

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    const [mutant] = mutants(world);

    // On le pose à mi-portée : l'arc doit partir au tick suivant.
    world.player.x = mutant!.x + 3 * TILE_SIZE;
    world.player.y = mutant!.y;
    world.tick();
    expect(shots).toBe(1);

    for (let i = 0; i < 200 && deaths === 0; i += 1) {
      // Le mutant marche : on garde Adam à sa hauteur.
      world.player.x = mutant!.x + 3 * TILE_SIZE;
      world.player.y = mutant!.y;
      world.tick();
    }

    expect(deaths).toBe(1);
    expect(hits).toEqual([ENEMIES.mutant.hp - 1, ENEMIES.mutant.hp - 2].slice(0, ENEMIES.mutant.hp - 1));
    expect(mutants(world)).toHaveLength(0);
    expect(shots).toBeGreaterThanOrEqual(ENEMIES.mutant.hp);
  });

  it('respecte le délai entre deux flèches', () => {
    const world = worldWithTownHall();
    let shots = 0;

    world.events.on('arrowShot', () => (shots += 1));

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    const [mutant] = mutants(world);

    world.player.x = mutant!.x + 2 * TILE_SIZE;
    world.player.y = mutant!.y;
    world.tick();
    expect(shots).toBe(1);

    for (let i = 0; i < WEAPONS.bow.cooldown - 1; i += 1) world.tick();
    expect(shots).toBe(1);

    world.tick();
    expect(shots).toBe(2);
  });

  it('ne tire pas hors de portée', () => {
    const world = worldWithTownHall();
    let shots = 0;

    world.events.on('arrowShot', () => (shots += 1));
    world.player.x += 60 * TILE_SIZE;

    for (let i = 0; i < WAVES.firstDelay + 40; i += 1) world.tick();

    expect(mutants(world).length).toBeGreaterThan(0);
    expect(shots).toBe(0);
  });
});

describe('tour de guet', () => {
  it('tire sur les mutants à portée et se rendort quand il n’y en a plus', () => {
    const world = worldWithTownHall();
    const tower = build(world, 'watchtower');
    let shots = 0;

    if (tower.kind !== 'tower') throw new Error('pas une tour');

    world.events.on('arrowShot', () => (shots += 1));

    // Adam loin : seule la tour tire.
    world.player.x += 60 * TILE_SIZE;
    expect(tower.armed).toBe(false);

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();
    expect(tower.armed).toBe(true);

    // On amène le mutant sous la tour.
    const [mutant] = mutants(world);
    const x = (tower.tx + tower.width / 2) * TILE_SIZE;
    const y = (tower.ty + tower.height + 1.5) * TILE_SIZE;

    mutant!.x = x;
    mutant!.y = y;

    for (let i = 0; i < WEAPONS.towerBow.cooldown + 2; i += 1) world.tick();
    expect(shots).toBeGreaterThan(0);

    // Sans mutant, la tour cesse de se replanifier.
    for (const other of mutants(world)) world.mobiles.delete(other.id);
    for (let i = 0; i < WEAPONS.towerBow.cooldown + 2; i += 1) world.tick();
    expect(tower.armed).toBe(false);
  });
});

describe('nurserie', () => {
  it('fait naître un enfant toutes les dix minutes, qui reste près de chez lui', () => {
    const world = new World(7);
    const nursery = build(world, 'nursery');
    const born: number[] = [];
    let birthTick = 0;

    if (nursery.kind !== 'nursery') throw new Error('pas une nurserie');

    world.events.on('childBorn', ({ kidId }) => {
      born.push(kidId);
      birthTick = world.tickCount;
    });
    expect(nursery.nextBirthTick - world.tickCount).toBeLessThanOrEqual(NURSERY_BIRTH_TICKS);
    expect(world.population()).toEqual({ adults: 1, children: 0 });

    for (let i = 0; i < NURSERY_BIRTH_TICKS - 3; i += 1) world.tick();
    expect(born).toHaveLength(0);

    for (let i = 0; i < 3; i += 1) world.tick();
    expect(born).toHaveLength(1);
    expect(nursery.born).toBe(1);
    expect(world.population()).toEqual({ adults: 1, children: 1 });
    expect(nursery.nextBirthTick).toBe(birthTick + NURSERY_BIRTH_TICKS);

    const home = {
      x: (nursery.tx + nursery.width / 2) * TILE_SIZE,
      y: (nursery.ty + nursery.height / 2) * TILE_SIZE,
    };

    for (let i = 0; i < 20 * 30; i += 1) {
      world.tick();

      const kid = world.mobiles.get(born[0]!)!;

      expect(Math.hypot(kid.x - home.x, kid.y - home.y)).toBeLessThan(6 * TILE_SIZE);
    }

    for (let i = 0; i < NURSERY_BIRTH_TICKS; i += 1) world.tick();
    expect(born).toHaveLength(2);
  });
});

describe('déterminisme des vagues', () => {
  /*
   * Le PRNG des vagues et des enfants vit dans le monde et n'avance qu'au
   * tick : deux parties menées à l'identique donnent les mêmes mutants aux
   * mêmes endroits, flèche pour flèche. C'est ce que la rejouabilité par
   * journal de commandes exige.
   */
  it('donne les mêmes mutants et les mêmes flèches à deux parties identiques', () => {
    const scenario = (): World => {
      const world = worldWithTownHall(11);

      for (let i = 0; i < WAVES.firstDelay + 200; i += 1) world.tick();
      return world;
    };
    const first = scenario();
    const second = scenario();

    expect(first.wave).toBe(1);
    expect(second.wave).toBe(first.wave);
    expect([...second.mobiles.values()]).toEqual([...first.mobiles.values()]);
    expect(second.commandLog()).toEqual(first.commandLog());
  });
});
