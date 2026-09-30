import { describe, expect, it } from 'vitest';

import { gridStep } from './gridNav.ts';

// Six cartes sur trois colonnes :
//   0 1 2
//   3 4 5
// et cinq cartes, dernière ligne incomplète :
//   0 1 2
//   3 4

describe('gridStep', () => {
  it('commence à la première case quand rien n’est sélectionné', () => {
    expect(gridStep(-1, 6, 3, 'down')).toBe(0);
    expect(gridStep(-1, 6, 3, 'left')).toBe(0);
  });

  it('avance et recule d’une case, et s’arrête aux bords', () => {
    expect(gridStep(1, 6, 3, 'right')).toBe(2);
    expect(gridStep(2, 6, 3, 'right')).toBe(3);
    expect(gridStep(5, 6, 3, 'right')).toBe(5);
    expect(gridStep(0, 6, 3, 'left')).toBe(0);
  });

  it('monte et descend d’une ligne', () => {
    expect(gridStep(1, 6, 3, 'down')).toBe(4);
    expect(gridStep(4, 6, 3, 'up')).toBe(1);
    expect(gridStep(4, 6, 3, 'down')).toBe(4);
    expect(gridStep(1, 6, 3, 'up')).toBe(1);
  });

  it('descend sur la dernière carte quand la case du dessous est vide', () => {
    expect(gridStep(2, 5, 3, 'down')).toBe(4);
  });

  it('se comporte comme une liste sur une seule colonne', () => {
    expect(gridStep(0, 4, 1, 'down')).toBe(1);
    expect(gridStep(3, 4, 1, 'down')).toBe(3);
    expect(gridStep(2, 4, 0, 'up')).toBe(1);
  });

  it('ne sélectionne rien dans une grille vide', () => {
    expect(gridStep(0, 0, 3, 'down')).toBe(-1);
  });
});
