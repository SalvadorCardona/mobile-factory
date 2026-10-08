/**
 * Le champ de l'eau d'un bloc : ce que lit le shader (`waterShader.ts`).
 *
 * La simulation ne connaît que des tuiles d'eau ou de terre ; une rive
 * dessinée case par case fait un escalier. Ici, chaque bloc reçoit une petite
 * texture de données, `FIELD_TEXELS` texels par tuile, qui lisse la grille :
 *
 * - **R, le niveau** : 1 au cœur d'une tuile d'eau, 0 au cœur d'une tuile à
 *   sec, interpolé entre les deux puis adouci d'un flou d'une demi-tuile. La
 *   rive est la courbe où il vaut ½ : sur un bord droit, elle tombe pile
 *   entre les deux tuiles ; une rive en biais devient une pente, un coin
 *   s'arrondit. Le shader y ajoute un bruit fixe : le bord ondule un peu ;
 * - **G, la profondeur** : la distance de la tuile à la terre la plus proche,
 *   jusqu'à `DEPTH_REACH` tuiles, ramenée à 0–1 et adoucie de même. Le
 *   shader en tire un dégradé continu, sans palier ;
 * - **B, le tremblé de la rive** : un bruit fixe, lu sur les coordonnées du
 *   monde, que le shader ajoute au niveau — le bord ondule de quelques pixels ;
 * - **A, le retard du ressac** : un bruit lent qui déphase l'écume le long de
 *   la rive.
 *
 * Les deux bruits sont calculés ici une fois pour toutes plutôt que par pixel
 * à chaque image : le shader n'a plus qu'à les lire.
 *
 * Les texels tombent sur les nœuds d'une grille qui commence au coin du
 * bloc et finit au coin opposé (`FIELD_SIZE` = 16 × 4 + 1) : deux blocs
 * voisins ont exactement les mêmes valeurs sur leur bord commun, la rive ne
 * se casse pas d'un bloc à l'autre.
 *
 * Seules les tuiles d'eau et leurs voisines sont peintes (`tiles`) : un bloc
 * sans eau n'a pas de champ, et le shader ne passe pas sur la prairie.
 *
 * Rien de Pixi ici : tout se teste en Node. Rien n'est de l'état de jeu.
 */

import { hash3 } from '../core/rng.ts';
import { BlockTerrain } from './terrainTiles.ts';

/** Texels par tuile : assez pour une courbe lisse une fois interpolée par le GPU. */
export const FIELD_TEXELS = 4;

/** Profondeur maximale, en tuiles de la rive : au-delà, le fond est le plus bleu. */
export const DEPTH_REACH = 4;

/** Rayon du flou qui arrondit la rive, en texels : une demi-tuile. */
const BLUR = FIELD_TEXELS / 2;

/** Côté du champ d'un bloc de `tiles` tuiles, en texels : un nœud par quart de tuile, bords compris. */
export function fieldSize(tiles: number): number {
  return tiles * FIELD_TEXELS + 1;
}

export interface WaterField {
  /** RGBA, `size` × `size` : R le niveau, G la profondeur, B le tremblé de la rive, A le retard du ressac. */
  data: Uint8Array;
  size: number;
  /** Tuiles du bloc, en coordonnées locales, que le shader peint : l'eau et ses voisines. */
  tiles: readonly (readonly [number, number])[];
}

/**
 * Le champ du bloc de `size` tuiles dont le coin est (baseTx, baseTy), ou
 * `null` s'il n'y a ni eau ni rive à peindre.
 */
