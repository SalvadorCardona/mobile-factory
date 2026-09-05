/**
 * Déplacement d'une boîte sur la grille — la seule « physique » du jeu.
 *
 * Adam, les mutants et les enfants sont des AABB centrées sur leur position.
 * Les deux axes sont intégrés séparément : une boîte qui bute sur un obstacle
 * en diagonale glisse le long au lieu de s'y coller. Le contact retenu est
 * celui de l'axe dominant — en poussant en diagonale contre un rocher, c'est
 * ce rocher qu'on heurte, pas l'arbre qu'on frôle.
 *
 * Pas de vitesse, pas d'inertie, pas de masse : une position voulue, une
 * position obtenue. C'est tout ce qu'un jeu d'usine demande.
 */

import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import type { Contact, Facing } from './types.ts';

/** Une tuile est-elle infranchissable pour cette boîte ? */
export type SolidTest = (tx: number, ty: number) => boolean;

/** Ce qu'une boîte mobile porte : position courante, position au tick précédent. */
export interface Body {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export interface BoxSize {
  halfW: number;
  halfH: number;
}

/**
 * Intègre un déplacement de (dx, dy) pixels et renvoie la tuile heurtée sur
 * l'axe dominant, ou `null` si rien n'a bloqué. `body.prev*` reçoit la
 * position de départ : le rendu interpole entre les deux.
 */
export function moveBox(body: Body, size: BoxSize, dx: number, dy: number, isSolid: SolidTest): Contact | null {
  body.prevX = body.x;
  body.prevY = body.y;

  const hitX = dx === 0 ? null : blockingTile(body.x + dx, body.y, size, isSolid);
  if (!hitX) body.x += dx;

  const hitY = dy === 0 ? null : blockingTile(body.x, body.y + dy, size, isSolid);
  if (!hitY) body.y += dy;

  if (hitX && hitY) return Math.abs(dx) >= Math.abs(dy) ? hitX : hitY;
  return hitX ?? hitY;
}

/**
 * La première tuile solide que la boîte occuperait en (x, y), ou `null`.
 * Les quatre coins suffisent tant que la boîte est plus petite qu'une tuile.
 */
export function blockingTile(x: number, y: number, size: BoxSize, isSolid: SolidTest): Contact | null {
  const minTx = floorDiv(x - size.halfW, TILE_SIZE);
  const maxTx = floorDiv(x + size.halfW - 1, TILE_SIZE);
  const minTy = floorDiv(y - size.halfH, TILE_SIZE);
  const maxTy = floorDiv(y + size.halfH - 1, TILE_SIZE);

  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (isSolid(tx, ty)) return { tx, ty };
    }
  }
  return null;
}

/** Direction dominante d'un vecteur. À amplitude égale, le regard reste horizontal. */
export function facingOf(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** La boîte recouvre-t-elle l'emprise de tuiles donnée ? Bords exclus. */
export function boxOverlaps(
  body: { x: number; y: number },
  size: BoxSize,
  tx: number,
  ty: number,
  width: number,
  height: number,
): boolean {
  const left = tx * TILE_SIZE;
  const top = ty * TILE_SIZE;
  const right = left + width * TILE_SIZE;
  const bottom = top + height * TILE_SIZE;

  return (
    body.x + size.halfW > left &&
    body.x - size.halfW < right &&
    body.y + size.halfH > top &&
    body.y - size.halfH < bottom
  );
}
