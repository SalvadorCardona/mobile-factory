/**
 * Normalisation et vérification des planches de sprites générées.
 *
 * Outillage Node, jamais importé par le jeu. Un modèle d'image fournit la
 * forme ; c'est ici que le dépôt impose ce qui fait la cohérence d'une planche
 * à l'autre : les dimensions exactes de la grille, un alpha binaire et une
 * palette strictement réduite à `PALETTE`. La procédure complète est dans
 * `CLAUDE.md` ; ce module en est l'étape « normaliser puis vérifier ».
 */

import { PALETTE } from '../data/artDirection.ts';
import { sheetGrid, type SpriteProto } from '../data/sprites.ts';

/** Image RGBA décodée, 4 octets par pixel, lignes de haut en bas. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface NormalizeOptions {
  /** Recadrage dans l'image d'entrée, en pixels de l'entrée, avant réduction. */
  crop?: { x: number; y: number; width: number; height: number };
  /**
   * Couleur de fond à rendre transparente (0xRRGGBB), pour un modèle qui n'a
   * pas respecté « fond transparent ». Comparée après quantification à la
   * palette : tout pixel dont la couleur d'origine est à moins de
   * `keyTolerance` de cette teinte devient transparent.
   */
  keyColor?: number;
  keyTolerance?: number;
}

export interface NormalizeReport {
  /** Facteur de réduction appliqué (1 = l'image était déjà à la taille). */
  scale: number;
  width: number;
  height: number;
  /** Couleurs opaques distinctes avant quantification. */
  sourceColors: number;
  /** Couleurs de la palette réellement utilisées après quantification. */
  paletteColors: number;
  /**
   * Distance RVB moyenne entre chaque pixel opaque et la couleur de palette
   * qui l'a remplacé. Petit = le modèle a suivi la palette ; grand = il a
   * dérivé et la quantification a beaucoup corrigé.
   */
  meanDrift: number;
  /** Part des pixels opaques, dans [0, 1]. */
  coverage: number;
}

const PALETTE_RGB = Object.values(PALETTE).map((hex) => [hex >> 16, (hex >> 8) & 0xff, hex & 0xff]);
const PALETTE_SET = new Set<number>(Object.values(PALETTE));

function distance(r: number, g: number, b: number, rgb: readonly number[]): number {
  const dr = r - rgb[0]!;
  const dg = g - rgb[1]!;
  const db = b - rgb[2]!;
  return dr * dr + dg * dg + db * db;
}

/** Couleur de `PALETTE` la plus proche, en distance RVB euclidienne. */
export function nearestPaletteColor(r: number, g: number, b: number): {
  rgb: readonly number[];
  drift: number;
} {
  let best = PALETTE_RGB[0]!;
  let bestDistance = Infinity;
  for (const rgb of PALETTE_RGB) {
    const d = distance(r, g, b, rgb);
    if (d < bestDistance) {
      bestDistance = d;
      best = rgb;
    }
  }
  return { rgb: best, drift: Math.sqrt(bestDistance) };
}

export function crop(image: RgbaImage, region: NonNullable<NormalizeOptions['crop']>): RgbaImage {
  const { x, y, width, height } = region;
  if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
    throw new Error(
      `Recadrage ${width}×${height} à (${x}, ${y}) hors de l'image ${image.width}×${image.height}.`,
    );
  }
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { width, height, data };
}

/**
 * Réduction en `nearest` d'un facteur entier : chaque pixel de sortie prend la
 * valeur du pixel central de son bloc `scale × scale`. Aucun mélange, donc
 * aucun anti-aliasing introduit.
 */
