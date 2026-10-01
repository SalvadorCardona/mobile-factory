import { describe, expect, it } from 'vitest';
import { Inspect } from './inspect.ts';
import { PointerDispatch, type PointerConsumer, type PointerSample } from './pointer.ts';
import { Pinch, wheelZoom } from './zoom.ts';
import type { World } from '../sim/world.ts';

const at = (id: number, x: number, y: number): PointerSample => ({ id, x, y });

/** Un consommateur qui prend tout doigt posé à gauche de `maxX`, et ne le cède pas : le joystick. */
function stick(maxX: number): PointerConsumer & { held: number[] } {
  const held: number[] = [];

  return {
    held,
    onDown: (sample) => {
      if (sample.x >= maxX) return false;
      held.push(sample.id);
      return true;
    },
    onMove: () => {},
    onUp: (sample) => {
      held.splice(held.indexOf(sample.id), 1);
    },
  };
}

/** Une inspection dont toute la carte est un bâtiment : chaque tap ouvre une fenêtre. */
function taps(): { inspect: Inspect; opened: () => number } {
  let opened = 0;
  const world = {
    eve: () => undefined,
    mobiles: new Map(),
    entities: new Map([[1, { id: 1, kind: 'building', proto: 'townHall', tx: -100, ty: -100, width: 400, height: 400 }]]),
  } as unknown as World;
  const inspect = new Inspect(
    world,
    (x, y) => ({ x, y }),
    () => true,
    () => (opened += 1),
  );

  return { inspect, opened: () => opened };
}

describe('wheelZoom', () => {
  it('avance quand la molette monte, recule quand elle descend', () => {
    expect(wheelZoom(-100, 0, false).factor).toBeGreaterThan(1);
    expect(wheelZoom(100, 0, false).factor).toBeLessThan(1);
    expect(wheelZoom(100, 0, false).immediate).toBe(false);
  });

  it('compte les lignes en pixels et borne un cran trop fort', () => {
    expect(wheelZoom(3, 1, false).factor).toBeCloseTo(wheelZoom(48, 0, false).factor);
    expect(wheelZoom(-5000, 0, false).factor).toBe(1.5);
  });

  it('applique d’un coup le pinch d’un pavé tactile (ctrlKey)', () => {
    const pinch = wheelZoom(-4, 0, true);

    expect(pinch.immediate).toBe(true);
    expect(pinch.factor).toBeGreaterThan(wheelZoom(-4, 0, false).factor);
  });
});

describe('pinch à deux doigts', () => {
  function setup() {
    const zooms: { factor: number; x: number; y: number }[] = [];
    const pinch = new Pinch((factor, x, y) => zooms.push({ factor, x, y }));
    const pointers = new PointerDispatch();
    const thumb = stick(100);
    const { inspect, opened } = taps();

    pointers.add(thumb);
    pointers.add(inspect);
    pointers.setGesture(pinch);
    return { zooms, pinch, pointers, thumb, opened };
  }

  it('écarter les doigts zoome autour de leur milieu', () => {
    const { zooms, pointers } = setup();

    pointers.down(at(1, 200, 300));
    pointers.down(at(2, 300, 300));
    pointers.move(at(2, 400, 300));

    expect(zooms).toHaveLength(1);
    expect(zooms[0]!.factor).toBeCloseTo(2);
    expect(zooms[0]!.x).toBe(300);
    expect(zooms[0]!.y).toBe(300);
  });

  it('reprend le doigt d’un tap sur un bâtiment sans ouvrir sa fenêtre', () => {
    const { zooms, pointers, opened } = setup();

    pointers.down(at(1, 200, 300));
    expect(pointers.owns(1)).toBe(true);
    pointers.down(at(2, 300, 300));
    pointers.move(at(1, 150, 300));
    pointers.up(at(1, 150, 300));
    pointers.up(at(2, 300, 300));

    expect(zooms[0]!.factor).toBeCloseTo(1.5);
    expect(opened()).toBe(0);
  });

  it('ne prend jamais le pouce du joystick', () => {
    const { zooms, pointers, thumb, opened } = setup();

    pointers.down(at(1, 50, 700));
    pointers.down(at(2, 300, 300));
    pointers.move(at(1, 80, 700));
    pointers.up(at(2, 300, 300));

    expect(zooms).toHaveLength(0);
    expect(thumb.held).toEqual([1]);
    // Le second doigt est resté un tap.
    expect(opened()).toBe(1);
  });

  it('un tap seul ouvre toujours la fenêtre', () => {
    const { pointers, opened, pinch } = setup();

    pointers.down(at(1, 200, 300));
    pointers.up(at(1, 200, 300));
    expect(opened()).toBe(1);
    expect(pinch.active).toBe(false);
  });

  it('finit quand un doigt se lève : l’autre ne fait plus rien', () => {
    const { zooms, pointers, opened } = setup();

    pointers.down(at(1, 200, 300));
    pointers.down(at(2, 300, 300));
    pointers.up(at(2, 300, 300));
    pointers.move(at(1, 100, 300));
    pointers.up(at(1, 100, 300));

    expect(zooms).toHaveLength(0);
    expect(opened()).toBe(0);
    // Le geste fini, un nouveau tap reprend son cours normal.
    pointers.down(at(3, 200, 300));
    pointers.up(at(3, 200, 300));
    expect(opened()).toBe(1);
  });
});
