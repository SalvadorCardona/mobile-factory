import { describe, expect, it } from 'vitest';
import { Camera } from './camera.ts';

/** Une caméra posée sur le joueur immobile en (0, 0), écran de téléphone. */
function still(): Camera {
  const camera = new Camera();

  camera.resize(390, 844);
  camera.follow(0, 0, 0, 0, 16);
  return camera;
}

/** Avance de `ms` au pas d'un écran à 60 Hz, le joueur immobile. */
function run(camera: Camera, ms: number): void {
  for (let t = 0; t < ms; t += 16) camera.follow(0, 0, 0, 0, 16);
}

describe('Camera.drifting', () => {
  it('reste faux quand seul le joueur est suivi', () => {
    const camera = still();

    expect(camera.drifting).toBe(false);
    camera.follow(64, 0, 0.2, 0, 16);
    expect(camera.drifting).toBe(false);
  });

  it('dure le temps que le recul glisse, puis retombe', () => {
    const camera = still();

    camera.zoomOut(0.82, 5200, { x: 200, y: 0 });
    camera.follow(0, 0, 0, 0, 16);
    expect(camera.drifting).toBe(true);
    // Posé en recul : la carte ne bouge plus, un tap vise juste.
    run(camera, 3000);
    expect(camera.drifting).toBe(false);
    // Le retour glisse à son tour, puis tout est posé.
    run(camera, 2400);
    expect(camera.drifting).toBe(true);
    run(camera, 3000);
    expect(camera.drifting).toBe(false);
  });

  it('dure le temps que le coup d’œil parte et revienne', () => {
    const camera = still();

    camera.peek(300, 0);
    camera.follow(0, 0, 0, 0, 16);
    expect(camera.drifting).toBe(true);
    run(camera, 2000);
    expect(camera.drifting).toBe(false);
  });
});
