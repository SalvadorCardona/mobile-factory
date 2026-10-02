/**
 * Joystick virtuel hybride.
 *
 * Au repos, il est toujours au même endroit, en bas d'écran, au milieu, et
 * toujours affiché : le joueur sait où poser le pouce avant même d'avoir
 * touché l'écran. Toutes les coordonnées sont des **décalages** en pixels CSS depuis
 * ce centre de repos ; où il est à l'écran, c'est l'affaire de `ui/joystick.ts`.
 *
 * Un pouce qui rate l'anneau n'est pas perdu : posé ailleurs dans le bas de
 * l'écran, au milieu (`CAPTURE_ZONE`), il y fait sauter l'anneau, et ce point
 * devient le centre (`originX`, `originY`) tant qu'il est tenu. Sortie nulle au
 * contact, puis on marche dans le sens où le doigt glisse — jamais à
 * contresens parce qu'il est resté au-dessus du centre de repos. Posé dans
 * le creux de l'anneau, rien ne saute : c'est le joystick fixe.
 *
 * La sortie est **analogique** : la vitesse dépend de la distance au centre,
 * pas seulement de la direction. Au-delà du rayon, le bouton reste collé au
 * bord dans la bonne direction et la sortie sature à 1 — le doigt peut sortir
 * de l'anneau sans que le mouvement s'arrête.
 *
 * Aucun import Pixi ni DOM ici : ce fichier ne produit qu'un état, testé en Node.
 */

import type { PointerConsumer, PointerSample } from './pointer.ts';

/** Rayon de l'anneau en pixels CSS : la course du bouton, et la vitesse maximale. */
export const STICK_RADIUS = 56;

/** Rayon du bouton blanc, en pixels CSS. */
export const KNOB_RADIUS = 26;

/** Zone morte : sous ce rayon, la sortie est nulle. Évite la dérive au repos. */
export const DEAD_ZONE = 8;

/** Rayon de la zone où un doigt qui se pose prend le joystick : plus large que l'anneau, pour le pouce. */
export const TOUCH_RADIUS = 84;

/** Épaisseur du bord blanc de l'anneau. Un doigt posé dessus ou au-delà fait sauter l'anneau sous lui. */
export const RING_RIM = 6;

/**
 * Le bas de l'écran, au milieu, en fractions de sa taille : un doigt posé
 * sur la carte entre `minX` et `maxX` et sous `minY` prend le joystick, même
 * loin de l'anneau — centré comme lui. Les boutons du HUD, dans le DOM,
 * gardent leurs doigts.
 */
export const CAPTURE_ZONE = { minX: 0.25, maxX: 0.75, minY: 0.55 } as const;

/** Le point (`x`, `y`) d'un écran `width` × `height` est-il dans la zone de prise ? */
export function inCaptureZone(x: number, y: number, width: number, height: number): boolean {
  return x >= width * CAPTURE_ZONE.minX && x < width * CAPTURE_ZONE.maxX && y > height * CAPTURE_ZONE.minY && y <= height;
}

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
  /** Le centre courant de l'anneau, depuis son centre de repos : (0, 0) sauf s'il a sauté sous le doigt. */
  originX: number;
  originY: number;
}

export class Joystick {
  public readonly state: JoystickState = { active: false, knobX: 0, knobY: 0, axisX: 0, axisY: 0, originX: 0, originY: 0 };

  private pointerId: number | null = null;

  /**
   * Un doigt se pose. Renvoie `true` s'il prend le joystick : un seul doigt à
   * la fois, à moins de `reach` du centre de repos. Hors du creux de
   * l'anneau, l'anneau saute sous lui.
   */
  public press(id: number, dx: number, dy: number, reach = TOUCH_RADIUS): boolean {
    const distance = Math.hypot(dx, dy);

    if (this.pointerId !== null || distance > reach) return false;

    const jump = distance > STICK_RADIUS - RING_RIM;

    this.pointerId = id;
    this.state.active = true;
    this.state.originX = jump ? dx : 0;
    this.state.originY = jump ? dy : 0;
    this.drag(id, dx, dy);
    return true;
  }

  public drag(id: number, dx: number, dy: number): void {
    if (id !== this.pointerId) return;
    Object.assign(this.state, readStick(dx - this.state.originX, dy - this.state.originY));
  }

  /** Le doigt se lève : l'anneau revient à sa place, le bouton au centre, Adam s'arrête. */
  public release(id: number): void {
    if (id !== this.pointerId) return;
    this.reset();
  }

  /** Lâche le doigt quel qu'il soit : joystick masqué, onglet caché. */
  public reset(): void {
    this.pointerId = null;
    Object.assign(this.state, { active: false, knobX: 0, knobY: 0, axisX: 0, axisY: 0, originX: 0, originY: 0 });
  }
}

/** Où est le joystick, en pixels CSS du canvas — `null` s'il n'est pas affiché. */
export interface StickFrame {
  /** Taille de l'écran (du canvas). */
  width: number;
  height: number;
  /** Centre de repos de l'anneau. */
  centerX: number;
  centerY: number;
}

/**
 * Les doigts du canvas posés en bas au milieu, à côté de l'anneau :
 * un consommateur du routeur (`input/pointer.ts`), interrogé **après** le
 * repère de la mairie et l'inspection — un tap sur un bâtiment proche
 * reste un tap. Un doigt posé sur l'anneau lui-même n'arrive pas ici : le
 * joystick du DOM, au-dessus du canvas, le prend avant.
 */
export class StickCapture implements PointerConsumer {
  private readonly joystick: Joystick;
  private readonly frame: () => StickFrame | null;
  private readonly onChange: () => void;

  /** `onChange` : le joystick a bougé, à redessiner. */
  public constructor(joystick: Joystick, frame: () => StickFrame | null, onChange: () => void = () => {}) {
    this.joystick = joystick;
    this.frame = frame;
    this.onChange = onChange;
  }

  public onDown(sample: PointerSample): boolean {
    const frame = this.frame();

    if (sample.mouse || !frame || !inCaptureZone(sample.x, sample.y, frame.width, frame.height)) return false;
    if (!this.joystick.press(sample.id, sample.x - frame.centerX, sample.y - frame.centerY, Infinity)) return false;

    this.onChange();
    return true;
  }

  public onMove(sample: PointerSample): void {
    const frame = this.frame();

    if (!frame) return;
    this.joystick.drag(sample.id, sample.x - frame.centerX, sample.y - frame.centerY);
    this.onChange();
  }

  public onUp(sample: PointerSample): void {
    this.joystick.release(sample.id);
    this.onChange();
  }
}
