import { describe, expect, it } from 'vitest';
import { SEEN_BLOCK, SeenArea } from './mapSight.ts';
import { MAP_MARGIN_TILES, MAP_ZOOM, MapView } from './worldMapView.ts';

/** Une vue de téléphone, centrée sur l'origine. */
function phone(): MapView {
  const view = new MapView();

  view.resize(390, 844);
  return view;
}

describe('MapView', () => {
  it('suit le doigt qui glisse', () => {
    const view = phone();

    view.pan(40, -20);
    expect(view.cx).toBeCloseTo(-40 / MAP_ZOOM.default);
    expect(view.cy).toBeCloseTo(20 / MAP_ZOOM.default);
  });

  it('zoome autour du point visé, qui reste sous le curseur', () => {
    const view = phone();
    const before = view.toTile(300, 100);

    view.zoomAt(2, 300, 100);
    expect(view.scale).toBe(MAP_ZOOM.default * 2);
    expect(view.toTile(300, 100).x).toBeCloseTo(before.x);
    expect(view.toTile(300, 100).y).toBeCloseTo(before.y);
  });

  it('reste dans ses bornes d’échelle', () => {
    const view = phone();

    view.zoomAt(100, 0, 0);
    expect(view.scale).toBe(MAP_ZOOM.max);
    view.zoomAt(0.0001, 0, 0);
    expect(view.scale).toBe(MAP_ZOOM.min);
  });

  it('ne s’éloigne pas de la zone découverte de plus de sa marge', () => {
    const view = phone();
    const known = { minTx: 0, minTy: 0, maxTx: 31, maxTy: 15 };

    view.centerOn(1000, -1000);
    view.clamp(known);
    expect(view.cx).toBe(32 + MAP_MARGIN_TILES);
    expect(view.cy).toBe(-MAP_MARGIN_TILES);
    view.centerOn(10, 5);
    view.clamp(known);
    expect([view.cx, view.cy]).toEqual([10, 5]);
    view.clamp(null);
    expect([view.cx, view.cy]).toEqual([10, 5]);
  });

  it('passe de l’écran aux tuiles et retour', () => {
    const view = phone();

    view.centerOn(12.5, -3);
    view.zoomAt(1.7, 100, 100);
    const tile = view.toTile(50, 700);
    const back = view.toScreen(tile.x, tile.y);

    expect(back.x).toBeCloseTo(50);
    expect(back.y).toBeCloseTo(700);
  });
});

describe('SeenArea', () => {
  it('ne montre rien avant d’avoir vu', () => {
    const seen = new SeenArea();

    expect(seen.sightAt(0, 0)).toBe('unexplored');
    expect(seen.known()).toBeNull();
  });

  it('retient les blocs vus, et la zone qui les contient', () => {
    const seen = new SeenArea();

    seen.see({ minTx: 2, minTy: 3, maxTx: 20, maxTy: 4 });
    expect(seen.sightAt(0, 0)).toBe('visible');
    expect(seen.sightAt(31, 15)).toBe('visible');
    expect(seen.sightAt(32, 0)).toBe('unexplored');
    expect(seen.sightAt(0, -1)).toBe('unexplored');
    seen.seeAround(-20, -20, 1);
    expect(seen.known()).toEqual({ minTx: -2 * SEEN_BLOCK, minTy: -2 * SEEN_BLOCK, maxTx: 31, maxTy: 15 });
  });

  it('ne change de révision qu’à un bloc nouveau', () => {
    const seen = new SeenArea();

    seen.seeAround(5, 5, 2);
    const revision = seen.revision;

    seen.seeAround(6, 6, 2);
    expect(seen.revision).toBe(revision);
    seen.seeAround(100, 5, 0);
    expect(seen.revision).toBe(revision + 1);
  });
});
