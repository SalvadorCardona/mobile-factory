/**
 * Tap sur un repère de bord.
 *
 * Les repères sont dessinés sur le canvas, pas dans le DOM : ce consommateur
 * passe en tête du routeur et ne revendique un doigt que s'il se pose sur le
 * repère (`hit`). Relevé sans avoir glissé, c'est un tap ; sinon c'était le
 * début d'un mouvement, et rien ne se passe.
 *
 * Aucune commande ici : regarder ailleurs ne modifie pas le monde.
 */

import type { PointerConsumer, PointerSample } from './pointer.ts';

/** Déplacement en pixels CSS au-delà duquel un appui n'est plus un tap. */
const TAP_SLOP = 12;

export class IndicatorTap implements PointerConsumer {
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  private readonly hit: (x: number, y: number) => boolean;
  private readonly onTap: () => void;

  public constructor(hit: (x: number, y: number) => boolean, onTap: () => void) {
    this.hit = hit;
    this.onTap = onTap;
  }

  public onDown(sample: PointerSample): boolean {
    if (this.pointerId !== null || !this.hit(sample.x, sample.y)) return false;

    this.pointerId = sample.id;
    this.startX = sample.x;
    this.startY = sample.y;
    this.moved = false;
    return true;
  }

  public onMove(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;
    if (Math.hypot(sample.x - this.startX, sample.y - this.startY) > TAP_SLOP) this.moved = true;
  }

  public onUp(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;

    this.pointerId = null;
    if (!this.moved) this.onTap();
  }

  /** Un pinch reprend le doigt : pas de tap. */
  public onCancel(id: number): void {
    if (id === this.pointerId) this.pointerId = null;
  }
}
