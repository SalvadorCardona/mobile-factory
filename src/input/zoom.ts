/**
 * Zoom de la carte : la molette, le pinch des pavés tactiles, et le pinch à
 * deux doigts du téléphone.
 *
 * Rien ici ne connaît la caméra : chaque geste rend un **facteur** et le
 * point de l'écran (pixels CSS, relatifs au canvas) autour duquel zoomer ;
 * `main.ts` le passe à `Camera.zoomBy`, qui garde ce point immobile.
 *
 * Le pinch est le geste à deux doigts du routeur (`PointerGesture`,
 * `input/pointer.ts`) : il ne prend jamais le doigt du joystick ni celui
 * du placement. La molette est écoutée sur `window` pour empêcher aussi le
 * navigateur de zoomer la page entière (Ctrl + molette, pinch d'un pavé
 * tactile — qui arrive en `wheel` avec `ctrlKey` — ou geste Safari).
 */

import type { PointerGesture, PointerSample } from './pointer.ts';

/** Sensibilité de la molette : facteur de zoom par pixel de défilement. */
const WHEEL_RATE = 0.0015;

/** Un pinch de pavé tactile envoie de petits deltas, serrés : plus sensible. */
const TRACKPAD_PINCH_RATE = 0.01;

/** Un `deltaMode` en lignes (Firefox) ou en pages, ramené en pixels. */
const LINE_PX = 16;
const PAGE_PX = 400;

/** Un cran de molette ne zoome pas plus que ce facteur, quelle que soit la souris. */
const MAX_WHEEL_FACTOR = 1.5;

/** Sous cet écart entre les doigts, en pixels CSS, le rapport n'a plus de sens. */
const MIN_SPREAD = 8;

/** Ce qu'un événement `wheel` demande à la caméra. */
export interface WheelZoom {
  /** Facteur de zoom : plus de 1 pour avancer. */
  factor: number;
  /** Un pinch de pavé tactile suit déjà le doigt : appliqué d'un coup, sans glisser. */
  immediate: boolean;
}

/** Le zoom que vaut un événement `wheel` : vers le haut, on avance. */
export function wheelZoom(deltaY: number, deltaMode: number, ctrlKey: boolean): WheelZoom {
  const pixels = deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? PAGE_PX : 1);
  const factor = Math.exp(-pixels * (ctrlKey ? TRACKPAD_PINCH_RATE : WHEEL_RATE));

  return { factor: Math.min(MAX_WHEEL_FACTOR, Math.max(1 / MAX_WHEEL_FACTOR, factor)), immediate: ctrlKey };
}

/**
 * Le pinch à deux doigts : à chaque mouvement, le rapport entre l'écart des
 * doigts et leur écart précédent, autour du milieu des deux.
 */
export class Pinch implements PointerGesture {
  private fingers: PointerSample[] = [];
  private readonly onPinch: (factor: number, x: number, y: number) => void;

  public constructor(onPinch: (factor: number, x: number, y: number) => void) {
    this.onPinch = onPinch;
  }

  public get active(): boolean {
    return this.fingers.length === 2;
  }

  public start(first: PointerSample, second: PointerSample): void {
    this.fingers = [first, second];
  }

  public move(sample: PointerSample): void {
    const index = this.fingers.findIndex((finger) => finger.id === sample.id);

    if (index < 0 || !this.active) return;

    const [a, b] = this.fingers as [PointerSample, PointerSample];
    const before = Math.hypot(a.x - b.x, a.y - b.y);

    this.fingers[index] = sample;

    const [c, d] = this.fingers as [PointerSample, PointerSample];
    const after = Math.hypot(c.x - d.x, c.y - d.y);

    if (before < MIN_SPREAD || after < MIN_SPREAD) return;
    this.onPinch(after / before, (c.x + d.x) / 2, (c.y + d.y) / 2);
  }

  public end(): void {
    this.fingers = [];
  }
}

/**
 * Branche la molette du `canvas` sur `onZoom` (facteur, point visé en
 * pixels CSS du canvas, immédiat ou non), et empêche la page de zoomer.
 * Renvoie de quoi se débrancher.
 */
export function bindWheelZoom(
  canvas: HTMLCanvasElement,
  enabled: () => boolean,
  onZoom: (zoom: WheelZoom, x: number, y: number) => void,
): () => void {
  const wheel = (event: WheelEvent): void => {
    const onMap = event.target === canvas;

    // Ctrl + molette, ou le pinch d'un pavé tactile : le zoom de la page, jamais.
    if (onMap || event.ctrlKey) event.preventDefault();
    if (!onMap || !enabled() || event.deltaY === 0) return;

    const rect = canvas.getBoundingClientRect();

    onZoom(wheelZoom(event.deltaY, event.deltaMode, event.ctrlKey), event.clientX - rect.left, event.clientY - rect.top);
  };
  // Safari : le pinch d'un pavé tactile ou d'un iPhone passe par ces gestes propriétaires.
  const gesture = (event: Event): void => event.preventDefault();

  window.addEventListener('wheel', wheel, { passive: false });
  document.addEventListener('gesturestart', gesture, { passive: false });
  document.addEventListener('gesturechange', gesture, { passive: false });

  return () => {
    window.removeEventListener('wheel', wheel);
    document.removeEventListener('gesturestart', gesture);
    document.removeEventListener('gesturechange', gesture);
  };
}
