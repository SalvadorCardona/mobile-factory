import { describe, expect, it } from 'vitest';
import { terrainAt } from '../sim/terrain.ts';
import { FIELD_TEXELS, fieldSize, waterField } from './waterField.ts';

const SEED = 7;
const SIZE = 16;
// Un grand lac à l'ouest du départ, pour la seed 7 : le bloc (-2, -1) en a le large et la rive.
const BX = -2;
const BY = -1;

const wet = (tx: number, ty: number): boolean => terrainAt(SEED, tx, ty) === 'water';

/** Niveau (canal 0) ou profondeur (canal 1) au nœud (k, j), entre 0 et 1. */
function at(data: Uint8Array, size: number, k: number, j: number, channel: 0 | 1): number {
  return data[(j * size + k) * 4 + channel]! / 255;
}

describe("champ de l'eau", () => {
  const field = waterField(SEED, BX * SIZE, BY * SIZE, SIZE)!;

  it('a la taille du bloc, bords compris, et ne change pas à graine égale', () => {
    expect(field).not.toBeNull();
    expect(field.size).toBe(fieldSize(SIZE));
    expect(field.data.length).toBe(field.size * field.size * 4);
    expect(waterField(SEED, BX * SIZE, BY * SIZE, SIZE)).toEqual(field);
  });

  it("ne peint que l'eau et ses voisines", () => {
    const painted = new Set(field.tiles.map(([lx, ly]) => `${lx},${ly}`));
    let water = 0;

    for (let ly = 0; ly < SIZE; ly += 1) {
      for (let lx = 0; lx < SIZE; lx += 1) {
        const tx = BX * SIZE + lx;
        const ty = BY * SIZE + ly;
        let near = false;

        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) near ||= wet(tx + dx, ty + dy);
        expect(painted.has(`${lx},${ly}`)).toBe(near);
        if (wet(tx, ty)) water += 1;
      }
    }
    // Le bloc a bien une rive : de l'eau et de la terre.
    expect(water).toBeGreaterThan(0);
    expect(painted.size).toBeLessThan(SIZE * SIZE + 1);
  });

  it("n'a pas de champ là où il n'y a pas d'eau", () => {
    // À l'est du départ, la prairie.
    expect(waterField(SEED, 3 * SIZE, 0, SIZE)).toBeNull();
  });

  it("dit l'eau au cœur des tuiles d'eau, la terre au cœur des tuiles à sec", () => {
    for (let ly = 0; ly < SIZE; ly += 1) {
      for (let lx = 0; lx < SIZE; lx += 1) {
        const tx = BX * SIZE + lx;
        const ty = BY * SIZE + ly;
        let same = true;

        // Une tuile dont tout le voisinage est du même sol : le flou ne l'atteint pas.
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) same &&= wet(tx + dx, ty + dy) === wet(tx, ty);
        if (!same) continue;

        const centre = lx * FIELD_TEXELS + FIELD_TEXELS / 2;
        const level = at(field.data, field.size, centre, ly * FIELD_TEXELS + FIELD_TEXELS / 2, 0);

        expect(level).toBeCloseTo(wet(tx, ty) ? 1 : 0, 2);
      }
    }
  });

  it('passe la rive entre une tuile d’eau et une tuile à sec côte à côte', () => {
    let checked = 0;

    for (let ly = 1; ly < SIZE - 1; ly += 1) {
      for (let lx = 1; lx < SIZE - 2; lx += 1) {
        const tx = BX * SIZE + lx;
        const ty = BY * SIZE + ly;

        // Un bord droit : deux colonnes, eau à gauche et terre à droite, sur trois rangées.
        const straight = [-1, 0, 1].every((dy) => wet(tx, ty + dy) && !wet(tx + 1, ty + dy));

        if (!straight) continue;

        const j = ly * FIELD_TEXELS + FIELD_TEXELS / 2;
        const water = at(field.data, field.size, lx * FIELD_TEXELS + FIELD_TEXELS / 2, j, 0);
        const land = at(field.data, field.size, (lx + 1) * FIELD_TEXELS + FIELD_TEXELS / 2, j, 0);
        const edge = at(field.data, field.size, (lx + 1) * FIELD_TEXELS, j, 0);

        expect(water).toBeGreaterThan(0.5);
        expect(land).toBeLessThan(0.5);
        expect(edge).toBeCloseTo(0.5, 1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('se fonce en continu de la rive vers le large', () => {
    let deepest = 0;

    for (let j = 0; j < field.size; j += 1) {
      for (let k = 0; k < field.size; k += 1) {
        const depth = at(field.data, field.size, k, j, 1);

        deepest = Math.max(deepest, depth);
        // Pas de palier : deux nœuds voisins diffèrent de peu.
        if (k > 0) expect(Math.abs(depth - at(field.data, field.size, k - 1, j, 1))).toBeLessThan(0.1);
        if (j > 0) expect(Math.abs(depth - at(field.data, field.size, k, j - 1, 1))).toBeLessThan(0.1);
      }
    }
    expect(deepest).toBeGreaterThan(0.8);
  });

  it('raccorde deux blocs voisins sans couture', () => {
    const right = waterField(SEED, (BX + 1) * SIZE, BY * SIZE, SIZE);
    const below = waterField(SEED, BX * SIZE, (BY + 1) * SIZE, SIZE);
    const last = field.size - 1;

    for (let i = 0; i < field.size; i += 1) {
      for (const channel of [0, 1] as const) {
        if (right) expect(at(right.data, right.size, 0, i, channel)).toBe(at(field.data, field.size, last, i, channel));
        if (below) expect(at(below.data, below.size, i, 0, channel)).toBe(at(field.data, field.size, i, last, channel));
      }
    }
    expect(right ?? below).not.toBeNull();
  });
});
