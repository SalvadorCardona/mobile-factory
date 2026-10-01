/**
 * Les routes pavées : une tuile de 32 × 32 par façon de se raccorder.
 *
 * Des dalles arrondies dans la pierre pâle du sol rocheux (`GROUND.rock`),
 * posées sur un lit plus sombre de même teinte : ce lit fait les joints entre
 * les dalles, et la bordure — sa face avant dépasse en bas, vue de 3/4, et un
 * reflet en capsule éclaire le haut à gauche de chaque dalle. Trois tons,
 * aucun contour.
 *
 * Une tuile pavée regarde ses quatre voisines (`RoadNetwork.links`) : la
 * chaussée s'avance jusqu'au bord de la tuile du côté où une autre dalle
 * l'attend, et s'arrondit ailleurs. Seize masques couvrent les quatre formes
 * — droit, coin, T, croix — dans tous les sens, plus le bout et la dalle
 * seule. Les dalles d'un bras débordent du cadre, que le SVG coupe : d'une
 * tuile à l'autre, elles se recollent en une seule.
 *
 * Bakées avec le sol (`render/chunkLayer.ts`) ; un pavage rebake le bloc.
 */

import { GROUND, pill, rect, svg } from '../data/artDirection.ts';
import { ROAD_LINK } from '../data/roads.ts';

const T = 32;
/** Retrait de la chaussée dans la tuile : la largeur d'une route est `T - 2 × INSET`. */
const INSET = 4;
/** Hauteur de la face avant, sous la chaussée, là où elle ne se prolonge pas vers le bas. */
const FRONT = 3;
const SLAB_RADIUS = 3;
/** Longueur d'une dalle de jonction, à cheval sur le bord de deux tuiles pavées. */
const JOINT = 12;

const { base, shade, light } = GROUND.rock;

/** Une dalle et son reflet en capsule, en haut à gauche. */
function slab(x: number, y: number, w: number, h: number): string {
  return rect(x, y, w, h, base, SLAB_RADIUS) + pill(x + 2, y + 1.5, Math.max(3, w * 0.5), 2, light);
}

/** La tuile de route dont les voisines pavées sont `links` (bits `ROAD_LINK`). */
export function roadTile(links: number): string {
  const top = (links & ROAD_LINK.top) !== 0;
  const right = (links & ROAD_LINK.right) !== 0;
  const bottom = (links & ROAD_LINK.bottom) !== 0;
  const left = (links & ROAD_LINK.left) !== 0;
  const inner = T - INSET * 2;
  const bed: string[] = [rect(INSET, INSET, inner, inner + FRONT, shade, 6)];
  const slabs: string[] = [];

  // Le lit : le carré central, et un bras jusqu'au bord vers chaque voisine.
  if (top) bed.push(rect(INSET, 0, inner, INSET + 6, shade, 0));
  if (bottom) bed.push(rect(INSET, T - INSET - 6, inner, INSET + 6, shade, 0));
  if (left) bed.push(rect(0, INSET, INSET + 6, inner + FRONT, shade, 0));
  if (right) bed.push(rect(T - INSET - 6, INSET, INSET + 6, inner + FRONT, shade, 0));

  // Deux sur deux au centre : elles touchent la bordure du côté où la route s'arrête, et
  // laissent la place, vers une voisine, à une dalle de jonction à cheval sur le bord.
  const columns = [
    [left ? 8 : 5, 15],
    [17, right ? 24 : 27],
  ] as const;
  const rows = [
    [top ? 8 : 5, 15],
    [17, bottom ? 24 : 27],
  ] as const;

  for (const [y0, y1] of rows) {
    for (const [x0, x1] of columns) slabs.push(slab(x0, y0, x1 - x0, y1 - y0));
  }

  // Les dalles de jonction, dans l'axe du bras : le cadre en coupe la moitié, la voisine pose l'autre.
  for (const [a, b] of [
    [5, 15],
    [17, 27],
  ] as const) {
    if (left) slabs.push(slab(-JOINT / 2, a, JOINT, b - a));
    if (right) slabs.push(slab(T - JOINT / 2, a, JOINT, b - a));
    if (top) slabs.push(slab(a, -JOINT / 2, b - a, JOINT));
    if (bottom) slabs.push(slab(a, T - JOINT / 2, b - a, JOINT));
  }

  return svg(T, T, ...bed, ...slabs);
}

/** Les seize tuiles, indexées par masque de voisines. */
export const ROAD_TILES: readonly string[] = Array.from({ length: 16 }, (_, links) => roadTile(links));

/** Une dalle posée dans un cadre plus grand, coupée à sa tuile comme à la rastérisation. */
function placed(tile: string, x: number, y: number): string {
  return tile.replace('<svg ', `<svg x="${x}" y="${y}" `);
}

/** La vignette du menu de construction : une route qui tourne, et file hors du cadre. */
export const ROAD_THUMB = svg(
  2 * T,
  2 * T,
  placed(roadTile(ROAD_LINK.bottom), 0, 0),
  placed(roadTile(ROAD_LINK.top | ROAD_LINK.right), 0, T),
  placed(roadTile(ROAD_LINK.left | ROAD_LINK.right), T, T),
);
