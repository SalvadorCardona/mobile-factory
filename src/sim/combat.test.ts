import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { ENEMIES } from '../data/enemies.ts';
import { WEAPONS } from '../data/weapons.ts';
import { shoot, stepArrow } from './combat.ts';
import type { Mutant } from './types.ts';

function mutantAt(x: number, y: number): Mutant {
  return {
    kind: 'mutant',
    id: 1,
    proto: 'mutant',
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    hp: ENEMIES.mutant.hp,
    attackCooldown: 0,
    emerge: 0,
  };
}

/** Vole jusqu'à toucher ou se perdre ; renvoie vrai si la flèche a touché. */
function flies(fromX: number, fromY: number, target: Mutant): boolean {
  const arrow = shoot(2, 'bow', fromX, fromY, target);

  while (arrow.ttl > 0) {
    if (stepArrow(arrow, [target])) return true;
  }
  return false;
}

describe('flèches', () => {
  it('ne traversent jamais un mutant immobile, quel que soit l’angle ou la distance', () => {
    const range = WEAPONS.bow.range * TILE_SIZE;
    let misses = 0;

    // La flèche avance plus vite par tick que la boîte n'est large : sans test
    // balayé, elle sautait par-dessus la cible une fois sur deux.
    for (let angle = 0; angle < 64; angle += 1) {
      for (const distance of [1.5 * TILE_SIZE, range / 2, range - 4]) {
        const theta = (angle / 64) * Math.PI * 2;
        const target = mutantAt(0, 0);
        // Tir depuis la poitrine d'Adam, comme dans `World`.
        const fromX = Math.cos(theta) * distance;
        const fromY = Math.sin(theta) * distance;

        if (!flies(fromX, fromY, target)) misses += 1;
      }
    }
    expect(misses).toBe(0);
  });

  it('ratent un mutant qui n’est pas sur leur trajet', () => {
    const arrow = shoot(2, 'bow', 0, 0, { x: 200, y: 0 });
    const aside = mutantAt(100, 80);

    while (arrow.ttl > 0) expect(stepArrow(arrow, [aside])).toBeNull();
  });
});
