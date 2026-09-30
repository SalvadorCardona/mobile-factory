import { describe, expect, it } from 'vitest';
import { INVENTORY_CAPACITY } from '../sim/player.ts';
import { clock, effectLine, statusLine } from './researchText.ts';

describe('textes du panneau Recherche', () => {
  it('dit l’effet chiffré, sans et avec la recherche', () => {
    expect(effectLine('sharpArrows', [])).toBe('Dégâts de l’arc : 1 → 1,5');
    expect(effectLine('quickDraw', ['sharpArrows'])).toBe('Délai entre deux flèches : 0,7 s → 0,5 s');
    expect(effectLine('bigBag', [])).toBe(`Places du sac : ${INVENTORY_CAPACITY} → ${INVENTORY_CAPACITY + 15}`);
    expect(effectLine('sharpAxes', [])).toBe('Bois récolté en plus : 0 % → +50 %');
    expect(effectLine('walkingBoots', [])).toBe('Vitesse d’Adam : 4,5 cases/s → 5,4 cases/s');
  });

  it('compte les places du jardin dans le sac qu’Adam porte', () => {
    expect(effectLine('bigBag', [], ['bigBag'])).toBe(`Places du sac : ${INVENTORY_CAPACITY + 10} → ${INVENTORY_CAPACITY + 25}`);
  });

  it('une recherche finie dit ce qu’elle a changé, pas un second cran', () => {
    expect(effectLine('sharpArrows', ['sharpArrows'])).toBe('Dégâts de l’arc : 1 → 1,5');
  });

  it('nomme le prérequis qui manque', () => {
    expect(statusLine('quickDraw', 'locked', [])).toBe('Requiert : Flèches à croc');
    expect(statusLine('sharpArrows', 'done', ['sharpArrows'])).toBe('Terminée');
    expect(statusLine('sharpArrows', 'running', [], 20 * 65)).toBe('En cours — encore 1 min 05 s');
  });

  it('écrit le temps en minutes et secondes', () => {
    expect(clock(20 * 42)).toBe('42 s');
    expect(clock(20 * 60)).toBe('1 min 00 s');
  });
});
