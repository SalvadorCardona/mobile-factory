/**
 * Tileset du sol : les SVG de `art/terrain.ts`, rangés dans l'atlas.
 *
 * Ce module fait le lien entre les tuiles dessinées (variantes, transitions,
 * coins arrondis, ombres portées) et les textures de `SpriteLibrary` : il
 * déclare les images à rastériser au chargement, puis les retrouve par sol,
 * par côté, par coin.
 *
 * Choix d'une tuile, tout seedé : l'herbe alterne ses deux tons en damier,
 * une case par tuile ; les autres sols tirent une variante, la sobre le plus
 * souvent — un sol trop chargé fatigue l'œil et noie les ressources.
 */

import type { Texture } from 'pixi.js';
import { GROUND, type Ground } from '../data/artDirection.ts';
import {
  GROUND_TILES,
  SHADOW_SIZE,
  cornerTile,
  edgeTile,
  shadowTile,
  type Corner,
  type Side,
} from '../art/terrain.ts';
import type { SpriteLibrary, SvgSource } from './spriteLibrary.ts';

export type { Corner, Side };

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

type GroundColor = (typeof GROUND)[Ground]['base' | 'alt'];

/** Couleurs de fond qu'un coin arrondi peut prendre : la base de chaque sol, et le second ton de l'herbe. */
const CORNER_COLORS: readonly GroundColor[] = [...GROUNDS.map((ground) => GROUND[ground].base), GROUND.grass.alt];

/** Les images du sol, à passer à `SpriteLibrary.load`. */
export function terrainSources(): SvgSource[] {
  const sources: SvgSource[] = [];
  const add = (key: string, svg: string, width = TILE, height = TILE): void => {
    sources.push({ key, svg, width, height });
  };

  for (const ground of GROUNDS) {
    GROUND_TILES[ground].forEach((svg, variant) => add(`terrain.${ground}.${variant}`, svg));
    for (const side of SIDES) {
      const svg = edgeTile(ground, side);

      if (svg) add(`terrain.edge.${ground}.${side}`, svg);
    }
    add(`terrain.shadow.${ground}`, shadowTile(ground), SHADOW_SIZE.width, SHADOW_SIZE.height);
  }
  for (const color of CORNER_COLORS) {
    for (const corner of CORNERS) add(`terrain.corner.${color}.${corner}`, cornerTile(color, corner));
  }
  return sources;
}

export class TerrainTiles {
  private readonly library: SpriteLibrary;

  public constructor(library: SpriteLibrary) {
    this.library = library;
  }

  /**
   * La tuile de sol en (tx, ty). `roll` est un hachage seedé de la tuile :
   * il choisit la variante des sols qui en ont plusieurs.
   */
  public ground(ground: Ground, tx: number, ty: number, roll: number): Texture {
    if (ground === 'grass') return this.library.texture(`terrain.grass.${checker(tx, ty)}`);
    return this.library.texture(`terrain.${ground}.${variantOf(roll)}`);
  }

  /** Transition dessinée sur une tuile de `owner`, du côté où la voisine est d'un autre sol. */
  public edge(owner: Ground, side: Side): Texture | null {
    return edgeTile(owner, side) ? this.library.texture(`terrain.edge.${owner}.${side}`) : null;
  }

  /** Coin arrondi, peint dans la couleur du sol voisin tel qu'il est dessiné en (tx, ty). */
  public corner(neighbour: Ground, tx: number, ty: number, corner: Corner): Texture {
    const color = neighbour === 'grass' && checker(tx, ty) === 1 ? GROUND.grass.alt : GROUND[neighbour].base;

    return this.library.texture(`terrain.corner.${color}.${corner}`);
  }

  /** Ombre portée pleine, dans la teinte foncée du sol ; `SHADOW_SIZE` px, à étirer. */
  public shadow(ground: Ground): Texture {
    return this.library.texture(`terrain.shadow.${ground}`);
  }
}

/** Case du damier d'herbe : 0 ou 1. */
export function checker(tx: number, ty: number): 0 | 1 {
  return ((tx + ty) & 1) === 0 ? 0 : 1;
}

/** Variante d'un sol à trois tuiles : la sobre sept fois sur dix. */
export function variantOf(roll: number): number {
  const value = roll % 20;

  if (value < 14) return 0;
  return value < 17 ? 1 : 2;
}
