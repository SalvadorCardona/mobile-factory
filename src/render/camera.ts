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
 *
 * Elle sait aussi jeter un **coup d'œil** : glisser vers un point, s'y
 * attarder, puis revenir sur le joueur — le tap sur le repère de la mairie.
 * Le suivi continue dessous ; le coup d'œil ne fait que déplacer le centre
 * affiché.
 *
 * Elle sait aussi **reculer** un instant (`zoomOut`) : un léger dézoom,
 * tenu quelques secondes puis relâché en douceur, en glissant un peu vers
 * un point à montrer — d'où arrive une vague. Court et discret : on peut
 * être en train de récolter.
 *
 * Tant que l'un ou l'autre fait glisser la carte d'elle-même, elle le dit
 * (`drifting`) : un tap posé à ce moment viserait un point qui bouge.
 */

import { CHUNK_SIZE, TILE_SIZE, floorDiv } from '../core/grid.ts';

/** Constante de temps du rattrapage, en ms : ~95 % du chemin en trois fois cette durée. */
const FOLLOW_MS = 90;

/** Avance : combien de ms de marche la caméra montre devant le joueur. */
const LEAD_DISTANCE_MS = 260;
const LEAD_MS = 220;

/** Un trauma plein se dissipe en autant de ms. */
const TRAUMA_DECAY_MS = 600;
const MAX_SHAKE_PX = 10;

/** Coup d'œil : l'aller et l'arrêt font une seconde, puis le retour. */
const PEEK_GO_MS = 450;
const PEEK_HOLD_MS = 550;
const PEEK_BACK_MS = 450;

/** Constante de temps du zoom, en ms : il glisse, il ne saute pas. */
const ZOOM_MS = 420;

/** Pendant un recul, part du chemin entre le joueur et le point à montrer que la caméra parcourt. */
const FOCUS_SHARE = 0.4;

/** Au-delà de cette distance au point à montrer, en pixels monde, la caméra ne glisse pas : le joueur est ailleurs, occupé. */
const FOCUS_RANGE = 14 * TILE_SIZE;

