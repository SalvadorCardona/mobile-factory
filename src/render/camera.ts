/**
 * Caméra : une translation, et les bornes de ce qu'elle voit.
 *
 * Elle ne connaît pas Pixi — c'est de l'arithmétique. Le renderer se contente
 * de recopier sa position dans le `Container` monde, et le culling interroge
 * `visibleChunks()`.
 *
 * La caméra suit une position **interpolée** du joueur, pas sa position de
 * simulation : à 20 TPS et 120 Hz d'écran, suivre la position brute donne une
 * caméra qui avance par saccades de 7 pixels.
 */

import { CHUNK_SIZE, floorDiv } from '../core/grid.ts';

export interface ChunkBounds {
  minCx: number;
  minCy: number;
  maxCx: number;
  maxCy: number;
}

export class Camera {
  /** Centre de la caméra, en pixels monde. */
  public x = 0;
  public y = 0;
  public zoom = 1;
  public viewWidth = 1;
  public viewHeight = 1;

  public resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  public centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Décalage à appliquer au conteneur monde pour que (x, y) tombe au centre. */
  public offsetX(): number {
    return this.viewWidth / 2 - this.x * this.zoom;
  }

  public offsetY(): number {
    return this.viewHeight / 2 - this.y * this.zoom;
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.offsetX()) / this.zoom,
      y: (screenY - this.offsetY()) / this.zoom,
    };
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.offsetX(),
      y: worldY * this.zoom + this.offsetY(),
    };
  }

  /**
   * Chunks intersectant le viewport, avec une marge d'un chunk.
   *
   * La marge évite qu'un chunk apparaisse au moment précis où il entre à
   * l'écran : il est baké un cran à l'avance, hors du champ.
   */
  public visibleChunks(margin = 1): ChunkBounds {
    const halfW = this.viewWidth / (2 * this.zoom);
    const halfH = this.viewHeight / (2 * this.zoom);

    return {
      minCx: floorDiv(this.x - halfW, CHUNK_SIZE) - margin,
      minCy: floorDiv(this.y - halfH, CHUNK_SIZE) - margin,
      maxCx: floorDiv(this.x + halfW, CHUNK_SIZE) + margin,
      maxCy: floorDiv(this.y + halfH, CHUNK_SIZE) + margin,
    };
  }
}
