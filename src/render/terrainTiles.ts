/**
 * Tileset du terrain, fabriqué au démarrage.
 *
 * Un aplat de 32 × 32 px par tuile se lit comme un prototype : l'œil voit la
 * grille avant de voir le paysage. Un vrai tileset 16 bits a trois choses
 * que l'aplat n'a pas, et ce fichier les fabrique :
 *
 * - du **grain** : brins d'herbe, fleurs, cailloux, rides de sable, reflets
 *   sur l'eau — plusieurs variantes par terrain, tirées tuile par tuile ;
 * - des **transitions** : une rive d'écume là où l'eau touche la terre, une
 *   frange d'herbe qui mord sur le sable, un rebord sombre autour de la roche.
 *   C'est ce qui efface la grille ;
 * - des **ombres portées** sous les arbres et les rochers, lumière en haut à
 *   gauche comme le veut la direction artistique.
 *
 * Tout est dessiné pixel par pixel sur un canvas 2D à la résolution source
 * (16 px par tuile), puis affiché ×2 en `nearest`, comme les sprites. Le
 * tirage est seedé : même carte, mêmes brins d'herbe, d'une partie à l'autre.
 */

import { Texture } from 'pixi.js';
import { ART_PIXELS_PER_TILE, PALETTE } from '../data/legacyPixelArt.ts';
import { mulberry32, type Rng } from '../core/rng.ts';
import type { TerrainKind } from '../sim/terrain.ts';
import { TERRAIN_COLORS } from './atlas.ts';

const N = ART_PIXELS_PER_TILE;

/** Variantes par terrain : trois sobres, puis six ornées (fleurs, touffes, cailloux, débris). */
const VARIANTS = 9;

export type Side = 'top' | 'right' | 'bottom' | 'left';

export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

/** Décalage vers la tuile voisine de chaque côté. */
export const SIDE_OFFSET: Record<Side, readonly [number, number]> = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

export interface TerrainTiles {
  /** `VARIANTS` textures par terrain. */
  ground: Record<TerrainKind, readonly Texture[]>;
  /**
   * Transition dessinée **sur** une tuile de `owner`, du côté où la voisine
   * est d'un autre terrain. `null` quand la paire n'a pas de transition.
   */
  edge(owner: TerrainKind, neighbour: TerrainKind, side: Side): Texture | null;
  /** Ombre portée d'un arbre ou d'un rocher : une tuile source, transparente sauf l'ombre. */
  shadow: Texture;
  /** Petite ombre ovale sous un personnage, centrée. */
  footShadow: Texture;
  destroy(): void;
}

type Paint = (x: number, y: number, color: number, alpha?: number) => void;

interface Canvas {
  paint: Paint;
  texture: () => Texture;
}

function canvas(width: number, height: number): Canvas {
  const element = document.createElement('canvas');

  element.width = width;
  element.height = height;

  const context = element.getContext('2d')!;
  const image = context.createImageData(width, height);

  return {
    paint: (x, y, color, alpha = 1) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;

      const offset = (y * width + x) * 4;

      image.data[offset] = (color >> 16) & 0xff;
      image.data[offset + 1] = (color >> 8) & 0xff;
      image.data[offset + 2] = color & 0xff;
      image.data[offset + 3] = Math.round(alpha * 255);
    },
    texture: () => {
      context.putImageData(image, 0, 0);

      const texture = Texture.from(element);

      texture.source.scaleMode = 'nearest';
      return texture;
    },
  };
}

/** Assombrit ou éclaircit une couleur, composante par composante. */
function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));

  return (r << 16) | (g << 8) | b;
}

function fill(paint: Paint, color: number): void {
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) paint(x, y, color);
  }
}

/** Parsème des pixels isolés, pour casser l'aplat sans dessiner de motif. */
function speckle(paint: Paint, rng: Rng, color: number, count: number): void {
  for (let i = 0; i < count; i += 1) paint(Math.floor(rng() * N), Math.floor(rng() * N), color);
}

/* ------------------------------------------------------------------ sols */

