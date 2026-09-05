/**
 * Placeholders : une carte de pixels → des textures.
 *
 * Chaque caractère de `data/pixelmaps.ts` devient un rectangle d'un pixel,
 * les rectangles sont regroupés par couleur et remplis en un seul `fill()`
 * par couleur, puis le `Graphics` est rendu **une fois** en texture à
 * résolution 1 — pas à la résolution de l'écran. Un pixel source est donc
 * un vrai pixel de texture, et l'agrandissement ×2 en `nearest` donne des
 * pixels nets, sans bavure, exactement comme le fera une planche PNG.
 */

import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { PALETTE } from '../data/artDirection.ts';
import type { PixelMap } from '../data/pixelmaps.ts';

export function bakePixelMap(renderer: Renderer, map: PixelMap): Record<string, Texture[]> {
  const result: Record<string, Texture[]> = {};

  for (const [name, frames] of Object.entries(map.animations)) {
    result[name] = frames.map((rows) => bakeFrame(renderer, rows, map));
  }
  return result;
}

function bakeFrame(renderer: Renderer, rows: readonly string[], map: PixelMap): Texture {
  const graphics = new Graphics();
  const byColor = new Map<number, number[]>();
  const height = rows.length;
  const width = rows[0]?.length ?? 0;

  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x += 1) {
      const char = row[x]!;

      if (char === '.') continue;

      const color = PALETTE[map.palette[char]!];
      let coords = byColor.get(color);

      if (!coords) {
        coords = [];
        byColor.set(color, coords);
      }
      coords.push(x, y);
    }
  }

  // Un rectangle transparent aux dimensions de l'image : la texture garde la
  // taille annoncée même si l'image a des bords vides, et l'ancre reste juste.
  graphics.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0 });

  for (const [color, coords] of byColor) {
    for (let i = 0; i < coords.length; i += 2) {
      graphics.rect(coords[i]!, coords[i + 1]!, 1, 1);
    }
    graphics.fill(color);
  }

  const texture = renderer.generateTexture({
    target: graphics,
    resolution: 1,
    antialias: false,
    textureSourceOptions: { scaleMode: 'nearest' },
  });

  graphics.destroy();
  return texture;
}
