/**
 * Les bûcherons : quel arbre couper, et d'où.
 *
 * Ce module ne fait rien bouger — c'est `World` qui fait marcher un bûcheron,
 * avec `walkToward()` comme un porteur. Il répond à trois questions :
 * un arbre est-il dans le rayon de la cabane, lequel viser, et où se poster
 * pour le couper.
 *
 * Le rayon se mesure du centre de la cabane au centre de la tuile de
 * l'arbre, en distances au carré : c'est le cercle que le rendu dessine.
 * Seules les tuiles du carré qui l'englobe sont interrogées, jamais la carte.
 *
 * Deux bûcherons ne visent jamais le même arbre : l'arbre choisi est
 * réservé (`claimed`) jusqu'à ce que son bûcheron le lâche. Un arbre
 * réservé n'est plus proposé à personne.
 */

import { TILE_SIZE, coordKey, distanceSq } from '../core/grid.ts';
import { LUMBERJACKS } from '../data/workers.ts';
import type { ResourceIndex } from './resources.ts';
import type { LumberCamp } from './types.ts';
import type { LineTest } from './jobs.ts';

export interface TreeTile {
  tx: number;
  ty: number;
}

/** Le centre de l'emprise de la cabane, en pixels monde. */
function centerOf(camp: LumberCamp): { x: number; y: number } {
  return { x: (camp.tx + camp.width / 2) * TILE_SIZE, y: (camp.ty + camp.height / 2) * TILE_SIZE };
}

/** La tuile est-elle dans le rayon de coupe de la cabane ? */
export function inCutRange(camp: LumberCamp, tx: number, ty: number): boolean {
  const { x, y } = centerOf(camp);
  const reach = LUMBERJACKS.radius * TILE_SIZE;

  return distanceSq(x, y, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE) <= reach * reach;
}

/** Un arbre encore debout sur la tuile ? */
export function isTree(resources: ResourceIndex, tx: number, ty: number): boolean {
  return resources.at(tx, ty)?.id === 'tree';
}

/**
 * Les arbres encore debout dans le rayon, du plus proche du centre au plus loin.
 * `allowed` : la tuile se récolte-t-elle ? Pas dans la zone d'une base mutante debout.
 */
export function treesInRange(
  camp: LumberCamp,
  resources: ResourceIndex,
  allowed: (tx: number, ty: number) => boolean = () => true,
): (TreeTile & { d2: number })[] {
  const { x, y } = centerOf(camp);
  const span = Math.ceil(LUMBERJACKS.radius);
  const cx = camp.tx + Math.floor(camp.width / 2);
  const cy = camp.ty + Math.floor(camp.height / 2);
  const trees: (TreeTile & { d2: number })[] = [];

  for (let ty = cy - span - 1; ty <= cy + span; ty += 1) {
    for (let tx = cx - span - 1; tx <= cx + span; tx += 1) {
      if (!inCutRange(camp, tx, ty) || !isTree(resources, tx, ty) || !allowed(tx, ty)) continue;
      trees.push({ tx, ty, d2: distanceSq(x, y, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE) });
    }
  }
  // À distance égale, l'ordre de balayage départage : le choix ne dépend que de la carte.
  return trees.sort((a, b) => a.d2 - b.d2);
}

/**
 * L'arbre à couper : le plus proche de la cabane, dans son rayon, que
 * personne n'a réservé et qu'on atteint en ligne droite sans passer par
 * l'eau. `null` s'il n'en reste aucun.
 */
export function pickTree(
  camp: LumberCamp,
  from: { x: number; y: number },
  resources: ResourceIndex,
  claimed: ReadonlySet<string>,
  clear: LineTest,
  allowed: (tx: number, ty: number) => boolean = () => true,
): TreeTile | null {
  for (const tree of treesInRange(camp, resources, allowed)) {
    if (claimed.has(coordKey(tree.tx, tree.ty))) continue;

    const spot = chopSpot(tree);

    if (!clear(from.x, from.y, spot.x, spot.y)) continue;
    return { tx: tree.tx, ty: tree.ty };
  }
  return null;
}

/** Où se poste le bûcheron : à gauche du tronc, face à lui — la hache frappe de profil. */
export function chopSpot(tree: TreeTile): { x: number; y: number } {
  return { x: tree.tx * TILE_SIZE + 3, y: (tree.ty + 1) * TILE_SIZE - 5 };
}
