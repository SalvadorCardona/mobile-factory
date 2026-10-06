import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { ENEMIES } from '../data/enemies.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Entity, Mobile } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { selectionFrame } from './selectionFrame.ts';

const HALL = { id: 1, kind: 'site', proto: 'townHall', tx: 2, ty: 3, width: 3, height: 3, delivered: {} } as Entity;
const WORKER = { kind: 'worker', id: 10, prevX: 100, prevY: 200, x: 110, y: 200, inside: false } as Mobile;
const KID = { kind: 'kid', id: 11, prevX: 50, prevY: 50, x: 50, y: 50 } as Mobile;

function worldOf(entities: Entity[], mobiles: Mobile[]): World {
  return {
    entities: new Map(entities.map((entity) => [entity.id, entity])),
    mobiles: new Map(mobiles.map((mobile) => [mobile.id, mobile])),
  } as unknown as World;
}

describe('selectionFrame', () => {
  it('n’entoure rien sans sélection', () => {
    expect(selectionFrame(worldOf([HALL], [WORKER]), null, 0)).toBeNull();
  });

  it('entoure l’emprise d’un bâtiment, au sol', () => {
    const frame = selectionFrame(worldOf([HALL], []), { kind: 'building', id: 1 }, 0.5);

    expect(frame).toEqual({
      target: 'building:1',
      x: 3.5 * TILE_SIZE,
      y: 4.5 * TILE_SIZE,
      width: 3 * TILE_SIZE,
      height: 3 * TILE_SIZE,
      depth: null,
    });
  });

  it('entoure la silhouette d’un ouvrier et le suit à la position interpolée', () => {
    const world = worldOf([], [WORKER]);
    const { width, height, anchorY } = SPRITES.worker;
    const start = selectionFrame(world, { kind: 'creature', id: 10 }, 0)!;
    const half = selectionFrame(world, { kind: 'creature', id: 10 }, 0.5)!;

    expect(start).toMatchObject({ target: 'creature:10', x: 100, width, height });
    expect(start.y).toBeCloseTo(200 + (0.5 - anchorY) * height);
    expect(half.x).toBe(105);
    // Dans le tri en profondeur, juste sous son pantin (zIndex y + 6).
    expect(half.depth).toBeGreaterThan(200);
    expect(half.depth).toBeLessThan(206);
  });

  it('taille le cadre à la silhouette : un enfant est plus petit, un gros mutant plus grand', () => {
    const kid = selectionFrame(worldOf([], [KID]), { kind: 'creature', id: 11 }, 0)!;
    const brute = { kind: 'mutant', id: 12, proto: 'brute', prevX: 0, prevY: 0, x: 0, y: 0, emerge: 0 } as Mobile;
    const big = selectionFrame(worldOf([], [brute]), { kind: 'creature', id: 12 }, 0)!;

    expect(kid.height).toBe(SPRITES.kid.height);
    expect(kid.height).toBeLessThan(SPRITES.worker.height);
    expect(big.height).toBe(SPRITES[ENEMIES.brute.sprite].height * ENEMIES.brute.scale);
  });

  it('change de cible quand on sélectionne autre chose : un seul cadre, sur la nouvelle', () => {
    const world = worldOf([HALL], [WORKER]);

    expect(selectionFrame(world, { kind: 'creature', id: 10 }, 0)?.target).toBe('creature:10');
    expect(selectionFrame(world, { kind: 'building', id: 1 }, 0)?.target).toBe('building:1');
  });

  it('distingue un bâtiment et une créature de même id', () => {
    const twin = { ...WORKER, id: 1 };
    const world = worldOf([HALL], [twin]);

    expect(selectionFrame(world, { kind: 'building', id: 1 }, 0)?.target).not.toBe(
      selectionFrame(world, { kind: 'creature', id: 1 }, 0)?.target,
    );
  });

  it('n’entoure plus une cible disparue : bâtiment rasé, créature morte ou partie', () => {
    const world = worldOf([], []);

    expect(selectionFrame(world, { kind: 'building', id: 1 }, 0)).toBeNull();
    expect(selectionFrame(world, { kind: 'creature', id: 10 }, 0)).toBeNull();
  });

  it('n’entoure pas un habitant rentré chez lui, ni un mutant encore dans sa flaque', () => {
    const home = { ...WORKER, inside: true } as Mobile;
    const lumberjack = { kind: 'lumberjack', id: 13, prevX: 0, prevY: 0, x: 0, y: 0, inside: true } as Mobile;
    const rising = { kind: 'mutant', id: 14, proto: 'mutant', prevX: 0, prevY: 0, x: 0, y: 0, emerge: 5 } as Mobile;
    const world = worldOf([], [home, lumberjack, rising]);

    expect(selectionFrame(world, { kind: 'creature', id: 10 }, 0)).toBeNull();
    expect(selectionFrame(world, { kind: 'creature', id: 13 }, 0)).toBeNull();
    expect(selectionFrame(world, { kind: 'creature', id: 14 }, 0)).toBeNull();
  });

  it('entoure une bête', () => {
    const wolf = { kind: 'beast', id: 15, proto: 'wolf', prevX: 0, prevY: 0, x: 0, y: 0 } as Mobile;

    expect(selectionFrame(worldOf([], [wolf]), { kind: 'creature', id: 15 }, 0)?.width).toBe(SPRITES.wolf.width);
  });
});
