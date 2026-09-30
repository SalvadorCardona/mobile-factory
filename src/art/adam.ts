/**
 * Adam, le héros.
 *
 * Silhouette lisible à 32 px : cheveux indigo, tunique orange (la teinte des
 * humains), écharpe corail, sac à dos violet, et l'arc de fortune tenu à la
 * main. L'arc est un morceau à part : le rendu le tend et le relâche à
 * chaque flèche, sans toucher au corps.
 */

import { svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { bow, foot, humanBody, type Facing } from './people.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8) tombe ici. */
const GROUND = 38.4;

const OPTIONS = { pack: true, scarf: true, cap: false } as const;

function body(facing: Facing): string {
  return svg(W, H, humanBody(facing, OPTIONS));
}

export const ADAM = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    down: body('down'),
    up: body('up'),
    side: body('side'),
    foot: svg(W, H, foot(GROUND)),
    /** L'arc, tenu à droite de face et de dos, devant en profil. */
    bow: svg(W, H, bow(24.5, 19, 34)),
  },
  pivots: { bow: [25, 26.5] },
} satisfies SpriteProto;
