import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings.ts';
import { Store } from './store.ts';
import type { Entity } from './types.ts';
import { inLogisticRange } from './warehouse.ts';

/** Une mairie finie en (0, 0), et un chantier de 2 × 2 posé en (tx, ty). */
function hall(): Entity {
  return { kind: 'townHall', id: 1, proto: 'townHall', tx: 0, ty: 0, width: 3, height: 3, store: new Store(Infinity), hp: 1, level: 1 };
}

function site(tx: number, ty: number): Entity {
  return { kind: 'site', id: 2, proto: 'farm', tx, ty, width: 2, height: 2, delivered: {} };
}

describe('entrepôt', () => {
  it('ne sert que les chantiers dans son rayon, mesuré de centre à centre', () => {
    const radius = BUILDINGS.townHall.logisticRadius;

    // Centre de la mairie : (1,5 ; 1,5). Centre du chantier : (tx + 1 ; ty + 1).
    expect(inLogisticRange(hall(), site(4, 4))).toBe(true);
    expect(inLogisticRange(hall(), site(radius, 0))).toBe(true);
    expect(inLogisticRange(hall(), site(radius + 1, 0))).toBe(false);
    expect(inLogisticRange(hall(), site(-40, 12))).toBe(false);
  });
});
