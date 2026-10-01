/**
 * Le joystick à l'écran : un anneau blanc voilé en bas à gauche, et au
 * centre un bouton blanc — le point qu'on fait glisser pour marcher.
 *
 * Il est dans le DOM, au-dessus du canvas, et pas dans la scène Pixi : un
 * doigt posé sur lui est à lui, et le routeur du canvas (inspection,
 * placement, repères) ne le voit jamais. Toucher le joystick ne sélectionne
 * donc rien et ne construit rien, pendant qu'un autre doigt, lui, reste libre
 * de viser un bâtiment ou un bouton du HUD.
 *
 * La zone qui prend le doigt (`TOUCH_RADIUS`) est plus large que l'anneau
 * visible (`STICK_RADIUS`) : le pouce n'a pas à viser juste. Le doigt capturé
 * peut ensuite sortir de la zone, et même de l'écran, sans être perdu.
 *
 * Un pouce qui rate l'anneau mais tombe dans le quart bas-gauche, lui,
 * arrive sur le canvas : `canvasFinger()` le prend pour le routeur, après
 * les taps sur la carte. L'anneau saute alors sous le doigt (80 ms) et y
 * reste tant qu'il est tenu ; relâché, il revient à sa place (150 ms).
 *
 * Au repos il est voilé ; tenu, il est plein. Relâché, le bouton revient au
 * centre avec un petit ressort — des transitions CSS, pas de l'état.
 *
 * Une barre qui s'ouvre en bas d'écran par-dessus lui (celle du placement)
 * le fait monter au-dessus d'elle : il ne cache rien, et rien ne le cache.
 *
 * Il ne s'affiche qu'au doigt : ni à la souris, ni sur un écran sans tactile.
 * Le mode suit le dernier appui (`pointerType`), et part de `pointer: coarse`.
 *
 * La logique (direction, intensité, zone morte) est dans `input/joystick.ts` ;
 * ici on ne fait que lire le doigt et poser le bouton.
 */

import {
  KNOB_RADIUS,
  RING_RIM,
  STICK_RADIUS,
  StickCapture,
  TOUCH_RADIUS,
  type Joystick,
} from '../input/joystick.ts';
import type { PointerConsumer } from '../input/pointer.ts';

export class JoystickView {
  public readonly root: HTMLElement;

  private readonly ring: HTMLElement;
  private readonly knob: HTMLElement;
  private touch = window.matchMedia('(pointer: coarse)').matches;
  private enabled = false;

  private readonly joystick: Joystick;

  public constructor(joystick: Joystick) {
    this.joystick = joystick;

    this.root = element('div', 'joystick');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.style.setProperty('--stick-zone', `${TOUCH_RADIUS * 2}px`);
    this.root.style.setProperty('--stick-ring', `${STICK_RADIUS * 2}px`);
    this.root.style.setProperty('--stick-knob', `${KNOB_RADIUS * 2}px`);
    this.root.style.setProperty('--stick-rim', `${RING_RIM}px`);

    this.ring = element('div', 'joystick-ring');
    this.knob = element('div', 'joystick-knob');
    this.ring.append(this.knob);
    this.root.append(this.ring);

    this.root.addEventListener('pointerdown', (event) => this.handleDown(event));
    this.root.addEventListener('pointermove', (event) => this.handleMove(event));
    this.root.addEventListener('pointerup', (event) => this.handleUp(event));
    this.root.addEventListener('pointercancel', (event) => this.handleUp(event));
    this.root.addEventListener('lostpointercapture', (event) => this.handleUp(event));

    // En capture, pour voir aussi les appuis que les boutons du HUD gardent pour eux.
    window.addEventListener(
      'pointerdown',
      (event) => {
        this.touch = event.pointerType !== 'mouse';
        this.refresh();
      },
      { capture: true },
    );
    this.refresh();
  }

  /**
   * Ce qui peut s'ouvrir en bas d'écran, à gauche : le joystick se pose
   * au-dessus. Relu quand leur taille change — ouvrir, fermer, une ligne de
   * plus —, jamais à chaque frame.
   */
  public avoid(nodes: readonly Element[]): void {
    const observer = new ResizeObserver(() => {
      let lift = 0;

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();

        if (rect.height > 0 && rect.left < TOUCH_RADIUS * 2) lift = Math.max(lift, window.innerHeight - rect.top);
      }
      this.root.style.setProperty('--stick-lift', `${Math.round(lift)}px`);
    });

    for (const node of nodes) observer.observe(node);
  }

  /**
   * Le consommateur des doigts du canvas posés à côté de l'anneau, dans le
   * quart bas-gauche. `enabled` : `false` quand la carte veut ces doigts —
   * un bâtiment armé se pose aussi dans le coin.
   */
  public canvasFinger(canvas: HTMLCanvasElement, enabled: () => boolean): PointerConsumer {
    return new StickCapture(
      this.joystick,
      () => {
        if (!this.shown || !enabled()) return null;

        const screen = canvas.getBoundingClientRect();
        const rest = this.root.getBoundingClientRect();

        return {
          width: screen.width,
          height: screen.height,
          centerX: rest.left + rest.width / 2 - screen.left,
          centerY: rest.top + rest.height / 2 - screen.top,
        };
      },
      () => this.render(),
    );
  }

  /** Le joystick est-il affiché — au doigt, et quand rien ne le recouvre ? */
  public get shown(): boolean {
    return this.touch && this.enabled;
  }

  /** `false` pendant un menu, un panneau, une pause : le joystick disparaît et lâche son doigt. */
  public setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.refresh();
  }

  private refresh(): void {
    this.root.hidden = !this.shown;

    if (this.shown) return;
    this.joystick.reset();
    this.render();
  }

  private offset(event: PointerEvent): { dx: number; dy: number } {
    const rect = this.root.getBoundingClientRect();

    return { dx: event.clientX - (rect.left + rect.width / 2), dy: event.clientY - (rect.top + rect.height / 2) };
  }

  private handleDown(event: PointerEvent): void {
    event.preventDefault();

    const { dx, dy } = this.offset(event);

    if (!this.joystick.press(event.pointerId, dx, dy)) return;
    // Le doigt reste au joystick même s'il sort de la zone.
    this.root.setPointerCapture(event.pointerId);
    this.render();
  }

  private handleMove(event: PointerEvent): void {
    if (!this.joystick.state.active) return;
    event.preventDefault();

    const { dx, dy } = this.offset(event);

    this.joystick.drag(event.pointerId, dx, dy);
    this.render();
  }

  private handleUp(event: PointerEvent): void {
    this.joystick.release(event.pointerId);
    this.render();
  }

  private render(): void {
    const { active, knobX, knobY, originX, originY } = this.joystick.state;

    this.root.dataset['active'] = String(active);
    this.ring.style.transform = `translate(${originX}px, ${originY}px)`;
    this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
  }
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);

  node.className = className;
  return node;
}
