/**
 * Adam en calques.
 *
 * Son corps n'est plus un dessin d'un seul tenant : chaque partie est un
 * **calque** indépendant, dessiné par direction (face, dos, profil droit) dans
 * le même cadre 32 × 48 aux pieds en y = 38,4 —
 * - les calques fixes, qui font Adam quoi qu'il porte : la peau (visage,
 *   oreilles, mains, la bouche qui sourit), le sac à dos et son couchage
 *   roulé, l'écharpe corail ;
 * - un calque par emplacement de la garde-robe (`data/wardrobe.ts`) :
 *   cheveux, yeux et sourcils, barbe, haut, lunettes, chapeau ; la pièce
 *   choisie le dessine, dans la couleur choisie s'il en prend une.
 *
 * Un calque ne se dessine pas d'un bloc : il range ses formes à des
 * **profondeurs** (`DEPTHS`). Le sac passe derrière le corps de face et devant
 * de dos ; la masse des cheveux passe derrière le visage, la frange devant.
 * La composition empile les profondeurs dans l'ordre, puis les calques.
 *
 * Le pantalon et les chaussures sont dans le **pied** : une jambe et une
 * chaussure par pied, que le rendu fait alterner à la marche — la jambe monte
 * sous la tunique, qui la cache en haut quel que soit le rebond.
 *
 * Tout est fonction de l'apparence (`Look`) : le registre des sprites en tire
 * l'Adam par défaut, le rendu recompose ses textures quand il se change, et
 * l'éditeur en fait l'aperçu et les vignettes.
 */

import { PALETTE, circle, ellipse, flower, group, highlight, leaf, line, pill, rect, ring, shadedBlock, shadedCircle, svg, type Tone } from '../data/artDirection.ts';
import { DEFAULT_LOOK, PIECES, type LookSlot, type Look, type PieceId } from '../data/wardrobe.ts';
import type { Facing } from './people.ts';

export const ADAM_W = 32;
export const ADAM_H = 48;
/** Le sol, dans le cadre : l'ancre (0.5, 0.8) tombe ici. */
export const ADAM_GROUND = 38.4;
/** L'écart des pieds de part et d'autre du centre : de face et de dos, puis de profil. */
export const ADAM_STRIDE = { front: 4, side: 1.5 } as const;

/** Les profondeurs, du fond vers l'avant. */
const DEPTHS = ['packBack', 'top', 'skinBack', 'pack', 'scarf', 'hairMid', 'skinFace', 'hairFront', 'eyes', 'beard', 'glasses', 'hat'] as const;

type Depth = (typeof DEPTHS)[number];

/** Ce qu'un calque dessine dans une direction, rangé par profondeur. */
type Layer = Partial<Record<Depth, string>>;

/** Ce qu'une pièce sait de l'apparence : les tons choisis. */
interface Paint {
  hair: Tone;
  eyes: Tone;
  top: Tone;
}

type PieceArt = (facing: Facing, paint: Paint) => Layer;

/** Ce que dessine une pièce du pied : la jambe (pantalon) ou la chaussure, centrée en x = 16. */
type FootArt = () => string;

const { ink, coral, violet, yellow, skin, paper, cyan, orange } = PALETTE;

/* ---------------------------------------------------------------- calques fixes */

/** La peau : mains, oreilles, visage, joues roses, nez, et un sourire en coin. */
function skinLayer(facing: Facing): Layer {
  switch (facing) {
    case 'down':
      return {
        skinBack: circle(8.9, 31.6, 2.1, skin.base) + circle(23.1, 31.6, 2.1, skin.base),
        skinFace:
          circle(9.9, 15.2, 1.7, skin.shade) +
          circle(22.1, 15.2, 1.7, skin.shade) +
          rect(10, 10.6, 12, 9.6, skin.base, 4.6) +
          circle(11.9, 17.5, 1.1, coral.light) +
          circle(20.1, 17.5, 1.1, coral.light) +
          pill(15.2, 15.8, 1.6, 1.3, skin.shade) +
          pill(14.4, 17.7, 3.4, 1.3, coral.shade),
      };
    case 'up':
      return {
        skinBack: circle(8.9, 31.6, 2.1, skin.base) + circle(23.1, 31.6, 2.1, skin.base) + pill(13.5, 16.8, 5, 3.2, skin.shade),
      };
    case 'side':
      return {
        skinBack: circle(17, 31.8, 2.1, skin.base) + circle(16.5, 12.5, 7, skin.base),
        skinFace:
          rect(16, 11.4, 7.5, 7.8, skin.base, 3.5) +
          pill(22, 14.4, 2.6, 2, skin.base) +
          circle(15.4, 14.8, 1.7, skin.shade) +
          circle(21, 17.4, 1.1, coral.light) +
          pill(21.4, 18.2, 2.2, 1.1, coral.shade),
      };
  }
}

