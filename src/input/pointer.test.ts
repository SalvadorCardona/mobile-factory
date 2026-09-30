import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import type { Command } from '../sim/commands.ts';
import type { World } from '../sim/world.ts';
import { Joystick } from './joystick.ts';
import { Placement } from './placement.ts';
import { PointerDispatch, TAP_SLOP, type PointerSample } from './pointer.ts';

/** Un téléphone de 390 px de large : le joystick vit sous x = 195. */
const VIEW_WIDTH = 390;

/** Le routeur de `main.ts`, sans l'inspection : placement, puis joystick. Écran = monde, au pixel près. */
function setup() {
  const pushed: Command[] = [];
  const world = { push: (command: Command) => pushed.push(command), canPlace: () => null } as unknown as World;
  const placement = new Placement(world, (x, y) => ({ x, y }), () => {});
  const joystick = new Joystick(() => VIEW_WIDTH);
  const pointers = new PointerDispatch();

  pointers.add(placement);
  pointers.add(joystick);

  const at = (x: number, y: number, id = 1): PointerSample => ({ id, x, y });
  const tap = (x: number, y: number) => {
    pointers.down(at(x, y));
    pointers.up(at(x, y));
  };

  return { pushed, placement, joystick, pointers, at, tap };
}

describe('routeur de doigts pendant le placement', () => {
  it('armé, un glisser sur la moitié gauche va au joystick', () => {
    const { placement, joystick, pointers, at } = setup();

    placement.select('watchtower');
    pointers.down(at(60, 500));
    pointers.move(at(60, 500 + TAP_SLOP + 20));

    expect(joystick.state.active).toBe(true);
    expect(joystick.state.originY).toBe(500);
    expect(joystick.state.axisY).toBeGreaterThan(0);
    expect(placement.ghost).toBeNull();
    expect(placement.mode).toBe('armed');

    pointers.up(at(60, 540));
    expect(joystick.state.active).toBe(false);
    expect(placement.ghost).toBeNull();
  });

  it('armé, un tap va au placement, même sur la moitié gauche', () => {
    const { placement, joystick, pointers, at, tap } = setup();

    placement.select('watchtower');
    pointers.down(at(60, 500));
    pointers.move(at(60 + TAP_SLOP / 2, 500));
    expect(joystick.state.active).toBe(false);
    pointers.up(at(60 + TAP_SLOP / 2, 500));

    expect(placement.mode).toBe('placing');
    expect(placement.ghost).not.toBeNull();

    tap(300, 300);
    expect(placement.ghost?.tx).toBe(Math.round(300 / TILE_SIZE - 1));
    expect(joystick.state.active).toBe(false);
  });

  it('un glisser parti du fantôme le déplace, sans faire marcher Adam', () => {
    const { placement, joystick, pointers, at, tap } = setup();

    placement.select('watchtower');
    tap(64, 400);

    const before = placement.ghost;

    // Le fantôme est dessiné au-dessus du doigt : on le reprend là où on le voit.
    const ghostX = ((before?.tx ?? 0) + 1) * TILE_SIZE;
    const ghostY = ((before?.ty ?? 0) + 1) * TILE_SIZE;

    pointers.down(at(ghostX, ghostY));
    pointers.move(at(ghostX + 4 * TILE_SIZE, ghostY));

    expect(joystick.state.active).toBe(false);
    expect(placement.ghost?.tx).toBe((before?.tx ?? 0) + 4);
  });

  it('sur la moitié droite, sans joystick, un glisser déplace encore le fantôme', () => {
    const { placement, joystick, pointers, at } = setup();

    placement.select('watchtower');
    pointers.down(at(300, 400));
    pointers.move(at(300, 400 + TAP_SLOP + 40));

    expect(joystick.state.active).toBe(false);
    expect(placement.mode).toBe('placing');
  });

  it('le pouce gauche marche pendant que le droit vise', () => {
    const { placement, joystick, pointers, at } = setup();

    placement.select('watchtower');
    pointers.down(at(300, 400, 2));
    pointers.down(at(60, 500, 1));
    pointers.move(at(60, 560, 1));
    pointers.up(at(300, 400, 2));

    expect(joystick.state.active).toBe(true);
    expect(placement.mode).toBe('placing');
  });
});

describe('après « Poser »', () => {
  it('le placement repasse au repos : le joystick répond tout de suite', () => {
    const { pushed, placement, joystick, pointers, at, tap } = setup();

    placement.select('watchtower');
    tap(300, 300);
    placement.confirm();

    expect(pushed).toHaveLength(1);
    expect(placement.mode).toBe('idle');
    expect(placement.armedBuilding()).toBeNull();

    pointers.down(at(60, 500));
    expect(joystick.state.active).toBe(true);
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
