import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { COMPANIONS, COMPANION_CLASSES, COMPANION_CLASS_IDS, type CompanionClassId } from '../data/companions.ts';
import { ENEMIES } from '../data/enemies.ts';
import { TEST_SCENARIOS } from '../data/testScenario.ts';
import { validatePrototypes } from '../data/validate.ts';
import { createCompanion } from './companions.ts';
import { PLAYER_MAX_HP } from './player.ts';
import { decodeSave, encodeSave } from './save.ts';
import { stageScenario } from './testScenario.ts';
import type { Barracks, Companion, Mutant } from './types.ts';
import { World } from './world.ts';

/** Des ids hors de portée de ceux que le monde distribue. */
let nextId = 90_000;

/** La partie de test « Caserne » : caserne finie, Adam devant, de quoi recruter à la mairie. */
function barracksWorld(): { world: World; barracks: Barracks } {
  const world = stageScenario(TEST_SCENARIOS.army);
  const barracks = [...world.entities.values()].find((entity): entity is Barracks => entity.kind === 'barracks');

  if (!barracks) throw new Error('pas de caserne dans le scénario');
  return { world, barracks };
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

/** Ajoute un compagnon à `dx` tuiles d'Adam, sans passer par la caserne. */
function addCompanion(world: World, role: CompanionClassId, dx = 0, dy = 0): Companion {
  const companion = createCompanion(nextId++, role, world.player.x + dx * TILE_SIZE, world.player.y + dy * TILE_SIZE);

  world.mobiles.set(companion.id, companion);
  return companion;
}

function addMutant(world: World, dx: number, hp = 3): Mutant {
  const x = world.player.x + dx * TILE_SIZE;
  const y = world.player.y;
  const mutant: Mutant = {
    kind: 'mutant',
    id: nextId++,
    proto: 'mutant',
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    hp,
    age: 30,
    attackCooldown: 0,
    emerge: 0,
  };

  world.mobiles.set(mutant.id, mutant);
  return mutant;
}

const recruit = (world: World, barracks: Barracks, role: CompanionClassId): void => {
  world.push({ type: 'recruitCompanion', barracks: barracks.id, role });
  world.tick();
};

describe('classes de compagnons', () => {
  it('passent la validation des données', () => {
    expect(validatePrototypes()).toEqual([]);
  });

  it('chaque classe a ses caractéristiques : guerrier au contact, archer à distance, soigneur qui soigne', () => {
    expect(COMPANION_CLASSES.warrior.hp).toBeGreaterThan(COMPANION_CLASSES.archer.hp);
    expect(COMPANION_CLASSES.warrior.range).toBeLessThan(2);
    expect(COMPANION_CLASSES.archer.range).toBeGreaterThan(COMPANION_CLASSES.warrior.range);
    expect(COMPANION_CLASSES.archer.keep).toBeGreaterThan(0);
    expect(COMPANION_CLASSES.healer.damage).toBe(0);
    expect(COMPANION_CLASSES.healer.heal).toBeGreaterThan(0);
  });
});

describe('caserne', () => {
  it('se débloque à la Milice, au labo : sans elle, elle n’est pas au menu', () => {
    const world = new World(100);

    expect(world.isUnlocked('barracks')).toBe(false);
    world.researchDone.push('militia');
    expect(world.isUnlocked('barracks')).toBe(true);
  });

  it('recrute à la caserne : le coût est payé, la recrue se forme, puis sort et suit Adam', () => {
    const { world, barracks } = barracksWorld();
    const food = world.townStock()!.available('food');

    recruit(world, barracks, 'warrior');
    expect(barracks.training?.role).toBe('warrior');
    expect(world.townStock()!.available('food')).toBe(food - COMPANION_CLASSES.warrior.cost.food);
    expect(world.companions()).toHaveLength(0);

    run(world, COMPANION_CLASSES.warrior.trainTicks + 40);
    expect(barracks.training).toBeNull();
    expect(world.companions().map((companion) => companion.role)).toEqual(['warrior']);
  });

  it('refuse une seconde recrue pendant la formation', () => {
    const { world, barracks } = barracksWorld();
    const reasons: string[] = [];

    world.events.on('recruitRejected', ({ reason }) => reasons.push(reason));
    recruit(world, barracks, 'archer');
    recruit(world, barracks, 'healer');
    expect(reasons).toEqual(['busy']);
  });

  it('refuse sans de quoi payer, sans rien prendre', () => {
    const { world, barracks } = barracksWorld();
    const reasons: string[] = [];

    for (const [item] of world.townStock()!.entries()) world.townStock()!.remove(item, world.townStock()!.count(item));
    world.events.on('recruitRejected', ({ reason }) => reasons.push(reason));
    recruit(world, barracks, 'warrior');
    expect(reasons).toEqual(['missingItems']);
    expect(barracks.training).toBeNull();
  });

  it('refuse trop loin de la caserne', () => {
    const { world, barracks } = barracksWorld();
    const reasons: string[] = [];

    world.player.x += 40 * TILE_SIZE;
    world.events.on('recruitRejected', ({ reason }) => reasons.push(reason));
    recruit(world, barracks, 'warrior');
    expect(reasons).toEqual(['outOfReach']);
  });

  it('plafonne la troupe à cinq, formation comprise', () => {
    const { world, barracks } = barracksWorld();
    const reasons: string[] = [];

    world.events.on('recruitRejected', ({ reason }) => reasons.push(reason));
    for (let i = 0; i < COMPANIONS.max; i += 1) {
      recruit(world, barracks, COMPANION_CLASS_IDS[i % COMPANION_CLASS_IDS.length]!);
      run(world, 20 * 32);
    }
    expect(world.companions()).toHaveLength(COMPANIONS.max);

    recruit(world, barracks, 'archer');
    expect(reasons).toEqual(['full']);
    expect(barracks.training).toBeNull();
    expect(world.companionCount()).toBe(COMPANIONS.max);
  });

  it('compte une recrue en formation dans le plafond', () => {
    const { world, barracks } = barracksWorld();

    for (let i = 0; i < COMPANIONS.max - 1; i += 1) addCompanion(world, 'warrior', 1);
    recruit(world, barracks, 'healer');
    expect(world.companionCount()).toBe(COMPANIONS.max);
    expect(barracks.training).not.toBeNull();
  });

  it('un compagnon tombé laisse une place : on en recrute un autre', () => {
    const { world, barracks } = barracksWorld();
    const events: string[] = [];

    world.events.on('companionDied', ({ role }) => events.push(role));
    for (let i = 0; i < COMPANIONS.max; i += 1) addCompanion(world, 'archer', 1);

    const victim = world.companions()[0]!;

    victim.hp = 1;
    addMutant(world, 0.2, 99).x = victim.x;
    run(world, 5);
    expect(events).toEqual(['archer']);
    expect(world.companions()).toHaveLength(COMPANIONS.max - 1);

    recruit(world, barracks, 'warrior');
    expect(barracks.training?.role).toBe('warrior');
  });
});

describe('suivre Adam', () => {
  it('suit Adam qui s’éloigne, sans jamais le dépasser de loin', () => {
    const { world } = barracksWorld();
    const archer = addCompanion(world, 'archer', 1);

    world.player.x += 8 * TILE_SIZE;
    run(world, 60);
    expect(Math.hypot(archer.x - world.player.x, archer.y - world.player.y)).toBeLessThan(3 * TILE_SIZE);
  });

  it('se tient près de sa place sans bouger tant qu’Adam est immobile', () => {
    const { world } = barracksWorld();
    const healer = addCompanion(world, 'healer', 3);

    run(world, 100);
    const { x, y } = healer;

    run(world, 20);
    expect(healer.x).toBe(x);
    expect(healer.y).toBe(y);
    expect(Math.hypot(healer.x - world.player.x, healer.y - world.player.y)).toBeLessThan(3 * TILE_SIZE);
  });

  it('rejoint Adam d’un bond quand il est resté loin derrière', () => {
    const { world } = barracksWorld();
    const warrior = addCompanion(world, 'warrior');

    world.player.x += (COMPANIONS.teleportRange + 4) * TILE_SIZE;
    world.tick();
    expect(Math.hypot(warrior.x - world.player.x, warrior.y - world.player.y)).toBeLessThan(2 * TILE_SIZE);
  });

  it('ne gêne pas Adam : il marche à travers sa troupe', () => {
    const { world } = barracksWorld();

    for (let i = 0; i < COMPANIONS.max; i += 1) addCompanion(world, 'warrior', 0.3 * i);
    const before = world.player.x;

    world.push({ type: 'setMoveAxis', x: 1, y: 0 });
    run(world, 20);
    expect(world.player.x).toBeGreaterThan(before + TILE_SIZE);
  });
});

describe('combat par classe', () => {
  it('le guerrier va au contact et frappe, sans tirer de flèche', () => {
    const { world } = barracksWorld();
    const warrior = addCompanion(world, 'warrior', -1);
    const mutant = addMutant(world, 5, 4);
    let arrows = 0;

    // L'arc d'Adam est tendu mais jamais prêt : seuls les compagnons agissent.
    world.player.bowCooldown = 9999;
    world.events.on('arrowShot', () => (arrows += 1));
    run(world, 30);
    expect(Math.hypot(warrior.x - mutant.x, warrior.y - mutant.y)).toBeLessThan(2 * TILE_SIZE);
    run(world, 60);
    expect(world.mobiles.has(mutant.id)).toBe(false);
    expect(arrows).toBe(0);
  });

  it('l’archer tire de loin et recule devant l’ennemi qui s’approche', () => {
    const { world } = barracksWorld();
    const archer = addCompanion(world, 'archer', -1);
    const mutant = addMutant(world, 5, 99);
    let arrows = 0;

    world.player.bowCooldown = 9999;
    world.events.on('arrowShot', () => (arrows += 1));
    mutant.x = archer.x + 5 * TILE_SIZE;
    run(world, 40);
    expect(arrows).toBeGreaterThan(0);

    // L'ennemi se colle à lui : l'archer s'écarte.
    mutant.x = archer.x + 1 * TILE_SIZE;
    mutant.y = archer.y;
    const gap = Math.abs(archer.x - mutant.x);

    run(world, 6);
    expect(Math.abs(archer.x - mutant.x)).toBeGreaterThan(gap);
  });

  it('le soigneur ne combat pas : il reste près d’Adam face à l’ennemi', () => {
    const { world } = barracksWorld();
    const healer = addCompanion(world, 'healer', -1);
    const mutant = addMutant(world, 4, 5);
    let arrows = 0;

    world.player.bowCooldown = 9999;
    world.events.on('arrowShot', () => (arrows += 1));
    run(world, 20);
    expect(arrows).toBe(0);
    expect(mutant.hp).toBe(5);
    expect(Math.hypot(healer.x - world.player.x, healer.y - world.player.y)).toBeLessThan(3 * TILE_SIZE);
  });

  it('un ennemi au contact blesse un compagnon, une fois par seconde au plus', () => {
    const { world } = barracksWorld();
    const warrior = addCompanion(world, 'warrior');
    const mutant = addMutant(world, 0, 99);

    mutant.x = warrior.x;
    mutant.y = warrior.y;
    world.player.bowCooldown = 9999;
    world.tick();
    expect(warrior.hp).toBe(COMPANION_CLASSES.warrior.hp - ENEMIES.mutant.damage);
    world.tick();
    expect(warrior.hp).toBe(COMPANION_CLASSES.warrior.hp - ENEMIES.mutant.damage);
  });
});

describe('soin', () => {
  it('le soigneur soigne Adam blessé', () => {
    const { world } = barracksWorld();

    addCompanion(world, 'healer', 1);
    world.player.hp = 4;
    world.player.calmTicks = -9999;
    run(world, COMPANION_CLASSES.healer.healCooldown * 3);
    expect(world.player.hp).toBeGreaterThanOrEqual(6);
    expect(world.player.hp).toBeLessThanOrEqual(PLAYER_MAX_HP);
  });

  it('soigne le compagnon le plus blessé, et seulement ceux à portée', () => {
    const { world } = barracksWorld();
    const healed: (number | string)[] = [];

    world.events.on('companionHealed', ({ who }) => healed.push(who));
    addCompanion(world, 'healer', 1);

    const hurt = addCompanion(world, 'warrior', 2);
    const far = addCompanion(world, 'warrior', 2);

    hurt.hp = 3;
    far.hp = 1;
    far.x += 30 * TILE_SIZE;
    far.prevX = far.x;
    run(world, 5);
    expect(healed[0]).toBe(hurt.id);
    expect(hurt.hp).toBeGreaterThan(3);
  });

  it('ne dépasse jamais les points de vie de la classe', () => {
    const { world } = barracksWorld();
    const warrior = addCompanion(world, 'warrior', 1);

    addCompanion(world, 'healer', 1);
    warrior.hp = COMPANION_CLASSES.warrior.hp - 1;
    run(world, 200);
    expect(warrior.hp).toBe(COMPANION_CLASSES.warrior.hp);
  });
});

describe('sauvegarde', () => {
  it('garde les compagnons — classe, points de vie, position — et la recrue en formation', () => {
    const { world, barracks } = barracksWorld();
    const archer = addCompanion(world, 'archer', 2, 1);

    archer.hp = 3;
    addCompanion(world, 'healer', -2);
    recruit(world, barracks, 'warrior');

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error('sauvegarde illisible');

    const loaded = decoded.world.companions();

    expect(loaded.map((companion) => companion.role)).toEqual(['archer', 'healer']);
    expect(loaded[0]).toMatchObject({ hp: archer.hp, x: archer.x, y: archer.y });
    expect(decoded.world.companionCount()).toBe(3);
    expect(JSON.parse(encodeSave(decoded.world, 0))).toEqual(JSON.parse(encodeSave(world, 0)));

    // La recrue sort quand même, au bon moment.
    const reloaded = decoded.world.entities.get(barracks.id) as Barracks;

    expect(reloaded.training).toEqual(barracks.training);
    run(decoded.world, COMPANION_CLASSES.warrior.trainTicks + 40);
    expect(decoded.world.companions()).toHaveLength(3);
  });

  it('lit une ancienne sauvegarde, d’avant les compagnons', () => {
    const world = new World(100);
    const state = world.snapshot();

    expect(state.mobiles.some((mobile) => mobile.kind === 'companion')).toBe(false);

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error('sauvegarde illisible');
    expect(decoded.world.companions()).toEqual([]);
    expect(decoded.world.companionCount()).toBe(0);
  });

  it('refuse une classe inconnue ou des points de vie impossibles', () => {
    const { world } = barracksWorld();

    addCompanion(world, 'warrior');

    const json = JSON.parse(encodeSave(world, 0)) as { state: { mobiles: { kind: string; role?: string; hp?: number }[] } };
    const companion = json.state.mobiles.find((mobile) => mobile.kind === 'companion')!;

    companion.role = 'dragon';
    expect(decodeSave(JSON.stringify(json)).ok).toBe(false);
    companion.role = 'warrior';
    companion.hp = 999;
    expect(decodeSave(JSON.stringify(json)).ok).toBe(false);
  });
});
