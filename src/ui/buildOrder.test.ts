import { describe, expect, it } from 'vitest';
import { MENU_BUILDING_IDS, type BuildingId } from '../data/buildings.ts';
import { buildOrder } from './buildOrder.ts';

const never = (): boolean => false;
const always = (): boolean => true;

describe('buildOrder', () => {
  it('le jour, sans rien dans le sac : l’ordre des données', () => {
    expect(buildOrder(MENU_BUILDING_IDS, { threat: false, locked: never, affordable: never })).toEqual(MENU_BUILDING_IDS);
  });

  it('au crépuscule et la nuit, la tour de guet passe en tête', () => {
    const order = buildOrder(MENU_BUILDING_IDS, { threat: true, locked: never, affordable: never });

    expect(order[0]).toBe('watchtower');
  });

  it('même la nuit, une tour grisée ne passe pas devant une carte qu’on peut choisir', () => {
    const order = buildOrder(MENU_BUILDING_IDS, { threat: true, locked: (id) => id === 'watchtower', affordable: always });

    expect(order.at(-1)).toBe('watchtower');
  });

  it('ce qu’on peut payer d’abord, puis le reste, les cartes grisées au bout', () => {
    const affordable = new Set<BuildingId>(['farm', 'watchtower']);
    const locked = new Set<BuildingId>(['lumberCamp']);
    const order = buildOrder(MENU_BUILDING_IDS, {
      threat: false,
      locked: (id) => locked.has(id),
      affordable: (id) => affordable.has(id),
    });

    expect(order.slice(0, 2)).toEqual(['farm', 'watchtower']);
    expect(order.at(-1)).toBe('lumberCamp');
    expect([...order].sort()).toEqual([...MENU_BUILDING_IDS].sort());
  });
});
