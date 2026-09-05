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

import { TILE_SIZE } from '../core/grid.ts';
import { boxOverlaps, facingOf, moveBox, type SolidTest } from './motion.ts';
import { Store } from './store.ts';
import type { Contact, Player } from './types.ts';

export type { SolidTest } from './motion.ts';

/** Vitesse en tuiles par seconde à pleine amplitude du joystick. */
export const PLAYER_SPEED_TILES = 4.5;

/** Portée de construction, en tuiles, depuis le centre du joueur. */
export const BUILD_REACH_TILES = 7;

/** Capacité du sac, en nombre total d'objets. */
export const INVENTORY_CAPACITY = 60;

/** Demi-largeur et demi-hauteur de la boîte de collision, en pixels monde. */
export const PLAYER_HALF_W = 10;
export const PLAYER_HALF_H = 7;

const PLAYER_BOX = { halfW: PLAYER_HALF_W, halfH: PLAYER_HALF_H };

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    harvesting: false,
    bowCooldown: 0,
    inventory: new Store(INVENTORY_CAPACITY),
  };
}

/**
 * Intègre un tick de déplacement et renvoie la tuile heurtée, s'il y en a une.
 *
 * `axisX` / `axisY` sont analogiques : la vitesse dépend de la distance au
 * centre du joystick, pas seulement de la direction.
 */
export function stepPlayer(
  player: Player,
  axisX: number,
  axisY: number,
  isSolid: SolidTest,
  stepSeconds: number,
): Contact | null {
  const speed = PLAYER_SPEED_TILES * TILE_SIZE * stepSeconds;
  const contact = moveBox(player, PLAYER_BOX, axisX * speed, axisY * speed, isSolid);

  player.moving = player.x !== player.prevX || player.y !== player.prevY;

  if (axisX !== 0 || axisY !== 0) player.facing = facingOf(axisX, axisY);

  return contact;
}

/** La boîte du joueur recouvre-t-elle l'emprise donnée ? Sert à refuser un placement sur lui. */
export function playerOverlaps(
  player: Player,
  tx: number,
  ty: number,
  width: number,
  height: number,
): boolean {
  return boxOverlaps(player, PLAYER_BOX, tx, ty, width, height);
}