export function waterField(seed: number, baseTx: number, baseTy: number, size: number): WaterField | null {
  // Les tuiles lues autour : le flou et l'interpolation débordent d'une
  // tuile et demie, la profondeur cherche la terre `DEPTH_REACH` plus loin.
  const reach = 2;
  const margin = reach + DEPTH_REACH + 1;
  const terrain = new BlockTerrain(seed, baseTx, baseTy, size, margin);
  const wet = (lx: number, ly: number): boolean => terrain.kind(lx, ly) === 'water';

  const tiles: [number, number][] = [];

  for (let ly = 0; ly < size; ly += 1) {
    for (let lx = 0; lx < size; lx += 1) {
      if (nearWater(wet, lx, ly)) tiles.push([lx, ly]);
    }
  }
  if (tiles.length === 0) return null;

  // Valeurs par tuile, sur le bloc et `reach` tuiles autour.
  const span = size + reach * 2;
  const level = new Float32Array(span * span);
  const depth = new Float32Array(span * span);

  for (let ly = -reach; ly < size + reach; ly += 1) {
    for (let lx = -reach; lx < size + reach; lx += 1) {
      const i = (ly + reach) * span + lx + reach;

      if (!wet(lx, ly)) continue;
      level[i] = 1;
      depth[i] = shoreDistance(wet, lx, ly) / DEPTH_REACH;
    }
  }

  // Nœuds de la grille fine, flou compris : texel k au point k / FIELD_TEXELS
  // tuiles du coin du bloc, de -BLUR à fieldSize + BLUR.
  const nodes = fieldSize(size);
  const wide = nodes + BLUR * 2;
  const sample = (values: Float32Array, k: number, j: number): number => {
    // Les centres de tuile sont en t + ½ : on interpole entre les quatre qui entourent le point.
    const u = (k - BLUR) / FIELD_TEXELS - 0.5;
    const v = (j - BLUR) / FIELD_TEXELS - 0.5;
    const tx = Math.floor(u);
    const ty = Math.floor(v);
    const fx = u - tx;
    const fy = v - ty;
    const at = (x: number, y: number): number => values[(y + reach) * span + x + reach]!;
    const top = at(tx, ty) + (at(tx + 1, ty) - at(tx, ty)) * fx;
    const bottom = at(tx, ty + 1) + (at(tx + 1, ty + 1) - at(tx, ty + 1)) * fx;

    return top + (bottom - top) * fy;
  };
  const smooth = (values: Float32Array): Float32Array => {
    const raw = new Float32Array(wide * wide);

    for (let j = 0; j < wide; j += 1) {
      for (let k = 0; k < wide; k += 1) raw[j * wide + k] = sample(values, k, j);
    }
    return blur(raw, wide, nodes);
  };

  const levels = smooth(level);
  const depths = smooth(depth);
  const data = new Uint8Array(nodes * nodes * 4);

  for (let j = 0; j < nodes; j += 1) {
    for (let k = 0; k < nodes; k += 1) {
      const i = j * nodes + k;
      // Le nœud, en tuiles du monde : les bruits se raccordent d'un bloc à l'autre.
      const x = baseTx + k / FIELD_TEXELS;
      const y = baseTy + j / FIELD_TEXELS;

      data[i * 4] = Math.round(levels[i]! * 255);
      data[i * 4 + 1] = Math.round(depths[i]! * 255);
      data[i * 4 + 2] = Math.round((0.65 * valueNoise(seed ^ 0x2545f491, x, y, 1.4) + 0.35 * valueNoise(seed ^ 0x6c8e9cf5, x, y, 0.6)) * 255);
      data[i * 4 + 3] = Math.round(valueNoise(seed ^ 0x1b873593, x, y, 3.3) * 255);
    }
  }

  return { data, size: nodes, tiles };
}

/**
 * Bruit de valeur lissé, 0 à 1, sur un réseau de `cell` tuiles : des bosses
 * rondes, tirées de la seed. Le même en tout point du monde, quel que soit le bloc.
 */
function valueNoise(seed: number, x: number, y: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (ix: number, iy: number): number => hash3(seed, ix, iy) / 0x100000000;
  const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * sx;
  const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * sx;

  return top + (bottom - top) * sy;
}

