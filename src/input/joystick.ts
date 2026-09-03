/**
 * Joystick virtuel flottant.
 *
 * Il n'a pas de position fixe : il apparaît là où le pouce se pose, sur la
 * moitié gauche de l'écran. C'est ce qui le rend utilisable sur un téléphone
 * qu'on tient d'une main comme sur une tablette à deux mains — un joystick
 * ancré en bas à gauche oblige à regarder l'écran pour le retrouver.
 *
 * La sortie est **analogique** : la vitesse dépend de la distance au centre,
 * pas seulement de la direction. Au-delà du rayon, la sortie sature à 1.
 *
 * Aucun import Pixi ici : ce fichier ne produit qu'un état. Le rendu du
 * joystick est fait par `render/`, qui lit cet état.
 */

import type { PointerConsumer, PointerSample } from './pointer.ts';

/** Rayon en pixels CSS au-delà duquel la sortie sature. */
const RADIUS = 64;

/** Zone morte : sous ce rayon, la sortie est nulle. Évite la dérive au repos. */
const DEAD_ZONE = 6;

export interface JoystickState {
  active: boolean;
  /** Centre du joystick, en pixels CSS écran. */
  originX: number;
  originY: number;
  /** Position du pouce, bornée au rayon. */
  knobX: number;
  knobY: number;
  /** Sortie analogique, chaque composante dans [-1, 1]. */
  axisX: number;
  axisY: number;
}

export class Joystick implements PointerConsumer {
  public readonly state: JoystickState = {
    active: false,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    axisX: 0,
    axisY: 0,
  };

  private pointerId: number | null = null;

  private readonly viewWidth: () => number;

  /** `viewWidth` est relu à chaque appui : l'écran peut tourner en cours de partie. */
  public constructor(viewWidth: () => number) {
    this.viewWidth = viewWidth;
  }

  public onDown(sample: PointerSample): boolean {
    // Un seul doigt à la fois, et seulement sur la moitié gauche.
    if (this.pointerId !== null || sample.x > this.viewWidth() / 2) return false;

    this.pointerId = sample.id;
    this.state.active = true;
    this.state.originX = sample.x;
    this.state.originY = sample.y;
    this.state.knobX = sample.x;
    this.state.knobY = sample.y;
    this.state.axisX = 0;
    this.state.axisY = 0;
    return true;
  }

  public onMove(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;

    const dx = sample.x - this.state.originX;
    const dy = sample.y - this.state.originY;
    const distance = Math.hypot(dx, dy);

    if (distance < DEAD_ZONE) {
      this.state.knobX = this.state.originX;
      this.state.knobY = this.state.originY;
      this.state.axisX = 0;
      this.state.axisY = 0;
      return;
    }

    const clamped = Math.min(distance, RADIUS);
    const nx = dx / distance;
    const ny = dy / distance;
    // Amplitude remise à l'échelle depuis la zone morte : la vitesse démarre à
    // zéro juste après le seuil, au lieu de sauter d'un coup à 10 %.
    const amplitude = (clamped - DEAD_ZONE) / (RADIUS - DEAD_ZONE);

    this.state.knobX = this.state.originX + nx * clamped;
    this.state.knobY = this.state.originY + ny * clamped;
    this.state.axisX = nx * amplitude;
    this.state.axisY = ny * amplitude;
  }

  public onUp(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;

    this.pointerId = null;
    this.state.active = false;
    this.state.axisX = 0;
    this.state.axisY = 0;
  }
}
