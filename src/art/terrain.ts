/**
 * Le sol : tuiles, transitions, coins et ombres portées.
 *
 * Vue de dessus en 3/4 :
 * - l'**herbe** est une prairie continue, sans damier ni contour de case :
 *   un aplat, sur lequel le bake pose de grandes taches aux bords ronds,
 *   plus claires ou plus denses (`MEADOW_PATCHES`), des brins et des
 *   fleurettes semés hors de la grille (`MEADOW_SPRINKLES`), et les chemins
 *   de terre battue de la ville (`TRAIL_DOTS`). La grille ne se montre
 *   qu'en mode construction (`render/ghostLayer.ts`) ;
 * - le **sable** a un liseré clair côté lumière, là où il touche un autre sol ;
 * - l'**eau** a trois profondeurs (`WATER_TILES`) : claire au bord, plus
 *   bleue au large, plus encore au milieu des grands lacs, chaque palier aux
 *   coins arrondis ; sa face avant, plus sombre, se voit en bas — c'est un
 *   creux, vu de trois quarts. L'écume des rives et les vaguelettes du large
 *   sont des sprites à part, animés au-dessus du sol baké (`WATER_SPRITES`,
 *   `render/waterLayer.ts`) ;
 * - la **roche** est un plateau : dessus pâle, face avant sombre en bas,
 *   liseré clair en haut.
 * Là où un sol s'avance dans un autre, son coin s'arrondit (`corner`) : les
 * étangs et les plateaux ont les angles doux des autres formes du jeu.
 *
 * Chaque tuile est un SVG de 32 × 32, bakée avec les autres dans la texture
 * du chunk (`render/chunkLayer.ts`).
 */

import { GROUND, PALETTE, circle, ellipse, group, pill, rect, shape, svg, type Ground } from '../data/artDirection.ts';

const T = 32;

/**
 * Rayon des coins arrondis entre deux sols : une demi-tuile. Une rive en
 * biais, qui avance d'une case à chaque rangée, devient une vague — l'arc
 * saillant d'une marche rejoint le suivant —, jamais un escalier.
 */
export const CORNER_RADIUS = 16;

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

function tile(...body: string[]): string {
  return svg(T, T, ...body);
}

function flat(ground: Ground, tone: 'base' | 'alt' = 'base'): string {
  return rect(0, 0, T, T, GROUND[ground][tone], 0);
}

/** Profondeurs de l'eau, du bord vers le large : la couleur de chaque palier. */
export const WATER_DEPTH_COLORS = [GROUND.water.base, GROUND.water.alt, GROUND.water.deep] as const;

export type WaterDepth = 0 | 1 | 2;

/**
 * Les tuiles d'eau, par profondeur : un aplat par palier, sans reflet baké.
 * Un reflet figé dans le sol se lit comme un tiret peint sur l'eau ; ce
 * sont les vaguelettes animées qui font vivre le large.
 */
export const WATER_TILES: Readonly<Record<WaterDepth, readonly string[]>> = {
  0: [tile(flat('water'))],
  1: [tile(rect(0, 0, T, T, GROUND.water.alt, 0))],
  2: [tile(rect(0, 0, T, T, GROUND.water.deep, 0))],
};

/**
 * Les variantes de chaque sol. L'herbe n'en a qu'une, un aplat : ce qui la
 * fait vivre est posé par-dessus, sans suivre les cases. Les autres en ont
 * trois, tirées par tuile — la première, sobre, le plus souvent. L'eau a les
 * siennes par profondeur (`WATER_TILES`) : ici, celles du bord.
 */
export const GROUND_TILES: Record<Ground, readonly string[]> = {
  grass: [tile(flat('grass'))],
  sand: [
    tile(flat('sand')),
    tile(flat('sand'), pill(18, 20, 9, 2.4, GROUND.sand.alt)),
    tile(flat('sand'), pill(5, 10, 12, 2.6, GROUND.sand.light), pill(15, 22, 8, 2.4, GROUND.sand.light)),
  ],
  water: WATER_TILES[0],
  rock: [
    tile(flat('rock')),
    // Pas d'aplat d'un autre ton : des carrés de teinte voisine feraient un damier.
    tile(flat('rock'), pill(16, 18, 10, 3, GROUND.rock.alt), circle(9, 10, 2, GROUND.rock.alt)),
    tile(flat('rock'), rect(6, 8, 14, 10, GROUND.rock.alt, 4), pill(8, 9.5, 6, 2, GROUND.rock.light)),
  ],
};