/** Le sac à dos violet et le couchage jaune roulé dessus : de face, il dépasse des épaules ; de dos, il couvre le dos. */
function packLayer(facing: Facing): Layer {
  const bedroll = (x: number, y: number, w: number): string => pill(x, y, w, 3.6, yellow.shade) + pill(x, y, w, 2.6, yellow.base) + pill(x + 1.5, y + 0.5, 3, 1, yellow.light);

  switch (facing) {
    case 'down':
      return {
        packBack: pill(9, 17.2, 14, 6.5, violet.shade) + bedroll(8.2, 15.8, 15.6),
        pack: line(12.6, 22.6, 12.6, 28.2, violet.shade) + line(19.4, 22.6, 19.4, 28.2, violet.shade),
      };
    case 'up':
      return {
        pack:
          shadedBlock(10, 20.5, 12, 13, 3, 'violet', 4) +
          pill(11.5, 20.5, 9, 4, violet.light) +
          flower(19, 26.5, 'coral', 0.55) +
          bedroll(8.8, 18.4, 14.4),
      };
    case 'side':
      return { packBack: shadedBlock(6.2, 19.5, 7.8, 12.5, 3, 'violet', 3) + bedroll(5.6, 17.4, 8.6) };
  }
}

/** L'écharpe corail, nouée, dont le pan flotte. */
function scarfLayer(facing: Facing): Layer {
  switch (facing) {
    case 'down':
      return {
        scarf:
          pill(9.6, 18.6, 12.8, 4.8, coral.shade) +
          pill(9.6, 18.6, 12.8, 3.8, coral.base) +
          pill(11.2, 19.2, 4, 1.3, coral.light) +
          pill(18.6, 21, 3.8, 8, coral.shade) +
          circle(19.8, 21.4, 1.8, coral.base),
      };
    case 'up':
      return { scarf: pill(10.2, 18.4, 11.6, 4.2, coral.base) + pill(12.6, 20.8, 3.8, 8, coral.shade) };
    case 'side':
      return {
        packBack: pill(3.4, 19.4, 10, 3.2, coral.shade),
        scarf: pill(11, 19, 10.5, 4.5, coral.shade) + pill(11, 19, 10.5, 3.6, coral.base) + pill(12.4, 19.5, 3.4, 1.2, coral.light),
      };
  }
}

/* ---------------------------------------------------------------- les hauts */

/** Le corps d'un haut : manches, buste en trois tons. `wide` : un poncho, sans manches. */
function torso(facing: Facing, tone: Tone): string {
  const c = PALETTE[tone];

  switch (facing) {
    case 'down':
    case 'up':
      return (
        pill(6.8, 21.6, 4.6, 10.4, c.shade) +
        pill(20.6, 21.6, 4.6, 10.4, c.shade) +
        rect(9.5, 21, 13, 12.4, c.shade, 5) +
        rect(9.5, 21, 13, 10.4, c.base, 5) +
        highlight(9.5, 21, 13, 10.4, tone)
      );
    case 'side':
      return rect(10.8, 21, 10.4, 12.4, c.shade, 4.5) + rect(10.8, 21, 10.4, 10.4, c.base, 4.5) + highlight(10.8, 21, 10.4, 10.4, tone);
  }
}

/** Le bras de profil, par-dessus le buste. */
function sideArm(tone: Tone): string {
  return pill(14.4, 22, 4.6, 10, PALETTE[tone].shade);
}

const topTunic: PieceArt = (facing, { top }) => {
  const belt =
    facing === 'side'
      ? pill(10.8, 28.6, 10.4, 2.4, ink.base) + rect(19, 28.2, 2.6, 3.2, yellow.base, 1)
      : pill(9.5, 28.6, 13, 2.4, ink.base) + (facing === 'down' ? rect(14.5, 28.2, 3, 3.2, yellow.base, 1) + pill(15, 28.6, 1.4, 1, yellow.light) : '');

  return { top: torso(facing, top) + belt + (facing === 'side' ? sideArm(top) : '') };
};

const topHoodie: PieceArt = (facing, { top }) => {
  const c = PALETTE[top];

  switch (facing) {
    case 'down':
      return { top: torso(facing, top) + rect(12, 26.6, 8, 4.4, c.shade, 2) + pill(13.4, 21.6, 1.2, 4, paper.base) + pill(17.4, 21.6, 1.2, 4, paper.base) };
    case 'up':
      return { top: torso(facing, top) + rect(10.6, 18.6, 10.8, 5, c.shade, 2.5) };
    case 'side':
      return { top: pill(8.4, 17.6, 6, 6, c.shade) + torso(facing, top) + rect(15.6, 26.6, 5.4, 4.4, c.shade, 2) + sideArm(top) };
  }
};