/** En deçà de ces écarts à sa cible, le recul est posé : la carte ne glisse plus. */
const SETTLED_ZOOM = 0.01;
const SETTLED_SHIFT_PX = 2;

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
  private peekX = 0;
  private peekY = 0;
  private peekElapsed = Infinity;
  /** Part du coup d'œil dans le centre affiché, dans [0, 1]. */
  private peekWeight = 0;

  /** Zoom visé pendant un recul, et ms pendant lesquelles il est tenu. */
  private zoomTarget = 1;
  private zoomHold = 0;
  /** Le point à montrer pendant un recul, et le décalage courant vers lui. */
  private focus: { x: number; y: number } | null = null;
  private focusShiftX = 0;
  private focusShiftY = 0;
  /** Le recul est encore en route vers sa cible, ou en revient. */
  private zoomDrifting = false;

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

    this.zoomHold = Math.max(0, this.zoomHold - deltaMs);

    const zooming = this.zoomHold > 0;
    const zoomTo = zooming ? this.zoomTarget : 1;
    const ease = 1 - Math.exp(-deltaMs / ZOOM_MS);

    this.zoom += (zoomTo - this.zoom) * ease;
    if (Math.abs(zoomTo - this.zoom) < 0.001) this.zoom = zoomTo;
    const toFocusX = zooming && this.focus ? this.focus.x - x : 0;
    const toFocusY = zooming && this.focus ? this.focus.y - y : 0;
    const shifting = Math.hypot(toFocusX, toFocusY) <= FOCUS_RANGE;
    const shiftToX = shifting ? toFocusX * FOCUS_SHARE : 0;
    const shiftToY = shifting ? toFocusY * FOCUS_SHARE : 0;

    this.focusShiftX += (shiftToX - this.focusShiftX) * ease;
    this.focusShiftY += (shiftToY - this.focusShiftY) * ease;
    this.zoomDrifting =
      Math.abs(zoomTo - this.zoom) > SETTLED_ZOOM ||
      Math.hypot(shiftToX - this.focusShiftX, shiftToY - this.focusShiftY) > SETTLED_SHIFT_PX;

    const catchUp = 1 - Math.exp(-deltaMs / FOLLOW_MS);
    const targetX = x + this.leadX + this.focusShiftX;
    const targetY = y + this.leadY + this.focusShiftY;

    this.x += (targetX - this.x) * catchUp;
    this.y += (targetY - this.y) * catchUp;

    // Trop loin (téléportation, premier cadre) : on saute au lieu de glisser.
    if (Math.abs(targetX - this.x) > this.viewWidth || Math.abs(targetY - this.y) > this.viewHeight) {
      this.centerOn(targetX, targetY);
    }

    this.peekElapsed += deltaMs;
    this.peekWeight = peekWeightAt(this.peekElapsed);
    this.trauma = Math.max(0, this.trauma - deltaMs / TRAUMA_DECAY_MS);

    const amplitude = this.trauma * this.trauma * MAX_SHAKE_PX;

    this.shakeX = (Math.random() * 2 - 1) * amplitude;
    this.shakeY = (Math.random() * 2 - 1) * amplitude;
  }

  /** Glisse vers (x, y) monde, s'y attarde, puis revient sur le joueur. */
  public peek(x: number, y: number): void {
    this.peekX = x;
    this.peekY = y;
    this.peekElapsed = 0;
  }

  /**
   * La carte glisse-t-elle d'elle-même — un recul ou un coup d'œil qui part
   * ou revient ? Le suivi du joueur n'en est pas : c'est lui qui bouge.
   */
  public get drifting(): boolean {
    return this.zoomDrifting || (this.peekWeight > 0 && this.peekWeight < 1);
  }

  /** Centre affiché : celui du suivi, tiré vers le coup d'œil en cours. */
  private get centerX(): number {
    return this.x + (this.peekX - this.x) * this.peekWeight;
  }

  private get centerY(): number {
    return this.y + (this.peekY - this.y) * this.peekWeight;
  }

  /**
   * Recule jusqu'à `zoom` (moins de 1) et y reste `holdMs`, en glissant un
   * peu vers `focus` (pixels monde) s'il est donné, puis revient tout seul.
   */
  public zoomOut(zoom: number, holdMs: number, focus: { x: number; y: number } | null = null): void {
    this.zoomTarget = zoom;
    this.zoomHold = Math.max(this.zoomHold, holdMs);
    this.focus = focus;
  }

  /** Ajoute du trauma : 0.2 pour un coup, 0.6 pour un effondrement. */
  public shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Décalage à appliquer au conteneur monde pour que (x, y) tombe au centre. */
  public offsetX(): number {
    return this.viewWidth / 2 - this.centerX * this.zoom + this.shakeX;
  }

  public offsetY(): number {
    return this.viewHeight / 2 - this.centerY * this.zoom + this.shakeY;
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
    return this.visibleCells(CHUNK_SIZE, margin);
  }

  /** Cellules carrées de `size` pixels monde intersectant le viewport, marge comprise. */
  public visibleCells(size: number, margin = 1): ChunkBounds {
    const halfW = this.viewWidth / (2 * this.zoom);
    const halfH = this.viewHeight / (2 * this.zoom);

    return {
      minCx: floorDiv(this.centerX - halfW, size) - margin,
      minCy: floorDiv(this.centerY - halfH, size) - margin,
      maxCx: floorDiv(this.centerX + halfW, size) + margin,
      maxCy: floorDiv(this.centerY + halfH, size) + margin,
    };
  }
}

/** Poids du coup d'œil `elapsed` ms après son début : monte, tient, redescend, adouci. */
function peekWeightAt(elapsed: number): number {
  const ease = (t: number): number => t * t * (3 - 2 * t);

  if (elapsed < PEEK_GO_MS) return ease(elapsed / PEEK_GO_MS);
  if (elapsed < PEEK_GO_MS + PEEK_HOLD_MS) return 1;
  if (elapsed < PEEK_GO_MS + PEEK_HOLD_MS + PEEK_BACK_MS) {
    return ease(1 - (elapsed - PEEK_GO_MS - PEEK_HOLD_MS) / PEEK_BACK_MS);
  }
  return 0;
}
