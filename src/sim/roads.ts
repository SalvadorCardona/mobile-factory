/**
 * Les routes pavées : un ensemble de tuiles par chunk.
 *
 * Une route est une modification du joueur, comme une tuile entamée : la
 * carte ne la génère pas, la sauvegarde la garde. Rangée par chunk — la clé
 * `"cx,cy"`, puis l'index de la tuile dans le chunk —, elle se sauvegarde en
 * quelques entiers par tuile et se lit en O(1) au pas de chaque marcheur.
 *
 * Ce module ne décide ni du coût ni de qui a le droit de paver : c'est
 * `World` (`paveRoad`, `removeRoad`). Il dit si une tuile est pavée, et
 * comment ses voisines s'y raccordent — de quoi choisir le dessin de la dalle.
 */

import { CHUNK_TILES, coordKey, floorDiv, type TileCoord } from '../core/grid.ts';
import { ROAD_LINK } from '../data/roads.ts';

/** Une tuile est-elle pavée ? Ce que lit le pas d'un marcheur. */
export type RoadTest = (tx: number, ty: number) => boolean;

export class RoadNetwork {
  private readonly chunks = new Map<string, Set<number>>();

  public has(tx: number, ty: number): boolean {
    const cx = floorDiv(tx, CHUNK_TILES);
    const cy = floorDiv(ty, CHUNK_TILES);

    return this.chunks.get(coordKey(cx, cy))?.has(localIndex(tx, ty, cx, cy)) ?? false;
  }

  /** Pave la tuile. `false` si elle l'était déjà. */
  public add(tx: number, ty: number): boolean {
    const cx = floorDiv(tx, CHUNK_TILES);
    const cy = floorDiv(ty, CHUNK_TILES);
    const key = coordKey(cx, cy);
    const index = localIndex(tx, ty, cx, cy);
    let tiles = this.chunks.get(key);

    if (!tiles) {
      tiles = new Set();
      this.chunks.set(key, tiles);
    }
    if (tiles.has(index)) return false;
    tiles.add(index);
    return true;
  }

  /** Retire la dalle. `false` s'il n'y en avait pas. */
  public remove(tx: number, ty: number): boolean {
    const cx = floorDiv(tx, CHUNK_TILES);
    const cy = floorDiv(ty, CHUNK_TILES);
    const key = coordKey(cx, cy);
    const tiles = this.chunks.get(key);

    if (!tiles?.delete(localIndex(tx, ty, cx, cy))) return false;
    if (tiles.size === 0) this.chunks.delete(key);
    return true;
  }

  /** Les voisines pavées de la tuile, en bits `ROAD_LINK` : de 0 (dalle seule) à 15 (croix). */
  public links(tx: number, ty: number): number {
    return (
      (this.has(tx, ty - 1) ? ROAD_LINK.top : 0) |
      (this.has(tx + 1, ty) ? ROAD_LINK.right : 0) |
      (this.has(tx, ty + 1) ? ROAD_LINK.bottom : 0) |
      (this.has(tx - 1, ty) ? ROAD_LINK.left : 0)
    );
  }

  /** Nombre de tuiles pavées. */
  public size(): number {
    let size = 0;

    for (const tiles of this.chunks.values()) size += tiles.size;
    return size;
  }

  /** Toutes les tuiles pavées, chunk par chunk. */
  public *tiles(): IterableIterator<TileCoord> {
    for (const [key, tiles] of this.chunks) {
      const [cx, cy] = key.split(',').map(Number) as [number, number];

      for (const index of tiles) {
        yield { tx: cx * CHUNK_TILES + (index % CHUNK_TILES), ty: cy * CHUNK_TILES + Math.floor(index / CHUNK_TILES) };
      }
    }
  }

  /** `"cx,cy"` → index des tuiles pavées dans le chunk, triés : la sauvegarde ne dépend pas de l'ordre de pose. */
  public toJSON(): Record<string, number[]> {
    const saved: Record<string, number[]> = {};

    for (const [key, tiles] of this.chunks) saved[key] = [...tiles].sort((a, b) => a - b);
    return saved;
  }

  /** Remplace les routes par celles d'une sauvegarde. */
  public restore(saved: Record<string, readonly number[]>): void {
    this.chunks.clear();
    for (const [key, tiles] of Object.entries(saved)) {
      if (tiles.length > 0) this.chunks.set(key, new Set(tiles));
    }
  }
}

/** Index de la tuile dans son chunk, ligne par ligne. */
function localIndex(tx: number, ty: number, cx: number, cy: number): number {
  return (ty - cy * CHUNK_TILES) * CHUNK_TILES + (tx - cx * CHUNK_TILES);
}

/**
 * Le tracé d'un doigt, tuile à tuile : de `from` à `to` par pas orthogonaux,
 * sans diagonale — une route se raccorde par ses côtés, jamais par un coin.
 * `from` exclu, `to` inclus. L'axe le plus long avance d'abord.
 */
export function stepsBetween(from: TileCoord, to: TileCoord): TileCoord[] {
  const steps: TileCoord[] = [];
  let { tx, ty } = from;

  while (tx !== to.tx || ty !== to.ty) {
    const dx = to.tx - tx;
    const dy = to.ty - ty;

    if (Math.abs(dx) >= Math.abs(dy)) tx += Math.sign(dx);
    else ty += Math.sign(dy);
    steps.push({ tx, ty });
  }
  return steps;
}