/**
 * Transition dessinée **sur** une tuile de `owner`, du côté `side` où la
 * voisine est d'un autre sol. `null` : ce côté n'a rien à dessiner.
 */
export function edgeTile(owner: Ground, side: Side): string | null {
  switch (owner) {
    case 'water':
      // La face avant du creux : on voit la profondeur en bas de l'étang.
      return side === 'bottom' ? tile(rect(0, 23, T, 9, GROUND.water.shade, 0)) : null;
    case 'sand':
      return side === 'top' ? tile(rect(0, 0, T, 4, GROUND.sand.light, 0)) : null;
    case 'rock':
      if (side === 'bottom') return tile(rect(0, 24, T, 8, GROUND.rock.shade, 0));
      if (side === 'top') return tile(rect(0, 0, T, 3, GROUND.rock.light, 0));
      return null;
    case 'grass':
      return null;
  }
}

/**
 * Un coin arrondi : le quart de tuile hors du quart de rond, dans la
 * couleur du sol voisin. Posé sur un coin saillant, il arrondit la forme —
 * un étang, un plateau, ou un palier de profondeur de l'eau.
 */
export function cornerTile(color: (typeof GROUND)[Ground]['base' | 'alt'] | typeof GROUND.water.deep, corner: Corner): string {
  const r = CORNER_RADIUS;
  const paths: Record<Corner, string> = {
    tl: `M0 0H${r}A${r} ${r} 0 0 0 0 ${r}Z`,
    tr: `M${T} 0V${r}A${r} ${r} 0 0 0 ${T - r} 0Z`,
    bl: `M0 ${T}V${T - r}A${r} ${r} 0 0 0 ${r} ${T}Z`,
    br: `M${T} ${T}H${T - r}A${r} ${r} 0 0 0 ${T} ${T - r}Z`,
  };

  return tile(shape(paths[corner], color));
}

/** Largeur et hauteur de l'ombre portée de référence ; le rendu l'étire selon l'objet. */
export const SHADOW_SIZE = { width: 32, height: 10 } as const;

/** L'ombre portée : une capsule pleine dans la teinte foncée du sol. */
export function shadowTile(ground: Ground): string {
  return svg(SHADOW_SIZE.width, SHADOW_SIZE.height, pill(0, 0, SHADOW_SIZE.width, SHADOW_SIZE.height, GROUND[ground].shade));
}

/**
 * Les sprites animés de l'eau, posés au-dessus du sol baké.
 *
 * - `foam.0`, `foam.1` : l'écume d'une rive, une rangée de bulles claires de
 *   tailles mêlées, un reflet blanc dans la plus grosse ; centrée sur le
 *   milieu du côté de la tuile (tournée d'un quart pour les rives gauche et
 *   droite). Des ronds plutôt qu'une capsule : bout à bout, ils font un
 *   bouillon, pas un pointillé.
 * - `wavelet.0`, `wavelet.1` : une vaguelette du large, un croissant clair
 *   bombé vers la lumière, un point blanc à gauche.
 *
 * Cadres serrés, centrés sur leur milieu (la base pour une vaguelette) : le
 * rendu les fait gonfler et naître autour de ce point.
 */
const FOAM_HEIGHT = 6;

function foam(radii: readonly number[]): string {
  const centres: number[] = [];
  let x = 0;

  for (const r of radii) {
    centres.push(x + r);
    x += r * 2 - 0.6;
  }

  const biggest = radii.indexOf(Math.max(...radii));
  const r = radii[biggest]!;

  return svg(
    x + 0.6,
    FOAM_HEIGHT,
    ...radii.map((radius, i) => circle(centres[i]!, FOAM_HEIGHT / 2, radius, GROUND.water.light)),
    circle(centres[biggest]! - r * 0.3, FOAM_HEIGHT / 2 - r * 0.35, r * 0.38, PALETTE.paper.base),
  );
}

const WAVELET_HEIGHT = 6;

/** Un croissant : deux demi-ellipses de même corde, l'une plus bombée que l'autre. */
function wavelet(width: number): string {
  const rx = width / 2;
  const base = WAVELET_HEIGHT - 1;

  return svg(
    width,
    WAVELET_HEIGHT,
    shape(`M0 ${base}A${rx} ${base - 0.5} 0 0 1 ${width} ${base}A${rx} ${base - 3.2} 0 0 0 0 ${base}Z`, GROUND.water.light),
    circle(width * 0.3, 2.2, 1, PALETTE.paper.base),
  );
}

