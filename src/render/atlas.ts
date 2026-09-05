/**
 * Textures qui ne sont pas des sprites : le terrain et le joystick.
 *
 * Les sprites — personnage, ressources, bâtiments — passent par
 * `spriteLibrary.ts`. Ici ne restent que les aplats de terrain, bakés dans
 * les chunks, et les deux disques du joystick, dessinés en vectoriel parce
 * qu'ils vivent en pixels écran, pas en pixels monde.
 */

import { Graphics, type Renderer, type Texture } from 'pixi.js';
import type { TerrainKind } from '../sim/terrain.ts';

/**
 * Deux teintes par terrain, choisies tuile par tuile depuis la seed : un
 * aplat uni se lit comme un prototype, deux teintes se lisent comme du
 * pixel art. Palette terne, poussiéreuse — c'est l'après.
 */
export const TERRAIN_COLORS: Record<TerrainKind, readonly [number, number]> = {
  water: [0x2f5d78, 0x2a5570],
  sand: [0xc4ad7f, 0xb9a274],
  grass: [0x5f7f3f, 0x577639],
  rock: [0x6d6f74, 0x64666b],
};

export interface Atlas {
  joystickBase: Texture;
  joystickKnob: Texture;
}

export function createAtlas(renderer: Renderer): Atlas {
  return {
    joystickBase: bake(
      renderer,
      new Graphics().circle(64, 64, 62).fill({ color: 0xffffff, alpha: 0.12 }).stroke({
        width: 2,
        color: 0xffffff,
        alpha: 0.35,
      }),
    ),
    joystickKnob: bake(
      renderer,
      new Graphics().circle(28, 28, 26).fill({ color: 0xffffff, alpha: 0.45 }),
    ),
  };
}

/** Rend un `Graphics` une fois pour toutes et libère la géométrie vectorielle. */
function bake(renderer: Renderer, graphics: Graphics): Texture {
  const texture = renderer.generateTexture({ target: graphics, antialias: true });

  graphics.destroy();
  return texture;
}
