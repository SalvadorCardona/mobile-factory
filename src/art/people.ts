/**
 * Morceaux communs aux humains : Adam et les enfants.
 *
 * Un humain se lit à trois choses : une tête ronde aux cheveux indigo, une
 * tunique orange (la teinte réservée aux humains) et une écharpe corail. Le
 * corps est dessiné par direction — face, dos, profil droit (le profil gauche
 * est le miroir, fait au rendu) — et les pieds sont un morceau à part, que le
 * rendu fait alterner pendant la marche.
 *
 * Cadre commun : `width × height`, le sol à `ground`. Le corps s'arrête au
 * ras des pieds : pas de jambes, la silhouette reste lisible à 32 px.
 */

import { PALETTE, circle, curve, group, highlight, line, pill, polyline, rect, shadedBlock, svg } from '../data/artDirection.ts';

export type Facing = 'down' | 'up' | 'side';

export interface HumanOptions {
  /** Sac à dos violet, bretelles comprises. */
  pack: boolean;
  /** Écharpe corail, dont le pan flotte. */
  scarf: boolean;
  /** Petite casquette jaune — les enfants de la colonie. */
  cap: boolean;
  /** Bras levés au-dessus de la tête — un ouvrier qui s'étire. De face seulement. */
  armsUp?: boolean;
  /** Yeux fermés, bouche grande ouverte — un ouvrier qui bâille. De face seulement. */
  yawn?: boolean;
}

const { ink, orange, coral, violet, skin, yellow, cyan } = PALETTE;

/**
 * Le corps d'un humain vu dans une direction, dans un cadre 32 × 48 aux pieds
 * en y = 38. Les enfants réutilisent ce corps, réduit autour des pieds.
 */
export function humanBody(facing: Facing, options: HumanOptions): string {
  switch (facing) {
    case 'down':
      return (
        (options.pack ? pill(9.5, 17.5, 13, 6, violet.shade) : '') +
        // Bras, puis tunique en trois tons, mains.
        (options.armsUp
          ? pill(4.5, 6, 4.5, 18, orange.shade) + pill(23, 6, 4.5, 18, orange.shade)
          : pill(7.5, 22, 4.5, 10, orange.shade) + pill(20, 22, 4.5, 10, orange.shade)) +
        rect(10, 21, 12, 14, orange.shade, 5) +
        rect(10, 21, 12, 11, orange.base, 5) +
        highlight(10, 21, 12, 11, 'orange') +
        (options.armsUp ? '' : circle(9.7, 32, 2, skin.base) + circle(22.3, 32, 2, skin.base)) +
        (options.pack ? line(12.5, 22.5, 12.5, 28, violet.shade) + line(19.5, 22.5, 19.5, 28, violet.shade) : '') +
        (options.scarf ? pill(10, 19, 12, 4.5, coral.base) + pill(18.5, 21, 3.5, 7, coral.shade) : '') +
        headFront(options.cap, options.yawn ?? false) +
        // Les mains par-dessus la tête : elles se rejoignent presque.
        (options.armsUp ? circle(6.75, 5.5, 2.3, skin.base) + circle(25.25, 5.5, 2.3, skin.base) : '')
      );

    case 'up':
      return (
        pill(7.5, 22, 4.5, 10, orange.shade) +
        pill(20, 22, 4.5, 10, orange.shade) +
        rect(10, 21, 12, 14, orange.shade, 5) +
        rect(10, 21, 12, 11, orange.base, 5) +
        circle(9.7, 32, 2, skin.base) +
        circle(22.3, 32, 2, skin.base) +
        (options.pack ? shadedBlock(10, 20.5, 12, 13, 3, 'violet', 4) + pill(11.5, 20.5, 9, 4, violet.light) : '') +
        (options.scarf ? pill(10.5, 18.5, 11, 4, coral.base) + pill(13, 21, 3.5, 7, coral.shade) : '') +
        headBack(options.cap)
      );

    case 'side':
      return (
        (options.scarf ? pill(4.5, 19.5, 9, 3.2, coral.shade) : '') +
        (options.pack ? shadedBlock(6.5, 19.5, 7.5, 12.5, 3, 'violet', 3) : '') +
        rect(11, 21, 10, 14, orange.shade, 4.5) +
        rect(11, 21, 10, 11, orange.base, 4.5) +
        highlight(11, 21, 10, 11, 'orange') +
        pill(14.5, 22, 4.5, 10, orange.shade) +
        circle(17, 32, 2, skin.base) +
        (options.scarf ? pill(11, 19, 10.5, 4.5, coral.base) : '') +
        headSide(options.cap)
      );
  }
}

