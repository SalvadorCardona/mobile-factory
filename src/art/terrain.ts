/**
 * Le sol : tuiles, transitions, coins et ombres portées.
 *
 * Vue de dessus en 3/4, la grille reste lisible :
 * - l'**herbe** est un damier doux à deux tons, une case par tuile ;
 * - le **sable** a un liseré clair côté lumière, là où il touche un autre sol ;
 * - l'**eau** est un aplat, avec des reflets en capsule ; sa face avant,
 *   plus sombre, se voit en bas — c'est un creux, vu de trois quarts ;
 * - la **roche** est un plateau : dessus pâle, face avant sombre en bas,
 *   liseré clair en haut.
 * Là où un sol s'avance dans un autre, son coin s'arrondit (`corner`) : les
 * étangs et les plateaux ont les angles doux des autres formes du jeu.
 *
 * Chaque tuile est un SVG de 32 × 32, bakée avec les autres dans la texture
 * du chunk (`render/chunkLayer.ts`).
 */

import { GROUND, pill, rect, shape, svg, type Ground } from '../data/artDirection.ts';

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

/**
 * Les variantes de chaque sol. L'herbe en a deux, les deux cases du damier ;
 * les autres en ont trois, tirées par tuile — la première, sobre, le plus souvent.
 */
export const GROUND_TILES: Record<Ground, readonly string[]> = {
  grass: [tile(flat('grass')), tile(flat('grass', 'alt'))],
  sand: [
    tile(flat('sand')),
    tile(flat('sand'), pill(18, 20, 9, 2.4, GROUND.sand.alt)),
    tile(flat('sand'), pill(5, 10, 12, 2.6, GROUND.sand.light), pill(15, 22, 8, 2.4, GROUND.sand.light)),
  ],
  water: [
    tile(flat('water')),
    tile(flat('water'), pill(5, 9, 15, 3, GROUND.water.light)),
    tile(flat('water'), pill(14, 19, 10, 2.6, GROUND.water.light), pill(6, 25, 5, 2.2, GROUND.water.light)),
  ],
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
 * couleur du sol voisin. Posé sur un coin saillant, il arrondit la forme.
 */
export function cornerTile(color: (typeof GROUND)[Ground]['base' | 'alt'], corner: Corner): string {
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
