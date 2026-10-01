/**
 * Lecture des PointerEvent bruts du canvas.
 *
 * On n'utilise pas le système d'événements de Pixi ici. Il est fait pour du
 * hit-testing sur des objets de la scène ; nous, on veut savoir *quel doigt*
 * fait quoi, et garder le multitouch propre : un doigt vise un bâtiment
 * pendant que l'autre en déplace le fantôme. (Le joystick est dans le DOM,
 * au-dessus du canvas — `ui/joystick.ts` ; seul un pouce qui rate son
 * anneau passe par ici, `StickCapture`.)
 *
 * Chaque doigt est attribué à un seul consommateur au `pointerdown`, et lui
 * reste attribué jusqu'au `pointerup`. Un consommateur ne voit donc jamais les
 * mouvements d'un doigt qu'il n'a pas revendiqué.
 *
 * L'aiguillage (`PointerDispatch`) ne touche pas au DOM : il se teste en Node.
 *
 * `touch-action: none` (cf. style.css) est indispensable : sans lui, le
 * navigateur avale les glissements avant qu'ils n'arrivent ici.
 */

export interface PointerSample {
  id: number;
  /** Coordonnées en pixels CSS, relatives au coin haut-gauche du canvas. */
  x: number;
  y: number;
  /**
   * L'appui vient d'une souris (`pointerType === 'mouse'`) : le mode PC du
   * placement. Jamais déduit de la taille d'écran — un doigt reste un doigt.
   */
  mouse?: boolean;
  /** Bouton de l'appui (`PointerEvent.button`) : 2 pour le clic droit. */
  button?: number;
}

/** Déplacement en pixels CSS au-delà duquel un appui n'est plus un tap. */
export const TAP_SLOP = 12;

export interface PointerConsumer {
  /** Renvoie `true` pour revendiquer ce doigt. Les consommateurs sont interrogés dans l'ordre d'ajout. */
  onDown(sample: PointerSample): boolean;
  onMove(sample: PointerSample): void;
  onUp(sample: PointerSample): void;
}

/** L'attribution des doigts aux consommateurs, sans DOM. */
export class PointerDispatch {
  private readonly consumers: PointerConsumer[] = [];
  private readonly owners = new Map<number, PointerConsumer>();

  public add(consumer: PointerConsumer): void {
    this.consumers.push(consumer);
  }

  public down(sample: PointerSample): void {
    const consumer = this.consumers.find((candidate) => candidate.onDown(sample));

    if (consumer) this.owners.set(sample.id, consumer);
  }

  public owns(id: number): boolean {
    return this.owners.has(id);
  }

  public move(sample: PointerSample): void {
    this.owners.get(sample.id)?.onMove(sample);
  }

  public up(sample: PointerSample): void {
    const owner = this.owners.get(sample.id);

    if (!owner) return;

    this.owners.delete(sample.id);
    owner.onUp(sample);
  }

  public clear(): void {
    this.owners.clear();
    this.consumers.length = 0;
  }
}

export class PointerRouter {
  private readonly dispatch = new PointerDispatch();
  private readonly detach: () => void;

  private readonly canvas: HTMLCanvasElement;

  private readonly onHover: (sample: PointerSample) => void;

  /**
   * `onHover` : une souris qui survole le canvas sans bouton enfoncé. Un
   * doigt ne survole jamais ; le tactile ne passe pas par là.
   */
  public constructor(canvas: HTMLCanvasElement, onHover: (sample: PointerSample) => void = () => {}) {
    this.canvas = canvas;
    this.onHover = onHover;

    const down = (event: PointerEvent) => this.handleDown(event);
    const move = (event: PointerEvent) => this.handleMove(event);
    const up = (event: PointerEvent) => this.handleUp(event);
    // Le clic droit annule un placement : pas de menu du navigateur par-dessus.
    // Un appui long au doigt, lui, garde son comportement.
    const menu = (event: MouseEvent) => {
      if (!(event instanceof PointerEvent) || event.pointerType === 'mouse') event.preventDefault();
    };

    canvas.addEventListener('pointerdown', down, { passive: false });
    canvas.addEventListener('contextmenu', menu);
    // move/up sur window : un doigt qui sort du canvas doit rester suivi,
    // sinon un glissé qui déborde ne se relâche jamais.
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    this.detach = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('contextmenu', menu);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }

  public add(consumer: PointerConsumer): void {
    this.dispatch.add(consumer);
  }

  private sample(event: PointerEvent): PointerSample {
    const rect = this.canvas.getBoundingClientRect();

    return {
      id: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      mouse: event.pointerType === 'mouse',
      button: event.button,
    };
  }

  private handleDown(event: PointerEvent): void {
    event.preventDefault();
    this.dispatch.down(this.sample(event));
  }

  private handleMove(event: PointerEvent): void {
    if (!this.dispatch.owns(event.pointerId)) {
      // Sur le HUD, le curseur vise un bouton, pas la carte.
      if (event.pointerType === 'mouse' && event.target === this.canvas) this.onHover(this.sample(event));
      return;
    }

    event.preventDefault();
    this.dispatch.move(this.sample(event));
  }

  private handleUp(event: PointerEvent): void {
    if (!this.dispatch.owns(event.pointerId)) return;
    this.dispatch.up(this.sample(event));
  }

  public destroy(): void {
    this.detach();
    this.dispatch.clear();
  }
}
