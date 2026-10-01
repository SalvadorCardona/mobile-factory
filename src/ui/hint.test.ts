import { describe, expect, it } from 'vitest';
import { BUILDINGS, REPAIR } from '../data/buildings.ts';
import { EVE, EVE_LINES } from '../data/eve.ts';
import { OBJECTIVES } from '../data/objectives.ts';
import { World } from '../sim/world.ts';
import { INVENTORY_CAPACITY } from '../sim/player.ts';
import { harvestRefusedText, tutorialAdvice, tutorialHint, uselessBagHint, type HintProgress } from './hint.ts';

const FRESH: HintProgress = { harvestedWood: false, harvestedStone: false, delivered: false, repaired: false };

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

  it('envoie poser une carrière quand la pierre manque en ville, et laisse parler l’objectif dès qu’il y en a', () => {
    const world = builtWorld();

    expect(world.townStock()!.available('stone')).toBe(0);
    expect(tutorialHint(world, FRESH, true, 0)).toBe(EVE_LINES.hints.quarry);
    // Pendant une vague, l'arc d'abord.
    expect(tutorialHint(world, FRESH, true, 1)).not.toBe(EVE_LINES.hints.quarry);

    world.townStock()!.add('stone', 1);
    expect(tutorialHint(world, FRESH, true, 0)).toBe(OBJECTIVES[1].hint);
  });

  it('apprend à réparer la mairie abîmée entre deux vagues, tant qu’Ève n’est pas là', () => {
    const world = builtWorld();
    const hall = world.entities.get(world.townHallId);

    if (hall?.kind !== 'townHall') throw new Error('la mairie devrait être bâtie');
    world.townStock()!.add('stone', 1);
    hall.hp -= REPAIR.hp;

    // Pas de bois sous la main : Ève envoie en chercher.
    world.player.inventory.remove('wood', world.player.inventory.count('wood'));
    world.townStock()!.remove('wood', world.townStock()!.available('wood'));
    expect(tutorialAdvice(world, FRESH, true, 0)).toEqual({ text: EVE_LINES.hints.repairFetch, wants: REPAIR.item });

    world.player.inventory.add(REPAIR.item, 1);
    expect(tutorialHint(world, FRESH, true, 0)).toBe(EVE_LINES.hints.repair);
    // Pendant la vague, l'arc d'abord ; une fois qu'Adam sait réparer, elle se tait
    // et c'est l'objectif en cours qui parle.
    expect(tutorialHint(world, FRESH, true, 1)).not.toBe(EVE_LINES.hints.repair);
    expect(tutorialHint(world, { ...FRESH, repaired: true }, true, 0)).toBe(OBJECTIVES[world.objective]?.hint);
  });

  it('annonce la forge une fois débloquée, et envoie chercher du charbon', () => {
    const world = builtWorld();

    // De la pierre en ville : Ève ne parle pas de carrière, c'est l'objectif en cours qui parle.
    world.townStock()!.add('stone', 1);
    expect(world.objective).toBe(1);
    expect(tutorialAdvice(world, FRESH, true, 0)).toEqual({ text: OBJECTIVES[1].hint, wants: null });

    // Tant qu'Ève annonce son arrivée par radio, c'est elle qui parle d'abord.
    world.night = Math.max(BUILDINGS.forge.unlockNight, EVE.arrivalNight);
    expect(tutorialAdvice(world, FRESH, true, 0)?.wants).toBe('coal');
    // Pendant une vague, l'arc d'abord.
    expect(tutorialAdvice(world, FRESH, true, 3)?.wants).not.toBe('coal');
  });
});

describe('conseil du sac plein', () => {
  const USELESS = /^Ton sac est plein de bois, Adam : pose un chantier qui en a besoin/;
  const DELIVER = EVE_LINES.hints.bagFull;

  /** Une partie dont la mairie a déjà reçu tout son bois. */
  function woodDelivered(): World {
    const world = new World(1);
    const hall = world.entities.get(world.townHallId);

    if (hall?.kind !== 'site') throw new Error('la partie ne commence plus sur le chantier de la mairie');
    hall.delivered = { wood: BUILDINGS.townHall.cost.wood };
    return world;
  }

  it('dit que le sac plein de bois ne sert à aucun chantier', () => {
    const world = woodDelivered();

    world.player.inventory.add('wood', INVENTORY_CAPACITY);

    expect(tutorialHint(world, FRESH, false, 0)).toMatch(USELESS);
    expect(tutorialHint(world, FRESH, false, 0)).not.toMatch(/chantier !/);
  });

  it('nomme l’objet qui prend le plus de place', () => {
    const world = woodDelivered();

    world.player.inventory.add('coal', 20);
    world.player.inventory.add('wood', INVENTORY_CAPACITY - 20);

    expect(uselessBagHint(world)).toMatch(USELESS);
  });

  it('envoie livrer quand le sac plein contient ce que le chantier attend', () => {
    const world = woodDelivered();

    world.player.inventory.add('wood', INVENTORY_CAPACITY - 1);
    world.player.inventory.add('stone', 1);

    expect(uselessBagHint(world)).toBeNull();
    expect(tutorialHint(world, FRESH, false, 0)).toBe(DELIVER);
  });

  it('se tait tant que le sac n’est pas plein', () => {
    const world = woodDelivered();

    world.player.inventory.add('wood', INVENTORY_CAPACITY - 1);

    expect(uselessBagHint(world)).toBeNull();
  });

  it('se tait une fois la mairie debout : tout se dépose en ville', () => {
    const world = builtWorld();

    world.player.inventory.add('coal', INVENTORY_CAPACITY);

    expect(uselessBagHint(world)).toBeNull();
  });

  /*
   * Le playtest du 30/09/2026 : sac à 30 bois, mairie à 0/20, et le refus de
   * récolte disait « aucun chantier n'en attend plus ».
   */
  it('refuse la récolte sans dire « aucun chantier » tant qu’un chantier attend l’objet', () => {
    const world = new World(1);

    world.player.inventory.add('wood', world.carryLimit('wood'));
    expect(world.wanted('wood')).toBeGreaterThan(0);
    expect(harvestRefusedText('wood', world.wanted('wood'))).not.toMatch(/aucun chantier/);
    expect(harvestRefusedText('wood', world.wanted('wood'))).toBe('Assez de bois dans le sac pour les chantiers — allez les livrer');
  });

  it('dit que la ville en a assez, quand c’est elle qui refuse', () => {
    expect(harvestRefusedText('wood', 0, true)).toBe('La ville a assez de bois — Adam n’en ramasse plus en passant');
  });

  it('dit « aucun chantier » quand plus personne n’attend l’objet', () => {
    const world = new World(1);

    expect(world.wanted('coal')).toBe(0);
    expect(harvestRefusedText('coal', world.wanted('coal'))).toBe('Assez de charbon : aucun chantier n’en attend plus');
  });
});
