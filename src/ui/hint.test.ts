import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings.ts';
import { EVE, EVE_LINES } from '../data/eve.ts';
import { World } from '../sim/world.ts';
import { tutorialAdvice, tutorialHint, type HintProgress } from './hint.ts';

const FRESH: HintProgress = { harvestedWood: false, harvestedStone: false, delivered: false };

/** Un monde dont la mairie est bâtie : le sac livré, le dernier objet l'achève. */
function builtWorld(): World {
  const world = new World(1);

  world.player.inventory.add('wood', 25);
  world.player.inventory.add('stone', 12);
  world.push({ type: 'transferToSite', id: world.townHallId });
  world.tick();
  return world;
}

describe('tutorialHint', () => {
  it('commence par le bois du chantier de la mairie', () => {
    expect(tutorialHint(new World(1), FRESH, false, 0)).toBe(EVE_LINES.hints.wood);
  });

  it('passe à la tour de guet une fois la mairie bâtie, sans autre action que la livraison', () => {
    const world = new World(1);

    world.player.inventory.add('wood', 25);
    world.player.inventory.add('stone', 12);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();

    expect(world.entities.get(world.townHallId)?.kind).toBe('townHall');
    expect(tutorialHint(world, FRESH, false, 0)).toBe(EVE_LINES.hints.tower);
  });

  it('ne parle jamais d’un bouton « Construire »', () => {
    const world = new World(1);
    const hints: (string | null)[] = [tutorialHint(world, FRESH, false, 0)];

    world.player.inventory.add('wood', 25);
    world.player.inventory.add('stone', 12);
    hints.push(tutorialHint(world, FRESH, false, 0));
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();
    hints.push(tutorialHint(world, FRESH, false, 0));

    for (const hint of hints) expect(hint ?? '').not.toContain('Construire');
  });

  it('envoie chercher du bois, puis de la pierre', () => {
    const world = new World(1);

    expect(tutorialAdvice(world, FRESH, false, 0)?.wants).toBe('wood');
    expect(tutorialAdvice(world, { ...FRESH, harvestedWood: true }, false, 0)?.wants).toBe('stone');
    // La mairie bâtie, le conseil ne réclame plus de matériau.
    expect(tutorialAdvice(builtWorld(), FRESH, false, 0)?.wants).toBeNull();
  });

  it('annonce la forge une fois débloquée, et envoie chercher du charbon', () => {
    const world = builtWorld();

    expect(tutorialAdvice(world, FRESH, true, 0)).toBeNull();

    // Tant qu'Ève annonce son arrivée par radio, c'est elle qui parle d'abord.
    world.night = Math.max(BUILDINGS.forge.unlockNight, EVE.arrivalNight);
    expect(tutorialAdvice(world, FRESH, true, 0)?.wants).toBe('coal');
    // Pendant une vague, l'arc d'abord.
    expect(tutorialAdvice(world, FRESH, true, 3)?.wants).not.toBe('coal');
  });
});
