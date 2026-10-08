import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { mulberry32 } from '../core/rng.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { CHIEF, SPITTER, WILDLIFE, type WildlifeId } from '../data/enemies.ts';
import { ENEMY_BASE, enemyBaseLevel } from '../data/enemyBases.ts';
import type { ItemId } from '../data/items.ts';
import { KILL_PRESTIGE } from '../data/prestige.ts';
import { spit, stepSpit } from './combat.ts';
import { baseCenter, breed, isShielded, isStanding } from './enemyBases.ts';
import { PLAYER_SPEED_TILES } from './player.ts';
import { deserialize, serialize } from './save.ts';
import type { Beast, EnemyBase, EntityId, Fireball, Spit } from './types.ts';
import { stepBeast } from './wildlife.ts';
import { World } from './world.ts';

const STEP = 1 / 20;

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
}

function withTownHall(seed = 7): World {
  const world = new World(seed);

  finish(world, world.townHallId);
  return world;
}

/** La base du premier anneau la plus proche de la mairie. */
function firstRingBase(world: World): EnemyBase {
  const hall = world.entities.get(world.townHallId)!;
  const hx = (hall.tx + hall.width / 2) * TILE_SIZE;
  const hy = (hall.ty + hall.height / 2) * TILE_SIZE;

  return world.enemyBases
    .filter((base) => base.level === 1)
    .sort((a, b) => Math.hypot(baseCenter(a).x - hx, baseCenter(a).y - hy) - Math.hypot(baseCenter(b).x - hx, baseCenter(b).y - hy))[0]!;
}

function guards(world: World, base?: EnemyBase, proto?: WildlifeId): Beast[] {
  return [...world.mobiles.values()].filter(
    (mobile): mobile is Beast =>
      mobile.kind === 'beast' && mobile.guardOf !== undefined && (!base || mobile.guardOf === base.id) && (!proto || mobile.proto === proto),
  );
}

function spits(world: World): Spit[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Spit => mobile.kind === 'spit');
}

function fireballs(world: World): Fireball[] {
  return [...world.mobiles.values()].filter((mobile): mobile is Fireball => mobile.kind === 'fireball');
}

/** Adam en (dx, dy) tuiles du centre de la base, le monde avance d'une seconde : les gardiens sortent. */
function approach(world: World, base: EnemyBase, dx: number, dy: number): void {
  const center = baseCenter(base);

  world.player.x = world.player.prevX = center.x + dx * TILE_SIZE;
  world.player.y = world.player.prevY = center.y + dy * TILE_SIZE;
  for (let i = 0; i < 21; i += 1) world.tick();
}

/** Ne garde de la base que l'espèce voulue — sortie et comptée. */
function only(world: World, base: EnemyBase, keep: WildlifeId): void {
  if (keep !== 'guardian') base.guards = 0;
  if (keep !== 'spitter') base.spitters = 0;
  if (keep !== 'chief') base.chief = 0;
  for (const beast of guards(world, base)) if (beast.proto !== keep) world.mobiles.delete(beast.id);
}

/** Un gardien posé à la main, pour les tests purs de `stepBeast`. */
function beast(proto: WildlifeId, x: number, y: number, state: Beast['state'] = 'chase'): Beast {
  return {
    kind: 'beast',
    id: 1,
    proto,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    hp: WILDLIFE[proto].hp,
    age: 30,
    denId: 0,
    guardOf: 1,
    homeX: 0,
    homeY: 0,
    state,
    dirX: 0,
    dirY: 0,
    wanderTicks: 0,
    attackCooldown: 0,
    ...(proto === 'chief' && { slamCooldown: 0 }),
  };
}

const open = (): boolean => false;

/** Ni arbre ni rocher autour de (x, y) : Adam y marche librement. */
function clearAround(world: World, x: number, y: number): void {
  const cx = Math.floor(x / TILE_SIZE);
  const cy = Math.floor(y / TILE_SIZE);

  for (let ty = cy - 4; ty <= cy + 4; ty += 1) {
    for (let tx = cx - 4; tx <= cx + 4; tx += 1) world.resources.clear(tx, ty);
  }
}

