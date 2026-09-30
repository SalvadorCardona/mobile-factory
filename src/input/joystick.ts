/**
 * Joystick virtuel fixe.
 *
 * Il est toujours au même endroit, en bas d'écran, et toujours affiché : le
 * joueur sait où poser le pouce avant même d'avoir touché l'écran. Toutes
 * les coordonnées sont des **décalages** en pixels CSS depuis le centre de
 * l'anneau ; où est l'anneau à l'écran, c'est l'affaire de `ui/joystick.ts`.
 *
 * La sortie est **analogique** : la vitesse dépend de la distance au centre,
 * pas seulement de la direction. Au-delà du rayon, le bouton reste collé au
 * bord dans la bonne direction et la sortie sature à 1 — le doigt peut sortir
 * de l'anneau sans que le mouvement s'arrête.
 *
 * Aucun import Pixi ni DOM ici : ce fichier ne produit qu'un état, testé en Node.
 */

/** Rayon de l'anneau en pixels CSS : la course du bouton, et la vitesse maximale. */
export const STICK_RADIUS = 56;

/** Rayon du bouton blanc, en pixels CSS. */
export const KNOB_RADIUS = 26;

/** Zone morte : sous ce rayon, la sortie est nulle. Évite la dérive au repos. */
export const DEAD_ZONE = 8;

/** Rayon de la zone où un doigt qui se pose prend le joystick : plus large que l'anneau, pour le pouce. */
export const TOUCH_RADIUS = 84;

export interface StickOutput {
  /** Position du bouton, bornée au rayon. */
  knobX: number;
  knobY: number;
  /** Sortie analogique, chaque composante dans [-1, 1], de norme au plus 1. */
  axisX: number;
  axisY: number;
}

/** Le bouton et la sortie pour un doigt à (`dx`, `dy`) du centre. */
export function readStick(dx: number, dy: number): StickOutput {
  const distance = Math.hypot(dx, dy);

  if (distance < DEAD_ZONE) return { knobX: dx, knobY: dy, axisX: 0, axisY: 0 };

  const clamped = Math.min(distance, STICK_RADIUS);
  const nx = dx / distance;
  const ny = dy / distance;
  // Amplitude remise à l'échelle depuis la zone morte : la vitesse démarre à
  // zéro juste après le seuil, au lieu de sauter d'un coup à 15 %.
  const amplitude = (clamped - DEAD_ZONE) / (STICK_RADIUS - DEAD_ZONE);

  return { knobX: nx * clamped, knobY: ny * clamped, axisX: nx * amplitude, axisY: ny * amplitude };
}

export interface JoystickState extends StickOutput {
  /** Un doigt tient le joystick. */
  active: boolean;
}

export class Joystick {
  public readonly state: JoystickState = { active: false, knobX: 0, knobY: 0, axisX: 0, axisY: 0 };

  private pointerId: number | null = null;

  /** Un doigt se pose. Renvoie `true` s'il prend le joystick : un seul doigt à la fois, dans la zone tactile. */
  public press(id: number, dx: number, dy: number): boolean {
    if (this.pointerId !== null || Math.hypot(dx, dy) > TOUCH_RADIUS) return false;

    this.pointerId = id;
    this.state.active = true;
    this.drag(id, dx, dy);
    return true;
  }

  public drag(id: number, dx: number, dy: number): void {
    if (id !== this.pointerId) return;
    Object.assign(this.state, readStick(dx, dy));
  }

  /** Le doigt se lève : le bouton revient au centre, Adam s'arrête. */
  public release(id: number): void {
    if (id !== this.pointerId) return;
    this.reset();
  }

  /** Lâche le doigt quel qu'il soit : joystick masqué, onglet caché. */
  public reset(): void {
    this.pointerId = null;
    Object.assign(this.state, { active: false, knobX: 0, knobY: 0, axisX: 0, axisY: 0 });
  }
}
