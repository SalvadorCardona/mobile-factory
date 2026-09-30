/**
 * Le sol : tuiles, transitions, coins et ombres portées.
 *
 * Vue de dessus en 3/4, la grille reste lisible :
 * - l'**herbe** est un damier doux à deux tons, une case par tuile ;
 * - le **sable** a un liseré clair côté lumière, là où il touche un autre sol ;
 * - l'**eau** a trois profondeurs (`WATER_TILES`) : claire au bord, plus
 *   bleue au large, plus encore au milieu des grands lacs, chaque palier aux
 *   coins arrondis ; des reflets en capsule au large ; sa face avant, plus
 *   sombre, se voit en bas — c'est un creux, vu de trois quarts. L'écume des
 *   rives et les reflets qui scintillent sont des sprites à part, animés
 *   au-dessus du sol baké (`WATER_SPRITES`, `render/waterLayer.ts`) ;
 * - la **roche** est un plateau : dessus pâle, face avant sombre en bas,
 *   liseré clair en haut.
 * Là où un sol s'avance dans un autre, son coin s'arrondit (`corner`) : les
 * étangs et les plateaux ont les angles doux des autres formes du jeu.
 *
 * Chaque tuile est un SVG de 32 × 32, bakée avec les autres dans la texture
 * du chunk (`render/chunkLayer.ts`).
 */

import { GROUND, PALETTE, pill, rect, shape, svg, type Ground } from '../data/artDirection.ts';

const T = 32;

/** Rayon des coins arrondis entre deux sols. */
export const CORNER_RADIUS = 12;

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
 * Les tuiles d'eau, par profondeur. Au bord, un aplat clair : l'écume animée
 * suffit à l'animer. Au large, la sobre le plus souvent, puis un long reflet
 * ou deux petits, posés à des endroits différents pour ne pas faire de motif.
 */
export const WATER_TILES: Readonly<Record<WaterDepth, readonly string[]>> = {
  0: [tile(flat('water'))],
  1: [
    tile(rect(0, 0, T, T, GROUND.water.alt, 0)),
    tile(rect(0, 0, T, T, GROUND.water.alt, 0), pill(4, 11, 14, 2.6, GROUND.water.light)),
    tile(rect(0, 0, T, T, GROUND.water.alt, 0), pill(15, 6, 9, 2.4, GROUND.water.light), pill(7, 23, 6, 2.2, GROUND.water.light)),
  ],
  2: [
    tile(rect(0, 0, T, T, GROUND.water.deep, 0)),
    tile(rect(0, 0, T, T, GROUND.water.deep, 0), pill(13, 20, 14, 2.6, GROUND.water.light)),
    tile(rect(0, 0, T, T, GROUND.water.deep, 0), pill(5, 5, 8, 2.4, GROUND.water.light), pill(18, 15, 7, 2.2, GROUND.water.light)),
  ],
};

/**
 * Les variantes de chaque sol. L'herbe en a deux, les deux cases du damier ;
 * les autres en ont trois, tirées par tuile — la première, sobre, le plus
 * souvent. L'eau a les siennes par profondeur (`WATER_TILES`) : ici, celles du bord.
 */
export const GROUND_TILES: Record<Ground, readonly string[]> = {
  grass: [tile(flat('grass')), tile(flat('grass', 'alt'))],
  sand: [
    tile(flat('sand')),
    tile(flat('sand'), pill(18, 20, 9, 2.4, GROUND.sand.alt)),
    tile(flat('sand'), pill(5, 10, 12, 2.6, GROUND.sand.light), pill(15, 22, 8, 2.4, GROUND.sand.light)),
  ],
  water: WATER_TILES[0],
  rock: [
    tile(flat('rock')),
    tile(flat('rock', 'alt')),
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
 * - `foam.0`, `foam.1` : le liseré d'écume d'une rive, deux capsules claires
 *   d'inégale longueur, un reflet blanc dans la plus longue ; centré sur le
 *   milieu du côté de la tuile (tourné d'un quart pour les rives gauche et
 *   droite). Il tient loin des bouts du côté : les coins arrondis de la rive
 *   ne le coupent pas.
 * - `glint.0`, `glint.1` : un reflet au large, une capsule claire ou deux.
 *
 * Cadres serrés, centrés sur leur milieu : le rendu les fait respirer et
 * glisser autour de ce point.
 */
const FOAM = { width: 20, height: 4 } as const;

function foam(long: number, first: boolean): string {
  const short = FOAM.width - long - 2;
  const [longX, shortX] = first ? [0, long + 2] : [short + 2, 0];

  return svg(
    FOAM.width,
    FOAM.height,
    pill(longX, 0, long, FOAM.height, GROUND.water.light),
    pill(shortX, 0, short, FOAM.height, GROUND.water.light),
    pill(longX + 2.5, 1, long * 0.4, 1.6, PALETTE.paper.base),
  );
}

export const WATER_SPRITES = {
  'foam.0': foam(12, true),
  'foam.1': foam(13, false),
  'glint.0': svg(12, 3, pill(0, 0, 12, 3, GROUND.water.light)),
  'glint.1': svg(14, 6, pill(0, 0, 8, 2.6, GROUND.water.light), pill(6, 3.4, 8, 2.6, GROUND.water.light)),
} as const;

export type WaterSprite = keyof typeof WATER_SPRITES;