describe('cracheur', () => {
  it('crache sur Adam à portée, après avoir gonflé son jabot, puis attend sa cadence', () => {
    const rng = mulberry32(1);
    const spitter = beast('spitter', 0, 0, 'roam');
    const player = { x: 4 * TILE_SIZE, y: 0 };
    const shots: number[] = [];

    for (let tick = 0; tick < WILDLIFE.spitter.attackTicks * 2 + SPITTER.tellTicks + 2; tick += 1) {
      if (stepBeast(spitter, player, open, 1, rng, STEP).shoots) shots.push(tick);
    }
    // Le premier crachat attend que le jabot soit plein ; les suivants, la cadence.
    expect(shots[0]).toBeGreaterThanOrEqual(SPITTER.tellTicks - 1);
    expect(shots.length).toBeGreaterThanOrEqual(2);
    expect(shots[1]! - shots[0]!).toBe(WILDLIFE.spitter.attackTicks);
  });

  it('ne crache pas hors de portée : il s’approche', () => {
    const rng = mulberry32(1);
    const spitter = beast('spitter', 0, 0);
    // Adam dans la zone, mais à plus de sa portée du cracheur.
    const player = { x: (SPITTER.range + 1.5) * TILE_SIZE, y: 0 };

    for (let tick = 0; tick < 10; tick += 1) expect(stepBeast(spitter, player, open, 1, rng, STEP).shoots).toBe(false);
    expect(spitter.x).toBeGreaterThan(0);
  });

  it('recule quand Adam l’approche de trop près, sans cracher', () => {
    const rng = mulberry32(1);
    const spitter = beast('spitter', 0, 0);

    // Adam le talonne à une tuile et demie : il recule tout du long.
    for (let tick = 0; tick < 20; tick += 1) {
      expect(stepBeast(spitter, { x: spitter.x + 1.5 * TILE_SIZE, y: 0 }, open, 1, rng, STEP).shoots).toBe(false);
    }
    expect(spitter.x).toBeLessThan(-TILE_SIZE);
    // Il recule moins vite qu'Adam ne marche : on le rattrape.
    expect(WILDLIFE.spitter.chargeSpeed).toBeLessThan(PLAYER_SPEED_TILES);
  });

  it('tire moins loin que l’arc d’Adam : on peut l’abattre sans se faire cracher dessus', () => {
    const world = withTownHall();
    const base = firstRingBase(world);

    approach(world, base, 0, 6);
    only(world, base, 'spitter');

    const [spitter] = guards(world, base, 'spitter');

    expect(spitter).toBeDefined();
    world.player.hp = 100;

    // Adam se tient à la portée de son arc, au-delà de celle du crachat, et recule s'il le faut.
    let hurt = 0;

    world.events.on('playerHurt', () => (hurt += 1));
    for (let i = 0; i < 20 * 30 && world.mobiles.has(spitter!.id); i += 1) {
      const dx = world.player.x - spitter!.x;
      const dy = world.player.y - spitter!.y;
      const distance = Math.hypot(dx, dy) / TILE_SIZE;
      const push = distance < SPITTER.range + 0.4 ? 1 : distance > 5.8 ? -1 : 0;

      world.push({ type: 'setMoveAxis', x: (dx / (distance * TILE_SIZE)) * push, y: (dy / (distance * TILE_SIZE)) * push });
      world.tick();
    }
    expect(world.mobiles.has(spitter!.id)).toBe(false);
    expect(base.spitters).toBe(0);
    expect(hurt).toBe(0);
  });
});

