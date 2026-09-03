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
 * `touch-action: none` (cf. style.css) est indispensable : sans lui, le
 * navigateur avale les glissements avant qu'ils n'arrivent ici.
 */

export interface PointerSample {
  id: number;
  /** Coordonnées en pixels CSS, relatives au coin haut-gauche du canvas. */
  x: number;
  y: number;
}

export interface PointerConsumer {
  /** Renvoie `true` pour revendiquer ce doigt. Les consommateurs sont interrogés dans l'ordre d'ajout. */
  onDown(sample: PointerSample): boolean;
  onMove(sample: PointerSample): void;
  onUp(sample: PointerSample): void;
}

export class PointerRouter {
  private readonly consumers: PointerConsumer[] = [];
  private readonly owners = new Map<number, PointerConsumer>();
  private readonly detach: () => void;

  private readonly canvas: HTMLCanvasElement;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const down = (event: PointerEvent) => this.handleDown(event);
    const move = (event: PointerEvent) => this.handleMove(event);
    const up = (event: PointerEvent) => this.handleUp(event);

    canvas.addEventListener('pointerdown', down, { passive: false });
    // move/up sur window : un doigt qui sort du canvas doit rester suivi,
    // sinon le joystick reste collé en butée quand le pouce déborde.
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    this.detach = () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }

  public add(consumer: PointerConsumer): void {
    this.consumers.push(consumer);
  }

  private sample(event: PointerEvent): PointerSample {
    const rect = this.canvas.getBoundingClientRect();

    return { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private handleDown(event: PointerEvent): void {
    event.preventDefault();

    const sample = this.sample(event);

    for (const consumer of this.consumers) {
      if (consumer.onDown(sample)) {
        this.owners.set(sample.id, consumer);
        return;
      }
    }
  }

  private handleMove(event: PointerEvent): void {
    const consumer = this.owners.get(event.pointerId);

    if (!consumer) return;

    event.preventDefault();
    consumer.onMove(this.sample(event));
  }

  private handleUp(event: PointerEvent): void {
    const consumer = this.owners.get(event.pointerId);

    if (!consumer) return;

    this.owners.delete(event.pointerId);
    consumer.onUp(this.sample(event));
  }

  public destroy(): void {
    this.detach();
    this.owners.clear();
    this.consumers.length = 0;
  }
}
