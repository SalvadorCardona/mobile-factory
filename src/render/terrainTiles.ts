/**
 * Tileset du sol : les SVG de `art/terrain.ts`, rangés dans l'atlas.
 *
 * Ce module fait le lien entre les tuiles dessinées (variantes, transitions,
 * coins arrondis, ombres portées) et les textures de `SpriteLibrary` : il
 * déclare les images à rastériser au chargement, puis les retrouve par sol,
 * par côté, par coin.
 *
 * Choix d'une tuile, tout seedé : l'herbe n'a qu'un aplat, sans damier —
 * sa vie vient des taches, des brins et des chemins que le bake pose
 * par-dessus (`chunkLayer.ts`) ; les autres sols tirent une variante, la
 * sobre le plus souvent — un sol trop chargé fatigue l'œil et noie les
 * ressources. L'eau tire la sienne parmi celles de sa profondeur
 * (`BlockTerrain.depth`).
 */

import type { Texture } from 'pixi.js';
import { GROUND, type Ground } from '../data/artDirection.ts';
import {
  GROUND_TILES,
  MEADOW_PATCHES,
  MEADOW_SPRINKLES,
  PATCH_SIZE,
  SHADOW_SIZE,
  TRAIL_DOTS,
  TRAIL_WIDTH,
  WATER_DEPTH_COLORS,
  WATER_SPRITES,
  WATER_TILES,
  cornerTile,
  edgeTile,
  shadowTile,
  type Corner,
  type MeadowSprinkle,
  type PatchTone,
  type Side,
  type WaterDepth,
  type WaterSprite,
} from '../art/terrain.ts';
import { ROAD_TILES } from '../art/road.ts';
import { hash3 } from '../core/rng.ts';
import { terrainAt, type TerrainKind } from '../sim/terrain.ts';
import type { SpriteLibrary, SvgSource } from './spriteLibrary.ts';

export type { Corner, Side, WaterDepth };

export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];
export const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];

/** Décalage vers la tuile voisine de chaque côté. */
export const SIDE_OFFSET: Record<Side, readonly [number, number]> = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

/** Les deux voisins orthogonaux qui décident si un coin est saillant : vertical, puis horizontal. */
export const CORNER_SIDES: Record<Corner, readonly [Side, Side]> = {
  tl: ['top', 'left'],
  tr: ['top', 'right'],
  bl: ['bottom', 'left'],
  br: ['bottom', 'right'],
};

const GROUNDS = Object.keys(GROUND) as Ground[];
const TILE = 32;

type GroundColor = (typeof GROUND)[Ground]['base' | 'alt'] | (typeof WATER_DEPTH_COLORS)[number];

/**
 * Couleurs de fond qu'un coin arrondi peut prendre : la base de chaque sol,
 * et les deux profondeurs du large, qui arrondissent les paliers de l'eau.
 * L'herbe près d'un autre sol est toujours sa base : aucune tache ne touche
 * un autre sol (`chunkLayer.ts`).
 */
const CORNER_COLORS: readonly GroundColor[] = [
  ...GROUNDS.map((ground) => GROUND[ground].base),
  GROUND.water.alt,
  GROUND.water.deep,
];

/** Les images du sol, à passer à `SpriteLibrary.load`. */
export function terrainSources(): SvgSource[] {
  const sources: SvgSource[] = [];
  const add = (key: string, svg: string, width = TILE, height = TILE): void => {
    sources.push({ key, svg, width, height });
  };

  for (const ground of GROUNDS) {
    if (ground !== 'water') GROUND_TILES[ground].forEach((svg, variant) => add(`terrain.${ground}.${variant}`, svg));
    for (const side of SIDES) {
      const svg = edgeTile(ground, side);

      if (svg) add(`terrain.edge.${ground}.${side}`, svg);
    }
    add(`terrain.shadow.${ground}`, shadowTile(ground), SHADOW_SIZE.width, SHADOW_SIZE.height);
  }
  for (const depth of WATER_DEPTHS) {
    WATER_TILES[depth].forEach((svg, variant) => add(`terrain.water.${depth}.${variant}`, svg));
  }
  for (const [name, svg] of Object.entries(WATER_SPRITES)) {
    const [, width, height] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg) ?? [];

    add(`terrain.${name}`, svg, Number(width), Number(height));
  }
  for (const color of CORNER_COLORS) {
    for (const corner of CORNERS) add(`terrain.corner.${color}.${corner}`, cornerTile(color, corner));
  }
  ROAD_TILES.forEach((svg, links) => add(`terrain.road.${links}`, svg));
  for (const [name, svg] of Object.entries(MEADOW_PATCHES)) add(`terrain.patch.${name}`, svg, PATCH_SIZE.width, PATCH_SIZE.height);
  for (const [name, svg] of Object.entries(MEADOW_SPRINKLES)) add(`terrain.${name}`, svg, 14, 12);
  add('terrain.trail.outer', TRAIL_DOTS.outer, TRAIL_WIDTH.outer, TRAIL_WIDTH.outer);
  add('terrain.trail.inner', TRAIL_DOTS.inner, TRAIL_WIDTH.inner, TRAIL_WIDTH.inner);
  return sources;
}

