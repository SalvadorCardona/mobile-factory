/**
 * Adam, le héros.
 *
 * Silhouette lisible à 32 px : cheveux indigo en épi, regard décidé, barbe
 * courte, tunique orange ceinturée (la teinte des humains), écharpe corail,
 * sac à dos violet et son couchage roulé, jambes et godillots. Son corps et
 * ses pieds sont des **calques** (`adamLook.ts`) : ce registre en garde
 * l'apparence par défaut, le rendu les recompose quand il se change.
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
import { ADAM_H, ADAM_W, DEFAULT_ADAM_PARTS } from './adamLook.ts';
import { axe, bow, hammer, pickaxe } from './people.ts';

const W = ADAM_W;
const H = ADAM_H;
/** La main droite, de face, en pixels du cadre : le pivot des outils. */
const HAND: readonly [number, number] = [22.8, 31.6];

export const ADAM = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.8,
  parts: {
    ...DEFAULT_ADAM_PARTS,
    /** L'arc, tenu à droite de face et de dos, devant en profil. */
    bow: svg(W, H, bow(24.5, 19, 34)),
    axe: svg(W, H, axe(...HAND)),
    pickaxe: svg(W, H, pickaxe(...HAND)),
    hammer: svg(W, H, hammer(...HAND)),
  },
  pivots: { bow: [25, 26.5], axe: HAND, pickaxe: HAND, hammer: HAND },
} satisfies SpriteProto;
