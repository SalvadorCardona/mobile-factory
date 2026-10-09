import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { PATCH_SIZE } from '../art/terrain.ts';
import { terrainAt } from '../sim/terrain.ts';
import { patchesIn, sprinkleAt } from './meadow.ts';

const SEED = 7;
const AREA = { left: -2048, top: -2048, right: 2048, bottom: 2048 };

describe('prairie', () => {
  const patches = patchesIn(SEED, AREA.left, AREA.top, AREA.right, AREA.bottom);

  it('tire les mêmes taches à graine égale', () => {
    expect(patchesIn(SEED, AREA.left, AREA.top, AREA.right, AREA.bottom)).toEqual(patches);
    expect(patchesIn(SEED + 1, AREA.left, AREA.top, AREA.right, AREA.bottom)).not.toEqual(patches);
  });

  it('pose des taches claires et denses, de silhouettes et d’échelles variées', () => {
    expect(patches.length).toBeGreaterThan(20);
    expect(new Set(patches.map((patch) => patch.tone))).toEqual(new Set(['meadow', 'thicket']));
    expect(new Set(patches.map((patch) => patch.shape)).size).toBeGreaterThan(1);
    expect(new Set(patches.map((patch) => patch.scale)).size).toBeGreaterThan(3);
  });

  it('ne pose une tache que sur l’herbe : le cœur de son cadre ne touche aucun autre sol', () => {
    for (const patch of patches) {
      const width = PATCH_SIZE.width * patch.scale;
      const height = PATCH_SIZE.height * patch.scale;
      const centre = { tx: Math.floor((patch.x + width / 2) / TILE_SIZE), ty: Math.floor((patch.y + height / 2) / TILE_SIZE) };

      expect(terrainAt(SEED, centre.tx, centre.ty)).toBe('grass');
    }
  });

  it('sème des brins et des fleurettes sur une tuile sur huit environ, hors du coin de la tuile', () => {
    let sown = 0;
    const places = new Set<string>();

    for (let ty = 0; ty < 100; ty += 1) {
      for (let tx = 0; tx < 100; tx += 1) {
        const sprinkle = sprinkleAt(SEED, tx, ty);

        expect(sprinkleAt(SEED, tx, ty)).toEqual(sprinkle);
        if (!sprinkle) continue;
        sown += 1;
        places.add(`${sprinkle.dx},${sprinkle.dy}`);
        // Le cadre de 14 × 12 tient dans la tuile.
        expect(sprinkle.dx + 14).toBeLessThanOrEqual(TILE_SIZE);
        expect(sprinkle.dy + 12).toBeLessThanOrEqual(TILE_SIZE);
      }
    }
    expect(sown / 10_000).toBeGreaterThan(0.08);
    expect(sown / 10_000).toBeLessThan(0.18);
    // Pas une place fixe dans la tuile : l'œil ne retrouve pas la grille.
    expect(places.size).toBeGreaterThan(50);
  });
});
