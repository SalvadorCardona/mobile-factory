import { describe, expect, it } from 'vitest';
import { hash3, mulberry32, noise2 } from './rng.ts';

describe('mulberry32', () => {
  it('rejoue exactement la même suite pour la même seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);

    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b());
  });

  it('reste dans [0, 1[', () => {
    const rng = mulberry32(7);

    for (let i = 0; i < 10_000; i += 1) {
      const value = rng();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('hash3', () => {
  it('est déterministe', () => {
    expect(hash3(1, 2, 3)).toBe(hash3(1, 2, 3));
  });

  /*
   * Régression. Sans la finalisation murmur3, le troisième argument n'atteint
   * pas les bits de poids fort : `hash3(s, x, y)` variait à peine avec `y`,
   * les gisements s'alignaient en bandes verticales et le terrain se rayait
   * en colonnes. On mesure ici la corrélation le long de chaque axe.
   */
  it('décorrèle ses trois arguments', () => {
    for (const axis of [0, 1, 2]) {
      const values: number[] = [];

      for (let i = 0; i < 512; i += 1) {
        const args: [number, number, number] = [7, 7, 7];

        args[axis] = i;
        values.push(hash3(...args) / 4294967296);
      }

      // Variation moyenne entre deux valeurs consécutives : une suite bien
      // mélangée est autour de 1/3, une suite corrélée s'écroule vers 0.
      let jump = 0;

      for (let i = 1; i < values.length; i += 1) {
        jump += Math.abs(values[i]! - values[i - 1]!);
      }

      expect(jump / (values.length - 1)).toBeGreaterThan(0.25);
    }
  });

  it('couvre l’intervalle [0, 1[ dans noise2', () => {
    let min = 1;
    let max = 0;

    for (let x = 0; x < 200; x += 1) {
      for (let y = 0; y < 200; y += 1) {
        const value = noise2(11, x, y);

        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }

    expect(min).toBeLessThan(0.01);
    expect(max).toBeGreaterThan(0.99);
  });
});
