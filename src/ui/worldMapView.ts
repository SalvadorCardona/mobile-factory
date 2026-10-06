/**
 * La vue de la carte du monde : où elle regarde, et à quelle échelle.
 *
 * De l'arithmétique, comme la caméra du jeu : un centre en tuiles et une
 * échelle en pixels CSS par tuile. Glisser déplace le centre ; la molette
 * et le pinch zooment autour d'un point de l'écran qui reste sous le
 * curseur ou les doigts (`zoomAt`) — les mêmes gestes que sur le jeu, lus
 * par les mêmes fonctions (`input/zoom.ts`).
 *
 * La carte n'a pas de bord : le centre reste dans la zone découverte, plus
 * une marge (`clamp`).
 *
 * Sans DOM ni Pixi : se teste en Node.
 */

import type { TileRect } from './mapSight.ts';

/** Bornes de l'échelle, en pixels CSS par tuile. Un cran de bouton ou de touche multiplie par `step`. */
export const MAP_ZOOM = { min: 1.5, max: 16, default: 6, step: 1.5 } as const;

/** Le centre de la carte ne s'éloigne pas de la zone découverte de plus de tant de tuiles. */
export const MAP_MARGIN_TILES = 12;

export class MapView {
  /** Centre de la vue, en tuiles (fractionnaires). */
  public cx = 0;
  public cy = 0;
  /** Pixels CSS par tuile. */
  public scale: number = MAP_ZOOM.default;
  public width = 1;
  public height = 1;

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  public centerOn(tx: number, ty: number): void {
    this.cx = tx;
    this.cy = ty;
  }

  /** Le doigt a glissé de (dx, dy) pixels CSS : la carte le suit. */
  public pan(dx: number, dy: number): void {
    this.cx -= dx / this.scale;
    this.cy -= dy / this.scale;
  }

  /** Multiplie l'échelle par `factor` (bornée), en gardant immobile le point écran (x, y). */
  public zoomAt(factor: number, x: number, y: number): void {
    const before = this.toTile(x, y);

    this.scale = Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, this.scale * factor));

    const after = this.toTile(x, y);

    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
  }

  /** Ramène le centre dans la zone découverte `known`, marge comprise. Sans zone, il ne bouge pas. */
  public clamp(known: TileRect | null): void {
    if (!known) return;
    this.cx = Math.min(known.maxTx + 1 + MAP_MARGIN_TILES, Math.max(known.minTx - MAP_MARGIN_TILES, this.cx));
    this.cy = Math.min(known.maxTy + 1 + MAP_MARGIN_TILES, Math.max(known.minTy - MAP_MARGIN_TILES, this.cy));
  }

  /** Le point écran (pixels CSS) en tuiles fractionnaires. */
  public toTile(x: number, y: number): { x: number; y: number } {
    return {
      x: this.cx + (x - this.width / 2) / this.scale,
      y: this.cy + (y - this.height / 2) / this.scale,
    };
  }

  /** La tuile fractionnaire (tx, ty) en pixels CSS de l'écran. */
  public toScreen(tx: number, ty: number): { x: number; y: number } {
    return {
      x: (tx - this.cx) * this.scale + this.width / 2,
      y: (ty - this.cy) * this.scale + this.height / 2,
    };
  }

  /** Les tuiles à l'écran, bornes comprises. */
  public visibleTiles(): TileRect {
    const halfW = this.width / (2 * this.scale);
    const halfH = this.height / (2 * this.scale);

    return {
      minTx: Math.floor(this.cx - halfW),
      minTy: Math.floor(this.cy - halfH),
      maxTx: Math.floor(this.cx + halfW),
      maxTy: Math.floor(this.cy + halfH),
    };
  }
}
