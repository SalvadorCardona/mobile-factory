import { describe, expect, it } from 'vitest';
import { ENEMIES, WILDLIFE } from '../data/enemies.ts';
import { TEST_SCENARIOS } from '../data/testScenario.ts';
import { setLocale } from '../i18n/locale.ts';
import { foeName, nameOf } from '../sim/inhabitants.ts';
import { stageScenario } from '../sim/testScenario.ts';
import type { Beast, Mutant } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { creatureView, isCreature, type Creature } from './creatureView.ts';

/** La petite base de test, le temps que ses ouvriers sortent. */
function base(): World {
  const world = stageScenario(TEST_SCENARIOS.base);

  for (let i = 0; i < 40; i += 1) world.tick();
  return world;
}

function first<K extends Creature['kind']>(world: World, kind: K): Extract<Creature, { kind: K }> {
  const found = [...world.mobiles.values()].find((mobile) => mobile.kind === kind);

  if (!found) throw new Error(`aucun ${kind} dans la base de test`);
  return found as Extract<Creature, { kind: K }>;
}

function mutant(world: World, hp: number): Mutant {
  const hall = world.entities.get(world.townHallId)!;
  const x = hall.tx * 32 - 200;
  const y = hall.ty * 32;
  const foe: Mutant = { kind: 'mutant', id: 9_000, proto: 'mutant', x, y, prevX: x, prevY: y, facing: 'down', moving: true, hp, age: 41, attackCooldown: 0, emerge: 0 };

  world.mobiles.set(foe.id, foe);
  return foe;
}

describe('creatureView', () => {
  it('un habitant : son prénom, son âge, son métier, ce qu’il fait, où il loge — pas de points de vie', () => {
    const world = base();
    const jack = first(world, 'lumberjack');
    const view = creatureView(world, jack);
    const camp = world.entities.get(jack.homeId)!;

    expect(view.name).toBe(nameOf(world.seed, jack.id));
    expect(view.age).toBe(jack.age);
    expect(view.portrait).toBe('lumberjack');
    expect(view.hp).toBeNull();
    expect(view.lines[0]).toBe('Bûcheron');
    expect(camp.proto).toBe('lumberCamp');
    expect(view.lines).toContain('Logé : Cabane de bûcheron');
  });

  it('dit ce que porte un bûcheron qui rentre', () => {
    const world = base();
    const jack = first(world, 'lumberjack');

    jack.load = 3;
    expect(creatureView(world, jack).carry).toEqual({ item: 'wood', amount: 3 });
    expect(creatureView(world, jack).lines.at(-1)).toBe('Porte : 3 bois');
  });

  it('un mutant : son surnom, son âge, son espèce, ses points de vie et sa cible', () => {
    const world = base();
    const foe = mutant(world, 2);
    const view = creatureView(world, foe);

    expect(view.name).toBe(foeName(world.seed, foe.id));
    expect(view.age).toBe(41);
    expect(view.portrait).toBe('mutant');
    expect(view.hp).toEqual({ value: 2, max: ENEMIES.mutant.hp });
    expect(view.lines).toEqual(['Mutant radioactif', 'Marche sur : Mairie']);
  });

  it('une bête : son espèce et son humeur', () => {
    const world = base();
    const wolf: Beast = {
      kind: 'beast', id: 9_001, proto: 'wolf', x: 0, y: 0, prevX: 0, prevY: 0, facing: 'down', moving: false,
      hp: 1, age: 4, denId: 0, homeX: 0, homeY: 0, state: 'chase', dirX: 0, dirY: 0, wanderTicks: 0, attackCooldown: 0,
    };

    expect(creatureView(world, wolf)).toMatchObject({ age: 4, hp: { value: 1, max: WILDLIFE.wolf.hp }, lines: ['Loup indigo', 'Charge Adam !'] });
  });

  it('parle anglais quand la langue change', () => {
    const world = base();

    setLocale('en');
    try {
      expect(creatureView(world, mutant(world, 3)).lines).toEqual(['Radioactive mutant', 'Marching on: Town hall']);
    } finally {
      setLocale('fr');
    }
  });

  it('n’ouvre que les habitants et les ennemis', () => {
    const world = base();

    expect(isCreature(first(world, 'worker'))).toBe(true);
    expect(isCreature(mutant(world, 3))).toBe(true);
    expect([...world.mobiles.values()].filter((mobile) => mobile.kind === 'eve' || mobile.kind === 'pickup').some(isCreature)).toBe(false);
  });
});