function grass(paint: Paint, rng: Rng, variant: number): void {
  const [base, alt] = TERRAIN_COLORS.grass;
  const dark = shade(base, 0.82);
  const light = shade(base, 1.18);

  fill(paint, base);
  speckle(paint, rng, alt, 22);

  // Des brins : un pixel clair au-dessus d'un pixel sombre, la lumière vient d'en haut.
  const blades = 3 + Math.floor(rng() * 4);

  for (let i = 0; i < blades; i += 1) {
    const x = 1 + Math.floor(rng() * (N - 2));
    const y = 1 + Math.floor(rng() * (N - 3));

    paint(x, y, light);
    paint(x, y + 1, dark);
    if (rng() < 0.5) {
      paint(x + 1, y + 1, light);
      paint(x + 1, y + 2, dark);
    }
  }

  // Variantes rares : fleurs sauvages, touffe haute, cailloux. Le reste reste sobre.
  if (variant === 3 || variant === 6) {
    const flowers = [PALETTE.blanketLight, PALETTE.plaster, PALETTE.accent];

    for (let i = 0; i < 3; i += 1) {
      const x = 2 + Math.floor(rng() * (N - 4));
      const y = 2 + Math.floor(rng() * (N - 4));

      paint(x, y, flowers[i % flowers.length]!);
      paint(x, y + 1, dark);
    }
  } else if (variant === 4 || variant === 7) {
    const x = 4 + Math.floor(rng() * 7);
    const y = 5 + Math.floor(rng() * 5);

    for (const [dx, dy] of [[0, 0], [2, -1], [4, 0], [1, 1], [3, 1]] as const) {
      paint(x + dx, y + dy, light);
      paint(x + dx, y + dy + 1, base);
      paint(x + dx, y + dy + 2, dark);
    }
  } else if (variant === 5 || variant === 8) {
    for (let i = 0; i < 1 + (variant % 2); i += 1) {
      const x = 2 + Math.floor(rng() * (N - 4));
      const y = 2 + Math.floor(rng() * (N - 4));

      paint(x, y, PALETTE.rockLight);
      paint(x + 1, y, PALETTE.rock);
      paint(x, y + 1, PALETTE.rock);
      paint(x + 1, y + 1, PALETTE.rockDark);
    }
  }
}

function sand(paint: Paint, rng: Rng, variant: number): void {
  const [base, alt] = TERRAIN_COLORS.sand;
  const dark = shade(base, 0.86);
  const light = shade(base, 1.08);

  fill(paint, base);
  speckle(paint, rng, alt, 18);
  speckle(paint, rng, light, 6);

  // Rides laissées par le vent : de courts traits horizontaux.
  const ripples = 2 + (variant % 3);

  for (let i = 0; i < ripples; i += 1) {
    const x = Math.floor(rng() * (N - 5));
    const y = 1 + Math.floor(rng() * (N - 2));
    const length = 3 + Math.floor(rng() * 3);

    for (let dx = 0; dx < length; dx += 1) paint(x + dx, y, dark);
    for (let dx = 1; dx < length - 1; dx += 1) paint(x + dx, y - 1, light);
  }

  if (variant === 5 || variant === 8) {
    // Un débris rouillé à moitié enfoui : on est dans l'après.
    const x = 4 + Math.floor(rng() * 7);
    const y = 4 + Math.floor(rng() * 7);

    paint(x, y, PALETTE.rust);
    paint(x + 1, y, PALETTE.rust);
    paint(x + 2, y, PALETTE.accent);
    paint(x + 1, y + 1, dark);
  }
}

function rock(paint: Paint, rng: Rng, variant: number): void {
  const [base, alt] = TERRAIN_COLORS.rock;
  const dark = shade(base, 0.78);
  const light = shade(base, 1.2);

  fill(paint, base);
  speckle(paint, rng, alt, 26);
  speckle(paint, rng, light, 5);

  // Des fissures : une marche aléatoire courte, éclairée sur son bord haut.
  const cracks = 1 + (variant % 2);

  for (let i = 0; i < cracks; i += 1) {
    let x = 2 + Math.floor(rng() * (N - 4));
    let y = 2 + Math.floor(rng() * (N - 4));

    for (let step = 0; step < 5; step += 1) {
      paint(x, y, dark);
      paint(x, y - 1, light);
      x += rng() < 0.6 ? 1 : 0;
      y += rng() < 0.5 ? 1 : 0;
    }
  }

  if (variant === 4 || variant === 7) {
    // Une dalle de béton affleurante : les ruines de ce qu'il y avait avant.
    const x = 3 + Math.floor(rng() * 6);
    const y = 3 + Math.floor(rng() * 6);

    for (let dy = 0; dy < 4; dy += 1) {
      for (let dx = 0; dx < 5; dx += 1) paint(x + dx, y + dy, dy === 0 ? light : alt);
    }
    for (let dx = 0; dx < 5; dx += 1) paint(x + dx, y + 4, dark);
  }
}

