import { describe, expect, it } from 'vitest';
import { LocalSave, SAVE_KEY, type SaveStorage } from './localSave.ts';
import { LocalZoom, ZOOM_KEY } from './localZoom.ts';

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

describe('LocalZoom', () => {
  it('relit le niveau mémorisé, sous sa propre clé', () => {
    const storage = memoryStorage();

    expect(new LocalZoom(storage).load()).toBeNull();
    new LocalZoom(storage).save(1.25);
    expect(new LocalZoom(storage).load()).toBe(1.25);
    expect(ZOOM_KEY).not.toBe(SAVE_KEY);
  });

  it('survit à « Recommencer », qui n’efface que la sauvegarde', () => {
    const storage = memoryStorage();

    new LocalZoom(storage).save(0.8);
    new LocalSave(storage).clear();
    expect(new LocalZoom(storage).load()).toBe(0.8);
  });

  it('ignore une valeur illisible et un stockage hostile', () => {
    const storage = memoryStorage();

    storage.setItem(ZOOM_KEY, 'beaucoup');
    expect(new LocalZoom(storage).load()).toBeNull();
    expect(new LocalZoom(hostile).load()).toBeNull();
    expect(() => new LocalZoom(hostile).save(1)).not.toThrow();
  });
});
