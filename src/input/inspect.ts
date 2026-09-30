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
 * Le doigt vise ce qu'il **voit** : un bâtiment est dessiné en 3/4, son
 * cadre monte au-dessus de l'emprise (toit, grue, drapeau). La zone tapable
 * est donc ce cadre entier, emprise comprise — pas seulement les tuiles
 * occupées. Tout est en pixels monde : le DPR n'entre jamais en jeu, et le
 * zoom est absorbé par `screenToWorld`.
 *
 * Aucune commande ici : ouvrir une fenêtre ne modifie pas le monde.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Entity, EntityId } from '../sim/types.ts';
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

    return buildingAt(this.world.entities.values(), position.x, position.y);
  }
}

/**
 * Le bâtiment dessiné sous un point monde : son emprise, plus la partie du
 * sprite qui dépasse au-dessus (cadre ancré en (0, 1) au pied de l'emprise,
 * cf. `render/entityLayer.ts`).
 *
 * Deux cadres se chevauchent quand le toit d'un bâtiment de devant couvre
 * celui de derrière : le plus bas à l'écran gagne, comme le tri en
 * profondeur du rendu — on ouvre ce qu'on voit par-dessus.
 */
export function buildingAt(entities: Iterable<Entity>, x: number, y: number): EntityId | undefined {
  let found: EntityId | undefined;
  let foundBottom = -Infinity;

  for (const entity of entities) {
    const art = SPRITES[BUILDINGS[entity.proto].sprite];
    const left = entity.tx * TILE_SIZE;
    const right = left + Math.max(entity.width * TILE_SIZE, art.width);
    const bottom = (entity.ty + entity.height) * TILE_SIZE;
    const top = bottom - Math.max(entity.height * TILE_SIZE, art.height);

    if (x < left || x >= right || y < top || y >= bottom) continue;
    if (bottom <= foundBottom) continue;

    found = entity.id;
    foundBottom = bottom;
  }
  return found;
}
