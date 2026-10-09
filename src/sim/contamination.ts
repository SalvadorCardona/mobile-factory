/**
 * Les terres polluées et radioactives : où elles sont, lesquelles ont été
 * nettoyées.
 *
 * La carte les tire de la seed (`contaminationAt`), sans rien stocker, comme
 * le terrain. Ce que le joueur change — une case dépolluée — est de l'état :
 * `Land` en tient la liste, rangée par chunk comme les routes, et la
 * sauvegarde la garde (`cleaned`). Une case nettoyée ne se pollue plus.
 *
 * Ce module ne décide ni du coût ni du lieu de la station : c'est `World`
 * (`placementBlock`, `purify`). Il dit ce que porte une case et quelles
 * cases polluées sont à portée d'un emplacement.
 */

import { CHUNK_TILES, coordKey, floorDiv, type TileCoord } from '../core/grid.ts';
import { CONTAMINATION, CONTAMINATION_KINDS, type ContaminationKind } from '../data/contamination.ts';
import { findSpawn, smoothNoise, terrainAt } from './terrain.ts';

const SALT = 0x2c1b3c6d;

/**
 * Ce que la carte pose sur la tuile avant toute dépollution : `polluted`,
 * `radioactive`, ou `null` pour de la terre saine. L'eau n'en porte jamais,
 * ni la clairière de départ.
 */
export function contaminationAt(seed: number, tx: number, ty: number): ContaminationKind | null {
  if (terrainAt(seed, tx, ty) === 'water') return null;

  const [hallX, hallY] = findSpawn(seed);
  const dx = tx - hallX;
  const dy = ty - hallY;

  if (dx * dx + dy * dy <= CONTAMINATION.safeRadius * CONTAMINATION.safeRadius) return null;

  const level = smoothNoise(seed ^ SALT, tx, ty, CONTAMINATION.cell);

  if (level >= CONTAMINATION.radioactiveFrom) return 'radioactive';
  return level >= CONTAMINATION.pollutedFrom ? 'polluted' : null;
}

export class Land {
  private readonly seed: number;
  /** Chunk `"cx,cy"` → index des tuiles dépolluées. */
  private readonly cleaned = new Map<string, Set<number>>();

  public constructor(seed: number) {
    this.seed = seed;
  }

  /** Ce que porte la tuile aujourd'hui : la carte, moins ce qu'on a nettoyé. */
  public at(tx: number, ty: number): ContaminationKind | null {
    const kind = contaminationAt(this.seed, tx, ty);

    return kind !== null && !this.isCleaned(tx, ty) ? kind : null;
  }

  /** Peut-on y poser un bâtiment, au regard de la contamination ? */
  public buildable(tx: number, ty: number): boolean {
    const kind = this.at(tx, ty);

    return kind === null || CONTAMINATION_KINDS[kind].buildable;
  }

  /** Dépollue la tuile si elle est polluée. `false` sinon : saine, ou radioactive. */
  public clean(tx: number, ty: number): boolean {
    const kind = this.at(tx, ty);

    if (kind === null || !CONTAMINATION_KINDS[kind].cleanable) return false;

    const cx = floorDiv(tx, CHUNK_TILES);
    const cy = floorDiv(ty, CHUNK_TILES);
    const key = coordKey(cx, cy);
    let tiles = this.cleaned.get(key);

    if (!tiles) {
      tiles = new Set();
      this.cleaned.set(key, tiles);
    }
    tiles.add(localIndex(tx, ty, cx, cy));
    return true;
  }

  /**
   * Les cases à dépolluer autour d'une emprise, la plus proche d'abord : les
   * cases nettoyables à moins de `radius` tuiles de son bord. À égalité, ligne
   * par ligne — l'ordre ne dépend que de la carte.
   */
  public cleanableAround(tx: number, ty: number, width: number, height: number, radius: number): TileCoord[] {
    const found: { tile: TileCoord; distance: number }[] = [];

    for (let y = ty - radius; y < ty + height + radius; y += 1) {
      for (let x = tx - radius; x < tx + width + radius; x += 1) {
        const kind = this.at(x, y);

        if (kind === null || !CONTAMINATION_KINDS[kind].cleanable) continue;

        // Distance au carré à l'emprise : 0 sur elle, croît avec l'écart au bord le plus proche.
        const gapX = Math.max(tx - x, 0, x - (tx + width - 1));
        const gapY = Math.max(ty - y, 0, y - (ty + height - 1));
        const distance = gapX * gapX + gapY * gapY;

        if (distance <= radius * radius) found.push({ tile: { tx: x, ty: y }, distance });
      }
    }
    return found.sort((a, b) => a.distance - b.distance).map(({ tile }) => tile);
  }

  /** `"cx,cy"` → index des tuiles nettoyées dans le chunk, triés. */
  public toJSON(): Record<string, number[]> {
    const saved: Record<string, number[]> = {};

    for (const [key, tiles] of this.cleaned) saved[key] = [...tiles].sort((a, b) => a - b);
    return saved;
  }

  public restore(saved: Record<string, readonly number[]>): void {
    this.cleaned.clear();
    for (const [key, tiles] of Object.entries(saved)) {
      if (tiles.length > 0) this.cleaned.set(key, new Set(tiles));
    }
  }

  private isCleaned(tx: number, ty: number): boolean {
    const cx = floorDiv(tx, CHUNK_TILES);
    const cy = floorDiv(ty, CHUNK_TILES);

    return this.cleaned.get(coordKey(cx, cy))?.has(localIndex(tx, ty, cx, cy)) ?? false;
  }
}

/** Index de la tuile dans son chunk, ligne par ligne. */
function localIndex(tx: number, ty: number, cx: number, cy: number): number {
  return (ty - cy * CHUNK_TILES) * CHUNK_TILES + (tx - cx * CHUNK_TILES);
}
