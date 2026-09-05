/**
 * Inspection au tap : un doigt posé sur un bâtiment, relevé sans bouger,
 * ouvre sa fenêtre.
 *
 * Ce consommateur passe **avant** le joystick dans le routeur : il ne
 * revendique le doigt que si, au moment où il se pose, un chantier ou un
 * bâtiment est dessous et qu'aucun placement n'est en cours. Sinon il laisse
 * la main. Un doigt revendiqué qui glisse au-delà de `TAP_SLOP` n'ouvre rien —
 * c'était un mouvement, pas un tap.
 *
 * Aucune commande ici : ouvrir une fenêtre ne modifie pas le monde.
 */

import { worldToTile } from '../core/grid.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import type { PointerConsumer, PointerSample } from './pointer.ts';

/** Déplacement en pixels CSS au-delà duquel un appui n'est plus un tap. */
const TAP_SLOP = 12;

export class Inspect implements PointerConsumer {
  private pointerId: number | null = null;
  private target: EntityId | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  private readonly world: World;
  private readonly screenToWorld: (x: number, y: number) => { x: number; y: number };
  private readonly enabled: () => boolean;
  private readonly onTap: (id: EntityId) => void;

  public constructor(
    world: World,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    enabled: () => boolean,
    onTap: (id: EntityId) => void,
  ) {
    this.world = world;
    this.screenToWorld = screenToWorld;
    this.enabled = enabled;
    this.onTap = onTap;
  }

  public onDown(sample: PointerSample): boolean {
    if (this.pointerId !== null || !this.enabled()) return false;

    const id = this.entityAt(sample);

    if (id === undefined) return false;

    this.pointerId = sample.id;
    this.target = id;
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

    const target = this.target;

    this.pointerId = null;
    this.target = null;

    // Le bâtiment doit encore exister au relâchement : un mutant a pu le raser entre-temps.
    if (!this.moved && target !== null && this.world.entities.has(target)) this.onTap(target);
  }

  private entityAt(sample: PointerSample): EntityId | undefined {
    const position = this.screenToWorld(sample.x, sample.y);
    const { tx, ty } = worldToTile(position.x, position.y);

    return this.world.chunks.occupantAt(tx, ty);
  }
}
