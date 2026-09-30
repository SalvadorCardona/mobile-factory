/**
 * Terrain, gisements et ressources de surface — régénérés depuis la seed,
 * jamais stockés.
 *
 * Une partie de 10 h tient dans quelques centaines de Ko parce que la carte
 * n'est pas sauvegardée : seules les modifications du joueur le sont. Un
 * gisement porte un id déterministe calculé sur (cellule, seed) ; une
 * ressource de surface est identifiée par sa tuile, et `sim/resources.ts` ne
 * retient que ce qui en a été arraché.
 *
 * Deux couches, volontairement distinctes :
 * - le **filon** (`oreAt`) : ce qu'une foreuse extrait, inépuisable ;
 * - la **surface** (`resourceAt`) : les rochers posés sur le filon et les
 *   arbres des forêts, qu'Adam heurte et récolte à la main, et qui
 *   disparaissent une fois vidés.
 *
 * Tout est pur : mêmes entrées, mêmes sorties, sans état.
 */

import { CHUNK_TILES } from '../core/grid.ts';
import { hash3, noise2 } from '../core/rng.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { DECOR, DECOR_DENSITY, DECOR_IDS, type DecorId, type DecorTerrain } from '../data/decor.ts';
import type { Habitat } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { ROCK_OF_ORE, type ResourceId } from '../data/resources.ts';

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

/** Le gisement présent sur cette tuile, ou `null`. Les filons du foyer passent devant ceux des cellules. */
export function oreAt(seed: number, tx: number, ty: number): OreNode | null {
  if (terrainAt(seed, tx, ty) === 'water') return null;

  for (const node of homeOf(seed).ores) {
    if (inDisc(tx, ty, node.tx, node.ty, node.radius)) return node;
  }

  const node = nodeOfCell(seed, Math.floor(tx / ORE_CELL), Math.floor(ty / ORE_CELL));

  return node && inDisc(tx, ty, node.tx, node.ty, node.radius) ? node : null;
}

function inDisc(tx: number, ty: number, cx: number, cy: number, radius: number): boolean {
  const dx = tx - cx;
  const dy = ty - cy;

  return dx * dx + dy * dy <= radius * radius;
}

/* ------------------------------------------------------------------ foyer */

/**
 * Cherche, en spirale carrée depuis l'origine, une clairière de 5 × 6 tuiles
 * entièrement constructible : la mairie (3 × 3) en haut, Adam en dessous,
 * une tuile de marge autour. Sans ça, une seed qui met de l'eau en (0, 0)
 * fait apparaître le joueur dans un lac dont il ne peut pas sortir — ou la
 * mairie les pieds dedans. La clairière doit aussi pouvoir accueillir le
 * foyer (voir `Home`) : un îlot où ne tient aucun filon est écarté.
 *
 * Renvoie la tuile sous la mairie ; Adam apparaît juste en dessous.
 */
export function findSpawn(seed: number): [number, number] {
  return homeOf(seed).spawn;
}

/** La mairie, premier chantier : c'est elle que la clairière du départ doit accueillir. */
const TOWN_HALL_HEIGHT = BUILDINGS.townHall.height;

/** La clairière du départ, que `World` vide de ses ressources : la mairie au-dessus, Adam en dessous. */
function inClearing(sx: number, sy: number, tx: number, ty: number): boolean {
  return tx >= sx - 2 && tx <= sx + 2 && ty >= sy - TOWN_HALL_HEIGHT && ty <= sy + 2;
}

function isClearing(seed: number, sx: number, sy: number): boolean {
  for (let ty = sy - TOWN_HALL_HEIGHT; ty <= sy + 2; ty += 1) {
    for (let tx = sx - 2; tx <= sx + 2; tx += 1) {
      if (!isBuildable(terrainAt(seed, tx, ty))) return false;
    }
  }
  return true;
}

