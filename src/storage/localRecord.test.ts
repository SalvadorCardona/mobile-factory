import { describe, expect, it } from 'vitest';
import { World } from '../sim/world.ts';
import { GARDEN_KEY } from './localGarden.ts';
import { LocalRecord, RECORD_KEY } from './localRecord.ts';
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

describe('LocalRecord', () => {
  it('garde le meilleur nombre de nuits, sous sa propre clé', () => {
    const storage = memoryStorage();
    const record = new LocalRecord(storage);

    expect(record.load()).toBe(0);
    expect(record.offer(4)).toBe(4);
    expect(record.offer(2)).toBe(4);
    expect(new LocalRecord(storage).load()).toBe(4);
    expect(RECORD_KEY).not.toBe(SAVE_KEY);
    expect(RECORD_KEY).not.toBe(GARDEN_KEY);
  });

  it('survit à « Recommencer » : effacer la partie ne touche pas au record', () => {
    const storage = memoryStorage();

    new LocalSave(storage).save(new World(3));
    new LocalRecord(storage).offer(7);
    new LocalSave(storage).clear();
    expect(new LocalRecord(storage).load()).toBe(7);
  });

  it('ne lève jamais, et ignore un record illisible', () => {
    const storage = memoryStorage();

    storage.setItem(RECORD_KEY, 'beaucoup');
    expect(new LocalRecord(storage).load()).toBe(0);
    expect(new LocalRecord(hostile).load()).toBe(0);
    expect(new LocalRecord(hostile).offer(3)).toBe(0);
    expect(new LocalRecord(null).offer(3)).toBe(0);
  });
});
