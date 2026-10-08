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

  it('pose sous l\'eau la terre de sa rive', () => {
    const seen = new Set<string>();

    for (let ly = 0; ly < SIZE; ly += 1) {
      for (let lx = 0; lx < SIZE; lx += 1) {
        const kind = terrain.kind(lx, ly);
        const ground = terrain.beneath(lx, ly);

        if (kind !== 'water') {
          expect(ground).toBe(kind);
          continue;
        }
        expect(ground).not.toBe('water');

        const near = new Set<string>();

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) if (terrain.kind(lx + dx, ly + dy) !== 'water') near.add(terrain.kind(lx + dx, ly + dy));
        }
        // Une rive : une des terres voisines ; le large : le sable.
        if (near.size > 0) expect(near.has(ground)).toBe(true);
        else expect(ground).toBe('sand');
        seen.add(ground);
      }
    }
    expect(seen.has('sand')).toBe(true);
  });
});