function water(paint: Paint, rng: Rng, variant: number): void {
  const [base, alt] = TERRAIN_COLORS.water;
  const light = shade(base, 1.25);
  const deep = shade(base, 0.9);

  fill(paint, base);
  speckle(paint, rng, alt, 20);
  speckle(paint, rng, deep, 10);

  // Des reflets : de petits tirets clairs, espacés.
  const glints = 1 + (variant % 3);

  for (let i = 0; i < glints; i += 1) {
    const x = 1 + Math.floor(rng() * (N - 5));
    const y = 1 + Math.floor(rng() * (N - 2));

    paint(x, y, light);
    paint(x + 1, y, light);
    if (rng() < 0.5) paint(x + 2, y, light);
  }
}

const PAINTERS: Record<TerrainKind, (paint: Paint, rng: Rng, variant: number) => void> = {
  grass,
  sand,
  rock,
  water,
};

/* ----------------------------------------------------------- transitions */

/**
 * Coordonnées d'un pixel de bord : `along` court le long du côté, `depth`
 * s'enfonce vers l'intérieur de la tuile (0 = tout contre la voisine).
 */
function edgePixel(side: Side, along: number, depth: number): [number, number] {
  switch (side) {
    case 'top':
      return [along, depth];
    case 'bottom':
      return [along, N - 1 - depth];
    case 'left':
      return [depth, along];
    case 'right':
      return [N - 1 - depth, along];
  }
}

/** Profondeur ondulante le long d'un bord : jamais une ligne droite. */
function wobble(rng: Rng, min: number, max: number): number[] {
  const depths: number[] = [];
  let depth = min + Math.floor(rng() * (max - min + 1));

  for (let i = 0; i < N; i += 1) {
    depths.push(depth);
    if (rng() < 0.45) depth = Math.max(min, Math.min(max, depth + (rng() < 0.5 ? -1 : 1)));
  }
  return depths;
}

/** L'eau contre la terre : un liseré d'écume, puis une bande d'eau claire peu profonde. */
function shore(paint: Paint, rng: Rng, side: Side): void {
  const [base] = TERRAIN_COLORS.water;
  const shallow = shade(base, 1.2);
  const foam = 0xa9c9d4;
  const depths = wobble(rng, 1, 2);

  for (let along = 0; along < N; along += 1) {
    const depth = depths[along]!;

    for (let d = 0; d < depth; d += 1) paint(...edgePixel(side, along, d), foam);
    paint(...edgePixel(side, along, depth), shallow);
    paint(...edgePixel(side, along, depth + 1), shallow, 0.5);
  }
}

/** L'herbe qui mord sur le sable ou la roche : une frange irrégulière. */
function fringe(paint: Paint, rng: Rng, side: Side): void {
  const [base] = TERRAIN_COLORS.grass;
  const dark = shade(base, 0.82);
  const depths = wobble(rng, 0, 2);

  for (let along = 0; along < N; along += 1) {
    const depth = depths[along]!;

    for (let d = 0; d < depth; d += 1) paint(...edgePixel(side, along, d), base);
    paint(...edgePixel(side, along, depth), dark);
  }
}

/** Le sable contre l'eau : une bande humide, plus sombre. */
function wetSand(paint: Paint, rng: Rng, side: Side): void {
  const [base] = TERRAIN_COLORS.sand;
  const wet = shade(base, 0.8);
  const depths = wobble(rng, 1, 2);

  for (let along = 0; along < N; along += 1) {
    for (let d = 0; d < depths[along]!; d += 1) paint(...edgePixel(side, along, d), wet, d === 0 ? 1 : 0.6);
  }
}