/**
 * Le foyer : ce qu'il faut autour du départ pour bâtir la mairie, puis la
 * foreuse. Laissés au hasard des cellules, la pierre n'étant qu'un filon sur
 * quatre, les rochers roses tombaient à 30–60 tuiles d'Adam sur une seed sur
 * deux — trois écrans de téléphone à errer sans savoir où. Le foyer pose donc,
 * à portée de pas depuis Adam (jamais de l'autre côté d'un lac) :
 * - un bosquet à quelques tuiles, pour le bois ;
 * - un filon de pierre à moins d'un écran ;
 * - un filon de fer un peu plus loin, pour la première foreuse.
 *
 * Tiré de la seed seule (le terrain ne dépend pas des filons), donc pur ;
 * gardé en cache parce que `oreAt` le consulte à chaque tuile.
 */
interface Home {
  spawn: [number, number];
  ores: OreNode[];
  grove: { tx: number; ty: number };
}

/** Distances au départ d'Adam, en tuiles, du centre de chaque pièce du foyer. */
const HOME_GROVE = { min: 3, max: 4.5, radius: 2 };
const HOME_STONE = { min: 7, max: 9.5, radius: 2 };
const HOME_IRON = { min: 13, max: 16, radius: 2 };

/** Assez large pour contenir le filon de fer le plus lointain. */
const HOME_REACH = 20;
const SPAN = 2 * HOME_REACH + 1;

const HOMES = new Map<number, Home>();

function homeOf(seed: number): Home {
  let home = HOMES.get(seed);

  if (!home) {
    home = searchHome(seed);
    HOMES.set(seed, home);
  }
  return home;
}

function searchHome(seed: number): Home {
  let first: [number, number] | null = null;

  for (let radius = 0; radius < CHUNK_TILES * 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        if (!isClearing(seed, dx, dy)) continue;

        const home = planHome(seed, dx, dy);

        if (home) return home;
        first ??= [dx, dy];
      }
    }
  }

  // Aucune clairière n'accueille de foyer : la première venue, filons posés d'office.
  const [sx, sy] = first ?? [0, 0];

  return planHome(seed, sx, sy, true)!;
}

/** Le foyer autour de cette clairière, ou `null` s'il n'y tient pas (sauf `force`). */
function planHome(seed: number, sx: number, sy: number, force = false): Home | null {
  const ax = sx;
  const ay = sy + 1;
  const reachable = reachableFrom(seed, ax, ay);
  const land = (tx: number, ty: number): boolean => terrainAt(seed, tx, ty) !== 'water';
  const clear = (tx: number, ty: number, radius: number): boolean => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > radius * radius) continue;
        if (!land(tx + dx, ty + dy) || inClearing(sx, sy, tx + dx, ty + dy)) return false;
      }
    }
    return true;
  };

  /** Une tuile atteignable dans l'anneau, tirée de la seed parmi celles qui passent le filtre. */
  const pick = (salt: number, ring: { min: number; max: number }, accept: (tx: number, ty: number) => boolean) => {
    const candidates: [number, number][] = [];

    for (const key of reachable) {
      const tx = (key % SPAN) - HOME_REACH + ax;
      const ty = Math.floor(key / SPAN) - HOME_REACH + ay;
      const distSq = (tx - ax) ** 2 + (ty - ay) ** 2;

      if (distSq < ring.min * ring.min || distSq > ring.max * ring.max) continue;
      if (accept(tx, ty)) candidates.push([tx, ty]);
    }
    return candidates.length > 0 ? candidates[hash3(seed ^ salt, sx, sy) % candidates.length]! : null;
  };

  const stoneAt =
    pick(0x68e31da4, HOME_STONE, (tx, ty) => clear(tx, ty, HOME_STONE.radius)) ??
    pick(0x68e31da4, HOME_STONE, (tx, ty) => clear(tx, ty, 0)) ??
    (force ? [ax, ay + HOME_STONE.min] : null);

  if (!stoneAt) return null;

  const stone = homeNode(seed, 'stone', stoneAt, HOME_STONE.radius);
  const apart = (tx: number, ty: number): boolean => !inDisc(tx, ty, stone.tx, stone.ty, 2 * HOME_IRON.radius + 1);
  const ironAt =
    pick(0xb5297a4d, HOME_IRON, (tx, ty) => clear(tx, ty, HOME_IRON.radius) && apart(tx, ty)) ??
    pick(0xb5297a4d, HOME_IRON, (tx, ty) => clear(tx, ty, 0) && apart(tx, ty)) ??
    (force ? [ax, ay - HOME_IRON.min] : null);

  if (!ironAt) return null;

  const iron = homeNode(seed, 'ironOre', ironAt, HOME_IRON.radius);

  // Le cœur du bosquet porte toujours un arbre : ni filon ni clairière dessous.
  const bare = (tx: number, ty: number): boolean =>
    clear(tx, ty, 0) &&
    !inDisc(tx, ty, stone.tx, stone.ty, stone.radius) &&
    !inDisc(tx, ty, iron.tx, iron.ty, iron.radius) &&
    nodeAt(seed, tx, ty) === null;
  const groveAt =
    pick(0x1656567b, HOME_GROVE, (tx, ty) => bare(tx, ty) && terrainAt(seed, tx, ty) === 'grass') ??
    pick(0x1656567b, HOME_GROVE, bare) ??
    (force ? [ax + HOME_GROVE.min, ay] : null);

  if (!groveAt) return null;

  return { spawn: [sx, sy], ores: [stone, iron], grove: { tx: groveAt[0], ty: groveAt[1] } };
}

