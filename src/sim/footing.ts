/**
 * L'assise d'une foreuse : sur quoi son emprise se pose.
 *
 * Une foreuse se pose au **bord** d'un filon : la moitié de son emprise sur
 * le gisement qu'elle extrait, l'autre moitié sur l'herbe — deux cases de fer
 * et deux d'herbe pour une foreuse 2 × 2. Plein filon, à cheval sur deux
 * gisements, sur le sable, la roche ou l'eau : refusé. Les gisements qu'elle
 * accepte sont de la donnée (`deposits` de `data/buildings.ts`) ; le terrain
 * et les filons se tirent de la seed, rien n'est stocké.
 *
 * Une emprise d'aire impaire donnerait sa case de trop à l'herbe : `half`
 * est l'arrondi inférieur de la moitié.
 *
 * `World.placementBlock()` en fait un motif de refus (`footing`) — le juge
 * unique du fantôme et du tick — et le fantôme colore chaque case d'après
 * `tiles` : filon, herbe, ou fautive.
 */

import type { TileCoord } from '../core/grid.ts';
import type { ItemId } from '../data/items.ts';
import { oreAt, terrainAt } from './terrain.ts';

/** Ce qu'une case de l'emprise apporte : le filon voulu, l'herbe voulue, ou une faute. */
export type FootingState = 'ore' | 'grass' | 'wrong';

export interface FootingTile extends TileCoord {
  state: FootingState;
}

export interface Footing {
  /**
   * Le gisement que la foreuse extrairait : celui des `deposits` qui couvre
   * le plus de cases (à égalité, le premier lu), `null` s'il n'y en a aucun.
   */
  ore: ItemId | null;
  /** Combien de cases de filon il faut : la moitié de l'emprise. Le reste est d'herbe. */
  half: number;
  /** Chaque case de l'emprise, ligne par ligne. */
  tiles: FootingTile[];
  /** Exactement `half` cases du filon, et l'herbe sur toutes les autres. */
  valid: boolean;
}

/** Les cases de filon qu'exige une emprise : la moitié, arrondie en dessous. */
export function footingHalf(width: number, height: number): number {
  return Math.floor((width * height) / 2);
}

/**
 * L'assise d'une emprise posée en (tx, ty). Au-delà de ce qu'il faut, les
 * cases en trop — de filon ou d'herbe — sont fautives, dans l'ordre de
 * lecture : le fantôme montre ce qui déborde.
 */
export function footingAt(
  seed: number,
  deposits: readonly ItemId[],
  tx: number,
  ty: number,
  width: number,
  height: number,
): Footing {
  const half = footingHalf(width, height);
  const grassNeeded = width * height - half;
  const read: { tx: number; ty: number; ore: ItemId | null; grass: boolean }[] = [];
  const counts = new Map<ItemId, number>();

  for (let y = ty; y < ty + height; y += 1) {
    for (let x = tx; x < tx + width; x += 1) {
      const node = oreAt(seed, x, y);
      const grass = node === null && terrainAt(seed, x, y) === 'grass';

      read.push({ tx: x, ty: y, ore: node?.item ?? null, grass });
      if (node && deposits.includes(node.item)) counts.set(node.item, (counts.get(node.item) ?? 0) + 1);
    }
  }

  let ore: ItemId | null = null;

  for (const [item, count] of counts) if (ore === null || count > counts.get(ore)!) ore = item;

  let ores = 0;
  let grasses = 0;
  const tiles = read.map(({ tx: x, ty: y, ore: item, grass }): FootingTile => {
    if (item !== null && item === ore && ores < half) {
      ores += 1;
      return { tx: x, ty: y, state: 'ore' };
    }
    if (grass && grasses < grassNeeded) {
      grasses += 1;
      return { tx: x, ty: y, state: 'grass' };
    }
    return { tx: x, ty: y, state: 'wrong' };
  });

  return { ore, half, tiles, valid: tiles.every((tile) => tile.state !== 'wrong') };
}