export const WATER_SPRITES = {
  'foam.0': foam([2.2, 1.5, 2.8, 1.8, 2.4, 1.4]),
  'foam.1': foam([1.6, 2.6, 2, 1.4, 2.8, 1.9]),
  'wavelet.0': wavelet(14),
  'wavelet.1': wavelet(10),
} as const;

export type WaterSprite = keyof typeof WATER_SPRITES;

/* ---------------------------------------------------------------- prairie */

/** Cadre d'une tache de prairie, en pixels monde : six tuiles sur quatre. */
export const PATCH_SIZE = { width: 192, height: 128 } as const;

/**
 * Les silhouettes des taches : des ellipses d'une seule couleur qui se
 * chevauchent — l'union fait un bord rond et irrégulier, jamais une case.
 * Chaque ellipse : centre x, centre y, rayon x, rayon y.
 */
const PATCH_SHAPES: readonly (readonly [number, number, number, number])[][] = [
  [
    [96, 64, 70, 40],
    [56, 56, 40, 30],
    [134, 76, 44, 30],
  ],
  [
    [90, 60, 56, 42],
    [138, 54, 38, 28],
    [70, 84, 46, 26],
  ],
  [
    [100, 70, 74, 34],
    [64, 52, 34, 26],
    [128, 50, 40, 28],
    [150, 84, 26, 20],
  ],
];

export type PatchTone = 'meadow' | 'thicket';

export const PATCH_TONES: readonly PatchTone[] = ['meadow', 'thicket'];

/** Nombre de silhouettes de tache : le bake en tire une par tache. */
export const PATCH_SHAPE_COUNT = PATCH_SHAPES.length;

function patch(ellipses: readonly (readonly [number, number, number, number])[], tone: PatchTone): string {
  return svg(PATCH_SIZE.width, PATCH_SIZE.height, ...ellipses.map(([cx, cy, rx, ry]) => ellipse(cx, cy, rx, ry, GROUND.grass[tone])));
}

/** Les taches de la prairie, `meadow.0`… `thicket.2` : posées sous tout le reste, à l'échelle que tire le bake. */
export const MEADOW_PATCHES: Readonly<Record<string, string>> = Object.fromEntries(
  PATCH_TONES.flatMap((tone) => PATCH_SHAPES.map((ellipses, i) => [`${tone}.${i}`, patch(ellipses, tone)])),
);

/** Un brin d'herbe : une capsule fine, inclinée autour de son pied. */
function blade(x: number, angle: number, length: number): string {
  return group(`rotate(${angle} ${x} 11)`, pill(x - 1, 11 - length, 2, length, GROUND.grass.shade));
}

/**
 * Ce que le bake sème sur l'herbe, à des places tirées de la seed qui ne
 * suivent pas la grille : deux touffes de brins, et des fleurettes —
 * trois points de couleur, la vie qui reprend. Cadres de 14 × 12, ancrés au milieu du pied.
 */
export const MEADOW_SPRINKLES = {
  'sprig.0': svg(14, 12, blade(5, -24, 7), blade(7, 0, 9), blade(9, 22, 7)),
  'sprig.1': svg(14, 12, blade(6, -14, 8), blade(9, 18, 6)),
  'speck.0': svg(
    14,
    12,
    circle(4, 7, 1.6, PALETTE.coral.base),
    circle(9, 4, 1.6, PALETTE.yellow.base),
    circle(10, 9, 1.4, PALETTE.violet.light),
  ),
  'speck.1': svg(14, 12, circle(5, 5, 1.6, PALETTE.paper.base), circle(9, 8, 1.6, PALETTE.yellow.base), circle(4, 9.5, 1.2, PALETTE.coral.light)),
} as const;

export type MeadowSprinkle = keyof typeof MEADOW_SPRINKLES;

/**
 * Les chemins de terre battue : un trait épais tamponné en ronds le long
 * d'une courbe — leur union fait une capsule qui tourne —, et la trace plus
 * claire du milieu, là où l'on marche. Diamètres en pixels monde.
 */
export const TRAIL_WIDTH = { outer: 16, inner: 5 } as const;

export const TRAIL_DOTS = {
  outer: svg(TRAIL_WIDTH.outer, TRAIL_WIDTH.outer, circle(TRAIL_WIDTH.outer / 2, TRAIL_WIDTH.outer / 2, TRAIL_WIDTH.outer / 2, GROUND.grass.trail)),
  inner: svg(TRAIL_WIDTH.inner, TRAIL_WIDTH.inner, circle(TRAIL_WIDTH.inner / 2, TRAIL_WIDTH.inner / 2, TRAIL_WIDTH.inner / 2, GROUND.grass.trailLight)),
} as const;
