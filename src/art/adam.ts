/**
 * Adam, le héros.
 *
 * Silhouette lisible à 32 px : cheveux indigo, tunique orange (la teinte des
 * humains), écharpe corail, sac à dos violet.
 *
 * Il a les mains vides : l'arc, la hache, la pioche et le marteau sont des
 * morceaux à part, que le rendu ne sort que le temps de l'action — l'arc
 * quand il vise et tire (tendu puis relâché à chaque flèche), la hache quand
 * il coupe un arbre, la pioche quand il casse un rocher, le marteau quand il
 * bâtit ou répare. Les outils pivotent dans la main droite et s'abattent à
 * chaque coup.
 */

import { svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { axe, bow, foot, hammer, humanBody, pickaxe, type Facing } from './people.ts';

const W = 32;
const H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8) tombe ici. */
const GROUND = 38.4;
/** La main droite, de face, en pixels du cadre : le pivot des outils. */
const HAND: readonly [number, number] = [22.5, 32];

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
    axe: svg(W, H, axe(...HAND)),
    pickaxe: svg(W, H, pickaxe(...HAND)),
    hammer: svg(W, H, hammer(...HAND)),
  },
  pivots: { bow: [25, 26.5], axe: HAND, pickaxe: HAND, hammer: HAND },
} satisfies SpriteProto;