/**
 * La roche est un plateau : son rebord est éclairé en haut et à gauche, dans
 * l'ombre en bas et à droite — une marche, lue en un coup d'œil.
 */
function ledge(paint: Paint, rng: Rng, side: Side): void {
  const [base] = TERRAIN_COLORS.rock;
  const lit = side === 'top' || side === 'left';
  const depths = wobble(rng, lit ? 1 : 2, lit ? 2 : 3);

  for (let along = 0; along < N; along += 1) {
    const depth = depths[along]!;

    for (let d = 0; d < depth; d += 1) {
      // Côté ombre, une face de falaise : le pixel du pied est le plus noir.
      const color = lit ? shade(base, d === 0 ? 1.32 : 1.14) : shade(base, d === 0 ? 0.5 : 0.66);

      paint(...edgePixel(side, along, d), color);
    }
  }
}

type EdgePainter = (paint: Paint, rng: Rng, side: Side) => void;

/** Quelle transition la tuile `owner` dessine face à une voisine `neighbour`. */
function edgePainter(owner: TerrainKind, neighbour: TerrainKind): EdgePainter | null {
  if (owner === 'water') return shore;
  if (owner === 'rock') return ledge;
  if (owner === 'sand' && neighbour === 'water') return wetSand;
  if (owner === 'sand' && neighbour === 'grass') return fringe;
  return null;
}

/* ---------------------------------------------------------------- ombres */

function treeShadow(): Texture {
  const { paint, texture } = canvas(N, N);

  // Ovale aplati, décalé vers le bas à droite : la lumière vient d'en haut à gauche.
  for (let y = 11; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const dx = (x - 9.5) / 6.5;
      const dy = (y - 13.5) / 2.6;

      if (dx * dx + dy * dy <= 1) paint(x, y, PALETTE.outline, 0.32);
    }
  }
  return texture();
}

function footShadow(): Texture {
  const width = 12;
  const height = 4;
  const { paint, texture } = canvas(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x + 0.5 - width / 2) / (width / 2);
      const dy = (y + 0.5 - height / 2) / (height / 2);

      if (dx * dx + dy * dy <= 1) paint(x, y, PALETTE.outline, 0.35);
    }
  }
  return texture();
}

/* ---------------------------------------------------------------- export */

const KINDS: readonly TerrainKind[] = ['water', 'sand', 'grass', 'rock'];

export function createTerrainTiles(seed: number): TerrainTiles {
  const rng = mulberry32(seed ^ 0x51ed270b);
  const owned: Texture[] = [];

  const ground = {} as Record<TerrainKind, Texture[]>;

  for (const kind of KINDS) {
    ground[kind] = [];
    for (let variant = 0; variant < VARIANTS; variant += 1) {
      const { paint, texture } = canvas(N, N);

      PAINTERS[kind](paint, rng, variant);

      const baked = texture();

      ground[kind].push(baked);
      owned.push(baked);
    }
  }

  const edges = new Map<string, Texture | null>();

  for (const owner of KINDS) {
    for (const neighbour of KINDS) {
      if (owner === neighbour) continue;

      const painter = edgePainter(owner, neighbour);

      for (const side of SIDES) {
        let baked: Texture | null = null;

        if (painter) {
          const { paint, texture } = canvas(N, N);

          painter(paint, rng, side);
          baked = texture();
          owned.push(baked);
        }
        edges.set(`${owner}>${neighbour}:${side}`, baked);
      }
    }
  }

  const shadow = treeShadow();
  const foot = footShadow();

  owned.push(shadow, foot);

  return {
    ground,
    edge: (owner, neighbour, side) => edges.get(`${owner}>${neighbour}:${side}`) ?? null,
    shadow,
    footShadow: foot,
    destroy() {
      for (const texture of owned) texture.destroy(true);
    },
  };
}

/**
 * Variante de sol d'une tuile, depuis un hachage. La variante 0, la plus
 * Les trois premières variantes, sobres, sortent quatre fois sur cinq : un
 * sol trop chargé fatigue l'œil et noie les ressources.
 */
export function variantOf(hash: number): number {
  const roll = hash % 32;

  // Trois sols sobres sur 26 tirages, six variantes ornées sur 6.
  if (roll < 26) return roll % 3;
  return 3 + (roll - 26);
}
