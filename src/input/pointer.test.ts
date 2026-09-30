import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import type { Command } from '../sim/commands.ts';
import type { World } from '../sim/world.ts';
import { Placement } from './placement.ts';
import { PointerDispatch, TAP_SLOP, type PointerSample } from './pointer.ts';

/** Le routeur du canvas de `main.ts`, sans l'inspection : le placement. Écran = monde, au pixel près. */
function setup(blocked = false) {
  const pushed: Command[] = [];
  let refused = 0;
  const world = {
    push: (command: Command) => pushed.push(command),
    canPlace: () => null,
    placementBlock: () => (blocked ? { reason: 'occupied', tiles: [] } : null),
  } as unknown as World;
  const placement = new Placement(
    world,
    (x, y) => ({ x, y }),
    () => {},
    () => (refused += 1),
  );
  const pointers = new PointerDispatch();

  pointers.add(placement);

  const at = (x: number, y: number, id = 1): PointerSample => ({ id, x, y });
  const tap = (x: number, y: number) => {
    pointers.down(at(x, y));
    pointers.up(at(x, y));
  };

  const mouse = (x: number, y: number, button = 0): PointerSample => ({ id: 1, x, y, mouse: true, button });

  return { pushed, placement, pointers, at, tap, mouse, refused: () => refused };
}

describe('routeur de doigts pendant le placement', () => {
  it('au repos, le placement ne prend aucun doigt', () => {
    const { placement, pointers, at } = setup();

    pointers.down(at(60, 500));
    expect(pointers.owns(1)).toBe(false);
    expect(placement.ghost).toBeNull();
  });

  it('armé, un tap pose le fantôme, n’importe où sur la carte', () => {
    const { placement, pointers, at, tap } = setup();

    placement.select('watchtower');
    pointers.down(at(60, 500));
    pointers.move(at(60 + TAP_SLOP / 2, 500));
    pointers.up(at(60 + TAP_SLOP / 2, 500));

    expect(placement.mode).toBe('placing');
    expect(placement.ghost).not.toBeNull();

    tap(300, 300);
    expect(placement.ghost?.tx).toBe(Math.round(300 / TILE_SIZE - 1));
  });

  it('un glisser promène le fantôme sous le doigt', () => {
    const { placement, pointers, at, tap } = setup();

    placement.select('watchtower');
    tap(64, 400);

    const before = placement.ghost;

    pointers.down(at(64, 400));
    pointers.move(at(64 + 4 * TILE_SIZE, 400));

    expect(placement.ghost?.tx).toBe((before?.tx ?? 0) + 4);
  });

  it('deux doigts : le second ne vole pas le fantôme au premier', () => {
    const { placement, pointers, at } = setup();

    placement.select('watchtower');
    pointers.down(at(300, 400, 2));
    pointers.down(at(60, 500, 1));
    pointers.move(at(300 + 4 * TILE_SIZE, 400, 2));
    pointers.move(at(60, 700, 1));
    pointers.up(at(300 + 4 * TILE_SIZE, 400, 2));

    expect(pointers.owns(1)).toBe(false);
    expect(placement.ghost?.tx).toBe(Math.round((300 + 4 * TILE_SIZE) / TILE_SIZE - 1));
  });
});

describe('après « Poser »', () => {
  it('le placement repasse au repos : il ne prend plus les doigts', () => {
    const { pushed, placement, pointers, at, tap } = setup();

    placement.select('watchtower');
    tap(300, 300);
    placement.confirm();

    expect(pushed).toHaveLength(1);
    expect(placement.mode).toBe('idle');
    expect(placement.armedBuilding()).toBeNull();

    pointers.down(at(60, 500));
    expect(pointers.owns(1)).toBe(false);
  });

  it('« Poser encore » garde le bâtiment armé', () => {
    const { pushed, placement, tap } = setup();

    placement.select('watchtower');
    tap(300, 300);
    placement.confirm(true);

    expect(pushed).toHaveLength(1);
    expect(placement.mode).toBe('armed');
    expect(placement.armedBuilding()).toBe('watchtower');
  });
});

describe('à la souris', () => {
  it('le fantôme suit le survol, sans décalage de doigt', () => {
    const { placement, mouse } = setup();

    placement.hover(mouse(300, 300));
    expect(placement.ghost).toBeNull();

    placement.select('watchtower');
    placement.hover(mouse(300, 300));
    expect(placement.mode).toBe('placing');
    expect(placement.ghost).toMatchObject({ tx: Math.round(300 / TILE_SIZE - 1), ty: Math.round(300 / TILE_SIZE - 1), follow: true });
  });

  it('un doigt ne survole pas : le fantôme ne bouge pas', () => {
    const { placement, at } = setup();

    placement.select('watchtower');
    placement.hover(at(300, 300));
    expect(placement.ghost).toBeNull();
  });

  it('un clic gauche pose là où est le curseur, du premier coup', () => {
    const { pushed, placement, pointers, mouse } = setup();

    placement.select('watchtower');
    pointers.down(mouse(300, 300));
    pointers.up(mouse(300, 300));

    expect(pushed).toEqual([{ type: 'placeBuilding', building: 'watchtower', tx: Math.round(300 / TILE_SIZE - 1), ty: Math.round(300 / TILE_SIZE - 1) }]);
    expect(placement.mode).toBe('idle');
  });

  it('un clic sur un emplacement refusé ne pose rien et le signale', () => {
    const { pushed, placement, pointers, mouse, refused } = setup(true);

    placement.select('watchtower');
    pointers.down(mouse(300, 300));
    pointers.up(mouse(300, 300));

    expect(pushed).toHaveLength(0);
    expect(refused()).toBe(1);
    expect(placement.mode).toBe('placing');
  });

  it('un clic droit annule, sans rien poser', () => {
    const { pushed, placement, pointers, mouse } = setup();

    placement.select('watchtower');
    placement.hover(mouse(60, 500));
    pointers.down(mouse(60, 500, 2));
    pointers.up(mouse(60, 500, 2));

    expect(pushed).toHaveLength(0);
    expect(placement.mode).toBe('idle');
    expect(placement.ghost).toBeNull();
  });
});
