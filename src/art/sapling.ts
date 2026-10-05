/**
 * Les arbres plantés par le forestier, avant d'être des arbres : la pousse,
 * puis le jeune arbre. Adultes, ils prennent le sprite d'un arbre de la
 * forêt (`SAPLING.sprites`).
 *
 * Mêmes règles que les arbres : un tronc indigo, des coussins de feuillage
 * aplatis, jamais de boule. La pousse est une tige et deux feuilles sortant
 * d'une motte de terre retournée — on voit qu'elle vient d'être plantée — ;
 * le jeune arbre a déjà son tronc, deux coussins, et son tuteur au trait.
 *
 * Même cadre et même ancre que les arbres (48 × 64, pied en (24, 58)) : la
 * forêt du forestier s'aligne sur l'autre.
 */

import { GROUND, PALETTE, circle, cushion, ellipse, leaf, line, pill, rect, svg } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';

const W = 48;
const H = 64;
const BASE_X = 24;
const BASE_Y = 58;

const { ink, mint, orange, coral } = PALETTE;

/** La motte de terre retournée au pied : sable foncé, et son dessus plus clair. */
function mound(w: number): string {
  return ellipse(BASE_X, BASE_Y - 1, w / 2, 3, GROUND.sand.shade) + ellipse(BASE_X - 0.6, BASE_Y - 1.8, w / 2 - 1.5, 2, GROUND.sand.base);
}

function sprout(): string {
  return svg(
    W,
    H,
    mound(14),
    line(BASE_X, BASE_Y - 2, BASE_X, BASE_Y - 11, mint.shade),
    leaf(BASE_X, BASE_Y - 9, 200, 1.1),
    leaf(BASE_X, BASE_Y - 11, -25, 1.2),
    circle(BASE_X + 6, BASE_Y - 2, 1.2, orange.light),
  );
}

function young(): string {
  const top = BASE_Y - 16;

  return svg(
    W,
    H,
    mound(16),
    // Le tuteur et son lien : un piquet au trait, penché contre le tronc.
    line(BASE_X + 5, BASE_Y - 2, BASE_X + 3, BASE_Y - 22, orange.shade),
    rect(BASE_X - 1.5, top, 3, BASE_Y - top - 1, ink.base, 1.5),
    pill(BASE_X - 1, top + 2, 1, 6, ink.light),
    pill(BASE_X - 0.5, BASE_Y - 12, 6, 2, coral.base),
    cushion(BASE_X, BASE_Y - 17, 15, 6.5),
    cushion(BASE_X - 0.5, BASE_Y - 24, 10, 5.5),
  );
}

export const SAPLING_SPRITE = {
  width: W,
  height: H,
  anchorX: BASE_X / W,
  anchorY: BASE_Y / H,
  parts: { sprout: sprout(), young: young() },
} satisfies SpriteProto;
