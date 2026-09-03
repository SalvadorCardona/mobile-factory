/**
 * Terrain et gisements — régénérés depuis la seed, jamais stockés.
 *
 * Une partie de 10 h tient dans quelques centaines de Ko parce que la carte
 * n'est pas sauvegardée : seules les modifications du joueur le sont. Un
 * gisement porte un id déterministe calculé sur (cellule, seed), ce qui
 * permettra plus tard de ne persister que ses épuisements dans une
 * `Map<nodeId, restant>`.
 *
 * Tout est pur : mêmes entrées, mêmes sorties, sans état.
 */

import { hash3, noise2 } from '../core/rng.ts';
import type { ItemId } from '../data/items.ts';

export type TerrainKind = 'water' | 'sand' | 'grass' | 'rock';

export interface OreNode {
  /** Id déterministe : identique d'une partie à l'autre pour la même seed. */
  id: number;
  item: ItemId;
  /** Tuile du centre du gisement. */
  tx: number;
  ty: number;
  /** Rayon en tuiles. */
  radius: number;
}

/** Bruit de valeur lissé : lattice de `cell` tuiles, interpolation bilinéaire adoucie. */
function smoothNoise(seed: number, tx: number, ty: number, cell: number): number {
  const gx = Math.floor(tx / cell);
  const gy = Math.floor(ty / cell);
  const fx = tx / cell - gx;
  const fy = ty / cell - gy;

  // Courbe de Hermite : supprime les cassures visibles aux bords de lattice.
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = noise2(seed, gx, gy);
  const n10 = noise2(seed, gx + 1, gy);
  const n01 = noise2(seed, gx, gy + 1);
  const n11 = noise2(seed, gx + 1, gy + 1);

  const top = n00 + (n10 - n00) * sx;
  const bottom = n01 + (n11 - n01) * sx;

  return top + (bottom - top) * sy;
}

export function terrainAt(seed: number, tx: number, ty: number): TerrainKind {
  const height = 0.65 * smoothNoise(seed, tx, ty, 28) + 0.35 * smoothNoise(seed ^ 0x9e3779b9, tx, ty, 9);

  if (height < 0.3) return 'water';
  if (height < 0.36) return 'sand';
  if (height < 0.74) return 'grass';
  return 'rock';
}

/** L'eau se traverse et se construit dessus : non. Le reste : oui. */
export function isBuildable(kind: TerrainKind): boolean {
  return kind !== 'water';
}

export function isWalkable(kind: TerrainKind): boolean {
  return kind !== 'water';
}

/** Une cellule de gisement fait 20 tuiles ; un patch tient entièrement dans la sienne. */
const ORE_CELL = 20;
const ORE_CHANCE = 0.45;
const ORE_MIN_RADIUS = 2;
const ORE_MAX_RADIUS = 4;

const ORE_TABLE: readonly ItemId[] = ['ironOre', 'ironOre', 'coal', 'stone'];

/** Le gisement de la cellule contenant la tuile, ou `null` si la cellule n'en porte pas. */
function nodeOfCell(seed: number, cellX: number, cellY: number): OreNode | null {
  const roll = hash3(seed ^ 0x5bf03635, cellX, cellY) / 4294967296;

  if (roll > ORE_CHANCE) return null;

  const id = hash3(seed, cellX, cellY);
  const radius = ORE_MIN_RADIUS + (id % (ORE_MAX_RADIUS - ORE_MIN_RADIUS + 1));
  const span = ORE_CELL - 2 * radius;
  const offsetX = radius + (hash3(id, 1, 0) % span);
  const offsetY = radius + (hash3(id, 2, 0) % span);

  return {
    id,
    item: ORE_TABLE[id % ORE_TABLE.length]!,
    tx: cellX * ORE_CELL + offsetX,
    ty: cellY * ORE_CELL + offsetY,
    radius,
  };
}

/** Le gisement présent sur cette tuile, ou `null`. */
export function oreAt(seed: number, tx: number, ty: number): OreNode | null {
  const node = nodeOfCell(seed, Math.floor(tx / ORE_CELL), Math.floor(ty / ORE_CELL));

  if (!node) return null;
  if (terrainAt(seed, tx, ty) === 'water') return null;

  const dx = tx - node.tx;
  const dy = ty - node.ty;

  return dx * dx + dy * dy <= node.radius * node.radius ? node : null;
}
