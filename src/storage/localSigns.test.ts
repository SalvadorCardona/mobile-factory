import { describe, expect, it } from 'vitest';
import { LocalSave, SAVE_KEY, type SaveStorage } from './localSave.ts';
import { LocalSigns, SIGNS_KEY } from './localSigns.ts';
import { ZOOM_KEY } from './localZoom.ts';

function memoryStorage(): SaveStorage {
  const data = new Map<string, string>();

  return {
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

describe('LocalSigns', () => {
  it('affiche les pancartes par défaut, et retient qu’on les a masquées', () => {
    const storage = memoryStorage();

    expect(new LocalSigns(storage).load()).toBe(true);
    new LocalSigns(storage).save(false);
    expect(new LocalSigns(storage).load()).toBe(false);
    new LocalSigns(storage).save(true);
    expect(new LocalSigns(storage).load()).toBe(true);
    expect(SIGNS_KEY).not.toBe(SAVE_KEY);
    expect(SIGNS_KEY).not.toBe(ZOOM_KEY);
  });

  it('survit à « Recommencer », qui n’efface que la sauvegarde', () => {
    const storage = memoryStorage();

    new LocalSigns(storage).save(false);
    new LocalSave(storage).clear();
    expect(new LocalSigns(storage).load()).toBe(false);
  });

  it('résiste à un stockage hostile', () => {
    expect(new LocalSigns(hostile).load()).toBe(true);
    expect(() => new LocalSigns(hostile).save(false)).not.toThrow();
    expect(new LocalSigns(null).load()).toBe(true);
  });
});
