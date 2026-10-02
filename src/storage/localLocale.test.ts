import { describe, expect, it } from 'vitest';
import { LocalSave, SAVE_KEY, type SaveStorage } from './localSave.ts';
import { LOCALE_KEY, LocalLocale } from './localLocale.ts';

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

describe('LocalLocale', () => {
  it('relit la langue choisie, sous sa propre clé', () => {
    const storage = memoryStorage();

    expect(new LocalLocale(storage).load()).toBeNull();
    new LocalLocale(storage).save('en');
    expect(new LocalLocale(storage).load()).toBe('en');
    expect(LOCALE_KEY).not.toBe(SAVE_KEY);
  });

  it('survit à « Recommencer », qui n’efface que la sauvegarde', () => {
    const storage = memoryStorage();

    new LocalLocale(storage).save('fr');
    new LocalSave(storage).clear();
    expect(new LocalLocale(storage).load()).toBe('fr');
  });

  it('ignore une langue inconnue et un stockage hostile', () => {
    const storage = memoryStorage();

    storage.setItem(LOCALE_KEY, 'klingon');
    expect(new LocalLocale(storage).load()).toBeNull();
    expect(new LocalLocale(hostile).load()).toBeNull();
    expect(() => new LocalLocale(hostile).save('en')).not.toThrow();
  });
});
