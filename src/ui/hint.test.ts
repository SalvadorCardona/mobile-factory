import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings.ts';
import { World } from '../sim/world.ts';
import { tutorialAdvice, tutorialHint, type HintProgress } from './hint.ts';

const TAP_HINT = 'Tapez le chantier, puis « Construire ».';

const FRESH: HintProgress = { harvestedWood: false, harvestedStone: false, delivered: false, inspected: null };

/** Une partie dont le chantier de la mairie a reçu tout son coût. */
function readyWorld(): World {
  const world = new World(1);
  const hall = world.entities.get(world.townHallId);

  if (hall?.kind !== 'site') throw new Error('la partie ne commence plus sur le chantier de la mairie');
  hall.delivered = { ...BUILDINGS[hall.proto].cost };
  return world;
}

describe('tutorialHint', () => {
  it('ne pousse pas à taper un chantier qui attend encore', () => {
    expect(tutorialHint(new World(1), FRESH, false, 0)).not.toBe(TAP_HINT);
  });

  it('invite à taper le chantier livré', () => {
    expect(tutorialHint(readyWorld(), FRESH, false, 0)).toBe(TAP_HINT);
  });

  it('se tait quand la fenêtre du chantier est ouverte', () => {
    const world = readyWorld();

    expect(tutorialHint(world, { ...FRESH, inspected: world.townHallId }, false, 0)).toBeNull();
  });

  it('revient si la fenêtre ouverte est celle d’un autre bâtiment', () => {
    const world = readyWorld();

    expect(tutorialHint(world, { ...FRESH, inspected: world.townHallId + 1 }, false, 0)).toBe(TAP_HINT);
  });

  it('disparaît une fois la mairie construite', () => {
    const world = readyWorld();

    world.push({ type: 'buildSite', id: world.townHallId });
    world.tick();

    expect(world.entities.get(world.townHallId)?.kind).toBe('townHall');
    expect(tutorialHint(world, FRESH, false, 0)).not.toBe(TAP_HINT);
  });

  it('envoie chercher du bois, puis de la pierre', () => {
    const world = new World(1);

    expect(tutorialAdvice(world, FRESH, false, 0)?.wants).toBe('wood');
    expect(tutorialAdvice(world, { ...FRESH, harvestedWood: true }, false, 0)?.wants).toBe('stone');
    expect(tutorialAdvice(readyWorld(), FRESH, false, 0)?.wants).toBeNull();
  });
});
