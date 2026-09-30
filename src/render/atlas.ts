/**
 * Textures qui ne sont pas des sprites : les deux disques du joystick.
 *
 * Les sprites et le sol passent par `spriteLibrary.ts`. Ici ne reste que le
 * joystick, qui vit en pixels écran, pas en pixels monde — comme sur la
 * maquette : un grand disque blanc voilé, et un bouton blanc, son ombre
 * lavande en bas à droite (le blanc est déjà son propre reflet), sans contour.
 */

import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { PALETTE, hex } from '../data/artDirection.ts';

export interface Atlas {
  joystickBase: Texture;
  joystickKnob: Texture;
}

export function createAtlas(renderer: Renderer): Atlas {
  const white = hex(PALETTE.paper.base);

  return {
    joystickBase: bake(
      renderer,
      new Graphics()
        .circle(64, 64, 62)
        .fill({ color: white, alpha: 0.28 })
        .circle(64, 64, 62)
        .stroke({ width: 5, color: white, alpha: 0.7, alignment: 1 }),
    ),
    joystickKnob: bake(
      renderer,
      new Graphics()
        .circle(28, 28, 26)
        .fill(hex(PALETTE.paper.shade))
        .circle(26.5, 26, 23.5)
        .fill(white),
    ),
  };
}

/** Rend un `Graphics` une fois pour toutes et libère la géométrie vectorielle. */
function bake(renderer: Renderer, graphics: Graphics): Texture {
  const texture = renderer.generateTexture({ target: graphics, antialias: true, resolution: renderer.resolution });

  graphics.destroy();
  return texture;
}
