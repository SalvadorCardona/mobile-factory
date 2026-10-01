/**
 * Un logisticien du poste de logistique.
 *
 * Il dérive du porteur : même humain, même taille, la tunique orange de la
 * famille, le bandeau corail. Ce qui le distingue au premier coup d'œil :
 * **la caisse sur le dos**, sanglée par deux bretelles indigo — on la voit
 * dépasser des épaules de face, en entier de dos, en flanc de profil — et
 * **une casquette cyan** à visière.
 *
 * Chargé, l'objet qu'il porte dépasse de la caisse, au-dessus de la tête :
 * c'est la charge du porteur (`loadParts`), un peu plus haut — la caisse la
 * soulève. À vide, la caisse est vide.
 */

import { PALETTE, line, pill, rect, shadedBlock, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, humanBody, idleParts, scaledAround, type Facing, type IdleLook } from './people.ts';
import { loadParts } from './worker.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8), comme le porteur. */
const GROUND = 38.4;
/** La taille d'un porteur. */
const SCALE = 0.8;

const OPTIONS = { pack: false, scarf: false, cap: false } as const;

const { ink, coral, cyan, orange } = PALETTE;

/** La caisse dans le dos, derrière le corps : de face, ses coins dépassent des épaules. */
function crateBehind(facing: Facing): string {
  switch (facing) {
    case 'down':
      return shadedBlock(6.5, 11, 19, 11, 3, 'orange', 3) + line(9, 15, 23, 15, orange.shade);
    case 'up':
      return '';
    case 'side':
      return shadedBlock(3, 15, 10, 16, 3, 'orange', 3) + line(5, 20, 11, 20, orange.shade);
  }
}

/** Ce qui se voit devant le corps : les bretelles de face, la caisse entière de dos. */
function crateFront(facing: Facing): string {
  switch (facing) {
    case 'down':
      return line(12.5, 22, 12.5, 28, ink.base) + line(19.5, 22, 19.5, 28, ink.base);
    case 'up':
      return shadedBlock(7, 16, 18, 17, 4, 'orange', 3) + line(9.5, 22, 22.5, 22, orange.shade) + line(11, 17, 11, 33, ink.base) + line(21, 17, 21, 33, ink.base);
    case 'side':
      return line(13, 21, 16, 28, ink.base);
  }
}

/** La casquette cyan et le bandeau corail qui dépasse dessous. */
function cap(facing: Facing): string {
  switch (facing) {
    case 'down':
      return pill(9.5, 9, 13, 2.5, coral.base) + rect(9, 4.5, 14, 5.5, cyan.base, 2.75) + pill(11, 5.3, 5, 1.6, cyan.light) + pill(10, 9, 12, 2.5, cyan.shade);
    case 'up':
      return pill(9.5, 9.5, 13, 2.5, coral.base) + rect(9, 4.5, 14, 5.5, cyan.base, 2.75);
    case 'side':
      return pill(9, 9, 13.5, 2.5, coral.base) + rect(10, 4.5, 13, 5.5, cyan.base, 2.75) + pill(20, 8, 6, 2.5, cyan.shade);
  }
}

/** Le corps d'adulte, avant réduction ; `look` : les bras levés ou le bâillement d'une pose de glande. */
function figure(facing: Facing, look: IdleLook = {}): string {
  return crateBehind(facing) + humanBody(facing, { ...OPTIONS, ...look }) + crateFront(facing) + cap(facing);
}

function body(facing: Facing): string {
  return svg(W, H, scaledAround(16, GROUND, SCALE, figure(facing)));
}

export const LOGISTICIAN = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down'),
    up: body('up'),
    side: body('side'),
    foot: svg(W, H, foot(GROUND, 'ink', 0.9)),
    ...idleParts(W, H, GROUND, SCALE, (look) => figure('down', look)),
    // L'objet dépasse de la caisse : un peu plus haut que sur la tête d'un porteur.
    ...loadParts(1),
  },
} satisfies SpriteProto;
