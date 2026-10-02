import { describe, expect, it } from 'vitest';
import { worldToTile } from '../core/grid.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import { setLocale } from '../i18n/locale.ts';
import { World } from '../sim/world.ts';
import { placementOutput, placementReason } from './placementReason.ts';

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
    const reasons: PlacementRejection[] = ['terrain', 'occupied', 'resource', 'onPlayer', 'noOre', 'outOfReach', 'locked'];

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

  it('une foreuse hors filon : dit où la poser', () => {
    const world = new World(1);

    expect(placementReason({ reason: 'noOre', tiles: [] }, world)).toEqual({
      text: 'Aucun filon ici',
      remedy: 'Cassez un rocher, puis posez la foreuse à sa place',
    });
  });

  it('parle anglais quand la langue change', () => {
    const world = new World(1);

    setLocale('en');
    try {
      expect(placementReason({ reason: 'terrain', tiles: [] }, world)).toEqual({ text: 'Not on water', remedy: null });
    } finally {
      setLocale('fr');
    }
  });

  it('une foreuse sur un filon : dit ce qu’elle extraira', () => {
    const world = new World(1);
    const origin = worldToTile(world.player.x, world.player.y);

    for (let dy = -20; dy <= 20; dy += 1) {
      for (let dx = -20; dx <= 20; dx += 1) {
        const tx = origin.tx + dx;
        const ty = origin.ty + dy;
        const item = world.oreUnder('drill', tx, ty);

        if (item === 'stone') {
          expect(placementOutput('drill', tx, ty, world)).toBe('Extraira : Pierre');
          expect(placementOutput('nursery', tx, ty, world)).toBeNull();
          return;
        }
      }
    }
    throw new Error('aucun filon de pierre près du départ');
  });
});
