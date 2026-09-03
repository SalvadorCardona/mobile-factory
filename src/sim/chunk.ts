/**
 * Index des chunks : ce que le joueur a modifié, et rien d'autre.
 *
 * Le terrain n'apparaît pas ici — il est régénéré depuis la seed à la demande.
 * Un chunk ne retient que les bâtiments qu'il contient et un drapeau `dirty`
 * que le rendu consomme pour décider s'il doit rebaker sa RenderTexture.
 */

import { CHUNK_TILES, coordKey, floorDiv } from '../core/grid.ts';
import type { EntityId } from './types.ts';

export interface Chunk {
  cx: number;
  cy: number;
  /** Bâtiments dont l'origine tombe dans ce chunk. */
  buildings: Set<EntityId>;
  /** Le rendu doit-il rebaker ce chunk ? */
  dirty: boolean;
}

export class ChunkIndex {
  private readonly chunks = new Map<string, Chunk>();
  /** Occupation tuile → bâtiment, pour le test de collision au placement. */
  private readonly occupancy = new Map<string, EntityId>();

  public get(cx: number, cy: number): Chunk {
    const key = coordKey(cx, cy);
    let chunk = this.chunks.get(key);

    if (!chunk) {
      chunk = { cx, cy, buildings: new Set(), dirty: true };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  public peek(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(coordKey(cx, cy));
  }

  public occupantAt(tx: number, ty: number): EntityId | undefined {
    return this.occupancy.get(coordKey(tx, ty));
  }

  public isFree(tx: number, ty: number, width: number, height: number): boolean {
    for (let y = ty; y < ty + height; y += 1) {
      for (let x = tx; x < tx + width; x += 1) {
        if (this.occupancy.has(coordKey(x, y))) return false;
      }
    }
    return true;
  }

  public occupy(id: EntityId, tx: number, ty: number, width: number, height: number): void {
    for (let y = ty; y < ty + height; y += 1) {
      for (let x = tx; x < tx + width; x += 1) {
        this.occupancy.set(coordKey(x, y), id);
      }
    }
    const chunk = this.get(floorDiv(tx, CHUNK_TILES), floorDiv(ty, CHUNK_TILES));

    chunk.buildings.add(id);
    chunk.dirty = true;
  }

  public release(id: EntityId, tx: number, ty: number, width: number, height: number): void {
    for (let y = ty; y < ty + height; y += 1) {
      for (let x = tx; x < tx + width; x += 1) {
        const key = coordKey(x, y);

        if (this.occupancy.get(key) === id) this.occupancy.delete(key);
      }
    }
    const chunk = this.get(floorDiv(tx, CHUNK_TILES), floorDiv(ty, CHUNK_TILES));

    chunk.buildings.delete(id);
    chunk.dirty = true;
  }
}
