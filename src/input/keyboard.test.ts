import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keyboard, isTyping } from './keyboard.ts';

// Node n'a pas de DOM : juste ce que `keyboard.ts` lit — `window`, `document` et les classes des champs.
class FakeElement extends EventTarget {
  public isContentEditable = false;
}
class FakeInput extends FakeElement {}
class FakeTextArea extends FakeElement {}

type Listener = (event: unknown) => void;

/** Les écouteurs posés sur `window`, par type : on les appelle comme le navigateur le ferait. */
let listeners: Map<string, Listener[]>;

function fire(type: string, event: object): void {
  for (const listener of listeners.get(type) ?? []) listener(event);
}

/** Une touche enfoncée sur `target` — le corps de la page par défaut. Renvoie si le navigateur en a été empêché. */
function press(code: string, target: unknown = new FakeElement(), repeat = false): boolean {
  let prevented = false;

  fire('keydown', { code, target, repeat, preventDefault: () => (prevented = true) });
  return prevented;
}

function release(code: string): void {
  fire('keyup', { code });
}

beforeEach(() => {
  listeners = new Map();

  const target = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: (type: string, listener: Listener) =>
      listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== listener)),
  };

  vi.stubGlobal('window', target);
  vi.stubGlobal('document', { addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('HTMLInputElement', FakeInput);
  vi.stubGlobal('HTMLTextAreaElement', FakeTextArea);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Keyboard : Adam marche au clavier', () => {
  it('ZQSD / WASD par position, et les flèches', () => {
    const keyboard = new Keyboard();

    for (const [code, x, y] of [
      ['KeyW', 0, -1],
      ['KeyS', 0, 1],
      ['KeyA', -1, 0],
      ['KeyD', 1, 0],
      ['ArrowUp', 0, -1],
      ['ArrowDown', 0, 1],
      ['ArrowLeft', -1, 0],
      ['ArrowRight', 1, 0],
    ] as const) {
      press(code);
      expect(keyboard.state).toEqual({ active: true, axisX: x, axisY: y });
      release(code);
      expect(keyboard.state.active).toBe(false);
    }
    keyboard.destroy();
  });

  it('deux touches en diagonale ne vont pas plus vite ; deux opposées s’annulent', () => {
    const keyboard = new Keyboard();

    press('KeyD');
    press('KeyS');
    expect(Math.hypot(keyboard.state.axisX, keyboard.state.axisY)).toBeCloseTo(1);
    press('KeyA');
    expect(keyboard.state.axisX).toBe(0);
    expect(keyboard.state.axisY).toBe(1);
    keyboard.destroy();
  });

  it('les flèches ne font pas défiler la page', () => {
    const keyboard = new Keyboard();

    expect(press('ArrowDown')).toBe(true);
    expect(press('KeyP')).toBe(false);
    keyboard.destroy();
  });

  it('une touche tapée dans un champ (la recherche du menu) ne fait pas marcher Adam', () => {
    const keyboard = new Keyboard();

    expect(press('KeyD', new FakeInput())).toBe(false);
    expect(press('ArrowLeft', new FakeTextArea())).toBe(false);
    expect(keyboard.state.active).toBe(false);
    keyboard.destroy();
  });

  it('la fenêtre perd le focus : Adam s’arrête, sans attendre un keyup qui ne viendra pas', () => {
    const keyboard = new Keyboard();

    press('KeyD');
    fire('blur', {});
    expect(keyboard.state).toEqual({ active: false, axisX: 0, axisY: 0 });
    keyboard.destroy();
  });

  it('détruit, il n’écoute plus rien', () => {
    const keyboard = new Keyboard();

    keyboard.destroy();
    press('KeyD');
    expect(keyboard.state.active).toBe(false);
  });
});

describe('isTyping', () => {
  it('un champ ou un texte éditable a le clavier ; le reste de la page non', () => {
    const editable = Object.assign(new FakeElement(), { isContentEditable: true });

    expect(isTyping(new FakeInput())).toBe(true);
    expect(isTyping(new FakeTextArea())).toBe(true);
    expect(isTyping(editable)).toBe(true);
    expect(isTyping(new FakeElement())).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