describe('crachats', () => {
  it('volent droit vers Adam et le touchent s’il ne bouge pas', () => {
    const glob = spit(9, 1, 0, 0, { x: 4 * TILE_SIZE, y: 0 }, 1);
    let hit = null;

    while (glob.ttl > 0 && hit === null) hit = stepSpit(glob, { x: 4 * TILE_SIZE, y: 14 }, open);
    expect(hit).toBe('player');
  });

  it('s’esquivent : Adam qui s’écarte au pas pendant le vol n’est pas touché', () => {
    const target = { x: 4 * TILE_SIZE, y: 14 };
    const glob = spit(9, 1, 0, 0, { x: target.x, y: 0 }, 1);
    const player = { ...target };
    let hit = null;

    for (let i = 0; glob.ttl > 0 && hit === null; i += 1) {
      player.y += (PLAYER_SPEED_TILES * TILE_SIZE) / 20;
      hit = stepSpit(glob, player, open);
    }
    expect(hit).toBeNull();
    // Ils se voient venir : plus lents que deux pas d'Adam.
    expect(SPITTER.speed).toBeLessThan(PLAYER_SPEED_TILES * 2);
  });

  it('s’écrasent sur un mur au lieu de le traverser', () => {
    const glob = spit(9, 1, 0, 0, { x: 4 * TILE_SIZE, y: 0 }, 1);
    const wall = (x: number): boolean => x >= 2 * TILE_SIZE && x < 3 * TILE_SIZE;
    let hit = null;

    while (glob.ttl > 0 && hit === null) hit = stepSpit(glob, { x: 4 * TILE_SIZE, y: 14 }, wall);
    expect(hit).toBe('wall');
    expect(glob.x).toBeLessThan(3 * TILE_SIZE);
  });

  it('blessent Adam dans le monde, au nom du cracheur, et disparaissent', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const hits: number[] = [];

    approach(world, base, 0, 6);
    only(world, base, 'spitter');

    const [spitter] = guards(world, base, 'spitter');

    // Les boules de feu de la base blessent aussi Adam, mais au nom de la base : on ne compte que les crachats.
    const balls = new Set<number>();

    world.events.on('baseFired', ({ fireball }) => balls.add(fireball));
    world.events.on('playerHurt', ({ by }) => {
      if (!balls.has(by)) hits.push(by);
    });
    world.player.hp = 100;
    // Adam immobile, l'arc au repos : il prend.
    for (let i = 0; i < 20 * 8; i += 1) {
      world.player.bowCooldown = 100;
      world.player.x = spitter!.x;
      world.player.y = spitter!.y + 4 * TILE_SIZE;
      world.tick();
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((id) => id === spitter!.id)).toBe(true);
    expect(spits(world).every((glob) => glob.ttl > 0)).toBe(true);
  });
});