export class TerrainTiles {
  private readonly library: SpriteLibrary;

  public constructor(library: SpriteLibrary) {
    this.library = library;
  }

  /**
   * La tuile de sol. `roll` est un hachage seedé de la tuile :
   * il choisit la variante des sols qui en ont plusieurs. `depth` ne sert
   * qu'à l'eau.
   */
  public ground(ground: Ground, roll: number, depth: WaterDepth = 0): Texture {
    if (ground === 'grass') return this.library.texture('terrain.grass.0');
    if (ground === 'water') {
      return this.library.texture(`terrain.water.${depth}.${Math.min(variantOf(roll), WATER_TILES[depth].length - 1)}`);
    }
    return this.library.texture(`terrain.${ground}.${variantOf(roll)}`);
  }

  /** Transition dessinée sur une tuile de `owner`, du côté où la voisine est d'un autre sol. */
  public edge(owner: Ground, side: Side): Texture | null {
    return edgeTile(owner, side) ? this.library.texture(`terrain.edge.${owner}.${side}`) : null;
  }

  /** Coin arrondi, peint dans la couleur du sol voisin ; pour l'eau, celle de sa profondeur `depth`. */
  public corner(neighbour: Ground, corner: Corner, depth: WaterDepth = 0): Texture {
    const color = neighbour === 'water' ? WATER_DEPTH_COLORS[depth] : GROUND[neighbour].base;

    return this.library.texture(`terrain.corner.${color}.${corner}`);
  }

  /** La dalle d'une route dont les voisines pavées sont `links` (bits `ROAD_LINK`). */
  public road(links: number): Texture {
    return this.library.texture(`terrain.road.${links}`);
  }

  /** Une tache de prairie : `PATCH_SIZE` px, à l'échelle que tire le bake. */
  public patch(tone: PatchTone, shape: number): Texture {
    return this.library.texture(`terrain.patch.${tone}.${shape}`);
  }

  /** Un brin ou une fleurette semé sur l'herbe. */
  public sprinkle(name: MeadowSprinkle): Texture {
    return this.library.texture(`terrain.${name}`);
  }

  /** Un rond de terre battue (`outer`) ou de sa trace claire (`inner`). */
  public trail(part: 'outer' | 'inner'): Texture {
    return this.library.texture(`terrain.trail.${part}`);
  }

  /** Un sprite animé de l'eau : écume des rives ou vaguelette du large. */
  public water(name: WaterSprite): Texture {
    return this.library.texture(`terrain.${name}`);
  }

  /** Ombre portée pleine, dans la teinte foncée du sol ; `SHADOW_SIZE` px, à étirer. */
  public shadow(ground: Ground): Texture {
    return this.library.texture(`terrain.shadow.${ground}`);
  }
}

const WATER_DEPTHS: readonly WaterDepth[] = [0, 1, 2];

/**
 * Le sol d'un bloc de `size` tuiles et de sa marge, lu une fois depuis la
 * seed : la nature de chaque tuile, et la profondeur de l'eau.
 *
 * La profondeur se lit à la distance de la rive : 0 quand une des huit
 * voisines est à sec, 1 quand la rive est à deux tuiles, 2 au-delà. Elle
 * regarde deux tuiles autour : elle n'est juste qu'à `margin - 2` tuiles
 * du bloc, au plus.
 */
export class BlockTerrain {
  private readonly kinds: TerrainKind[];
  private readonly span: number;
  private readonly margin: number;

  public constructor(seed: number, baseTx: number, baseTy: number, size: number, margin: number) {
    this.span = size + margin * 2;
    this.margin = margin;
    this.kinds = new Array<TerrainKind>(this.span * this.span);

    for (let ly = -margin; ly < size + margin; ly += 1) {
      for (let lx = -margin; lx < size + margin; lx += 1) {
        this.kinds[(ly + margin) * this.span + lx + margin] = terrainAt(seed, baseTx + lx, baseTy + ly);
      }
    }
  }

  /** Nature de la tuile en (lx, ly), coordonnées locales au bloc. */
  public kind(lx: number, ly: number): TerrainKind {
    return this.kinds[(ly + this.margin) * this.span + lx + this.margin]!;
  }

  /** Profondeur de l'eau en (lx, ly) ; 0 pour une tuile à sec. */
  public depth(lx: number, ly: number): WaterDepth {
    if (this.kind(lx, ly) !== 'water') return 0;

    let depth: WaterDepth = 2;

    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (this.kind(lx + dx, ly + dy) === 'water') continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return 0;
        depth = 1;
      }
    }
    return depth;
  }
}

/** Le hachage seedé d'une tuile qui choisit sa variante de sol : le même au bake et pour l'eau animée. */
export function groundRoll(seed: number, tx: number, ty: number): number {
  return hash3(seed ^ 0x6a09e667, tx, ty);
}

/** Variante d'un sol à trois tuiles : la sobre sept fois sur dix. */
export function variantOf(roll: number): number {
  const value = roll % 20;

  if (value < 14) return 0;
  return value < 17 ? 1 : 2;
}
