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
 *
 * Elle ne colle pas au joueur, elle le **rattrape** : un amorti exponentiel,
 * indépendant de la cadence d'écran, avec une petite avance dans le sens de
 * la marche pour montrer ce qui vient plutôt que ce qu'on quitte. Et elle
 * tremble quand ça cogne — un « trauma » qui décroît, dont le carré donne
 * l'amplitude : les petits chocs restent discrets, les gros se sentent.
 */

import { CHUNK_SIZE, floorDiv } from '../core/grid.ts';

/** Constante de temps du rattrapage, en ms : ~95 % du chemin en trois fois cette durée. */
const FOLLOW_MS = 90;

/** Avance : combien de ms de marche la caméra montre devant le joueur. */
const LEAD_DISTANCE_MS = 260;
const LEAD_MS = 220;

/** Un trauma plein se dissipe en autant de ms. */
const TRAUMA_DECAY_MS = 600;
const MAX_SHAKE_PX = 10;

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

  /** Trauma courant, dans [0, 1]. */
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private leadX = 0;
  private leadY = 0;

  public resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  public centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Rattrape (x, y) en `deltaMs`. `vx, vy` est la vitesse de la cible en
   * pixels par milliseconde : elle décide de l'avance.
   */
  public follow(x: number, y: number, vx: number, vy: number, deltaMs: number): void {
    const lead = 1 - Math.exp(-deltaMs / LEAD_MS);

    this.leadX += (vx * LEAD_DISTANCE_MS - this.leadX) * lead;
    this.leadY += (vy * LEAD_DISTANCE_MS - this.leadY) * lead;

    const catchUp = 1 - Math.exp(-deltaMs / FOLLOW_MS);
    const targetX = x + this.leadX;
    const targetY = y + this.leadY;

    this.x += (targetX - this.x) * catchUp;
    this.y += (targetY - this.y) * catchUp;

    // Trop loin (téléportation, premier cadre) : on saute au lieu de glisser.
    if (Math.abs(targetX - this.x) > this.viewWidth || Math.abs(targetY - this.y) > this.viewHeight) {
      this.centerOn(targetX, targetY);
    }

    this.trauma = Math.max(0, this.trauma - deltaMs / TRAUMA_DECAY_MS);

    const amplitude = this.trauma * this.trauma * MAX_SHAKE_PX;

    this.shakeX = (Math.random() * 2 - 1) * amplitude;
    this.shakeY = (Math.random() * 2 - 1) * amplitude;
  }

  /** Ajoute du trauma : 0.2 pour un coup, 0.6 pour un effondrement. */
  public shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Décalage à appliquer au conteneur monde pour que (x, y) tombe au centre. */
  public offsetX(): number {
    return this.viewWidth / 2 - this.x * this.zoom + this.shakeX;
  }

  public offsetY(): number {
    return this.viewHeight / 2 - this.y * this.zoom + this.shakeY;
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