/** Côté de la texture de bruit des ondulations, en texels, et son nombre de mailles de bruit avant de se répéter. */
export const RIPPLE_TEXELS = 64;
export const RIPPLE_LATTICE = 16;

/**
 * Le bruit des ondulations : une texture qui se répète sans couture, que le
 * shader fait glisser sous l'eau (`uRipples`). Un bruit de gradient — des
 * formes rondes, sans les carrés d'un bruit de valeur —, périodique : son
 * réseau de `RIPPLE_LATTICE` mailles boucle sur lui-même. R seul compte.
 */
export function ripplesTexture(seed: number): Uint8Array {
  const lattice = RIPPLE_LATTICE;
  const data = new Uint8Array(RIPPLE_TEXELS * RIPPLE_TEXELS * 4);
  const gradient = (ix: number, iy: number): readonly [number, number] => {
    const angle = (hash3(seed ^ 0x3c6ef372, ix % lattice, iy % lattice) / 0x100000000) * Math.PI * 2;

    return [Math.cos(angle), Math.sin(angle)];
  };
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

  for (let j = 0; j < RIPPLE_TEXELS; j += 1) {
    for (let k = 0; k < RIPPLE_TEXELS; k += 1) {
      const x = ((k + 0.5) / RIPPLE_TEXELS) * lattice;
      const y = ((j + 0.5) / RIPPLE_TEXELS) * lattice;
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      const fx = x - gx;
      const fy = y - gy;
      const dot = (ix: number, iy: number): number => {
        const [cx, cy] = gradient(gx + ix, gy + iy);

        return cx * (fx - ix) + cy * (fy - iy);
      };
      const top = dot(0, 0) + (dot(1, 0) - dot(0, 0)) * fade(fx);
      const bottom = dot(0, 1) + (dot(1, 1) - dot(0, 1)) * fade(fx);
      const value = 0.5 + (top + (bottom - top) * fade(fy)) * 0.9;
      const i = (j * RIPPLE_TEXELS + k) * 4;

      data[i] = Math.round(Math.min(1, Math.max(0, value)) * 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Une tuile que le shader peint : de l'eau, ou une voisine de l'eau — la rive courbe peut y mordre. */
function nearWater(wet: (lx: number, ly: number) => boolean, lx: number, ly: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) if (wet(lx + dx, ly + dy)) return true;
  }
  return false;
}

/** Distance d'une tuile d'eau à la terre la plus proche, de centre à centre, plafonnée à `DEPTH_REACH`. */
function shoreDistance(wet: (lx: number, ly: number) => boolean, lx: number, ly: number): number {
  let best = DEPTH_REACH * DEPTH_REACH;

  for (let dy = -DEPTH_REACH; dy <= DEPTH_REACH; dy += 1) {
    for (let dx = -DEPTH_REACH; dx <= DEPTH_REACH; dx += 1) {
      const d = dx * dx + dy * dy;

      if (d < best && !wet(lx + dx, ly + dy)) best = d;
    }
  }
  return Math.sqrt(best);
}

/**
 * Flou en boîte séparable de rayon `BLUR` sur une grille `wide` × `wide`,
 * rogné à son centre `nodes` × `nodes`.
 */
function blur(raw: Float32Array, wide: number, nodes: number): Float32Array {
  const taps = BLUR * 2 + 1;
  const rows = new Float32Array(wide * nodes);

  for (let j = 0; j < wide; j += 1) {
    for (let k = 0; k < nodes; k += 1) {
      let sum = 0;

      for (let d = 0; d < taps; d += 1) sum += raw[j * wide + k + d]!;
      rows[j * nodes + k] = sum / taps;
    }
  }

  const out = new Float32Array(nodes * nodes);

  for (let j = 0; j < nodes; j += 1) {
    for (let k = 0; k < nodes; k += 1) {
      let sum = 0;

      for (let d = 0; d < taps; d += 1) sum += rows[(j + d) * nodes + k]!;
      out[j * nodes + k] = sum / taps;
    }
  }
  return out;
}
