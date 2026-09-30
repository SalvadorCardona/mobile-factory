import { describe, expect, it } from 'vitest';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { ENEMIES, MUTANT_LOOT, WAVES, waveSize } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES } from '../data/recipes.ts';
import { WEAPONS } from '../data/weapons.ts';
import { compassOf } from './enemies.ts';
import { BUILD_REACH_TILES } from './player.ts';
import { deserialize, serialize } from './save.ts';
import type { Entity, EntityId, Mutant, Pickup } from './types.ts';
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

const NURSERY_BIRTH_TICKS = RECIPES.raiseChild.duration;
const BIRTH_FOOD = RECIPES.raiseChild.inputs.food;

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

    const current = world.entities.get(id);

    if (current?.kind !== 'site') break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  // Un tick de plus, comme avant : les cadences des tests se comptent depuis là.
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

/** Laisse les mutants sortir de leur flaque, Adam au loin pour que son arc n'y touche pas, puis le ramène. */
function waitEmergence(world: World): void {
  const { x } = world.player;

  world.player.x += 60 * TILE_SIZE;
  for (let i = 0; i < 400 && mutants(world).some((mutant) => mutant.emerge > 0); i += 1) world.tick();
  world.player.x = x;
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

    const waveTicks: number[] = [];
    const countdown: number[] = [];

    world.events.on('waveCountdown', ({ seconds }) => countdown.push(seconds));

    world.events.on('waveStarted', ({ wave, count }) => {
      waves.push(wave * 100 + count);
      waveTicks.push(world.tickCount);
    });

    // Le compte à rebours du HUD lit ce tick : il doit tomber pile sur l'apparition.
    const firstWaveTick = world.nextWaveTick;

    expect(firstWaveTick).toBeGreaterThan(world.tickCount);

    for (let i = 0; i < WAVES.firstDelay - 2; i += 1) world.tick();
    expect(mutants(world)).toHaveLength(0);

    for (let i = 0; i < 2; i += 1) world.tick();
    expect(mutants(world)).toHaveLength(waveSize(1));
    expect(waves).toEqual([100 + waveSize(1)]);
    expect(waveTicks).toEqual([firstWaveTick]);
    expect(countdown).toEqual([3, 2, 1]);
    expect(world.nextWaveTick).toBe(firstWaveTick + WAVES.interval);

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

describe('mise en scène des vagues', () => {
  it('annonce la vague trois secondes avant : son numéro, son effectif, d’où elle vient', () => {
    const world = worldWithTownHall();
    const center = townHallCenter(world);
    const heading = world.nextWaveHeading;
    const announces: { seconds: number; wave: number; count: number; from: string; x: number; y: number }[] = [];

    world.events.on('waveCountdown', (event) => announces.push(event));
    world.player.x += 60 * TILE_SIZE;

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    expect(announces.map(({ seconds }) => seconds)).toEqual([3, 2, 1]);
    for (const announce of announces) {
      expect(announce).toMatchObject({ wave: 1, count: waveSize(1), from: compassOf(heading) });
    }
    expect(Math.atan2(announces[0]!.y - center.y, announces[0]!.x - center.x)).toBeCloseTo(
      Math.atan2(Math.sin(heading), Math.cos(heading)),
    );

    // Les mutants sortent bien du côté annoncé.
    for (const mutant of mutants(world)) {
      const angle = Math.atan2(mutant.y - center.y, mutant.x - center.x) - heading;
      const gap = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));

      expect(gap).toBeLessThanOrEqual(WAVES.spread + 1e-9);
    }

    // La suivante a déjà tiré son côté : l'annonce pourra le dire.
    expect(world.nextWaveHeading).not.toBe(heading);
  });

  it('fait sortir chaque mutant de sa flaque, immobile et hors d’atteinte, l’un après l’autre', () => {
    const world = worldWithTownHall();
    let shots = 0;

    world.events.on('arrowShot', () => (shots += 1));

    // Une vague de trois : on avance le compteur.
    world.wave = 1 + 2 * WAVES.growEvery - 1;
    world.player.x += 60 * TILE_SIZE;
    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();

    const wave = mutants(world);

    expect(wave).toHaveLength(3);
    const [a, b, c] = wave.map((mutant) => mutant.emerge);

    expect(a).toBeGreaterThan(WAVES.emergeTicks - 2);
    expect([b! - a!, c! - b!]).toEqual([WAVES.emergeStagger, WAVES.emergeStagger]);

    // Adam colle au premier : son arc ne part pas tant qu'il émerge.
    const [first] = wave;
    const start = { x: first!.x, y: first!.y };

    while (first!.emerge > 1) {
      world.player.x = first!.x + 2 * TILE_SIZE;
      world.player.y = first!.y;
      world.tick();
      expect(world.player.target).toBeNull();
    }
    expect(shots).toBe(0);
    expect({ x: first!.x, y: first!.y }).toEqual(start);

    // Debout : l'arc part aussitôt.
    world.tick();
    expect(first!.emerge).toBe(0);
    expect(shots).toBe(1);
    expect(world.player.target).toBe(first!.id);
  });

  it('laisse chaque mutant au moins deux secondes dans le champ quand Adam garde la mairie', () => {
    const world = worldWithTownHall(42);
    const hall = world.entities.get(world.townHallId)!;
    const post = { x: (hall.tx + hall.width / 2) * TILE_SIZE, y: (hall.ty + hall.height + 0.5) * TILE_SIZE };

    // Adam, une tour de guet à côté, et tout ce qui tire.
    world.player.x = post.x;
    world.player.y = post.y;
    build(world, 'watchtower');

    const born = new Map<number, number>();
    const lifetimes: number[] = [];

    world.events.on('waveStarted', () => {
      for (const mutant of mutants(world)) {
        if (born.has(mutant.id)) continue;
        born.set(mutant.id, world.tickCount);

        // Un téléphone tenu droit, caméra en recul : ~7,4 tuiles de part et d'autre d'Adam, ~16 au-dessus et en dessous.
        expect(Math.abs(mutant.x - post.x) / TILE_SIZE).toBeLessThanOrEqual(7.5);
        expect(Math.abs(mutant.y - post.y) / TILE_SIZE).toBeLessThanOrEqual(13);
      }
    });
    world.events.on('mutantDied', ({ id }) => lifetimes.push(world.tickCount - born.get(id)!));

    for (let i = 0; i < WAVES.firstDelay + WAVES.interval * 5 && !world.defeated; i += 1) {
      world.player.x = post.x;
      world.player.y = post.y;
      world.tick();
    }

    expect(world.wave).toBeGreaterThanOrEqual(5);
    expect(lifetimes.length).toBeGreaterThan(5);
    for (const ticks of lifetimes) expect(ticks).toBeGreaterThanOrEqual(2 * 20);
  });

  it('déclare la vague repoussée au dernier mutant abattu, et chacun lâche un butin qu’Adam ramasse', () => {
    const world = worldWithTownHall();
    const cleared: number[] = [];
    const dropped: Pickup[] = [];

    world.events.on('waveCleared', ({ wave }) => cleared.push(wave));
    world.events.on('lootDropped', ({ id }) => dropped.push(world.mobiles.get(id) as Pickup));

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();
    waitEmergence(world);

    const [mutant] = mutants(world);

    for (let i = 0; i < 200 && mutants(world).length > 0; i += 1) {
      world.player.x = mutant!.x + 3 * TILE_SIZE;
      world.player.y = mutant!.y;
      world.tick();
    }

    expect(cleared).toEqual([1]);
    expect(dropped).toHaveLength(1);

    const loot = dropped[0]!;

    expect(MUTANT_LOOT.items).toContain(loot.item);
    expect(world.mobiles.get(loot.id)).toBe(loot);

    const before = world.player.inventory.count(loot.item);
    const picked: number[] = [];

    world.events.on('lootPicked', ({ id }) => picked.push(id));
    world.player.x = loot.x;
    world.player.y = loot.y;
    world.tick();

    expect(picked).toEqual([loot.id]);
    expect(world.player.inventory.count(loot.item)).toBe(before + 1);
    expect(world.mobiles.has(loot.id)).toBe(false);
  });

  it('laisse le butin au sol quand le sac est plein, puis le fait disparaître s’il est oublié', () => {
    const world = worldWithTownHall();

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();
    waitEmergence(world);

    const [mutant] = mutants(world);
    let loot: Pickup | undefined;

    world.events.on('lootDropped', ({ id }) => (loot = world.mobiles.get(id) as Pickup));

    for (let i = 0; i < 200 && !loot; i += 1) {
      world.player.x = mutant!.x + 3 * TILE_SIZE;
      world.player.y = mutant!.y;
      world.tick();
    }

    world.player.inventory.add('wood', world.player.inventory.freeSpace());
    world.player.x = loot!.x;
    world.player.y = loot!.y;
    world.tick();
    expect(world.mobiles.has(loot!.id)).toBe(true);

    world.player.x += 10 * TILE_SIZE;
    for (let i = 0; i < MUTANT_LOOT.lifetimeTicks; i += 1) world.tick();
    expect(world.mobiles.has(loot!.id)).toBe(false);
  });

  it('sauvegarde le côté de la prochaine vague, l’émergence des mutants et le butin au sol', () => {
    const world = worldWithTownHall();

    world.player.x += 60 * TILE_SIZE;
    for (let i = 0; i < WAVES.firstDelay + 5; i += 1) world.tick();

    const [mutant] = mutants(world);

    // Un butin posé à la main : on n'attend pas qu'un mutant tombe.
    const { x, y } = mutant!;

    world.mobiles.set(9999, { kind: 'pickup', id: 9999, x, y, prevX: x, prevY: y, facing: 'down', moving: false, item: 'food', ttl: 42 });
    // Les bêtes ne sont pas l'objet de ce test.
    for (const mobile of world.mobiles.values()) if (mobile.kind === 'beast') world.mobiles.delete(mobile.id);

    const restored = deserialize(JSON.parse(JSON.stringify(serialize(world))));

    expect(restored.nextWaveHeading).toBe(world.nextWaveHeading);
    expect((restored.mobiles.get(mutant!.id) as Mutant).emerge).toBe(mutant!.emerge);
    expect(mutant!.emerge).toBeGreaterThan(0);
    expect(restored.mobiles.get(9999)).toMatchObject({ kind: 'pickup', item: 'food', ttl: 42 });
  });
});

