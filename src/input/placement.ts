/**
 * Placement au tap, en deux temps.
 *
 * Règle d'UX du projet : **jamais de construction au premier tap.** Sur un
 * téléphone, le doigt masque la case qu'il vise et la précision est de l'ordre
 * de la tuile. Un tap qui construit directement, c'est une foreuse posée de
 * travers une fois sur trois, sans moyen d'annuler.
 *
 * D'où trois états :
 * - `idle`    aucun bâtiment sélectionné ;
 * - `armed`   un bâtiment est choisi dans le menu, on attend un tap sur la carte ;
 * - `placing` le fantôme est posé, le doigt peut le déplacer au drag, et un
 *             bouton de confirmation valide.
 *
 * Rien n'est modifié dans le monde ici : la validation pousse une commande
 * `placeBuilding` que le tick consomme.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { World } from '../sim/world.ts';
import type { PointerConsumer, PointerSample } from './pointer.ts';

export interface GhostState {
  building: BuildingId;
  /** Tuile d'origine (coin haut-gauche de l'emprise). */
  tx: number;
  ty: number;
}

export type PlacementMode = 'idle' | 'armed' | 'placing';

/**
 * Décalage vertical du fantôme au-dessus du doigt, en pixels CSS.
 * Sans lui le pouce cache exactement ce qu'on essaie de viser.
 */
const FINGER_OFFSET_Y = 44;

export class Placement implements PointerConsumer {
  public mode: PlacementMode = 'idle';
  public ghost: GhostState | null = null;

  /** Bâtiment choisi dans le menu, conservé entre deux poses. */
  private armed: BuildingId | null = null;
  private pointerId: number | null = null;

  private readonly world: World;
  private readonly screenToWorld: (x: number, y: number) => { x: number; y: number };
  private readonly onChange: () => void;

  public constructor(
    world: World,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    onChange: () => void,
  ) {
    this.world = world;
    this.screenToWorld = screenToWorld;
    this.onChange = onChange;
  }

  /** Le menu de construction a choisi un bâtiment. Un second appui désarme. */
  public select(building: BuildingId): void {
    if (this.armed === building) {
      this.cancel();
      return;
    }
    this.armed = building;
    this.mode = 'armed';
    this.ghost = null;
    this.onChange();
  }

  /** Bâtiment actuellement armé, ou `null`. Le menu s'en sert pour s'allumer. */
  public armedBuilding(): BuildingId | null {
    return this.armed;
  }

  public cancel(): void {
    this.mode = 'idle';
    this.armed = null;
    this.ghost = null;
    this.pointerId = null;
    this.onChange();
  }

  /** Le bouton de confirmation. Seul chemin vers une construction réelle. */
  public confirm(): void {
    if (this.mode !== 'placing' || !this.ghost) return;

    this.world.push({
      type: 'placeBuilding',
      building: this.ghost.building,
      tx: this.ghost.tx,
      ty: this.ghost.ty,
    });

    // On reste armé : poser trois foreuses d'affilée ne doit pas obliger à
    // rouvrir le menu entre chaque.
    this.mode = 'armed';
    this.ghost = null;
    this.onChange();
  }

  /** Le fantôme est-il posable là où il est ? Sert à griser le bouton. */
  public isConfirmable(): boolean {
    return (
      this.mode === 'placing' &&
      this.ghost !== null &&
      this.world.canPlace(this.ghost.building, this.ghost.tx, this.ghost.ty) === null
    );
  }

  public onDown(sample: PointerSample): boolean {
    if (this.mode === 'idle' || this.pointerId !== null) return false;

    this.pointerId = sample.id;
    this.moveGhost(sample);
    return true;
  }

  public onMove(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;
    this.moveGhost(sample);
  }

  public onUp(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;
    this.pointerId = null;
  }

  private moveGhost(sample: PointerSample): void {
    const building = this.armed;

    if (!building) return;

    const proto = BUILDINGS[building];
    const world = this.screenToWorld(sample.x, sample.y - FINGER_OFFSET_Y);
    // Le doigt vise le centre de l'emprise, pas son coin.
    const tx = Math.round(world.x / TILE_SIZE - proto.width / 2);
    const ty = Math.round(world.y / TILE_SIZE - proto.height / 2);

    if (this.ghost && this.ghost.tx === tx && this.ghost.ty === ty) return;

    this.ghost = { building, tx, ty };
    this.mode = 'placing';
    this.onChange();
  }
}