const topJacket: PieceArt = (facing, { top }) => {
  const c = PALETTE[top];
  const band = (x: number, w: number): string => pill(x, 28.4, w, 1.8, yellow.base);

  switch (facing) {
    case 'down':
      return {
        top:
          torso(facing, top) +
          pill(14.9, 21, 2.2, 9, paper.base) +
          pill(12.2, 21, 2.8, 6.2, c.shade) +
          pill(17, 21, 2.8, 6.2, c.shade) +
          rect(10.6, 24.6, 3.4, 2.8, c.shade, 1) +
          rect(18, 24.6, 3.4, 2.8, c.shade, 1) +
          band(9.5, 13),
      };
    case 'up':
      return { top: torso(facing, top) + band(9.5, 13) };
    case 'side':
      return { top: torso(facing, top) + rect(17.6, 24.4, 3, 2.8, c.shade, 1) + band(10.8, 10.4) + sideArm(top) + pill(14.4, 28.4, 4.6, 1.8, yellow.base) };
  }
};

const topPoncho: PieceArt = (facing, { top }) => {
  const c = PALETTE[top];
  const stripes = (x: number, w: number): string => pill(x, 24.4, w, 1.6, paper.base) + pill(x, 27, w, 1.6, ink.light);
  const fringe = (x: number, count: number): string =>
    Array.from({ length: count }, (_, i) => circle(x + i * 2.4, 31.4, 0.9, c.shade)).join('');

  switch (facing) {
    case 'down':
    case 'up':
      return {
        top: rect(6.6, 20.6, 18.8, 11, c.shade, 5.5) + rect(6.6, 20.6, 18.8, 9.4, c.base, 5.5) + highlight(6.6, 20.6, 18.8, 9.4, top) + stripes(7.4, 17.2) + fringe(8, 7),
      };
    case 'side':
      return {
        top: rect(9.6, 20.6, 13, 11, c.shade, 5) + rect(9.6, 20.6, 13, 9.4, c.base, 5) + highlight(9.6, 20.6, 13, 9.4, top) + stripes(10.4, 11.4) + fringe(10.8, 5),
      };
  }
};

const topArmor: PieceArt = (facing, paint) => {
  const tunic = topTunic(facing, paint).top ?? '';
  const rivets = (x: number, y: number, w: number): string => circle(x + 1.6, y + 1.6, 0.7, ink.light) + circle(x + w - 1.6, y + 1.6, 0.7, ink.light);

  switch (facing) {
    case 'down':
      return { top: tunic + shadedBlock(10.6, 21.4, 10.8, 7.6, 2, 'cyan', 3.5) + rivets(10.6, 21.4, 10.8) + shadedCircle(9, 22.6, 2.6, 'cyan') + shadedCircle(23, 22.6, 2.6, 'cyan') };
    case 'up':
      return { top: tunic + shadedCircle(9, 22.6, 2.6, 'cyan') + shadedCircle(23, 22.6, 2.6, 'cyan') };
    case 'side':
      return { top: tunic + shadedBlock(14.4, 21.4, 7, 7.6, 2, 'cyan', 3) + rivets(14.4, 21.4, 7) + shadedCircle(16.6, 22.6, 2.6, 'cyan') };
  }
};

/* ---------------------------------------------------------------- les cheveux */

/** L'épi : une mèche dressée sur le crâne, penchée vers la droite. */
function tuft(x: number, y: number, tone: Tone): string {
  return group(`rotate(24 ${x} ${y + 4})`, pill(x - 1.3, y, 2.6, 5, PALETTE[tone].base));
}

const hairShort: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return {
        hairMid: circle(16, 11.5, 7, h.base) + tuft(17, 2.4, hair),
        hairFront: pill(10.5, 10.2, 11, 2.4, h.base) + pill(11.5, 6.3, 6, 2, h.light),
      };
    case 'up':
      return { hairMid: circle(16, 12, 7, h.base) + tuft(15, 2.6, hair) + pill(11.5, 6.5, 6, 2, h.light) };
    case 'side':
      return { hairMid: circle(15, 11, 6.6, h.base) + tuft(15, 2, hair), hairFront: pill(16, 10.2, 6.8, 2.4, h.base) + pill(11, 6.3, 6, 2, h.light) };
  }
};

const hairBuzz: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return { hairMid: circle(16, 11.5, 6.8, h.shade) + pill(12, 6.6, 5, 1.6, h.base), hairFront: pill(11, 10.6, 10, 1.6, h.shade) };
    case 'up':
      return { hairMid: circle(16, 12, 6.8, h.shade) + pill(12, 6.8, 5, 1.6, h.base) };
    case 'side':
      return { hairMid: circle(15, 11.2, 6.4, h.shade) + pill(11.4, 6.6, 5, 1.6, h.base), hairFront: pill(16, 10.8, 6, 1.4, h.shade) };
  }
};

