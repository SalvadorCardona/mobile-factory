import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { SPRITES } from '../data/sprites.ts';
import { Camera } from '../render/camera.ts';
import type { Entity } from '../sim/types.ts';
import { buildingAt } from './inspect.ts';

/** Le chantier de la mairie, emprise 3 × 3 en (0, 0) : cadre de 96 × 128, 32 px de toit au-dessus. */
const HALL = { id: 1, kind: 'site', proto: 'townHall', tx: 0, ty: 0, width: 3, height: 3, delivered: {} } as Entity;
const HALL_BOTTOM = 3 * TILE_SIZE;
const HALL_TOP = HALL_BOTTOM - SPRITES.townHall.height;

/** Une tour de guet juste devant la mairie : son cadre de 128 px monte sur l'emprise de la mairie. */
const TOWER = { id: 2, kind: 'site', proto: 'watchtower', tx: 0, ty: 3, width: 2, height: 2, delivered: {} } as Entity;

describe('buildingAt', () => {
  it('prend le centre et les bords de l’emprise', () => {
    expect(buildingAt([HALL], 48, 48)).toBe(1);
    expect(buildingAt([HALL], 0, 0)).toBe(1);
    expect(buildingAt([HALL], 95.9, HALL_BOTTOM - 0.1)).toBe(1);
  });

  it('prend le toit, au-dessus de l’emprise', () => {
    expect(HALL_TOP).toBeLessThan(0);
    expect(buildingAt([HALL], 48, -16)).toBe(1);
    expect(buildingAt([HALL], 48, HALL_TOP)).toBe(1);
  });

  it('laisse passer ce qui est hors du cadre', () => {
    expect(buildingAt([HALL], 48, HALL_TOP - 1)).toBeUndefined();
    expect(buildingAt([HALL], 48, HALL_BOTTOM)).toBeUndefined();
    expect(buildingAt([HALL], -1, 48)).toBeUndefined();
    expect(buildingAt([HALL], 96, 48)).toBeUndefined();
  });

  it('donne la priorité au bâtiment de devant', () => {
    // Le haut de la tour recouvre le bas de la mairie : on ouvre ce qu'on voit.
    expect(buildingAt([HALL, TOWER], 32, HALL_BOTTOM - 16)).toBe(2);
    expect(buildingAt([TOWER, HALL], 32, HALL_BOTTOM - 16)).toBe(2);
    // À côté de la tour, la mairie reste tapable.
    expect(buildingAt([HALL, TOWER], 80, HALL_BOTTOM - 16)).toBe(1);
  });
});

describe('écran → monde → bâtiment', () => {
  /*
   * Le navigateur donne le doigt en pixels CSS, quel que soit le DPR : un
   * écran de 390 × 844 CSS à DPR 3 fait 1170 × 2532 pixels physiques. La
   * caméra travaille dans ces mêmes pixels CSS (`app.screen`, `autoDensity`).
   */
  for (const dpr of [1, 2, 3]) {
    for (const zoom of [1, 1.5, 2]) {
      it(`touche la mairie au centre, sur le toit et au bord, à DPR ${dpr} et zoom ${zoom}`, () => {
        const camera = new Camera();

        camera.resize(390, 844);
        camera.zoom = zoom;
        camera.centerOn(48, 64);

        const tapAt = (worldX: number, worldY: number) => {
          const css = camera.worldToScreen(worldX, worldY);
          // Le doigt physique, ramené en CSS comme le fait le navigateur.
          const device = { x: Math.round(css.x * dpr), y: Math.round(css.y * dpr) };
          const world = camera.screenToWorld(device.x / dpr, device.y / dpr);

          return buildingAt([HALL], world.x, world.y);
        };

        expect(tapAt(48, 48)).toBe(1);
        expect(tapAt(48, HALL_TOP + 4)).toBe(1);
        expect(tapAt(2, HALL_BOTTOM - 2)).toBe(1);
        expect(tapAt(94, 2)).toBe(1);
        expect(tapAt(48, HALL_TOP - 4)).toBeUndefined();
      });
    }
  }
});
