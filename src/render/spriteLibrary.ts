/**
 * Bibliothèque de sprites : une planche → des images par animation.
 *
 * C'est le seul endroit qui sait d'où viennent les textures. Pour chaque
 * entrée de `data/sprites.ts` :
 * - si `file` est renseigné, la planche PNG est chargée depuis
 *   `public/sprites/` et découpée sur la grille annoncée ;
 * - sinon, le placeholder pixel art de `data/pixelmaps.ts` est baké.
 *
 * Les deux chemins donnent la même chose — `Texture[]` par animation, à
 * l'échelle source — et le reste du rendu ne fait pas la différence. Le jour
 * où un asset généré remplace un placeholder, seul `SPRITES[id].file` change.
 */

import { Assets, Rectangle, Texture, type Renderer } from 'pixi.js';
import { ART_PIXELS_PER_TILE } from '../data/artDirection.ts';
import { TILE_SIZE } from '../core/grid.ts';
import { PIXEL_MAPS } from '../data/pixelmaps.ts';
import { SPRITES, SPRITE_IDS, type AnimationOf, type SpriteId, type SpriteProto } from '../data/sprites.ts';
import { bakePixelMap } from './placeholders.ts';

/** Facteur d'agrandissement des sprites : 16 px source → 32 px écran. */
export const SPRITE_SCALE = TILE_SIZE / ART_PIXELS_PER_TILE;

export interface AnimationFrames {
  textures: Texture[];
  fps: number;
  loop: boolean;
}

export class SpriteLibrary {
  private readonly sheets = new Map<SpriteId, Record<string, Texture[]>>();

  private constructor() {}

  public static async load(renderer: Renderer, baseUrl: string): Promise<SpriteLibrary> {
    const library = new SpriteLibrary();

    await Promise.all(
      SPRITE_IDS.map(async (id) => {
        // Typé `SpriteProto` explicitement : dans `SPRITES`, `file` est `null`
        // partout tant que rien n'est généré, et TypeScript en déduirait que
        // la branche PNG est du code mort.
        const proto: SpriteProto = SPRITES[id];
        const frames = proto.file
          ? sliceSheet(await Assets.load<Texture>(`${baseUrl}sprites/${proto.file}`), proto)
          : bakePixelMap(renderer, PIXEL_MAPS[id]);

        library.sheets.set(id, frames);
      }),
    );

    return library;
  }

  /** Les images d'une animation, dans l'ordre, avec sa cadence. */
  public animation<S extends SpriteId>(id: S, name: AnimationOf<S>): AnimationFrames {
    const proto = SPRITES[id];
    const animation = (proto.animations as Record<string, { fps: number; loop: boolean }>)[name]!;
    const textures = this.sheets.get(id)?.[name];

    if (!textures) throw new Error(`SpriteLibrary : animation ${id}.${name} introuvable`);

    return { textures, fps: animation.fps, loop: animation.loop };
  }

  /** La première image d'une animation — pour tout ce qui ne bouge pas. */
  public still<S extends SpriteId>(id: S, name: AnimationOf<S>): Texture {
    return this.animation(id, name).textures[0]!;
  }

  public destroy(): void {
    for (const sheet of this.sheets.values()) {
      for (const textures of Object.values(sheet)) {
        for (const texture of textures) texture.destroy(true);
      }
    }
    this.sheets.clear();
  }
}

/** Découpe une planche PNG sur la grille : une ligne par animation, une colonne par image. */
function sliceSheet(sheet: Texture, proto: SpriteProto): Record<string, Texture[]> {
  const result: Record<string, Texture[]> = {};

  sheet.source.scaleMode = 'nearest';

  for (const [name, animation] of Object.entries(proto.animations)) {
    result[name] = Array.from(
      { length: animation.frames },
      (_, column) =>
        new Texture({
          source: sheet.source,
          frame: new Rectangle(
            column * proto.frameWidth,
            animation.row * proto.frameHeight,
            proto.frameWidth,
            proto.frameHeight,
          ),
        }),
    );
  }
  return result;
}