const hairCurly: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];
  const curls = (points: readonly (readonly [number, number])[], r: number): string =>
    points.map(([x, y]) => circle(x, y, r, h.base) + circle(x - r * 0.35, y - r * 0.35, r * 0.35, h.light)).join('');

  switch (facing) {
    case 'down':
      return {
        hairMid: circle(9.6, 14.6, 3, h.shade) + circle(22.4, 14.6, 3, h.shade) + circle(16, 10.6, 7.4, h.base) + curls([[10.4, 7.4], [16, 4.4], [21.6, 7.4]], 3),
        hairFront: curls([[12.4, 10.8], [16, 10.2], [19.6, 10.8]], 2),
      };
    case 'up':
      return { hairMid: circle(16, 12, 7.4, h.base) + curls([[10.6, 9], [16, 5.4], [21.4, 9], [11, 15], [21, 15], [16, 16.4]], 3) };
    case 'side':
      return { hairMid: circle(14.6, 11, 7, h.base) + curls([[10, 8.6], [14.6, 5], [9.4, 14.4]], 3), hairFront: curls([[18, 10.4], [21, 11]], 2) };
  }
};

const hairMohawk: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return { hairMid: circle(16, 11.5, 6.8, h.shade), hairFront: pill(14, 0.6, 4, 11.4, h.base) + pill(14.8, 1.6, 1.4, 4, h.light) };
    case 'up':
      return { hairMid: circle(16, 12, 6.8, h.shade) + pill(14, 1, 4, 17, h.base) + pill(14.8, 2, 1.4, 5, h.light) };
    case 'side':
      return {
        hairMid:
          circle(15, 11.2, 6.4, h.shade) +
          group('rotate(-24 10.6 8)', pill(9.2, 2.4, 2.8, 7, h.base)) +
          group('rotate(-8 14 7)', pill(12.6, 0.8, 3, 7.6, h.base)) +
          group('rotate(10 17.6 7.6)', pill(16.2, 1.6, 2.8, 7, h.base)) +
          pill(13.2, 1.8, 1.2, 3, h.light),
      };
  }
};

/* ---------------------------------------------------------------- les yeux */

/** Un œil ouvert : le blanc, l'iris de la couleur choisie, un éclat. */
function eye(x: number, y: number, tone: Tone, size = 1): string {
  return circle(x, y, 1.65 * size, paper.base) + circle(x + 0.2, y + 0.2, 1.15 * size, PALETTE[tone].base) + circle(x - 0.25, y - 0.25, 0.45 * size, paper.base);
}

/** Un sourcil, penché de `angle` degrés autour de son milieu. */
function brow(x: number, y: number, angle: number, tone: Tone): string {
  return group(`rotate(${angle} ${x} ${y})`, pill(x - 1.7, y - 0.55, 3.4, 1.1, PALETTE[tone].base));
}

/** Les deux yeux de face, ou le seul de profil ; `right` dessine l'œil droit autrement (le clin d'œil). */
function eyes(facing: Facing, draw: (x: number, y: number) => string, brows: (x: number, y: number, inner: 1 | -1) => string, right = draw): Layer {
  switch (facing) {
    case 'down':
      return { eyes: draw(13.2, 15) + right(18.8, 15) + brows(13.2, 12.6, 1) + brows(18.8, 12.6, -1) };
    case 'up':
      return {};
    case 'side':
      return { eyes: right(21, 14.6) + brows(20.8, 12.2, 1) };
  }
}

const eyesBold: PieceArt = (facing, paint) =>
  eyes(
    facing,
    (x, y) => eye(x, y, paint.eyes),
    (x, y, inner) => brow(x, y, inner * 12, paint.hair),
  );

const eyesSleepy: PieceArt = (facing, paint) =>
  eyes(
    facing,
    (x, y) => eye(x, y, paint.eyes) + pill(x - 1.9, y - 1.9, 3.8, 2, skin.shade) + pill(x - 1.9, y - 0.4, 3.8, 0.7, ink.base),
    (x, y) => brow(x, y + 0.3, 0, paint.hair),
  );

const eyesBright: PieceArt = (facing, paint) =>
  eyes(
    facing,
    (x, y) => eye(x, y, paint.eyes, 1.15) + circle(x + 0.6, y + 0.7, 0.3, paper.base),
    (x, y, inner) => brow(x, y - 0.6, -inner * 8, paint.hair),
  );

