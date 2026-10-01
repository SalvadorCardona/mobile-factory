/**
 * Icônes d'objets — contenu pur.
 *
 * Une ressource = une icône. `ITEM_ICONS` est un `Record<ItemId, string>` :
 * ajouter un objet dans `items.ts` sans lui donner d'icône ici ne compile pas.
 * C'est la seule garantie qui tienne ; un `icon?: string` optionnel finit en
 * carré vide dans le sac au bout de trois objets.
 *
 * Chaque icône est un SVG de `ICON_SIZE` px de côté, construit avec les
 * helpers de la direction artistique, et reprend la couleur de ce qu'elle
 * représente : la pierre est corail comme son rocher, le fer cyan, le
 * charbon indigo. Le HUD les affiche telles quelles (`ui/icons.ts`).
 */

import { PALETTE, RADIUS, circle, cushion, line, pill, polygon, rect, shadedBlock, shadedPill, svg } from './artDirection.ts';
import type { ItemId } from './items.ts';

/** Côté d'une icône, dans son propre repère. */
export const ICON_SIZE = 24;

const S = ICON_SIZE;
const { ink, orange, yellow, cyan, mint, toxic, paper } = PALETTE;

export const ITEM_ICONS: Record<ItemId, string> = {
  /** Une bûche orange, sa tranche jaune et ses cernes — comme sur la maquette. */
  wood: svg(
    S,
    S,
    shadedPill(3, 7, 18, 11, 3, 'orange'),
    circle(19, 12, 5, yellow.shade),
    circle(18.6, 11.6, 4.2, yellow.base),
    circle(18.6, 11.6, 1.6, orange.light),
    pill(5, 16.5, 6, 2, orange.shade),
  ),
  /** Un galet corail, la couleur des rochers de pierre. */
  stone: svg(S, S, shadedPill(3, 6, 18, 14, 4, 'coral'), pill(6, 16.5, 4, 1.6, PALETTE.coral.shade)),
  /** Un morceau de charbon indigo, facettes luisantes. */
  coal: svg(
    S,
    S,
    polygon([4, 14, 9, 5, 18, 6, 21, 15, 14, 20, 6, 19], ink.shade),
    polygon([5, 13, 9.5, 5.5, 17.5, 6.5, 19.5, 13.5, 13, 16.5], ink.base),
    polygon([8.5, 8.5, 11, 6.8, 13, 8.2, 10, 10.5], ink.light),
    circle(17, 9.5, 1, yellow.light),
  ),
  /** Un bloc de fer cyan, clouté de pépites claires, comme son rocher. */
  ironOre: svg(
    S,
    S,
    shadedPill(3, 6, 18, 14, 4, 'cyan'),
    circle(9.5, 12.5, 2.4, cyan.shade),
    circle(9, 12, 1.9, cyan.light),
    circle(15.5, 10.5, 1.8, cyan.shade),
    circle(15.1, 10.1, 1.4, cyan.light),
  ),
  /** Un épi de maïs jaune dans ses feuilles menthe. */
  food: svg(
    S,
    S,
    rect(9, 3, 7, 16, yellow.shade, 3.5),
    rect(9, 3, 6, 14, yellow.base, 3),
    pill(10.5, 5, 2.4, 6, yellow.light),
    cushion(8, 17, 8, 6),
    cushion(16.5, 17, 8, 6),
    line(12.5, 21, 12.5, 23, mint.shade),
  ),
  /** Une plaque de fer cyan, forgée, rivetée d'indigo aux quatre coins. */
  ironPlate: svg(
    S,
    S,
    shadedBlock(3, 5, 18, 15, 4, 'cyan', RADIUS.small),
    circle(6.5, 8.5, 1.3, ink.base),
    circle(17.5, 8.5, 1.3, ink.base),
    circle(6.5, 14, 1.3, ink.base),
    circle(17.5, 14, 1.3, ink.base),
  ),
  /** Une goutte de gelée fluo, tremblotante, qui louche d'un œil : un bout de mutant, drôle plus qu'effrayant. */
  mutantGoo: svg(
    S,
    S,
    pill(3, 11, 18, 11, toxic.shade),
    circle(12, 11, 7.5, toxic.shade),
    pill(3, 11, 18, 8.5, toxic.base),
    circle(11.4, 10.4, 6.8, toxic.base),
    pill(6.5, 5.5, 5, 2.4, toxic.light),
    circle(19.5, 19.5, 1.6, toxic.shade),
    circle(13.5, 12, 2.6, paper.base),
    circle(14.2, 12.5, 1.3, ink.base),
  ),
  /** Un croc blanc, pointe en bas, passé sur un lacet indigo : le trophée d'un loup. */
  wolfFang: svg(
    S,
    S,
    line(4, 4.5, 20, 4.5, ink.base),
    polygon([7, 6, 17, 6, 13.5, 20, 11.5, 21], paper.shade),
    polygon([7, 6, 15.5, 6, 12.5, 18.5, 11, 19], paper.base),
    rect(6, 3, 12, 6, paper.shade, RADIUS.small),
    rect(6, 3, 11, 4.5, paper.base, RADIUS.small),
    pill(9, 8.5, 2, 6, paper.shade),
  ),
  /** Une pince orange, ouverte, comme celles du crabe des ruines. */
  crabClaw: svg(
    S,
    S,
    shadedPill(3, 12, 11, 8, 2.5, 'orange'),
    polygon([10, 8, 21, 4, 19, 10, 12, 13], orange.shade),
    polygon([10, 8, 20, 4.5, 18, 8.5, 11.5, 11.5], orange.base),
    polygon([11, 14, 21, 15, 20, 19, 12, 18], orange.shade),
    polygon([11, 14, 20.5, 15, 19.5, 17.5, 12, 16.8], orange.base),
    pill(12.5, 6.8, 4, 1.6, orange.light),
    circle(6, 16, 1, orange.light),
  ),
  /**
   * Le cœur de la Reine : une bille fluo cerclée d'indigo — un disque plein
   * derrière elle, pas un trait —, reflet en haut à gauche, et le trèfle
   * radioactif en trois points indigo autour d'un quatrième.
   */
  radCore: svg(
    S,
    S,
    circle(12, 12.5, 10.5, ink.base),
    circle(12, 12.5, 8.5, toxic.shade),
    circle(11.4, 11.6, 7.8, toxic.base),
    pill(6.5, 6.5, 5.5, 2.6, toxic.light),
    circle(12, 12.5, 1.6, ink.base),
    circle(12, 8.4, 1.7, ink.base),
    circle(15.6, 14.6, 1.7, ink.base),
    circle(8.4, 14.6, 1.7, ink.base),
  ),
};
