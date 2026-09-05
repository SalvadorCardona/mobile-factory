import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { PLAYER_HALF_W, createPlayer, playerOverlaps, stepPlayer } from './player.ts';

const STEP = 1 / 20;

/** Un monde où seule la colonne de tuiles `tx = 2` est solide. */
const wall = (tx: number): boolean => tx === 2;

describe('stepPlayer', () => {
  it('avance librement quand rien ne bloque', () => {
    const player = createPlayer(16, 16);

    expect(stepPlayer(player, 1, 0, () => false, STEP)).toBeNull();
    expect(player.x).toBeGreaterThan(16);
    expect(player.prevX).toBe(16);
    expect(player.moving).toBe(true);
    expect(player.facing).toBe('right');
  });

  it('s’arrête contre une tuile solide et la renvoie comme contact', () => {
    // Juste à gauche du mur : le bord droit de la boîte touche x = 64.
    const player = createPlayer(2 * TILE_SIZE - PLAYER_HALF_W, 16);

    expect(stepPlayer(player, 1, 0, wall, STEP)).toEqual({ tx: 2, ty: 0 });
    expect(player.x).toBe(2 * TILE_SIZE - PLAYER_HALF_W);
    expect(player.moving).toBe(false);
    // Le regard reste tourné vers l'obstacle, même à l'arrêt.
    expect(player.facing).toBe('right');
  });

  it('glisse le long d’un obstacle en diagonale', () => {
    const player = createPlayer(2 * TILE_SIZE - PLAYER_HALF_W, 16);

    const contact = stepPlayer(player, 1, 1, wall, STEP);

    expect(contact).toEqual({ tx: 2, ty: 0 });
    expect(player.x).toBe(2 * TILE_SIZE - PLAYER_HALF_W);
    expect(player.y).toBeGreaterThan(16);
    expect(player.moving).toBe(true);
  });

  it('garde la direction du dernier mouvement à l’arrêt', () => {
    const player = createPlayer(16, 16);

    stepPlayer(player, 0, -1, () => false, STEP);
    expect(player.facing).toBe('up');

    stepPlayer(player, 0, 0, () => false, STEP);
    expect(player.facing).toBe('up');
    expect(player.moving).toBe(false);
  });
});

describe('playerOverlaps', () => {
  it('détecte la boîte du joueur sur une emprise, bords exclus', () => {
    const player = createPlayer(16, 16);

    expect(playerOverlaps(player, 0, 0, 1, 1)).toBe(true);
    expect(playerOverlaps(player, 1, 0, 1, 1)).toBe(false);
    // Boîte de 20 px : elle déborde sur la tuile voisine dès x = 22 + 1.
    player.x = 23;
    expect(playerOverlaps(player, 1, 0, 1, 1)).toBe(true);
  });
});