const eyesWink: PieceArt = (facing, paint) =>
  eyes(
    facing,
    (x, y) => eye(x, y, paint.eyes),
    (x, y, inner) => brow(x, y, inner * 10, paint.hair),
    (x, y) => group(`rotate(-8 ${x} ${y})`, pill(x - 1.7, y - 0.5, 3.4, 1.1, ink.base)),
  );

/* ---------------------------------------------------------------- les barbes */

const beardNone: PieceArt = () => ({});

const beardStubble: PieceArt = (facing, { hair }) => {
  const dot = PALETTE[hair].base;
  const dots = (points: readonly (readonly [number, number])[]): string => points.map(([x, y]) => circle(x, y, 0.3, dot)).join('');

  switch (facing) {
    case 'down':
      return {
        beard:
          pill(11, 17.6, 10, 3, skin.shade) +
          dots([[12.4, 18.6], [13.9, 19.6], [16, 19.9], [18.1, 19.6], [19.6, 18.6], [12.8, 17.9], [19.2, 17.9]]) +
          pill(14.4, 17.7, 3.4, 1.3, coral.shade),
      };
    case 'up':
      return {};
    case 'side':
      return { beard: pill(17.8, 17, 5.4, 2.6, skin.shade) + dots([[19, 18.4], [20.6, 19], [22.2, 18.6]]) + pill(21.4, 18.2, 2.2, 1.1, coral.shade) };
  }
};

const beardShort: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return {
        beard:
          pill(9.7, 15, 1.8, 4.6, h.base) +
          pill(20.5, 15, 1.8, 4.6, h.base) +
          pill(10.4, 17.2, 11.2, 3.8, h.base) +
          pill(11.6, 17.6, 2.6, 1, h.light) +
          pill(14.5, 17.6, 3, 1.3, coral.shade),
      };
    case 'up':
      return {};
    case 'side':
      return { beard: pill(15.6, 14.6, 1.8, 4.6, h.base) + pill(16.6, 16.8, 6.4, 3.6, h.base) + pill(21.6, 17.8, 2, 1.1, coral.shade) };
  }
};

const beardMustache: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return {
        beard:
          pill(12.2, 16.3, 3.9, 1.8, h.base) +
          pill(15.9, 16.3, 3.9, 1.8, h.base) +
          circle(11.9, 15.8, 1, h.base) +
          circle(20.1, 15.8, 1, h.base) +
          pill(14.8, 18.3, 2.4, 1, coral.shade),
      };
    case 'up':
      return {};
    case 'side':
      return { beard: pill(20.4, 16.3, 3.6, 1.7, h.base) + circle(23.6, 15.8, 0.95, h.base) };
  }
};

const beardFull: PieceArt = (facing, { hair }) => {
  const h = PALETTE[hair];

  switch (facing) {
    case 'down':
      return {
        beard:
          pill(9.4, 13.6, 2.2, 5.6, h.base) +
          pill(20.4, 13.6, 2.2, 5.6, h.base) +
          pill(9.6, 16.6, 12.8, 6.4, h.shade) +
          pill(9.9, 16.6, 12.2, 5.2, h.base) +
          pill(11.2, 17.4, 3, 1.2, h.light) +
          pill(14.4, 17.6, 3.2, 1.4, coral.shade),
      };
    case 'up':
      return {};
    case 'side':
      return { beard: pill(15.8, 13.4, 2.2, 5.6, h.base) + pill(16.4, 16.2, 8, 6, h.shade) + pill(16.6, 16.2, 7.6, 4.8, h.base) + pill(21.4, 17.6, 2.2, 1.1, coral.shade) };
  }
};

/* ---------------------------------------------------------------- les lunettes */

const glassesNone: PieceArt = () => ({});

const glassesRound: PieceArt = (facing) => {
  switch (facing) {
    case 'down':
      return { glasses: ring(13.2, 15, 2.4, 2.4, 0.9, ink.base) + ring(18.8, 15, 2.4, 2.4, 0.9, ink.base) + pill(15.3, 14.5, 1.4, 0.9, ink.base) };
    case 'up':
      return {};
    case 'side':
      return { glasses: ring(21, 14.6, 2.3, 2.3, 0.9, ink.base) + pill(15.6, 14.1, 3.4, 0.9, ink.base) };
  }
};

const glassesAviator: PieceArt = (facing) => {
  const lens = (x: number, y: number): string => rect(x, y, 5, 3.8, cyan.shade, 1.9) + pill(x + 0.8, y + 0.6, 2.2, 0.9, cyan.light);

  switch (facing) {
    case 'down':
      return { glasses: pill(10.6, 13.1, 10.8, 0.9, yellow.shade) + lens(10.6, 13.4) + lens(16.4, 13.4) };
    case 'up':
      return {};
    case 'side':
      return { glasses: pill(15.6, 13.4, 4.6, 0.9, yellow.shade) + rect(19.2, 13, 4.6, 3.8, cyan.shade, 1.9) + pill(20, 13.6, 2, 0.9, cyan.light) };
  }
};

