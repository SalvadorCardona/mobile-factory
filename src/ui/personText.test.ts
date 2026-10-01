import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings.ts';
import { personText } from './personText.ts';

describe('infobulle d’un habitant', () => {
  it('dit le prénom, l’âge et ce qu’il fait', () => {
    expect(personText('Lina', 12, { kind: 'child', days: 2 })).toBe('Lina, 12 ans · enfant, travaille dans 2 jours');
    expect(personText('Lina', 13, { kind: 'child', days: 1 })).toBe('Lina, 13 ans · enfant, travaille dans 1 jour');
    expect(personText('Tom', 27, { kind: 'working', at: 'drill' })).toBe(`Tom, 27 ans · au travail : ${BUILDINGS.drill.label}`);
    expect(personText('Tom', 27, { kind: 'idle' })).toBe('Tom, 27 ans · sans travail');
    expect(personText('Tom', 27, { kind: 'home' })).toBe('Tom, 27 ans · à la maison');
  });
});
