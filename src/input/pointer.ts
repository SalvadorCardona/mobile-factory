/**
 * Lecture des PointerEvent bruts du canvas.
 *
 * On n'utilise pas le système d'événements de Pixi ici. Il est fait pour du
 * hit-testing sur des objets de la scène ; nous, on veut savoir *quel doigt*
 * fait quoi, et garder le multitouch propre : le pouce gauche pilote le
 * joystick pendant que le pouce droit pose un bâtiment.
 *
 * Chaque doigt est attribué à un seul consommateur au `pointerdown`, et lui
 * reste attribué jusqu'au `pointerup`. Un consommateur ne voit donc jamais les
 * mouvements d'un doigt qu'il n'a pas revendiqué.
 *
 * Une seule exception : un consommateur peut **lâcher** un doigt au premier
 * mouvement qui lui montre que ce n'est pas pour lui (le placement, quand ce
 * n'est ni un tap ni un glissé depuis le fantôme). Le doigt est alors proposé
 * aux consommateurs suivants, comme s'il venait de se poser là où il s'était
 * posé ; si aucun n'en veut, il reste à celui qui l'a lâché.
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
  /**
   * Renvoie `'release'` pour lâcher le doigt, une seule fois par doigt. S'il
   * trouve preneur, le consommateur reçoit `onUp` et ne le voit plus ; sinon
   * il reçoit de nouveau ce même mouvement, et garde le doigt.
   */
  onMove(sample: PointerSample): 'release' | void;
  onUp(sample: PointerSample): void;
}

interface Owner {
  consumer: PointerConsumer;
  /** Où le doigt s'est posé : ce que voit un consommateur à qui on le passe. */
  down: PointerSample;
  released: boolean;
}

/** L'attribution des doigts aux consommateurs, sans DOM. */
export class PointerDispatch {
  private readonly consumers: PointerConsumer[] = [];
  private readonly owners = new Map<number, Owner>();

  public add(consumer: PointerConsumer): void {
    this.consumers.push(consumer);
  }

  public down(sample: PointerSample): void {
    const consumer = this.consumers.find((candidate) => candidate.onDown(sample));

    if (consumer) this.owners.set(sample.id, { consumer, down: sample, released: false });
  }

  public owns(id: number): boolean {
    return this.owners.has(id);
  }

  public move(sample: PointerSample): void {
    const owner = this.owners.get(sample.id);

    if (!owner) return;
    if (owner.consumer.onMove(sample) !== 'release' || owner.released) return;

    owner.released = true;

    const next = this.consumers.slice(this.consumers.indexOf(owner.consumer) + 1);
    const taker = next.find((consumer) => consumer.onDown(owner.down));

    if (taker) {
      owner.consumer.onUp(sample);
      owner.consumer = taker;
    }
    owner.consumer.onMove(sample);
  }

  public up(sample: PointerSample): void {
    const owner = this.owners.get(sample.id);

    if (!owner) return;

    this.owners.delete(sample.id);
    owner.consumer.onUp(sample);
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
    // sinon le joystick reste collé en butée quand le pouce déborde.
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