/** Les lunettes de soudeur, remontées sur le front : verres cyan cerclés de jaune, sangle indigo. */
const glassesGoggles: PieceArt = (facing) => {
  const goggle = (x: number, y: number): string => shadedCircle(x, y, 2.7, 'yellow') + circle(x, y, 1.6, cyan.base) + circle(x - 0.5, y - 0.5, 0.6, cyan.light);

  switch (facing) {
    case 'down':
      return { glasses: pill(9.2, 8.4, 13.6, 2.2, ink.shade) + goggle(13.2, 9.4) + goggle(18.8, 9.4) };
    case 'up':
      return { glasses: pill(9.2, 8.6, 13.6, 2.2, ink.shade) + rect(14.6, 8.2, 2.8, 3, ink.light, 1) };
    case 'side':
      return { glasses: pill(10, 8.4, 9, 2.2, ink.shade) + goggle(20.2, 9.4) };
  }
};

/* ---------------------------------------------------------------- les chapeaux */

const hatNone: PieceArt = () => ({});

const hatBandana: PieceArt = (facing) => {
  const band = (x: number, w: number): string =>
    pill(x, 6.4, w, 4, violet.shade) + pill(x, 6.4, w, 3, violet.base) + circle(x + w * 0.22, 7.9, 0.6, paper.base) + circle(x + w * 0.5, 7.7, 0.6, paper.base) + circle(x + w * 0.78, 7.9, 0.6, paper.base);

  switch (facing) {
    case 'down':
      return { hat: band(9.4, 13.2) + group('rotate(20 22 8.4)', pill(21.4, 7.4, 4.6, 2, violet.shade)) };
    case 'up':
      return { hat: band(9.4, 13.2) + pill(13.8, 9.2, 1.9, 5.2, violet.shade) + pill(16.3, 9.2, 1.9, 5.8, violet.shade) + circle(16, 8.6, 1.8, violet.base) };
    case 'side':
      return { hat: band(9.6, 13) + pill(5, 7.8, 5.6, 2, violet.shade) + pill(5.6, 9.6, 4.6, 1.8, violet.shade) };
  }
};

const hatFlower: PieceArt = (facing) => {
  switch (facing) {
    case 'down':
      return { hat: leaf(21.4, 10.4, 40, 0.8) + flower(21.8, 8.8, 'coral', 1) };
    case 'up':
      return { hat: leaf(10.4, 10.6, -130, 0.8) + flower(10.2, 9, 'coral', 1) };
    case 'side':
      return { hat: leaf(14.6, 12.2, 150, 0.8) + flower(14.6, 10.4, 'coral', 1) };
  }
};

const hatCap: PieceArt = (facing) => {
  const crown = (x: number, w: number): string => rect(x, 4, w, 6, cyan.shade, 3) + rect(x, 4, w, 4.8, cyan.base, 3) + highlight(x, 4, w, 4.8, 'cyan');

  switch (facing) {
    case 'down':
      return { hat: crown(9.4, 13.2) + pill(10.2, 8.6, 11.6, 2.8, cyan.shade) + circle(16, 4.4, 0.9, cyan.shade) };
    case 'up':
      return { hat: crown(9.4, 13.2) + pill(14, 8.2, 4, 1.6, paper.shade) + circle(16, 4.4, 0.9, cyan.shade) };
    case 'side':
      return { hat: crown(9.4, 12) + pill(19, 7.8, 7, 2.4, cyan.shade) };
  }
};

const hatStraw: PieceArt = (facing) => {
  const hat = (cx: number): string =>
    ellipse(cx, 8.8, 12.6, 3.4, yellow.shade) +
    ellipse(cx, 8.3, 12.2, 2.9, yellow.base) +
    rect(cx - 5.4, 2.2, 10.8, 6.6, yellow.shade, 4) +
    rect(cx - 5.4, 2.2, 10.8, 5.4, yellow.base, 4) +
    highlight(cx - 5.4, 2.2, 10.8, 5.4, 'yellow') +
    pill(cx - 5.4, 6.2, 10.8, 1.8, coral.base);

  switch (facing) {
    case 'down':
      return { hat: hat(16) };
    case 'up':
      return { hat: hat(16) };
    case 'side':
      return { hat: hat(15.6) + flower(11.4, 6.4, 'mint', 0.6) };
  }
};

