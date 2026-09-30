import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, Joystick, STICK_RADIUS, TOUCH_RADIUS, readStick } from './joystick.ts';

describe('sortie du joystick', () => {
  it('au centre et dans la zone morte, Adam ne bouge pas', () => {
    expect(readStick(0, 0)).toMatchObject({ axisX: 0, axisY: 0 });
    expect(readStick(DEAD_ZONE - 1, 0)).toMatchObject({ axisX: 0, axisY: 0 });
    expect(readStick(0, -(DEAD_ZONE - 1))).toMatchObject({ axisX: 0, axisY: 0 });
  });

  it('la vitesse démarre à zéro au bord de la zone morte et croît avec la distance', () => {
    const edge = readStick(DEAD_ZONE, 0);
    const half = readStick((DEAD_ZONE + STICK_RADIUS) / 2, 0);
    const full = readStick(STICK_RADIUS, 0);

    expect(edge.axisX).toBeCloseTo(0);
    expect(half.axisX).toBeCloseTo(0.5);
    expect(full.axisX).toBeCloseTo(1);
  });

  it('suit la direction du doigt, dans toutes les directions', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const out = readStick(Math.cos(angle) * STICK_RADIUS, Math.sin(angle) * STICK_RADIUS);

      expect(out.axisX).toBeCloseTo(Math.cos(angle));
      expect(out.axisY).toBeCloseTo(Math.sin(angle));
    }
  });

  it('hors de l’anneau, le bouton reste collé au bord et la vitesse sature', () => {
    const out = readStick(-300, 400);

    expect(Math.hypot(out.knobX, out.knobY)).toBeCloseTo(STICK_RADIUS);
    expect(out.knobX / out.knobY).toBeCloseTo(-300 / 400);
    expect(Math.hypot(out.axisX, out.axisY)).toBeCloseTo(1);
    expect(out.axisX).toBeCloseTo(-0.6);
    expect(out.axisY).toBeCloseTo(0.8);
  });
});

describe('doigt sur le joystick', () => {
  it('prend un doigt posé un peu hors de l’anneau, pas plus loin que la zone tactile', () => {
    const joystick = new Joystick();

    expect(joystick.press(1, TOUCH_RADIUS + 1, 0)).toBe(false);
    expect(joystick.state.active).toBe(false);
    expect(joystick.press(1, STICK_RADIUS + 10, 0)).toBe(true);
    expect(joystick.state.active).toBe(true);
    expect(joystick.state.axisX).toBeCloseTo(1);
  });

  it('un seul doigt à la fois : le second ne le vole pas', () => {
    const joystick = new Joystick();

    joystick.press(1, 0, 0);
    expect(joystick.press(2, 0, 20)).toBe(false);
    joystick.drag(2, 0, STICK_RADIUS);
    expect(joystick.state.axisY).toBe(0);
    joystick.drag(1, 0, -STICK_RADIUS);
    expect(joystick.state.axisY).toBeCloseTo(-1);
  });

  it('relâcher remet le bouton au centre et arrête Adam', () => {
    const joystick = new Joystick();

    joystick.press(1, 0, 0);
    joystick.drag(1, 500, 0);
    joystick.release(2);
    expect(joystick.state.active).toBe(true);

    joystick.release(1);
    expect(joystick.state).toEqual({ active: false, knobX: 0, knobY: 0, axisX: 0, axisY: 0 });
    expect(joystick.press(3, 0, 0)).toBe(true);
  });

  it('masqué, il lâche son doigt', () => {
    const joystick = new Joystick();

    joystick.press(1, 0, 0);
    joystick.drag(1, 0, STICK_RADIUS);
    joystick.reset();
    expect(joystick.state).toMatchObject({ active: false, axisX: 0, axisY: 0 });
    joystick.drag(1, 0, STICK_RADIUS);
    expect(joystick.state.axisY).toBe(0);
  });
});