function homeNode(seed: number, item: ItemId, [tx, ty]: [number, number], radius: number): OreNode {
  return { id: hash3(seed ^ 0x2f8a6c1e, tx, ty), item, tx, ty, radius };
}

/** Le gisement de cellule sur la tuile, sans les filons du foyer. */
function nodeAt(seed: number, tx: number, ty: number): OreNode | null {
  const node = nodeOfCell(seed, Math.floor(tx / ORE_CELL), Math.floor(ty / ORE_CELL));

  return node && inDisc(tx, ty, node.tx, node.ty, node.radius) ? node : null;
}

/**
 * Les tuiles qu'Adam peut atteindre à pied depuis son départ, dans un carré
 * de `HOME_REACH` tuiles autour de lui. Seule l'eau arrête : un arbre ou un
 * rocher se récolte. Clés : `x + y * SPAN`, relatives au coin du carré.
 */
function reachableFrom(seed: number, ax: number, ay: number): number[] {
  const seen = new Uint8Array(SPAN * SPAN);
  const start = HOME_REACH + HOME_REACH * SPAN;
  const queue = [start];

  seen[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const x = key % SPAN;
    const y = Math.floor(key / SPAN);

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= SPAN || ny >= SPAN) continue;

      const next = nx + ny * SPAN;

      if (seen[next]) continue;
      if (!isWalkable(terrainAt(seed, nx - HOME_REACH + ax, ny - HOME_REACH + ay))) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return queue;
}

/** Les gisements des cellules à `range` cellules ou moins de celle de la tuile. */
export function oreNodesNear(seed: number, tx: number, ty: number, range: number): OreNode[] {
  const cellX = Math.floor(tx / ORE_CELL);
  const cellY = Math.floor(ty / ORE_CELL);
  const nodes: OreNode[] = [];

  for (let dy = -range; dy <= range; dy += 1) {
    for (let dx = -range; dx <= range; dx += 1) {
      const node = nodeOfCell(seed, cellX + dx, cellY + dy);

      if (node) nodes.push(node);
    }
  }
  return nodes;
}

/*
 * Forêts : un bruit large dessine les massifs, un tirage par tuile fait le
 * grain. Le seuil de massif est haut pour laisser des clairières : un joueur
 * qui ne peut pas traverser un arbre doit pouvoir contourner la forêt.
 */
const FOREST_CELL = 12;
const FOREST_THRESHOLD = 0.58;
const TREE_DENSITY = 0.62;

/** Sur un filon, un rocher par tuile sauf les trous : un patch se traverse à moitié. */
const ROCK_DENSITY = 0.8;