/** L'antenne bricolée : un serre-tête indigo, une tige, une ampoule jaune allumée. */
const hatAntenna: PieceArt = (facing) => {
  const antenna = (x: number, top: number, tip: number): string =>
    line(x, 7.4, tip, top + 1.6, ink.base) + circle(tip, top + 1.6, 1.9, yellow.shade) + circle(tip - 0.2, top + 1.4, 1.5, yellow.base) + circle(tip - 0.6, top + 1, 0.55, yellow.light);

  switch (facing) {
    case 'down':
      return { hat: pill(9.6, 6.6, 12.8, 2.2, ink.base) + antenna(19.2, 0, 21.8) };
    case 'up':
      return { hat: pill(9.6, 6.8, 12.8, 2.2, ink.base) + antenna(12.8, 0, 10.2) };
    case 'side':
      return { hat: pill(9.8, 6.4, 12, 2.2, ink.base) + antenna(14.6, 0, 12.6) };
  }
};

/* ---------------------------------------------------------------- le pied */

/** Une jambe de pantalon, centrée en x = 16 : elle monte sous la tunique. */
function leg(tone: Tone, depth = 1.4): string {
  const c = PALETTE[tone];

  return pill(13.7, 29.4, 4.6, 8, c.shade) + pill(13.7, 29.4, 4.6, 8 - depth, c.base);
}

const pantsCargo: FootArt = () => leg('violet') + rect(14.2, 32, 2.4, 2, violet.light, 0.8);

const pantsShorts: FootArt = () => pill(14.3, 31.6, 3.4, 5.6, skin.base) + pill(13.4, 29.4, 5.2, 4.8, cyan.shade) + pill(13.4, 29.4, 5.2, 3.8, cyan.base);

const pantsPatched: FootArt = () => leg('cyan') + rect(14.1, 31.6, 3, 2.6, coral.base, 0.8) + circle(14.9, 32.3, 0.45, coral.light);

const pantsStriped: FootArt = () => leg('yellow') + pill(13.7, 30.6, 4.6, 1, coral.base) + pill(13.7, 32.6, 4.6, 1, coral.base) + pill(13.7, 34.6, 4.6, 1, coral.base);

const shoesBoots: FootArt = () => pill(12.6, 33.4, 6.8, 5, ink.shade) + pill(12.6, 33.4, 6.8, 3.8, ink.base) + pill(13.6, 33.9, 2.4, 1, ink.light);

const shoesSandals: FootArt = () => pill(13, 34.6, 6, 3.4, skin.base) + pill(12.6, 37, 6.8, 1.4, orange.shade) + pill(13, 35.2, 6, 1.1, orange.base);

const shoesSneakers: FootArt = () => pill(12.6, 33.8, 6.8, 4.6, paper.shade) + pill(12.6, 33.8, 6.8, 3.4, paper.base) + pill(14, 35.2, 3.6, 1, coral.base);

const shoesRainBoots: FootArt = () =>
  pill(13, 31, 6, 6, yellow.shade) + pill(12.4, 35.2, 7.2, 3.2, yellow.shade) + pill(13, 31, 6, 6.2, yellow.base) + pill(13.8, 31.6, 1.6, 3, yellow.light);

/** Les chaussons lapin : oreilles roses, deux yeux, une truffe — pour affronter la fin du monde au chaud. */
const shoesBunny: FootArt = () =>
  pill(13.4, 30.6, 1.8, 4.4, paper.shade) +
  pill(16.8, 30.6, 1.8, 4.4, paper.shade) +
  pill(13.8, 31.2, 1, 2.6, coral.light) +
  pill(17.2, 31.2, 1, 2.6, coral.light) +
  pill(12.4, 33.6, 7.2, 4.8, paper.shade) +
  pill(12.4, 33.6, 7.2, 3.6, paper.base) +
  circle(14.6, 35, 0.5, ink.base) +
  circle(17.4, 35, 0.5, ink.base) +
  circle(16, 35.9, 0.55, coral.base);

/* ---------------------------------------------------------------- le registre */

/** Le dessin de chaque pièce : une pièce du catalogue sans dessin ne compile pas. */
export const PIECE_ART = {
  hairShort,
  hairBuzz,
  hairCurly,
  hairMohawk,
  eyesBold,
  eyesSleepy,
  eyesBright,
  eyesWink,
  beardNone,
  beardStubble,
  beardShort,
  beardMustache,
  beardFull,
  topTunic,
  topHoodie,
  topJacket,
  topPoncho,
  topArmor,
  pantsCargo,
  pantsShorts,
  pantsPatched,
  pantsStriped,
  shoesBoots,
  shoesSandals,
  shoesSneakers,
  shoesRainBoots,
  shoesBunny,
  glassesNone,
  glassesRound,
  glassesAviator,
  glassesGoggles,
  hatNone,
  hatBandana,
  hatFlower,
  hatCap,
  hatStraw,
  hatAntenna,
} as const satisfies Record<PieceId, PieceArt | FootArt>;

