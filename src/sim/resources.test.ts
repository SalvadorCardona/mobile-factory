import { describe, expect, it } from 'vitest';
import { RESOURCES, type ResourceId } from '../data/resources.ts';
import { ResourceIndex, stageOf } from './resources.ts';
import { resourceAt } from './terrain.ts';

/** Première tuile portant une ressource, en spirale depuis l'origine. */
function firstResource(seed: number): { tx: number; ty: number; id: ResourceId } {
  for (let radius = 0; radius < 80; radius += 1) {
    for (let ty = -radius; ty <= radius; ty += 1) {
      for (let tx = -radius; tx <= radius; tx += 1) {
        const id = resourceAt(seed, tx, ty);

        if (id) return { tx, ty, id };
      }
    }
  }
  throw new Error('aucune ressource — la génération a changé');
}

describe('stageOf', () => {
  it('passe par intact, entamé, disparu', () => {
    const { amount } = RESOURCES.tree;

    expect(stageOf('tree', amount)).toBe('full');
    expect(stageOf('tree', Math.floor(amount / 2))).toBe('damaged');
    expect(stageOf('tree', 0)).toBe('gone');
  });
});

describe('ResourceIndex', () => {
  it('ne retient que les tuiles entamées', () => {
    const index = new ResourceIndex(11);
    const { tx, ty, id } = firstResource(11);

    expect(index.size()).toBe(0);
    expect(index.at(tx, ty)).toEqual({ id, remaining: RESOURCES[id].amount, stage: 'full' });
    expect(index.isSolid(tx, ty)).toBe(true);

    const taken = index.take(tx, ty);

    expect(taken?.resource.remaining).toBe(RESOURCES[id].amount - 1);
    expect(index.size()).toBe(1);
    expect(index.toJSON()).toEqual({ [`${tx},${ty}`]: 1 });
  });

  it('signale le changement d’état, et seulement lui', () => {
    const index = new ResourceIndex(11);
    const { tx, ty, id } = firstResource(11);
    const changes: boolean[] = [];

    for (let i = 0; i < RESOURCES[id].amount; i += 1) {
      changes.push(index.take(tx, ty)!.stageChanged);
    }

    // Une transition vers « entamé », une vers « disparu », rien d'autre.
    expect(changes.filter(Boolean).length).toBe(2);
    expect(changes.at(-1)).toBe(true);
    expect(index.at(tx, ty)).toBeNull();
    expect(index.isSolid(tx, ty)).toBe(false);
    expect(index.take(tx, ty)).toBeNull();
  });

  it('ne prend rien sur une tuile nue', () => {
    const index = new ResourceIndex(11);

    for (let tx = -20; tx < 20; tx += 1) {
      if (resourceAt(11, tx, 0)) continue;

      expect(index.take(tx, 0)).toBeNull();
      expect(index.clear(tx, 0)).toBe(false);
      return;
    }
  });

  it('vide une tuile d’un coup pour le dégagement du spawn', () => {
    const index = new ResourceIndex(11);
    const { tx, ty } = firstResource(11);

    expect(index.clear(tx, ty)).toBe(true);
    expect(index.at(tx, ty)).toBeNull();
  });
});
