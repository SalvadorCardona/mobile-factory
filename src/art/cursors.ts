/**
 * Les curseurs de souris : flèche, main, poing, interdit.
 *
 * Mêmes règles que les sprites — formes pleines, palette, lumière en haut à
 * gauche —, avec une exception de lisibilité : un curseur se pose sur l'herbe,
 * l'eau, le sable comme sur la nuit, il garde donc un liseré indigo (le trait
 * unique, sous la forme) autour d'un corps blanc et violet. Le cadre est
 * `CURSOR_SIZE` ; les points chauds sont dans `data/cursors.ts`.
 */

import { PALETTE, circle, curve, pill, rect, shape, svg, line, type Color } from '../data/artDirection.ts';
import { CURSOR_SIZE, type CursorId } from '../data/cursors.ts';

const { ink, violet, paper, coral } = PALETTE;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Le chemin d'un polygone aux angles arrondis de `radius`. */
function roundedPolygon(points: readonly [number, number][], radius: number): string {
  const count = points.length;
  let d = '';

  points.forEach(([x, y], index) => {
    const [px, py] = points[(index + count - 1) % count]!;
    const [nx, ny] = points[(index + 1) % count]!;
    const before = Math.hypot(px - x, py - y);
    const after = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, before / 2, after / 2);
    const start = `${round(x + ((px - x) / before) * r)} ${round(y + ((py - y) / before) * r)}`;
    const end = `${round(x + ((nx - x) / after) * r)} ${round(y + ((ny - y) / after) * r)}`;

    d += `${index === 0 ? 'M' : 'L'}${start}Q${round(x)} ${round(y)} ${end}`;
  });
  return `${d}Z`;
}

/** Le chemin d'une capsule (ou d'un rectangle de rayon `r`). */
function boxPath(x: number, y: number, w: number, h: number, r = Math.min(w, h) / 2): string {
  const k = Math.min(r, w / 2, h / 2);

  return (
    `M${round(x + k)} ${y}H${round(x + w - k)}Q${x + w} ${y} ${x + w} ${round(y + k)}V${round(y + h - k)}` +
    `Q${x + w} ${y + h} ${round(x + w - k)} ${y + h}H${round(x + k)}Q${x} ${y + h} ${x} ${round(y + h - k)}` +
    `V${round(y + k)}Q${x} ${y} ${round(x + k)} ${y}Z`
  );
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

/** Le liseré : la forme en trait indigo, que son remplissage recouvre à moitié. */
function rim(...paths: string[]): string {
  return paths.map((d) => curve(d, ink.shade)).join('');
}

const ARROW: [number, number][] = [
  [4, 4],
  [4, 25],
  [10, 19.6],
  [14.2, 28.2],
  [18.2, 26.3],
  [14, 17.8],
  [22, 17.8],
];

/** Le corps de la flèche : blanc, un cœur violet. */
function arrow(): string {
  const core = ARROW.map(([x, y]): [number, number] => [round(9 + (x - 9) * 0.5 + 0.5), round(15 + (y - 15) * 0.5 + 1)]);

  return (
    rim(roundedPolygon(ARROW, 2.4)) +
    shape(roundedPolygon(ARROW, 2.4), paper.base) +
    shape(roundedPolygon(core, 1.4), violet.base)
  );
}

/** Une main : le doigt levé n'est plus un bras mais un doigt, le reste est replié. */
function hand(): string {
  const index = boxPath(9, 3, 5.6, 17);
  const middle = boxPath(14.6, 11, 5.2, 12);
  const ring = boxPath(19.8, 12, 5.2, 12);
  const pinky = boxPath(25, 14, 4.4, 10);
  const thumb = boxPath(3.2, 17, 11, 5.6);
  const palm = boxPath(8, 16, 21.4, 11, 5);
  const cuff = boxPath(9, 25, 19.4, 5, 2.5);

  return (
    rim(thumb, index, middle, ring, pinky, palm, cuff) +
    [thumb, index, middle, ring, pinky, palm].map((d) => shape(d, paper.base)).join('') +
    shape(cuff, violet.base) +
    pill(10.6, 5, 1.6, 8, paper.shade) +
    line(14.6, 14, 14.6, 19, violet.shade) +
    line(19.8, 15, 19.8, 20, violet.shade) +
    line(25, 16, 25, 21, violet.shade) +
    pill(11, 26.4, 12, 1.6, violet.light)
  );
}

/** Le poing : quatre phalanges au-dessus, le pouce en travers. */
function fist(): string {
  const knuckles = [6, 11.8, 17.6, 23.4].map((x) => boxPath(x, 8, 5.4, 11));
  const palm = boxPath(5.6, 13, 23.8, 13, 5);
  const thumb = boxPath(7, 19, 12, 5.6);
  const cuff = boxPath(7, 24.5, 20, 5, 2.5);

  return (
    rim(...knuckles, palm, thumb, cuff) +
    [...knuckles, palm, thumb].map((d) => shape(d, paper.base)).join('') +
    shape(cuff, violet.base) +
    [11.4, 17.2, 23].map((x) => line(x, 12, x, 16, violet.shade)).join('') +
    pill(9, 20.6, 7, 1.6, paper.shade) +
    pill(9, 25.8, 12, 1.6, violet.light)
  );
}

/** La flèche, avec un badge d'interdit corail en bas à droite. */
function forbidden(): string {
  const badge: Color = coral.base;

  return (
    arrow() +
    rim(circlePath(24.5, 24.5, 6.5)) +
    circle(24.5, 24.5, 6.5, badge) +
    rect(20.7, 23.4, 7.6, 2.2, paper.base, 1.1)
  );
}

/** La main ouverte, les quatre doigts levés et le pouce de côté : on peut tirer la carte. */
function openHand(): string {
  const fingers = [boxPath(8, 6, 5, 15), boxPath(13.6, 3, 5, 18), boxPath(19.2, 5, 5, 16), boxPath(24.6, 9, 4.6, 12)];
  const thumb = boxPath(2.6, 15, 11, 5.6);
  const palm = boxPath(7, 14, 22.2, 13, 5);
  const cuff = boxPath(9, 25, 18.4, 5, 2.5);

  return (
    rim(thumb, ...fingers, palm, cuff) +
    [thumb, ...fingers, palm].map((d) => shape(d, paper.base)).join('') +
    shape(cuff, violet.base) +
    [13.6, 19.2, 24.6].map((x) => line(x, 14, x, 19, violet.shade)).join('') +
    pill(9.4, 8, 1.6, 7, paper.shade) +
    pill(11, 26.4, 12, 1.6, violet.light)
  );
}

const BODIES: Record<CursorId, () => string> = { arrow, hand, grab: openHand, grabbing: fist, forbidden };

export const CURSOR_SVGS: Record<CursorId, string> = Object.fromEntries(
  (Object.keys(BODIES) as CursorId[]).map((id) => [id, svg(CURSOR_SIZE, CURSOR_SIZE, BODIES[id]())]),
) as Record<CursorId, string>;