/** Tête de face : cheveux indigo, visage, deux yeux, les joues roses. Qui bâille : yeux plissés, bouche en O. */
function headFront(cap: boolean, yawn = false): string {
  return (
    circle(16, 11.5, 7, ink.base) +
    rect(10, 11, 12, 9, skin.base, 4.5) +
    pill(10.5, 11, 11, 2.2, ink.base) +
    (cap ? pill(9, 5.5, 14, 5, yellow.base) + pill(11, 6.3, 5, 1.6, yellow.light) : pill(11.5, 6.3, 6, 2, ink.light)) +
    (yawn
      ? pill(12.2, 14.4, 2.6, 1.1, ink.base) + pill(17.2, 14.4, 2.6, 1.1, ink.base) + pill(14.4, 15.8, 3.2, 3.8, ink.shade) + pill(15, 17.9, 2, 1.2, coral.base)
      : circle(13.4, 15, 1.1, ink.base) + circle(18.6, 15, 1.1, ink.base)) +
    circle(11.9, 17.3, 1.1, coral.light) +
    circle(20.1, 17.3, 1.1, coral.light)
  );
}

/** Tête de dos : que des cheveux, et la nuque. */
function headBack(cap: boolean): string {
  return (
    pill(13.5, 17, 5, 3, skin.shade) +
    circle(16, 12, 7, ink.base) +
    (cap ? pill(9, 5.5, 14, 5, yellow.base) : pill(11.5, 6.5, 6, 2, ink.light))
  );
}

/** Tête de profil droit : cheveux vers l'arrière, un œil, la joue. */
function headSide(cap: boolean): string {
  return (
    circle(16.5, 12.5, 7, skin.base) +
    circle(15, 11, 6.6, ink.base) +
    rect(16, 11.5, 7.5, 7.5, skin.base, 3.5) +
    (cap ? pill(10, 5.5, 15, 5, yellow.base) + pill(21, 8, 5, 2.5, yellow.shade) : pill(11, 6.3, 6, 2, ink.light)) +
    circle(20.8, 14.6, 1.1, ink.base) +
    circle(21.4, 17.2, 1.1, coral.light)
  );
}

/** Un pied : une capsule indigo, centrée en x = 16, posée au sol. */
export function foot(ground: number, tone: 'ink' | 'toxic' = 'ink', size = 1): string {
  const w = 6 * size;
  const h = 3.6 * size;

  return pill(16 - w / 2, ground - h, w, h, PALETTE[tone].shade);
}

/** L'arc de fortune : une branche jaune courbée, une corde indigo. */
export function bow(x: number, top: number, bottom: number): string {
  const middle = (top + bottom) / 2;

  return curve(`M${x} ${top} Q${x + 7} ${middle} ${x} ${bottom}`, yellow.shade) + line(x, top, x, bottom, ink.light);
}

/** La hache, tenue manche en main en (x, y) : le fer cyan à hauteur d'épaule, tranchant vers l'avant. */
export function axe(x: number, y: number): string {
  return (
    line(x, y + 1, x + 3.5, y - 14, orange.shade) +
    rect(x + 1.5, y - 19, 7.5, 6, cyan.shade, 2) +
    rect(x + 1.5, y - 19, 7.5, 4.8, cyan.base, 2) +
    pill(x + 2.5, y - 18.2, 3.5, 1.5, cyan.light)
  );
}

/** Le marteau, tenu manche en main en (x, y) : la tête indigo à hauteur d'épaule. */
export function hammer(x: number, y: number): string {
  return (
    line(x, y + 1, x + 2.5, y - 11, orange.shade) +
    rect(x - 1.5, y - 16, 9, 5.5, ink.shade, 2) +
    rect(x - 1.5, y - 16, 9, 4.2, ink.base, 2) +
    pill(x - 0.5, y - 15.3, 3.5, 1.4, ink.light)
  );
}

/**
 * La bêche, tenue manche en main en (x, y) : le manche droit, la poignée en
 * travers au-dessus de la main, le fer cyan plat en bas — c'est lui qui s'enfonce.
 */