describe('chef de base', () => {
  it('annonce son coup de zone, s’immobilise le temps de lever sa massue, puis frappe le cercle', () => {
    const rng = mulberry32(1);
    const chief = beast('chief', 0, 0);
    const player = { x: 2.5 * TILE_SIZE, y: 0 };
    const first = stepBeast(chief, player, open, 1, rng, STEP);

    expect(first.warns).toBe(true);
    expect(chief.slam).toEqual({ x: player.x, y: player.y, ticks: CHIEF.slam.windupTicks });

    let slam = null;

    for (let i = 0; i < CHIEF.slam.windupTicks && slam === null; i += 1) {
      const step = stepBeast(chief, player, open, 1, rng, STEP);

      expect(chief.x).toBe(0);
      slam = step.slam;
    }
    expect(slam).toEqual({ x: player.x, y: player.y });
    expect(chief.slam).toBeUndefined();
    expect(chief.slamCooldown).toBe(CHIEF.slam.cooldownTicks);
  });

  it('le coup de zone s’esquive : Adam qui sort du cercle n’est pas touché, celui qui reste l’est', () => {
    for (const dodge of [false, true]) {
      const world = withTownHall();
      const base = firstRingBase(world);
      const results: boolean[] = [];

      approach(world, base, 0, 6);
      only(world, base, 'chief');

      const [chief] = guards(world, base, 'chief');

      world.events.on('chiefSlammed', ({ hit }) => results.push(hit));
      world.player.hp = 100;
      chief!.state = 'chase';
      chief!.attackCooldown = 1000;
      world.player.x = world.player.prevX = chief!.x + 2 * TILE_SIZE;
      world.player.y = world.player.prevY = chief!.y;
      clearAround(world, world.player.x, world.player.y);
      for (let i = 0; i < 20 * 3 && results.length === 0; i += 1) {
        world.player.bowCooldown = 100;
        // Il esquive : il marche hors du cercle dès qu'il paraît.
        world.push({ type: 'setMoveAxis', x: 0, y: dodge && chief!.slam ? 1 : 0 });
        world.tick();
      }
      expect(results).toEqual([!dodge]);
      // Assez de temps pour sortir du cercle au pas d'Adam.
      expect((CHIEF.slam.radius * 2 * 20) / (PLAYER_SPEED_TILES * CHIEF.slam.windupTicks)).toBeLessThan(20);
    }
  });

  it('a sa barre de vie : ses points de vie, plus gros que ceux d’un gardien, croissent avec l’anneau', () => {
    const world = withTownHall();
    const base = firstRingBase(world);

    approach(world, base, 0, 6);

    const [chief] = guards(world, base, 'chief');

    expect(chief!.hp).toBe(enemyBaseLevel(1).chief.hp);
    expect(world.beastMaxHp(chief!)).toBe(enemyBaseLevel(1).chief.hp);
    expect(enemyBaseLevel(1).chief.hp).toBeGreaterThan(WILDLIFE.guardian.hp * 4);
    expect(enemyBaseLevel(2).chief.hp).toBeGreaterThan(enemyBaseLevel(1).chief.hp);
    expect(enemyBaseLevel(3).chief.hp).toBeGreaterThan(enemyBaseLevel(2).chief.hp);
    // Plus fort et plus lent qu'un gardien.
    expect(enemyBaseLevel(1).chief.damage).toBeGreaterThan(WILDLIFE.guardian.damage);
    expect(WILDLIFE.chief.attackTicks).toBeGreaterThan(WILDLIFE.guardian.attackTicks);
  });

  it('ne quitte pas sa base, rentre quand Adam fuit et regagne lentement sa vie', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const center = baseCenter(base);
    const leash = WILDLIFE.chief.leashRadius * TILE_SIZE;

    approach(world, base, 0, 6);
    only(world, base, 'chief');

    const [chief] = guards(world, base, 'chief');
    const max = enemyBaseLevel(base.level).chief.hp;

    chief!.hp = base.chief = 10;
    world.player.hp = 100;

    // Adam tourne autour de la zone : le chef le poursuit sans en sortir, et ne se refait pas en combat.
    for (let i = 0; i < 20 * 10; i += 1) {
      const angle = i / 60;

      world.player.bowCooldown = 100;
      world.player.x = center.x + Math.cos(angle) * 9 * TILE_SIZE;
      world.player.y = center.y + Math.sin(angle) * 9 * TILE_SIZE;
      world.tick();
      expect(Math.hypot(chief!.x - center.x, chief!.y - center.y)).toBeLessThanOrEqual(leash + TILE_SIZE);
    }
    expect(chief!.state).toBe('chase');
    expect(base.chief).toBe(10);

    // Adam fuit : le chef rentre, puis se refait, un point toutes les `regenTicks`.
    world.player.x = center.x + (WILDLIFE.chief.giveUpRadius + 2) * TILE_SIZE;
    world.player.y = center.y;
    for (let i = 0; i < 20 * 20; i += 1) world.tick();
    expect(chief!.state).not.toBe('chase');
    expect(Math.hypot(chief!.x - center.x, chief!.y - center.y)).toBeLessThan(leash * 0.6 + TILE_SIZE);
    expect(base.chief).toBeGreaterThan(10);
    expect(base.chief).toBeLessThanOrEqual(10 + (20 * 20) / CHIEF.regenTicks);
    expect(chief!.hp).toBe(base.chief);

    // Rentré, loin : il garde ses points et continue de se refaire, jusqu'au plein.
    world.player.x = center.x + 60 * TILE_SIZE;
    for (let i = 0; i < CHIEF.regenTicks * max; i += 1) world.tick();
    expect(guards(world, base, 'chief')).toHaveLength(0);
    expect(base.chief).toBe(max);
  });

  it('ne part jamais en vague, et ne revient pas une fois abattu', () => {
    const base: EnemyBase = { id: 1, tx: 0, ty: 0, level: 1, hp: 60, raiders: 0, brood: 0, guards: 2, spitters: 1, mend: 0, chief: 0, fire: 70 };

    for (let i = 0; i < 20 * 3600; i += 1) breed(base, 4);
    expect(base.chief).toBe(0);
    expect(isShielded(base)).toBe(false);
  });
});

