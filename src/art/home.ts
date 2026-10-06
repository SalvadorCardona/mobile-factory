/**
 * La Maison : quatre lits, pour que les habitants ne dorment plus dehors.
 *
 * La seule maison **à étage** de la colonie : haute et étroite, murs jaunes,
 * sous un grand **toit d'ardoise bleu indigo** — son accent, que nul autre
 * bâtiment ne porte en grand —, percé d'un œil-de-bœuf allumé. Ce qui la
 * signe de loin : **l'édredon en patchwork** qui prend l'air à la fenêtre de
 * l'étage, et la cheminée corail qui fume. Ce qui raconte qu'on y vit : la
 * jardinière sous la fenêtre du bas, un chat roulé en boule sur le paillasson,
 * une liane et deux fleurs au pied.
 *
 * Son chantier : le plancher et les montants au trait, deux sommiers déjà
 * posés, l'oreiller dessus — on y dormira avant d'y avoir des murs —, et le
 * panneau porte un lit.
 *
 * Cadre 64 × 104 ; l'emprise occupe les 64 px du bas.
 */

import { PALETTE, RADIUS, circle, flower, line, pill, polygon, rect, shadedBlock, shadedPill, svg, windowPane } from '../data/artDirection.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { damageMarks, door, gableRoof, lifeAt, scaffold, siteClutter, siteGround, siteSign } from './building.ts';

const W = 64;
const H = 104;
const FOOTPRINT = 64;

const { ink, coral, cyan, mint, yellow, paper, violet } = PALETTE;

/** La cheminée corail et sa fumée : trois bouffées blanches qui montent vers la droite. */
function chimney(smoke: boolean): string {
  return (
    shadedBlock(42, 14, 8, 20, 3, 'coral', RADIUS.small) +
    pill(41, 13, 10, 3.5, coral.shade) +
    (smoke ? circle(47, 9, 3.2, paper.shade) + circle(46.5, 8.5, 2.8, paper.base) + circle(52, 4.5, 2.4, paper.shade) + circle(51.6, 4.2, 2, paper.base) : '')
  );
}

/** L'œil-de-bœuf du grenier : un rond allumé dans le pignon. */
function bullseye(cx: number, cy: number): string {
  return circle(cx, cy, 5.2, ink.shade) + circle(cx, cy, 4, yellow.light) + pill(cx - 2.6, cy - 2.8, 3, 1.6, paper.base);
}

/**
 * L'édredon en patchwork, pendu à l'appui de la fenêtre de l'étage : six
 * carrés corail, cyan, menthe — on le voit de loin, c'est la maison où l'on dort.
 */
function quilt(x: number, y: number): string {
  const tones = [coral, cyan, mint, mint, coral, cyan] as const;
  const squares = tones.map((tone, index) => rect(x + (index % 3) * 5.5, y + Math.floor(index / 3) * 5.5, 5.5, 5.5, tone.base, 1.5)).join('');

  return rect(x - 0.5, y + 0.5, 17.5, 12, violet.shade, RADIUS.small) + squares + pill(x + 1, y + 0.8, 6, 1.4, paper.base);
}

/** Un chat indigo roulé en boule : le dos, la tête, deux oreilles, la queue autour. */
function cat(x: number, y: number): string {
  return (
    pill(x - 7, y - 4.5, 13, 6, ink.base) +
    circle(x + 4.5, y - 5, 3.4, ink.base) +
    polygon([x + 2, y - 7.4, x + 3, y - 10.5, x + 4.6, y - 8], ink.base) +
    polygon([x + 5, y - 8, x + 6.6, y - 10.5, x + 7.4, y - 7], ink.base) +
    pill(x - 4.5, y - 4, 4.5, 1.4, ink.light) +
    pill(x - 9, y - 2.2, 7, 2.2, ink.shade)
  );
}

/** La jardinière sous la fenêtre du bas : un bac orange, trois fleurs. */
function planter(x: number, y: number): string {
  return flower(x + 3, y - 1, 'coral', 0.8) + flower(x + 8, y - 2, 'violet', 0.8) + flower(x + 12, y - 1, 'coral', 0.8) + shadedBlock(x, y, 15, 4.5, 1.5, 'orange', RADIUS.small);
}

function home(): string {
  return (
    chimney(true) +
    // Les murs : deux étages, la face avant qui dépasse en bas.
    shadedBlock(6, 44, 52, 54, 10, 'yellow') +
    gableRoof(1, 63, 48, 12, 'ink') +
    bullseye(32, 34) +
    // L'étage : deux fenêtres, l'édredon à la gauche.
    windowPane(12, 52, 11, 11, 'yellow') +
    windowPane(41, 52, 11, 11, 'yellow') +
    quilt(9, 61) +
    // Le rez-de-chaussée : la porte, la fenêtre et sa jardinière.
    door(25, 72, 13, 22) +
    windowPane(42, 74, 11, 10, 'yellow') +
    planter(40, 86) +
    // Le paillasson, et le chat dessus.
    pill(22, 94, 19, 4, violet.base) +
    cat(31, 97) +
    lifeAt(6, 98, 26)
  );
}

/** Un sommier vu en 3/4 : le cadre orange, le matelas blanc, l'oreiller cyan. */
function bedFrame(x: number, y: number): string {
  return (
    shadedBlock(x, y, 22, 9, 3, 'orange', RADIUS.small) +
    shadedPill(x + 1.5, y - 2, 19, 6, 2, 'paper') +
    shadedPill(x + 2.5, y - 3, 6, 4, 1.5, 'cyan')
  );
}

/** Le pictogramme du panneau : un petit lit, tête à gauche, autour de `x, y`. */
function bedGlyph(x: number, y: number): string {
  return rect(x - 5, y - 3, 2, 7, ink.base, 1) + rect(x - 4, y + 1, 10, 2.5, coral.base, 1) + pill(x - 3, y - 1, 4, 2.4, cyan.base) + line(x + 5, y + 2, x + 5, y + 4, ink.base);
}

function site(): string {
  return (
    siteGround(W, H, FOOTPRINT) +
    // Le plancher, et les montants de l'étage au trait.
    shadedBlock(6, 76, 52, 20, 5, 'yellow') +
    scaffold(8, 52, 48, 24) +
    bedFrame(10, 80) +
    bedFrame(34, 84) +
    siteClutter(W, H) +
    siteSign(44, 58, bedGlyph(51, 64))
  );
}

export const HOME = {
  width: W,
  height: H,
  anchorX: 0,
  anchorY: 1,
  parts: {
    site: svg(W, H, site()),
    built: svg(W, H, home()),
    damaged: svg(W, H, home(), damageMarks(6, 50, 52, 44)),
  },
} satisfies SpriteProto;