describe('mutants', () => {
  it('marche droit sur la mairie, sans que rien d’autre ne l’arrête', () => {
    const world = worldWithTownHall();
    const center = townHallCenter(world);

    // Adam loin : son arc ne doit pas fausser la mesure.
    world.player.x += 40 * TILE_SIZE;

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();
    for (let i = 0; i < WAVES.emergeTicks; i += 1) world.tick();

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

    // La sortie de flaque, le trajet — au plus 8 tuiles à 1,2 tuile/s — puis les coups.
    for (let i = 0; i < 20 * 15 && damaged.length === 0; i += 1) world.tick();
    expect(damaged).toEqual([BUILDINGS.townHall.hp - ENEMIES.mutant.damage]);

    for (let i = 0; i < ENEMIES.mutant.attackTicks; i += 1) world.tick();
    expect(damaged).toHaveLength(2);

    for (let i = 0; i < 20 * 120 && !world.defeated; i += 1) world.tick();

    expect(world.defeated).toBe(true);
    expect(world.defeatTick).toBe(world.tickCount);
    expect(world.nextWaveTick).toBe(0);
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
    waitEmergence(world);

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
    expect(world.kills).toBe(1);
    expect(hits).toEqual([ENEMIES.mutant.hp - 1, ENEMIES.mutant.hp - 2].slice(0, ENEMIES.mutant.hp - 1));
    expect(mutants(world)).toHaveLength(0);
    expect(shots).toBeGreaterThanOrEqual(ENEMIES.mutant.hp);
  });

  it('respecte le délai entre deux flèches', () => {
    const world = worldWithTownHall();
    let shots = 0;

    world.events.on('arrowShot', () => (shots += 1));

    for (let i = 0; i < WAVES.firstDelay; i += 1) world.tick();
    waitEmergence(world);

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

    // De quoi nourrir deux enfants.
    world.player.inventory.add('food', BIRTH_FOOD * 2);
    world.push({ type: 'supplyBuilding', id: nursery.id });
    world.tick();
    expect(nursery.store.count('food')).toBe(BIRTH_FOOD * 2);

    expect(nursery.nextBirthTick - world.tickCount).toBeLessThanOrEqual(NURSERY_BIRTH_TICKS);
    expect(world.population()).toEqual({ adults: 1, children: 0, workers: 0 });

    while (world.tickCount < nursery.nextBirthTick - 1) world.tick();
    expect(born).toHaveLength(0);

    world.tick();
    expect(born).toHaveLength(1);
    expect(nursery.born).toBe(1);
    expect(nursery.store.count('food')).toBe(BIRTH_FOOD);
    expect(world.population()).toEqual({ adults: 1, children: 1, workers: 0 });
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
    expect(nursery.store.count('food')).toBe(0);
  });

  it('ne fait naître personne sans nourriture, et la livraison la réveille', () => {
    const world = new World(7);
    const nursery = build(world, 'nursery');
    let born = 0;
    let hungry = 0;

    if (nursery.kind !== 'nursery') throw new Error('pas une nurserie');

    world.events.on('childBorn', () => (born += 1));
    world.events.on('nurseryHungry', () => (hungry += 1));

    while (world.tickCount < nursery.nextBirthTick) world.tick();

    // L'heure est passée, le coffre est vide : pas d'enfant, et plus de réveil planifié.
    expect(born).toBe(0);
    expect(hungry).toBe(1);
    expect(nursery.hungry).toBe(true);

    const wakes = world.pendingWakes();

    for (let i = 0; i < NURSERY_BIRTH_TICKS; i += 1) world.tick();
    expect(born).toBe(0);
    expect(hungry).toBe(1);
    expect(world.pendingWakes()).toBe(wakes);

    // Trois nourritures ne suffisent pas ; la quatrième fait naître l'enfant sur-le-champ.
    world.player.inventory.add('food', BIRTH_FOOD - 1);
    world.push({ type: 'supplyBuilding', id: nursery.id });
    world.tick();
    expect(born).toBe(0);

    world.player.inventory.add('food', 1);
    world.push({ type: 'supplyBuilding', id: nursery.id });
    world.tick();
    expect(born).toBe(1);
    expect(nursery.hungry).toBe(false);
    expect(nursery.store.count('food')).toBe(0);
    expect(nursery.nextBirthTick).toBe(world.tickCount + NURSERY_BIRTH_TICKS);
    expect(world.pendingWakes()).toBe(wakes + 1);
  });

  it('prend la nourriture au contact d’Adam, et elle seule, dans la limite de son coffre', () => {
    const world = new World(7);
    const nursery = build(world, 'nursery');
    const rejected: string[] = [];

    if (nursery.kind !== 'nursery') throw new Error('pas une nurserie');

    world.events.on('supplyRejected', ({ reason }) => rejected.push(reason));

    // Rien à donner : refusé.
    world.player.inventory.add('wood', 5);
    world.push({ type: 'supplyBuilding', id: nursery.id });
    world.tick();
    expect(rejected).toEqual(['nothingToGive']);

    world.player.inventory.add('food', BUILDINGS.nursery.storage + 3);
    world.push({ type: 'setMoveAxis', ...standNextTo(world, nursery.tx, nursery.ty, nursery.width, nursery.height) });
    for (let i = 0; i < 200; i += 1) world.tick();

    expect(nursery.store.count('food')).toBe(BUILDINGS.nursery.storage);
    expect(world.player.inventory.count('food')).toBe(3);
    expect(world.player.inventory.count('wood')).toBe(5);
    expect(nursery.store.count('wood')).toBe(0);
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
