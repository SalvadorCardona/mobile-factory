/** Lecture et écriture PNG pour l'outillage Node. Jamais importé par le jeu. */

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { RgbaImage } from './spriteSheet.ts';

export function readPng(path: string): RgbaImage {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function writePng(path: string, image: RgbaImage): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  writeFileSync(path, PNG.sync.write(png));
}
