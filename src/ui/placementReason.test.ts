import { describe, expect, it } from 'vitest';
import { worldToTile } from '../core/grid.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import { World } from '../sim/world.ts';
import { placementReason } from './placementReason.ts';

/** Une partie et la première tuile, près d'Adam, qui porte une ressource de l'espèce voulue. */
function worldWith(tree: boolean): { world: World; tx: number; ty: number } {
  for (let seed = 1; seed < 200; seed += 1) {
    const world = new World(seed);
    const origin = worldToTile(world.player.x, world.player.y);

    for (let dy = -12; dy <= 12; dy += 1) {
      for (let dx = -12; dx <= 12; dx += 1) {
        const resource = world.resources.at(origin.tx + dx, origin.ty + dy);

        if (resource && (resource.id === 'tree') === tree) return { world, tx: origin.tx + dx, ty: origin.ty + dy };
      }
    }
  }
  throw new Error('aucune ressource près du départ');
}

describe('placementReason', () => {
  it('donne un motif en français pour chaque refus', () => {
    const world = new World(1);
    const reasons: PlacementRejection[] = ['terrain', 'occupied', 'resource', 'onPlayer', 'outOfReach', 'locked'];

    for (const reason of reasons) {
      const tiles = reason === 'resource' ? [] : [{ tx: 0, ty: 0 }];

      expect(placementReason({ reason, tiles }, world).text).not.toBe('');
    }
  });

  it('un arbre : Adam peut le couper', () => {
    const { world, tx, ty } = worldWith(true);

    expect(placementReason({ reason: 'resource', tiles: [{ tx, ty }] }, world)).toEqual({
      text: 'Un arbre gêne',
      remedy: 'Adam peut le couper',
    });
    expect(placementReason({ reason: 'resource', tiles: [{ tx, ty }, { tx, ty }] }, world).remedy).toBe(
      'Adam peut les couper',
    );
  });

  it('un rocher : Adam peut le casser', () => {
    const { world, tx, ty } = worldWith(false);

    expect(placementReason({ reason: 'resource', tiles: [{ tx, ty }] }, world)).toEqual({
      text: 'Un rocher gêne',
      remedy: 'Adam peut le casser',
    });
  });

  it('pas de remède à proposer pour l’eau ou la distance', () => {
    const world = new World(1);

    expect(placementReason({ reason: 'terrain', tiles: [] }, world)).toEqual({ text: 'Pas sur l’eau', remedy: null });
    expect(placementReason({ reason: 'outOfReach', tiles: [] }, world).remedy).toBeNull();
  });
});