describe('bouclier et récompense', () => {
  it('la base ne s’entame pas tant que son chef vit ; abattu, il paie, et elle tombe', () => {
    const world = withTownHall();
    const base = firstRingBase(world);
    const level = enemyBaseLevel(base.level);
    const shielded: number[] = [];
    const defeated: number[] = [];
    const loot: ItemId[] = [];

    world.events.on('enemyBaseShielded', ({ id }) => shielded.push(id));
    world.events.on('enemyChiefDefeated', ({ baseId }) => defeated.push(baseId));
    world.events.on('lootDropped', ({ item }) => loot.push(item));
    world.player.gear = base.level;

    // Gardiens et cracheurs ôtés : le chef seul tient le bouclier, rentré.
    only(world, base, 'chief');
    const center = baseCenter(base);

    world.player.x = center.x;
    world.player.y = (base.ty + ENEMY_BASE.height + 1.5) * TILE_SIZE;
    for (const chief of guards(world, base, 'chief')) world.mobiles.delete(chief.id);
    // Adam colle la base, le chef retenu chez lui le temps de voir le bouclier.
    for (let i = 0; i < 20 * 5; i += 1) {
      for (const chief of guards(world, base, 'chief')) world.mobiles.delete(chief.id);
      world.player.hp = 100;
      world.tick();
    }
    expect(base.hp).toBe(level.hp);
    expect(shielded.length).toBeGreaterThan(0);
    expect(isShielded(base)).toBe(true);

    // Le chef sort ; Adam l'abat.
    const prestige = world.prestige;

    for (let i = 0; i < 20 * 60 && isShielded(base); i += 1) {
      world.player.hp = 100;
      world.tick();
    }
    expect(defeated).toEqual([base.id]);
    expect(base.chief).toBe(0);
    expect(world.prestige - prestige).toBe(level.chief.prestige + KILL_PRESTIGE.chief);
    for (const { item, chance } of level.chief.loot) if (chance >= 1) expect(loot).toContain(item);

    // Plus de bouclier : la base tombe sous l'arc.
    for (let i = 0; i < 20 * 120 && isStanding(base); i += 1) {
      world.player.hp = 100;
      world.tick();
    }
    expect(isStanding(base)).toBe(false);
  });
});

describe('sauvegarde', () => {
  it('garde chef, cracheurs, coup annoncé et crachats en vol : la suite est identique', () => {
    const world = withTownHall();
    const base = firstRingBase(world);

    approach(world, base, 0, 5);
    world.player.hp = 100;
    // Adam immobile dans la zone : ça crache et ça cogne.
    for (let i = 0; i < 20 * 6; i += 1) {
      world.player.hp = 100;
      world.tick();
      if (spits(world).length > 0 && guards(world, base, 'chief').some((chief) => chief.slam)) break;
    }

    const copy = deserialize(JSON.parse(JSON.stringify(serialize(world))));

    expect(copy.enemyBases).toEqual(world.enemyBases);
    expect(guards(copy)).toEqual(guards(world));
    expect(spits(copy)).toEqual(spits(world));
    for (let i = 0; i < 20 * 10; i += 1) {
      world.player.hp = copy.player.hp = 100;
      world.tick();
      copy.tick();
    }
    expect(copy.enemyBases).toEqual(world.enemyBases);
    expect(guards(copy)).toEqual(guards(world));
    expect(copy.player).toEqual(world.player);
  });

  it('une ancienne sauvegarde se charge : ses bases debout reçoivent leur chef et leurs cracheurs', () => {
    const world = withTownHall();
    const fallen = world.enemyBases[1]!;

    fallen.hp = 0;

    const state = JSON.parse(JSON.stringify(serialize(world))) as Record<string, unknown>;

    for (const raw of state['enemyBases'] as Record<string, unknown>[]) {
      delete raw['chief'];
      delete raw['spitters'];
    }

    const old = deserialize(state);

    for (const base of old.enemyBases) {
      const level = enemyBaseLevel(base.level);

      expect(base.chief).toBe(isStanding(base) ? level.chief.hp : 0);
      expect(base.spitters).toBe(isStanding(base) ? level.guards.spitters : 0);
    }
    approach(old, firstRingBase(old), 0, 6);
    expect(guards(old, firstRingBase(old), 'chief')).toHaveLength(1);
    for (let i = 0; i < 100; i += 1) old.tick();
  });
});

