/**
 * Géométrie de la grille : tuiles, chunks, conversions.
 *
 * Une tuile fait 32 px. Un chunk fait 32 × 32 tuiles, soit 1024 tuiles et
 * 1024 px de côté — l'unité de bake en RenderTexture et de culling.
 */

export const TILE_SIZE = 32;
export const CHUNK_TILES = 32;
export const CHUNK_SIZE = TILE_SIZE * CHUNK_TILES;

export interface TileCoord {
  tx: number;
  ty: number;
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}

/** Division entière vers le bas, correcte pour les coordonnées négatives. */
export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

export function worldToTile(worldX: number, worldY: number): TileCoord {
  return { tx: floorDiv(worldX, TILE_SIZE), ty: floorDiv(worldY, TILE_SIZE) };
}

export function tileToChunk(tx: number, ty: number): ChunkCoord {
  return { cx: floorDiv(tx, CHUNK_TILES), cy: floorDiv(ty, CHUNK_TILES) };
}

/** Coordonnée de la tuile à l'intérieur de son chunk, dans [0, CHUNK_TILES). */
export function localTile(tx: number, ty: number): TileCoord {
  return {
    tx: tx - floorDiv(tx, CHUNK_TILES) * CHUNK_TILES,
    ty: ty - floorDiv(ty, CHUNK_TILES) * CHUNK_TILES,
  };
}

/**
 * Clé de map pour un couple de coordonnées signées.
 * Chaîne plutôt qu'entier bit-packé : lisible au débogage, et une Map<string>
 * reste largement assez rapide au nombre de chunks qu'on manipule.
 */
export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Distance au carré — on ne prend jamais de racine pour comparer des portées. */
export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
