/**
 * Le joueur vit dans la simulation.
 *
 * Sa position détermine ce qu'il récolte et où il peut construire : c'est de
 * la logique de jeu, pas de l'affichage. Il avance à 20 TPS et le rendu
 * interpole entre `prevX/prevY` et la position courante.
 *
 * Adam est une boîte, pas un point : une AABB de 20 × 14 px centrée sur sa
 * position, qui correspond à ses pieds. Un point traverserait visuellement
 * les rochers avant d'être bloqué ; une boîte s'arrête au contact, et c'est
 * ce contact qui récolte.
 */

import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { Store } from './store.ts';
import type { Contact, Facing, Player } from './types.ts';

/** Vitesse en tuiles par seconde à pleine amplitude du joystick. */
export const PLAYER_SPEED_TILES = 4.5;

/** Portée de construction, en tuiles, depuis le centre du joueur. */
export const BUILD_REACH_TILES = 7;

/** Capacité du sac, en nombre total d'objets. */
export const INVENTORY_CAPACITY = 60;

/** Demi-largeur et demi-hauteur de la boîte de collision, en pixels monde. */
export const PLAYER_HALF_W = 10;
export const PLAYER_HALF_H = 7;

/** Une tuile est-elle infranchissable ? Le monde compose terrain, ressources et bâtiments. */
export type SolidTest = (tx: number, ty: number) => boolean;

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    inventory: new Store(INVENTORY_CAPACITY),
  };
}

/**
 * Intègre un tick de déplacement et renvoie la tuile heurtée, s'il y en a une.
 *
 * `axisX` / `axisY` sont analogiques : la vitesse dépend de la distance au
 * centre du joystick, pas seulement de la direction.
 *
 * Les deux axes sont testés séparément, ce qui permet de glisser le long
 * d'un obstacle au lieu de s'y coller. Le contact retenu est celui de l'axe
 * dominant : en poussant en diagonale contre un rocher, c'est bien ce rocher
 * qu'on récolte, pas l'arbre qu'on frôle.
 */
export function stepPlayer(
  player: Player,
  axisX: number,
  axisY: number,
  isSolid: SolidTest,
  stepSeconds: number,
): Contact | null {
  player.prevX = player.x;
  player.prevY = player.y;

  const speed = PLAYER_SPEED_TILES * TILE_SIZE * stepSeconds;
  const wantX = player.x + axisX * speed;
  const wantY = player.y + axisY * speed;

  const hitX = axisX === 0 ? null : blockingTile(wantX, player.y, isSolid);
  if (!hitX) player.x = wantX;

  const hitY = axisY === 0 ? null : blockingTile(player.x, wantY, isSolid);
  if (!hitY) player.y = wantY;

  player.moving = player.x !== player.prevX || player.y !== player.prevY;

  if (axisX !== 0 || axisY !== 0) player.facing = facingOf(axisX, axisY);

  if (hitX && hitY) return Math.abs(axisX) >= Math.abs(axisY) ? hitX : hitY;
  return hitX ?? hitY;
}

/** Direction dominante de l'axe. À amplitude égale, le regard reste horizontal. */
function facingOf(axisX: number, axisY: number): Facing {
  if (Math.abs(axisX) >= Math.abs(axisY)) return axisX < 0 ? 'left' : 'right';
  return axisY < 0 ? 'up' : 'down';
}

/**
 * La première tuile solide que la boîte occuperait en (x, y), ou `null`.
 * Les quatre coins suffisent : la boîte est plus petite qu'une tuile.
 */
function blockingTile(x: number, y: number, isSolid: SolidTest): Contact | null {
  const minTx = floorDiv(x - PLAYER_HALF_W, TILE_SIZE);
  const maxTx = floorDiv(x + PLAYER_HALF_W - 1, TILE_SIZE);
  const minTy = floorDiv(y - PLAYER_HALF_H, TILE_SIZE);
  const maxTy = floorDiv(y + PLAYER_HALF_H - 1, TILE_SIZE);

  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (isSolid(tx, ty)) return { tx, ty };
    }
  }
  return null;
}

/** La boîte du joueur recouvre-t-elle l'emprise donnée ? Sert à refuser un placement sur lui. */
export function playerOverlaps(
  player: Player,
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
    player.x + PLAYER_HALF_W > left &&
    player.x - PLAYER_HALF_W < right &&
    player.y + PLAYER_HALF_H > top &&
    player.y - PLAYER_HALF_H < bottom
  );
}
