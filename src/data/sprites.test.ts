import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPng } from '../tools/png.ts';
import {
  downscale,
  normalizeSheet,
  scaleFor,
  sheetSize,
  verifySheet,
  type RgbaImage,
} from '../tools/spriteSheet.ts';
import { PALETTE } from './artDirection.ts';
import { SPRITES, SPRITE_IDS, type SpriteProto } from './sprites.ts';

const ONE_TILE: SpriteProto = {
  file: null,
  frameWidth: 4,
  frameHeight: 4,
  anchorX: 0,
  anchorY: 0,
  animations: { a: { row: 0, frames: 2, fps: 1, loop: false } },
  prompt: '',
};

function solid(width: number, height: number, rgba: [number, number, number, number]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

describe('planches générées', () => {
  /*
   * Le contrat d'un PNG référencé : dimensions exactes de la grille, alpha
   * binaire, couleurs toutes dans PALETTE. C'est ce qui rend la direction
   * artistique vérifiable plutôt que souhaitée.
   */
  for (const id of SPRITE_IDS) {
    // Élargi : aujourd'hui tous les `file` valent null et le type le sait.
    const proto: SpriteProto = SPRITES[id];
    if (proto.file === null) continue;
    it(`${id} : ${proto.file} respecte la grille et la palette`, () => {
      const path = `public/sprites/${proto.file}`;
      expect(existsSync(path), `${path} manquant`).toBe(true);
      expect(verifySheet(readPng(path), proto)).toEqual([]);
    });
  }

  it('calcule la taille de la planche depuis la grille', () => {
    expect(sheetSize(SPRITES.adam)).toEqual({ width: 64, height: 216 });
    expect(sheetSize(SPRITES.townHall)).toEqual({ width: 48, height: 48 });
  });

  it('accepte un multiple entier de la grille et refuse le reste', () => {
    expect(scaleFor(solid(8, 4, [0, 0, 0, 255]), ONE_TILE)).toBe(1);
    expect(scaleFor(solid(32, 16, [0, 0, 0, 255]), ONE_TILE)).toBe(4);
    expect(() => scaleFor(solid(32, 20, [0, 0, 0, 255]), ONE_TILE)).toThrow(/multiple entier/);
    expect(() => scaleFor(solid(12, 6, [0, 0, 0, 255]), ONE_TILE)).toThrow(/multiple entier/);
  });

  it('réduit en nearest, sans mélanger les couleurs', () => {
    const image = solid(4, 4, [10, 20, 30, 255]);
    // Un bloc 2×2 dont le pixel central (1,1) diffère : c'est lui qui gagne.
    image.data.set([200, 100, 50, 255], (1 * 4 + 1) * 4);
    const small = downscale(image, 2);
    expect(small.width).toBe(2);
    expect([...small.data.subarray(0, 4)]).toEqual([200, 100, 50, 255]);
    expect([...small.data.subarray(4, 8)]).toEqual([10, 20, 30, 255]);
  });

  it('binarise l’alpha et ramène chaque couleur à la palette', () => {
    const image = solid(8, 4, [0xe0, 0xb0, 0x80, 255]); // proche de PALETTE.skin
    image.data.set([0, 0, 0, 100], 0); // presque transparent → transparent
    image.data.set([0x9e, 0xf0, 0x1a, 200], 4); // semi-opaque → opaque, radioactive
    const { image: out, report } = normalizeSheet(image, ONE_TILE);
    expect([...out.data.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...out.data.subarray(4, 8)]).toEqual([0x9e, 0xf0, 0x1a, 255]);
    expect([...out.data.subarray(8, 12)]).toEqual([0xe8, 0xb4, 0x8a, 255]);
    expect(report.paletteColors).toBe(2);
    expect(report.coverage).toBeCloseTo(31 / 32);
    expect(verifySheet(out, ONE_TILE)).toEqual([]);
  });

  it('incruste une couleur de fond quand le modèle n’a pas rendu de transparence', () => {
    const image = solid(8, 4, [255, 255, 255, 255]);
    image.data.set([0x6b, 0x8a, 0x3d, 255], 0);
    const { image: out, report } = normalizeSheet(image, ONE_TILE, { keyColor: 0xffffff });
    expect(out.data[3]).toBe(255);
    expect(out.data[7]).toBe(0);
    expect(report.coverage).toBeCloseTo(1 / 32);
  });

  it('signale ce qui ne rentre pas', () => {
    const image = solid(8, 4, [1, 2, 3, 255]);
    image.data[7] = 128;
    const problems = verifySheet(image, ONE_TILE);
    expect(problems.some((p) => p.includes('hors palette'))).toBe(true);
    expect(problems.some((p) => p.includes('semi-transparents'))).toBe(true);
    expect(verifySheet(solid(4, 4, [0, 0, 0, 0]), ONE_TILE)).toEqual([
      'dimensions 4×4, la grille attend 8×4',
      'planche entièrement transparente',
    ]);
  });

  it('la palette n’a pas deux entrées de même couleur', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });
});
