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
 * la recouvre. Un habitant — enfant, ouvrier, bûcheron — aussi : un doigt
 * sur lui montre son infobulle (`onPerson`) ; sa zone de tap est son corps,
 * pas son cadre, pour qu'un ouvrier devant une porte n'empêche pas d'ouvrir
 * le bâtiment.
 *
 * Une base mutante aussi : un doigt sur son campement ouvre sa fenêtre
 * d'info (`onBase`), comme un bâtiment.
 *
 * Une fenêtre de bâtiment ouverte (`canDismiss`), un tap dans le vide la
 * ferme (`onDismiss`) — et son cadre de sélection avec elle. Fenêtre
 * fermée, le vide n'est pas revendiqué : il reste au joystick et au placement.
 *
 * Aucune commande ici : ouvrir une fenêtre, faire parler Ève ou montrer qui
 * est un habitant ne modifie pas le monde.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { ENEMY_BASE } from '../data/enemyBases.ts';
import { SPRITES } from '../data/sprites.ts';
import { isStanding } from '../sim/enemyBases.ts';
import type { EnemyBase, Entity, EntityId, Eve, Mobile, MobileId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { TAP_SLOP, type PointerConsumer, type PointerSample } from './pointer.ts';

/** Marge autour du cadre d'Ève, en pixels monde : elle est petite, le doigt est gros. */
const EVE_TAP_MARGIN = 6;

/** Le corps d'un habitant, autour de ses pieds, en pixels monde : demi-largeur, hauteur au-dessus, marge sous les pieds. */
const PERSON_HALF_W = 9;
const PERSON_TOP = 34;
const KID_TOP = 24;
const PERSON_BELOW = 4;

/** Ce que le doigt vise : un bâtiment, une base mutante, Ève, un habitant, ou le vide (pour fermer la fenêtre ouverte). */
type Target =
  | { kind: 'building'; id: EntityId }
  | { kind: 'enemyBase'; id: number }
  | { kind: 'eve' }
  | { kind: 'person'; id: MobileId }
  | { kind: 'nothing' };

export class Inspect implements PointerConsumer {
  private pointerId: number | null = null;
  private target: Target | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  private readonly world: World;
  private readonly screenToWorld: (x: number, y: number) => { x: number; y: number };
  private readonly enabled: () => boolean;
  private readonly onTap: (id: EntityId) => void;
  private readonly onTalk: () => void;
  private readonly onPerson: (id: MobileId) => void;
  private readonly canDismiss: () => boolean;
  private readonly onDismiss: () => void;
  private readonly onBase: (id: number) => void;

  public constructor(
    world: World,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    enabled: () => boolean,
    onTap: (id: EntityId) => void,
    onTalk: () => void = () => {},
    onPerson: (id: MobileId) => void = () => {},
    canDismiss: () => boolean = () => false,
    onDismiss: () => void = () => {},
    onBase: (id: number) => void = () => {},
  ) {
    this.world = world;
    this.screenToWorld = screenToWorld;
    this.enabled = enabled;
    this.onTap = onTap;
    this.onTalk = onTalk;
    this.onPerson = onPerson;
    this.canDismiss = canDismiss;
    this.onDismiss = onDismiss;
    this.onBase = onBase;
  }

  public onDown(sample: PointerSample): boolean {
    if (this.pointerId !== null || !this.enabled()) return false;

    const target = this.targetAt(sample) ?? (this.canDismiss() ? { kind: 'nothing' } : undefined);

    if (target === undefined) return false;

    this.pointerId = sample.id;
    this.target = target;
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
    switch (target.kind) {
      case 'eve':
        this.onTalk();
        return;
      case 'person':
        if (this.world.mobiles.has(target.id)) this.onPerson(target.id);
        return;
      case 'nothing':
        this.onDismiss();
        return;
      case 'enemyBase':
        this.onBase(target.id);
        return;
      case 'building':
        // Le bâtiment doit encore exister au relâchement : un mutant a pu le raser entre-temps.
        if (this.world.entities.has(target.id)) this.onTap(target.id);
    }
  }

  /** Un pinch reprend le doigt : rien ne s'ouvre. */
  public onCancel(id: number): void {
    if (id !== this.pointerId) return;
    this.pointerId = null;
    this.target = null;
  }

  private targetAt(sample: PointerSample): Target | undefined {
    const position = this.screenToWorld(sample.x, sample.y);
    const eve = this.world.eve();

    if (eve && isOnEve(eve, position.x, position.y)) return { kind: 'eve' };

    const person = personAt(this.world.mobiles.values(), position.x, position.y);

    if (person !== undefined) return { kind: 'person', id: person };

    const building = buildingAt(this.world.entities.values(), position.x, position.y);

    if (building !== undefined) return { kind: 'building', id: building };

    const base = enemyBaseAt(this.world.enemyBases, position.x, position.y);

    return base === undefined ? undefined : { kind: 'enemyBase', id: base };
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
 * L'habitant dessiné sous un point monde — un enfant, un ouvrier ou un
 * bûcheron dehors —, le plus bas à l'écran s'ils se recouvrent.
 */
export function personAt(mobiles: Iterable<Mobile>, x: number, y: number): MobileId | undefined {
  let found: MobileId | undefined;
  let foundY = -Infinity;

  for (const mobile of mobiles) {
    if (mobile.kind !== 'kid' && mobile.kind !== 'worker' && mobile.kind !== 'lumberjack') continue;
    if (mobile.kind !== 'kid' && mobile.inside) continue;

    const top = mobile.kind === 'kid' ? KID_TOP : PERSON_TOP;

    if (Math.abs(x - mobile.x) > PERSON_HALF_W || y < mobile.y - top || y > mobile.y + PERSON_BELOW) continue;
    if (mobile.y <= foundY) continue;

    found = mobile.id;
    foundY = mobile.y;
  }
  return found;
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

/** La base mutante debout dessinée sous un point monde : son emprise et le campement qui la dépasse. */
export function enemyBaseAt(bases: Iterable<EnemyBase>, x: number, y: number): number | undefined {
  const art = SPRITES[ENEMY_BASE.sprite];

  for (const base of bases) {
    if (!isStanding(base)) continue;

    const left = base.tx * TILE_SIZE;
    const bottom = (base.ty + ENEMY_BASE.height) * TILE_SIZE;

    if (x >= left && x < left + art.width && y >= bottom - art.height && y < bottom) return base.id;
  }
  return undefined;
}
