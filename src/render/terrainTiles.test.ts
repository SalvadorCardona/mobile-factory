import { describe, expect, it } from 'vitest';
import { terrainAt } from '../sim/terrain.ts';
import { BlockTerrain } from './terrainTiles.ts';

const SEED = 7;
const SIZE = 64;

describe('BlockTerrain', () => {
  // Un grand lac à l'ouest du départ, pour la seed 7.
  const terrain = new BlockTerrain(SEED, -48, -30, SIZE, 3);

  it('lit le même sol que la simulation', () => {
    for (let ly = -3; ly < SIZE + 3; ly += 5) {
      for (let lx = -3; lx < SIZE + 3; lx += 5) expect(terrain.kind(lx, ly)).toBe(terrainAt(SEED, -48 + lx, -30 + ly));
    }
  });

  it('mesure la profondeur à la distance de la rive', () => {
    const seen = new Set<number>();

    for (let ly = 0; ly < SIZE; ly += 1) {
      for (let lx = 0; lx < SIZE; lx += 1) {
        const depth = terrain.depth(lx, ly);
        let nearest = Infinity;

        if (terrain.kind(lx, ly) !== 'water') {
          expect(depth).toBe(0);
          continue;
        }
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            if (terrain.kind(lx + dx, ly + dy) !== 'water') nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dy)));
          }
        }
        expect(depth).toBe(nearest === 1 ? 0 : nearest === 2 ? 1 : 2);
        seen.add(depth);
      }
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('ne saute jamais un palier entre deux tuiles voisines', () => {
    for (let ly = 0; ly < SIZE - 1; ly += 1) {
      for (let lx = 0; lx < SIZE - 1; lx += 1) {
        const depth = terrain.depth(lx, ly);

        expect(Math.abs(depth - terrain.depth(lx + 1, ly))).toBeLessThanOrEqual(1);
        expect(Math.abs(depth - terrain.depth(lx, ly + 1))).toBeLessThanOrEqual(1);
      }
    }
  });
});
