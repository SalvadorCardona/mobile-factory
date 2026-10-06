import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { Camera, ZOOM, clampZoom, stepZoom } from './camera.ts';

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

describe('zoom du joueur', () => {
  it('reste dans ses bornes', () => {
    const camera = still();

    camera.zoomTo(10);
    expect(camera.level).toBe(ZOOM.max);
    camera.zoomTo(0.01);
    expect(camera.level).toBe(ZOOM.min);
    camera.zoomBy(0.5);
    expect(camera.level).toBe(ZOOM.min);
    expect(clampZoom(Number.NaN)).toBeNaN();
  });

  it('avance par crans qui retombent sur le zoom par défaut', () => {
    let level: number = ZOOM.default;
    const up: number[] = [];

    for (let i = 0; i < 5; i += 1) up.push((level = stepZoom(level, 1)));
    expect(up.at(-1)).toBe(ZOOM.max);
    expect(up.every((value) => value <= ZOOM.max)).toBe(true);
    // Redescendre depuis la butée repasse par les mêmes crans.
    expect(stepZoom(ZOOM.max, -1)).toBeCloseTo(ZOOM.step);
    expect(stepZoom(ZOOM.step, -1)).toBeCloseTo(ZOOM.default);
    expect(stepZoom(ZOOM.min, -1)).toBe(ZOOM.min);
    // Un niveau de molette entre deux crans va au cran voisin, pas plus loin.
    expect(stepZoom(1.1, 1)).toBeCloseTo(ZOOM.step);
    expect(stepZoom(1.1, -1)).toBeCloseTo(ZOOM.default);
  });

  it('glisse vers le niveau choisi sans compter comme une dérive', () => {
    const camera = still();

    camera.zoomTo(1.25);
    camera.follow(0, 0, 0, 0, 16);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.zoom).toBeLessThan(1.25);
    expect(camera.drifting).toBe(false);
    run(camera, 1000);
    expect(camera.zoom).toBe(1.25);
  });

  it('garde le point visé sous le curseur, en glissant comme d’un coup', () => {
    for (const immediate of [true, false]) {
      const camera = still();
      const cursor = { x: 300, y: 200 };
      const aimed = camera.screenToWorld(cursor.x, cursor.y);

      camera.zoomTo(1.4, cursor, immediate);
      run(camera, 1200);
      expect(camera.zoom).toBe(1.4);

      const after = camera.worldToScreen(aimed.x, aimed.y);

      expect(after.x).toBeCloseTo(cursor.x, 0);
      expect(after.y).toBeCloseTo(cursor.y, 0);
    }
  });

  it('suit toujours Adam au niveau choisi, sans jamais le perdre de vue', () => {
    const camera = still();

    // Un zoom avant tout au bord de l'écran : le décalage est borné.
    camera.zoomTo(ZOOM.max, { x: 0, y: 0 }, true);
    run(camera, 1000);

    const adam = camera.worldToScreen(0, 0);

    expect(adam.x).toBeGreaterThan(0);
    expect(adam.y).toBeGreaterThan(0);

    // Adam marche : la caméra l'accompagne, et le décalage se résorbe.
    let x = 0;

    for (let t = 0; t < 4000; t += 16, x += 0.1 * 16) camera.follow(x, 0, 0.1, 0, 16);
    for (let t = 0; t < 1000; t += 16) camera.follow(x, 0, 0, 0, 16);
    expect(camera.worldToScreen(x, 0).x).toBeCloseTo(195, -1);
    expect(Math.abs(camera.worldToScreen(x, 0).y - 422)).toBeLessThan(5);
  });

  it('revient au zoom par défaut centré sur Adam', () => {
    const camera = still();

    camera.zoomTo(0.7, { x: 20, y: 700 });
    run(camera, 1000);
    expect(camera.atHome).toBe(false);
    camera.resetZoom();
    run(camera, 2000);
    expect(camera.atHome).toBe(true);
    expect(camera.zoom).toBe(ZOOM.default);
    expect(camera.worldToScreen(0, 0).x).toBeCloseTo(195, 0);
    expect(camera.worldToScreen(0, 0).y).toBeCloseTo(422, 0);
  });

  it('laisse le recul d’une vague élargir, jamais resserrer', () => {
    const camera = still();

    camera.zoomTo(ZOOM.min, null, true);
    camera.zoomOut(0.82, 3000);
    run(camera, 1500);
    expect(camera.zoom).toBe(ZOOM.min);

    camera.zoomTo(ZOOM.max, null, true);
    run(camera, 1000);
    expect(camera.zoom).toBeCloseTo(0.82, 2);
  });
});

describe('Camera.lookAt', () => {
  it('pose la caméra d’un coup sur le point, et l’y laisse tant qu’Adam ne marche pas', () => {
    const camera = still();

    camera.lookAt(3200, -640);
    run(camera, 2000);
    expect(camera.centerX).toBeCloseTo(3200);
    expect(camera.centerY).toBeCloseTo(-640);
    expect(camera.atHome).toBe(false);
    expect(camera.drifting).toBe(false);
    expect(camera.screenToWorld(195, 422).x).toBeCloseTo(3200);
  });

  it('revient sur Adam quand il se remet en marche', () => {
    const camera = still();

    camera.lookAt(3200, 0);
    camera.follow(4, 0, 0.25, 0, 16);
    run(camera, 1000);
    expect(Math.abs(camera.centerX)).toBeLessThan(TILE_SIZE);
    expect(camera.atHome).toBe(true);
  });

  it('glisse de près pour revenir sur Adam, par « Revenir sur Adam »', () => {
    const camera = still();

    camera.lookAt(200, 0);
    camera.resetZoom();
    camera.follow(0, 0, 0, 0, 16);
    expect(camera.drifting).toBe(true);
    expect(camera.centerX).toBeGreaterThan(100);
    run(camera, 1500);
    expect(Math.abs(camera.centerX)).toBeLessThan(1);
    expect(camera.atHome).toBe(true);
  });
});
