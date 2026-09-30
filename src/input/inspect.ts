/**
 * Inspection au tap : un doigt posé sur un bâtiment, relevé sans bouger,
 * ouvre sa fenêtre.
 *
 * Ce consommateur passe **avant** le placement dans le routeur : il ne
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
 * Ève se tape aussi : un doigt sur elle la fait parler (`onTalk`). Elle
 * passe avant les bâtiments — elle se tient devant la mairie, dont le cadre
 * la recouvre.
 *
 * Aucune commande ici : ouvrir une fenêtre ou faire parler Ève ne modifie
 * pas le monde.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Entity, EntityId, Eve } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { TAP_SLOP, type PointerConsumer, type PointerSample } from './pointer.ts';

/** Marge autour du cadre d'Ève, en pixels monde : elle est petite, le doigt est gros. */
const EVE_TAP_MARGIN = 6;

export class Inspect implements PointerConsumer {
  private pointerId: number | null = null;
  private target: EntityId | 'eve' | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  private readonly world: World;
  private readonly screenToWorld: (x: number, y: number) => { x: number; y: number };
  private readonly enabled: () => boolean;
  private readonly onTap: (id: EntityId) => void;
  private readonly onTalk: () => void;

  public constructor(
    world: World,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    enabled: () => boolean,
    onTap: (id: EntityId) => void,
    onTalk: () => void = () => {},
  ) {
    this.world = world;
    this.screenToWorld = screenToWorld;
    this.enabled = enabled;
    this.onTap = onTap;
    this.onTalk = onTalk;
  }

  public onDown(sample: PointerSample): boolean {
    if (this.pointerId !== null || !this.enabled()) return false;

    const id = this.targetAt(sample);

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

    if (this.moved || target === null) return;
    if (target === 'eve') {
      this.onTalk();
      return;
    }
    // Le bâtiment doit encore exister au relâchement : un mutant a pu le raser entre-temps.
    if (this.world.entities.has(target)) this.onTap(target);
  }

  private targetAt(sample: PointerSample): EntityId | 'eve' | undefined {
    const position = this.screenToWorld(sample.x, sample.y);
    const eve = this.world.eve();

    if (eve && isOnEve(eve, position.x, position.y)) return 'eve';
    return buildingAt(this.world.entities.values(), position.x, position.y);
  }
}

/** Le point monde tombe-t-il sur Ève — son sprite entier, plus une marge ? */
export function isOnEve(eve: Eve, x: number, y: number): boolean {
  const { width, height, anchorX, anchorY } = SPRITES.eve;
  const left = eve.x - width * anchorX - EVE_TAP_MARGIN;
  const top = eve.y - height * anchorY - EVE_TAP_MARGIN;

  return x >= left && x < left + width + EVE_TAP_MARGIN * 2 && y >= top && y < top + height + EVE_TAP_MARGIN * 2;
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
