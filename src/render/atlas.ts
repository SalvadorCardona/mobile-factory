/**
 * Atlas de substitution.
 *
 * Les assets définitifs seront générés (Nano Banana 2 pour le personnage,
 * Recraft V4 Styles pour les décors) puis empaquetés en un seul atlas. En
 * attendant, on fabrique les textures au lancement avec `generateTexture` :
 * elles sont créées une fois, réutilisées par tous les sprites, et Pixi batche
 * les draw calls parce qu'elles partagent la même source.
 *
 * Le jour où l'atlas existe, seul ce fichier change.
 */

import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { TerrainKind } from '../sim/terrain.ts';

export const TERRAIN_COLORS: Record<TerrainKind, number> = {
  water: 0x2f5d78,
  sand: 0xc8b184,
  grass: 0x4b7a45,
  rock: 0x6d6f74,
};

/** Teinte du minerai peinte par-dessus le terrain, au bake du chunk. */
export const ORE_COLOR = 0x8a5f3d;

export interface Atlas {
  buildings: Record<BuildingId, Texture>;
  player: Texture;
  joystickBase: Texture;
  joystickKnob: Texture;
}

export function createAtlas(renderer: Renderer): Atlas {
  const buildings = {} as Record<BuildingId, Texture>;

  for (const [id, proto] of Object.entries(BUILDINGS) as [BuildingId, (typeof BUILDINGS)[BuildingId]][]) {
    buildings[id] = bake(
      renderer,
      new Graphics()
        .roundRect(1, 1, proto.width * TILE_SIZE - 2, proto.height * TILE_SIZE - 2, 6)
        .fill(proto.tint)
        .stroke({ width: 2, color: 0x2a1e13, alignment: 1 })
        // Repère d'orientation, en attendant le vrai sprite.
        .circle((proto.width * TILE_SIZE) / 2, (proto.height * TILE_SIZE) / 2, TILE_SIZE / 4)
        .fill(0x2a1e13),
    );
  }

  return {
    buildings,
    player: bake(
      renderer,
      new Graphics()
        .circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 2)
        .fill(0xf2e8d5)
        .stroke({ width: 2, color: 0x11161d, alignment: 1 }),
    ),
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
  const texture = renderer.generateTexture(graphics);

  graphics.destroy();
  return texture;
}