export function downscale(image: RgbaImage, scale: number): RgbaImage {
  if (scale === 1) return image;
  const width = image.width / scale;
  const height = image.height / scale;
  const data = new Uint8Array(width * height * 4);
  const offset = Math.floor(scale / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((y * scale + offset) * image.width + x * scale + offset) * 4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Taille attendue en pixels source pour une planche. */
export function sheetSize(proto: SpriteProto): { width: number; height: number } {
  const { rows, columns } = sheetGrid(proto);
  return { width: columns * proto.frameWidth, height: rows * proto.frameHeight };
}

/**
 * Facteur entier qui ramène `image` à la grille de `proto`, ou une erreur
 * explicite si les dimensions ne sont pas un multiple exact : dans ce cas la
 * planche se recadre ou se régénère, elle ne s'étire jamais.
 */
export function scaleFor(image: RgbaImage, proto: SpriteProto): number {
  const target = sheetSize(proto);
  const sx = image.width / target.width;
  const sy = image.height / target.height;
  if (sx !== sy || !Number.isInteger(sx) || sx < 1) {
    throw new Error(
      `Image ${image.width}×${image.height} : la grille attend ${target.width}×${target.height} ` +
        `ou un multiple entier (×2 = ${target.width * 2}×${target.height * 2}, ` +
        `×4 = ${target.width * 4}×${target.height * 4}…). Recadrer ou régénérer.`,
    );
  }
  return sx;
}

/**
 * Applique, dans l'ordre : recadrage, réduction à la grille, alpha binaire,
 * fond incrusté optionnel, quantification à `PALETTE`.
 */
export function normalizeSheet(
  source: RgbaImage,
  proto: SpriteProto,
  options: NormalizeOptions = {},
): { image: RgbaImage; report: NormalizeReport } {
  const cropped = options.crop ? crop(source, options.crop) : source;
  const scale = scaleFor(cropped, proto);
  const image = downscale(cropped, scale);
  const out = new Uint8Array(image.data);

  const keyRgb =
    options.keyColor === undefined
      ? null
      : [options.keyColor >> 16, (options.keyColor >> 8) & 0xff, options.keyColor & 0xff];
  const keyTolerance = options.keyTolerance ?? 24;

  const sourceColors = new Set<number>();
  const used = new Set<number>();
  let opaque = 0;
  let driftSum = 0;

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]!;
    const g = out[i + 1]!;
    const b = out[i + 2]!;
    const a = out[i + 3]!;
    const keyed = keyRgb !== null && Math.sqrt(distance(r, g, b, keyRgb)) <= keyTolerance;
    if (a < 128 || keyed) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    sourceColors.add((r << 16) | (g << 8) | b);
    const { rgb, drift } = nearestPaletteColor(r, g, b);
    out[i] = rgb[0]!;
    out[i + 1] = rgb[1]!;
    out[i + 2] = rgb[2]!;
    out[i + 3] = 255;
    used.add((rgb[0]! << 16) | (rgb[1]! << 8) | rgb[2]!);
    opaque++;
    driftSum += drift;
  }

  const pixels = image.width * image.height;
  return {
    image: { width: image.width, height: image.height, data: out },
    report: {
      scale,
      width: image.width,
      height: image.height,
      sourceColors: sourceColors.size,
      paletteColors: used.size,
      meanDrift: opaque === 0 ? 0 : driftSum / opaque,
      coverage: opaque / pixels,
    },
  };
}

/**
 * Ce qu'une planche référencée par `SPRITES[id].file` doit respecter. Retourne
 * la liste des manquements, vide si tout va bien — même contrat que
 * `validatePrototypes()`.
 */
export function verifySheet(image: RgbaImage, proto: SpriteProto): string[] {
  const problems: string[] = [];
  const target = sheetSize(proto);
  if (image.width !== target.width || image.height !== target.height) {
    problems.push(
      `dimensions ${image.width}×${image.height}, la grille attend ${target.width}×${target.height}`,
    );
  }
  const strangers = new Set<number>();
  let softAlpha = 0;
  let opaque = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const a = image.data[i + 3]!;
    if (a === 0) continue;
    if (a !== 255) {
      softAlpha++;
      continue;
    }
    opaque++;
    const hex = (image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!;
    if (!PALETTE_SET.has(hex)) strangers.add(hex);
  }
  if (softAlpha > 0) problems.push(`${softAlpha} pixel(s) semi-transparents`);
  if (opaque === 0) problems.push('planche entièrement transparente');
  if (strangers.size > 0) {
    const sample = [...strangers]
      .slice(0, 5)
      .map((hex) => '#' + hex.toString(16).padStart(6, '0'))
      .join(', ');
    problems.push(`${strangers.size} couleur(s) hors palette (${sample}…)`);
  }
  return problems;
}