describe('déterminisme et équilibre', () => {
  it('deux parties de même seed, même chemin, livrent le même combat', () => {
    const run = (): string => {
      const world = withTownHall(42);
      const base = firstRingBase(world);
      const center = baseCenter(base);

      world.player.gear = 1;
      for (let i = 0; i < 20 * 40; i += 1) {
        const angle = i / 80;

        world.player.x = center.x + Math.cos(angle) * 6 * TILE_SIZE;
        world.player.y = center.y + Math.sin(angle) * 6 * TILE_SIZE;
        world.tick();
      }
      return JSON.stringify({ bases: world.enemyBases, guards: guards(world), spits: spits(world), player: world.player.hp, prestige: world.prestige });
    };

    expect(run()).toBe(run());
  });

  it('la première base demande de bouger : Adam immobile tombe, Adam qui esquive la prend avec l’arc cerclé de fer', () => {
    // Immobile, à portée d'arc de la porte : il tombe avant d'avoir abattu le chef.
    const still = withTownHall();
    const target = firstRingBase(still);
    let knockedOut = false;

    still.player.gear = 1;
    still.events.on('playerKnockedOut', () => (knockedOut = true));
    approach(still, target, 0, 4);
    for (let i = 0; i < 20 * 120 && !knockedOut; i += 1) {
      still.player.x = baseCenter(target).x;
      still.player.y = baseCenter(target).y + 4 * TILE_SIZE;
      still.tick();
    }
    expect(knockedOut).toBe(true);
    expect(isShielded(target)).toBe(true);

    // En bougeant : il tient ses distances, sort des cercles, s'écarte des crachats.
    const world = withTownHall();
    const base = firstRingBase(world);
    const center = baseCenter(base);
    let falls = 0;

    world.player.gear = 1;
    world.events.on('playerKnockedOut', () => (falls += 1));
    approach(world, base, 0, 9);
    for (let i = 0; i < 20 * 300 && isStanding(base); i += 1) {
      world.push({ type: 'setMoveAxis', ...kite(world, base, center) });
      world.tick();
    }
    expect(falls).toBe(0);
    expect(isShielded(base)).toBe(false);
    expect(isStanding(base)).toBe(false);
  }, 30_000);
});

/**
 * Le joueur qui s'est préparé : il garde ses distances avec ce qui cogne,
 * sort du cercle d'un coup de zone, s'écarte des crachats en vol, et
 * revient à portée d'arc de ce qui reste — puis de la base.
 */
function kite(world: World, base: EnemyBase, center: { x: number; y: number }): { x: number; y: number } {
  const { player } = world;
  let x = 0;
  let y = 0;
  const away = (fromX: number, fromY: number, weight: number): void => {
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const d = Math.hypot(dx, dy) || 1;

    x += (dx / d) * weight;
    y += (dy / d) * weight;
  };
  const foes = guards(world, base);

  for (const foe of foes) {
    const d = Math.hypot(player.x - foe.x, player.y - foe.y) / TILE_SIZE;

    if (foe.slam && Math.hypot(player.x - foe.slam.x, player.y - foe.slam.y) < (CHIEF.slam.radius + 0.6) * TILE_SIZE) away(foe.slam.x, foe.slam.y, 3);
    if (foe.proto !== 'spitter' && d < CHIEF.slam.range + 0.8) away(foe.x, foe.y, 1.5);
  }
  for (const glob of [...spits(world), ...fireballs(world)]) {
    const d = Math.hypot(player.x - glob.x, player.y - glob.y);

    // De côté, perpendiculaire à sa course ; une boule de feu va plus vite, on la quitte plus tôt.
    if (d < (glob.kind === 'fireball' ? 5 : 3) * TILE_SIZE) {
      const side = (player.x - glob.x) * glob.vy - (player.y - glob.y) * glob.vx >= 0 ? 1 : -1;
      const speed = Math.hypot(glob.vx, glob.vy) || 1;

      x += (-glob.vy / speed) * side * -1.2;
      y += (glob.vx / speed) * side * -1.2;
    }
  }
  if (x === 0 && y === 0) {
    // Rien à fuir : vers la cible la plus proche, jusqu'à bonne portée d'arc.
    const nearest = foes.sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
    const goal = nearest ?? center;
    const d = Math.hypot(player.x - goal.x, player.y - goal.y) / TILE_SIZE;

    if (d > (nearest ? 5 : 6)) away(goal.x, goal.y, -1);
  }

  const length = Math.hypot(x, y);

  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}