/** Les emplacements du corps (dans l'ordre des calques) et ceux du pied. */
const BODY_SLOTS = ['top', 'hair', 'eyes', 'beard', 'glasses', 'hat'] as const satisfies readonly LookSlot[];
const FOOT_SLOTS = ['pants', 'shoes'] as const satisfies readonly LookSlot[];

function paintOf(look: Look): Paint {
  return { hair: look.colors.hair, eyes: look.colors.eyes, top: look.colors.top };
}

/** Les calques du corps d'Adam dans une direction, sans le cadre : fixes d'abord, puis une pièce par emplacement. */
export function adamLayers(look: Look, facing: Facing): string {
  const paint = paintOf(look);
  const layers: Layer[] = [
    skinLayer(facing),
    packLayer(facing),
    scarfLayer(facing),
    ...BODY_SLOTS.map((slot) => (PIECE_ART[look.pieces[slot]] as PieceArt)(facing, paint)),
  ];

  return DEPTHS.map((depth) => layers.map((layer) => layer[depth] ?? '').join('')).join('');
}

/** Un pied d'Adam, sans le cadre : la jambe, puis la chaussure, centrés en x = 16. */
export function adamFootLayers(look: Look): string {
  return FOOT_SLOTS.map((slot) => (PIECE_ART[look.pieces[slot]] as FootArt)()).join('');
}

/** Les morceaux d'Adam qui dépendent de son apparence : un corps par direction, le pied. */
export type LookPart = 'down' | 'up' | 'side' | 'foot';

export function adamLookParts(look: Look): Record<LookPart, string> {
  return {
    down: svg(ADAM_W, ADAM_H, adamLayers(look, 'down')),
    up: svg(ADAM_W, ADAM_H, adamLayers(look, 'up')),
    side: svg(ADAM_W, ADAM_H, adamLayers(look, 'side')),
    foot: svg(ADAM_W, ADAM_H, adamFootLayers(look)),
  };
}

/** Adam en entier, pieds posés, sans cadre : pour l'éditeur et les vignettes. */
export function adamFigure(look: Look, facing: Facing): string {
  const spread = facing === 'side' ? ADAM_STRIDE.side : ADAM_STRIDE.front;
  const foot = adamFootLayers(look);

  return group(`translate(${-spread} 0)`, foot) + group(`translate(${spread} 0)`, foot) + adamLayers(look, facing);
}

/** Ce qu'une vignette de l'éditeur cadre, en pixels du sprite : la tête, le buste ou les jambes. */
const FRAMES: Record<LookSlot, readonly [number, number, number, number]> = {
  hair: [4, -1, 24, 24],
  eyes: [7, 6, 18, 18],
  beard: [6, 6, 20, 20],
  glasses: [6, 3, 20, 20],
  hat: [3, -1, 26, 26],
  top: [3, 14, 26, 26],
  pants: [5, 22, 22, 18],
  shoes: [5, 24, 22, 16],
};

/** Ce qu'une vignette retire pour qu'on voie la pièce : les lunettes devant les yeux, le chapeau sur les cheveux. */
const UNCOVER: Partial<Record<LookSlot, Partial<Record<LookSlot, PieceId>>>> = {
  eyes: { glasses: 'glassesNone' },
  hair: { hat: 'hatNone' },
};

/** La vignette d'une pièce : Adam qui la porte, cadré sur l'emplacement, de face. */
export function pieceThumbnail(look: Look, slot: LookSlot, piece: PieceId, size: number): string {
  const worn: Look = { pieces: { ...look.pieces, ...UNCOVER[slot], [slot]: piece }, colors: look.colors };
  const [x, y, w, h] = FRAMES[slot];

  return framed(adamFigure(worn, 'down'), size, size, x, y, w, h);
}

/** Le visage d'Adam tel qu'il est habillé, chapeau compris : le bouton de sa garde-robe. */
export function adamFace(look: Look, size: number): string {
  const [x, y, w, h] = FRAMES.hat;

  return framed(adamFigure(look, 'down'), size, size, x, y, w, h);
}

/** Un SVG à la taille d'affichage, qui cadre la zone (x, y, w, h) du sprite. */
function framed(body: string, width: number, height: number, x: number, y: number, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${w} ${h}">${body}</svg>`;
}

/** L'Adam de départ, celui du registre des sprites. */
export const DEFAULT_ADAM_PARTS = adamLookParts(DEFAULT_LOOK);

/** Le dessin d'une pièce est-il fait pour son emplacement ? Le pied et le corps ne se mélangent pas. */
export function isFootPiece(piece: PieceId): boolean {
  return (FOOT_SLOTS as readonly LookSlot[]).includes(PIECES[piece].slot);
}
