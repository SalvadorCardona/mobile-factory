/**
 * Les particules : la forme de ce qui saute quand on frappe.
 *
 * Une silhouette par forme (`ParticleShape`, `data/artDirection.ts`), toute
 * blanche : le rendu la teinte d'une couleur de `PARTICLES`, et du blanc
 * teinté reste exactement la couleur de la palette. Toutes les formes
 * partagent un cadre et l'atlas : des centaines de particules restent un
 * seul lot de dessin (`render/particles.ts`).
 *
 * Copeau en losange, éclat en triangle, étincelle en tiret, goutte ronde,
 * confetti carré très arrondi ; et ce qui reste au sol : l'ombre sous une
 * particule en l'air, la flaque d'une goutte, l'anneau de poussière d'un
 * bâtiment qui s'achève (`DUST_RING`, son propre cadre). Aucune
 * transparence : c'est le rendu qui estompe.
 */

import { PALETTE, ellipse, pill, polygon, rect, ring, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const S = 32;
const C = S / 2;

const { paper } = PALETTE;

export const PARTICLE_FX = {
  width: S,
  height: S,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    /** Copeau de bois : un losange allongé, qui tourne sur lui-même. */
    chip: svg(S, S, polygon([C - 4.5, C, C, C - 2.5, C + 4.5, C, C, C + 2.5], paper.base)),
    /** Éclat de pierre : un triangle sec. */
    shard: svg(S, S, polygon([C - 3.5, C + 2.5, C + 3.5, C + 2, C - 0.5, C - 3.5], paper.base)),
    /** Étincelle : un tiret court, couché dans le sens de sa course. */
    spark: svg(S, S, pill(C - 4, C - 1, 8, 2, paper.base)),
    /** Goutte : un disque rond. */
    drop: svg(S, S, ellipse(C, C, 2.6, 2.6, paper.base)),
    /** Confetti : un petit carré très arrondi. */
    square: svg(S, S, rect(C - 2.5, C - 2.5, 5, 5, paper.base, 1.5)),
    /** L'ombre d'une particule en l'air : un petit disque aplati. */
    shadow: svg(S, S, ellipse(C, C, 3, 1.4, paper.base)),
    /** La flaque d'une goutte tombée : un disque aplati, vu en 3/4. */
    puddle: svg(S, S, ellipse(C, C, 7, 2.8, paper.base)),
  },
} satisfies SpriteProto;

/** Cadre de l'anneau de poussière : large, pour rester net une fois élargi sous un bâtiment. */
const DW = 128;
const DH = 64;

export const DUST_RING = {
  width: DW,
  height: DH,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: {
    /** L'anneau de poussière : une ellipse percée, toute la largeur du cadre, vue en 3/4. */
    ring: svg(DW, DH, ring(DW / 2, DH / 2, DW / 2 - 2, DH / 2 - 2, 4, paper.base)),
  },
} satisfies SpriteProto;
