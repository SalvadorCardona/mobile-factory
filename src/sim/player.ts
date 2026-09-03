/**
 * Le joueur vit dans la simulation.
 *
 * Sa position détermine ce qu'il pourra récolter et où il peut construire :
 * c'est de la logique de jeu, pas de l'affichage. Il avance à 20 TPS et le
 * rendu interpole entre `prevX/prevY` et la position courante.
 */

import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Player } from './types.ts';

/** Vitesse en tuiles par seconde à pleine amplitude du joystick. */
export const PLAYER_SPEED_TILES = 4.5;

/** Portée de construction, en tuiles, depuis le centre du joueur. */
export const BUILD_REACH_TILES = 7;

export function createPlayer(x: number, y: number): Player {
  return { x, y, prevX: x, prevY: y };
}

/**
 * Intègre un tick de déplacement.
 * `axisX` / `axisY` sont analogiques : la vitesse dépend de la distance au
 * centre du joystick, pas seulement de la direction.
 *
 * Les deux axes sont testés séparément contre le terrain, ce qui permet de
 * glisser le long d'une rive au lieu de s'y coller.
 */
export function stepPlayer(
  player: Player,
  axisX: number,
  axisY: number,
  seed: number,
  stepSeconds: number,
): void {
  player.prevX = player.x;
  player.prevY = player.y;

  const speed = PLAYER_SPEED_TILES * TILE_SIZE * stepSeconds;
  const nextX = player.x + axisX * speed;
  const nextY = player.y + axisY * speed;

  if (canStand(seed, nextX, player.y)) player.x = nextX;
  if (canStand(seed, player.x, nextY)) player.y = nextY;
}

function canStand(seed: number, worldX: number, worldY: number): boolean {
  const { tx, ty } = worldToTile(worldX, worldY);

  return isWalkable(terrainAt(seed, tx, ty));
}