export function spade(x: number, y: number): string {
  return (
    line(x, y - 9, x + 1.5, y + 4, orange.shade) +
    pill(x - 2.5, y - 11, 6, 2.4, orange.base) +
    rect(x - 1.5, y + 3, 6, 6.5, cyan.shade, 2) +
    rect(x - 1.5, y + 3, 6, 5, cyan.base, 2) +
    pill(x - 0.8, y + 3.6, 2.4, 1.3, cyan.light)
  );
}

/**
 * La pioche, tenue manche en main en (x, y) : un fer cyan long et fin, en
 * travers du manche, à deux pointes — la hache, elle, n'a qu'un tranchant carré.
 */
export function pickaxe(x: number, y: number): string {
  const cx = x + 4;
  const top = y - 15;

  return (
    line(x, y + 1, cx, top + 1, orange.shade) +
    group(
      `rotate(-16 ${cx} ${top})`,
      pill(cx - 5, top - 1.8, 12.5, 3.6, cyan.shade),
      pill(cx - 5, top - 1.8, 12.5, 2.7, cyan.base),
      pill(cx - 3.5, top - 1.4, 4, 1.2, cyan.light),
      circle(cx, top, 1.8, ink.base),
    )
  );
}

/**
 * Les poses d'un ouvrier qui glande, toutes de face :
 * - `sit` : assis par terre, le corps tassé au sol, les deux pieds devant ;
 * - `stretch` : debout, il s'étire, bras levés au-dessus de la tête ;
 * - `yawn` : il bâille, yeux plissés, bouche en O — la bulle `zzz` à côté.
 * (Adossé et flâneur se font au rendu : le corps penche, ou marche sans but.)
 */
export const IDLE_POSES = ['sit', 'stretch', 'yawn'] as const;

export type IdlePose = (typeof IDLE_POSES)[number];

/** Ce qu'une pose de glande change au corps : les bras, le visage. */
export type IdleLook = Pick<HumanOptions, 'armsUp' | 'yawn'>;

/** De combien le corps descend quand il s'assoit, en pixels du corps d'adulte. */
const SIT_DROP = 6;

/**
 * Les morceaux de glande d'un ouvrier : une pose par `IDLE_POSES`, dans le
 * cadre `width × height` du sprite, et la bulle `zzz`. `figure` dessine le
 * corps d'adulte de face (pieds en (16, 38.4)) avec ce qui le distingue —
 * casque, caisse, barbe — selon les options de la pose ; `scale` le réduit
 * autour des pieds, posés à `ground`.
 */
export function idleParts(
  width: number,
  height: number,
  ground: number,
  scale: number,
  figure: (look: IdleLook) => string,
): Record<IdlePose | 'zzz', string> {
  const sized = (body: string): string => svg(width, height, scaledAround(16, ground, scale, body));

  return {
    sit: sized(
      // Tassé sur son derrière : plus bas, un peu écrasé, les pieds devant lui, écartés, semelles vers nous.
      group(`translate(16 ${ground + SIT_DROP}) scale(1.06 0.9) translate(-16 ${-ground})`, figure({})) +
        pill(6.5, ground + 1, 7, 4.4, ink.shade) +
        pill(18.5, ground + 1, 7, 4.4, ink.shade),
    ),
    stretch: sized(figure({ armsUp: true })),
    yawn: sized(figure({ yawn: true })),
    zzz: svg(width, height, zzz(25, 6)),
  };
}

/** La bulle du dormeur : un nuage blanc, un grand Z indigo, deux petites bulles vers la tête. */
function zzz(cx: number, cy: number): string {
  const { paper } = PALETTE;

  return (
    circle(cx - 6.2, cy + 7.6, 1.3, paper.shade) +
    circle(cx - 4, cy + 5, 1.9, paper.shade) +
    circle(cx + 0.4, cy + 0.5, 5.6, paper.shade) +
    circle(cx, cy, 5.4, paper.base) +
    polyline([cx - 2.4, cy - 2.4, cx + 2.4, cy - 2.4, cx - 2.4, cy + 2.4, cx + 2.4, cy + 2.4], ink.base)
  );
}

/** Réduit un corps d'adulte autour des pieds : c'est ainsi qu'on dessine un enfant. */
export function scaledAround(x: number, y: number, factor: number, body: string): string {
  return group(`translate(${x} ${y}) scale(${factor}) translate(${-x} ${-y})`, body);
}

export { svg };