/**
 * La ressource de surface d'une tuile, telle que la carte la génère.
 * Ce qu'il en reste est la responsabilité de `sim/resources.ts`.
 */
export function resourceAt(seed: number, tx: number, ty: number): ResourceId | null {
  const terrain = terrainAt(seed, tx, ty);

  if (terrain === 'water') return null;

  const ore = oreAt(seed, tx, ty);

  if (ore) {
    // Le cœur d'un filon porte toujours son rocher : celui du foyer ne peut pas sortir vide.
    const roll = hash3(seed ^ 0x2545f491, tx, ty) / 4294967296;
    const core = tx === ore.tx && ty === ore.ty;

    return core || roll < ROCK_DENSITY ? (ROCK_OF_ORE[ore.item] ?? null) : null;
  }

  const { grove } = homeOf(seed);
  const inGrove = inDisc(tx, ty, grove.tx, grove.ty, HOME_GROVE.radius);

  if (inGrove && tx === grove.tx && ty === grove.ty) return 'tree';
  if (terrain !== 'grass') return null;

  const forest = smoothNoise(seed ^ 0x7f4a7c15, tx, ty, FOREST_CELL);

  if (forest < FOREST_THRESHOLD && !inGrove) return null;

  const roll = hash3(seed ^ 0x1b873593, tx, ty) / 4294967296;

  return roll < TREE_DENSITY ? 'tree' : null;
}

/**
 * Le cœur d'un massif, un peu au-dessus du seuil de forêt : les lisières
 * clairsemées n'abritent pas de loups.
 */
const FOREST_CORE = FOREST_THRESHOLD + 0.05;

/**
 * L'habitat de la faune sur une tuile, ou `null`. Le sable est la rive (il
 * ne borde que l'eau) ; la forêt est l'herbe au cœur d'un massif, qu'un
 * arbre y pousse ou non. Pur, comme le reste : rien n'est stocké.
 */
export function habitatAt(seed: number, tx: number, ty: number): Habitat | null {
  const terrain = terrainAt(seed, tx, ty);

  if (terrain === 'sand') return 'shore';
  if (terrain !== 'grass') return null;
  return smoothNoise(seed ^ 0x7f4a7c15, tx, ty, FOREST_CELL) >= FOREST_CORE ? 'forest' : null;
}

/** Tables de tirage du décor, par terrain : ids et poids cumulés. */
const DECOR_TABLES = new Map<TerrainKind, { ids: DecorId[]; cumulative: number[]; total: number }>();

for (const terrain of ['grass', 'sand', 'rock'] as const satisfies readonly DecorTerrain[]) {
  const ids: DecorId[] = [];
  const cumulative: number[] = [];
  let total = 0;

  for (const id of DECOR_IDS) {
    const weight: number = (DECOR[id].weights as Partial<Record<DecorTerrain, number>>)[terrain] ?? 0;

    if (weight <= 0) continue;
    total += weight;
    ids.push(id);
    cumulative.push(total);
  }
  DECOR_TABLES.set(terrain, { ids, cumulative, total });
}

/**
 * L'élément de décor d'une tuile, ou `null`. Seulement sur une tuile que la
 * carte laisse nue : jamais sous un arbre ni sous un rocher, jamais dans
 * l'eau. Purement visuel — rien dans la simulation n'en dépend.
 */
export function decorAt(seed: number, tx: number, ty: number): DecorId | null {
  const table = DECOR_TABLES.get(terrainAt(seed, tx, ty));

  if (!table || table.total === 0) return null;
  if (hash3(seed ^ 0x3c6ef372, tx, ty) / 4294967296 >= DECOR_DENSITY) return null;
  if (resourceAt(seed, tx, ty) !== null) return null;

  const pick = (hash3(seed ^ 0xa54ff53a, tx, ty) / 4294967296) * table.total;
  const index = table.cumulative.findIndex((bound) => pick < bound);

  return table.ids[index] ?? null;
}
