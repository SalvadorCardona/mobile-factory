import { describe, expect, it } from 'vitest';
import { EMPTY_GARDEN } from '../sim/garden.ts';
import { World } from '../sim/world.ts';
import { LocalGarden, GARDEN_KEY } from './localGarden.ts';
import { LocalSave, SAVE_KEY, type SaveStorage } from './localSave.ts';

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();

  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const hostile: SaveStorage = {
  getItem: () => {
    throw new DOMException('refusé', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('plein', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('refusé', 'SecurityError');
  },
};

describe('LocalGarden', () => {
  it('relit le jardin écrit sous sa propre clé', () => {
    const storage = memoryStorage();
    const garden = { seeds: 12, planted: ['woodStart' as const], pure: false };

    expect(new LocalGarden(storage).save(garden)).toBe(true);
    expect(GARDEN_KEY).not.toBe(SAVE_KEY);
    expect(new LocalGarden(storage).load()).toEqual(garden);
  });

  it('survit à « Recommencer » : effacer la partie ne touche pas au jardin', () => {
    const storage = memoryStorage();
    const saves = new LocalSave(storage);
    const gardens = new LocalGarden(storage);

    saves.save(new World(3));
    gardens.save({ seeds: 5, planted: [], pure: true });
    saves.clear();

    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(gardens.load()).toEqual({ seeds: 5, planted: [], pure: true });
  });

  it('un jardin absent ou un stockage qui lève donnent un jardin vide', () => {
    expect(new LocalGarden(memoryStorage()).load()).toEqual(EMPTY_GARDEN);
    expect(new LocalGarden(hostile).load()).toEqual(EMPTY_GARDEN);
    expect(new LocalGarden(hostile).save({ ...EMPTY_GARDEN })).toBe(false);
    expect(new LocalGarden(null).save({ ...EMPTY_GARDEN })).toBe(false);
  });
});
