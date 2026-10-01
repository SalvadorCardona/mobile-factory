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
 * Poser ramène à `idle` : Adam doit pouvoir marcher tout de suite, une
 * attaque n'attend pas qu'on ait trouvé « Annuler ». Pour enchaîner trois
 * foreuses, « Poser encore » valide et reste armé.
 *
 * Un **tap** fait sauter le fantôme là où le doigt s'est levé ; un **glissé**
 * le promène sous le doigt. Le joystick n'a pas à se battre avec lui : il
 * vit dans le DOM, au-dessus du canvas, et garde ses doigts — on déplace
 * donc Adam au pouce pendant qu'on vise de l'autre main.
 *
 * **À la souris** (mode PC, décidé par `pointerType`, jamais par la taille
 * d'écran), le premier tap n'a plus de raison d'être : le curseur ne cache
 * rien et vise au pixel. Le fantôme suit donc le survol, calé sur la grille
 * et sans décalage de doigt ; un clic gauche pose s'il est posable (sinon
 * `onRefuse`, et rien n'est posé), un clic droit annule. Le tactile ne passe
 * par aucune de ces branches.
 *
 * **La route** n'est pas un bâtiment : c'est un tracé. Armée (`selectRoad`),
 * le doigt glisse de tuile en tuile et laisse derrière lui un fantôme de
 * dalles (`trail`), sans diagonale ; revenir en arrière efface la dernière
 * tuile. Le tracé s'arrête à `ROADS.maxTiles`. Au doigt, « Poser » pave
 * ensuite le tracé, comme pour un bâtiment ; à la souris, on maintient le
 * clic et on glisse, et le relâcher pave. Le même tracé, outil `remove`, est
 * le marteau : il retire les dalles qu'il couvre.
 *
 * Rien n'est modifié dans le monde ici : la validation pousse une commande
 * `placeBuilding`, `paveRoad` ou `removeRoad` que le tick consomme.
 */

import { TILE_SIZE, floorDiv, type TileCoord } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ROADS } from '../data/roads.ts';
import { stepsBetween } from '../sim/roads.ts';
import type { PlacementBlock, World } from '../sim/world.ts';
import { TAP_SLOP, type PointerConsumer, type PointerSample } from './pointer.ts';

export interface GhostState {
  building: BuildingId;
  /** Tuile d'origine (coin haut-gauche de l'emprise). */
  tx: number;
  ty: number;
  /** Le fantôme suit un curseur de souris : le rendu le fait respirer. */
  follow: boolean;
}

export type PlacementMode = 'idle' | 'armed' | 'placing';

/** L'outil route : paver, ou retirer au marteau. */
export type RoadTool = 'pave' | 'remove';

/** Le tracé de route en cours : l'outil, et les tuiles dans l'ordre du doigt. */
export interface RoadTrail {
  tool: RoadTool;
  tiles: readonly TileCoord[];
}

/**
 * Décalage vertical du fantôme au-dessus du doigt, en pixels CSS.
 * Sans lui le pouce cache exactement ce qu'on essaie de viser.
 */
const FINGER_OFFSET_Y = 44;

export class Placement implements PointerConsumer {
  public mode: PlacementMode = 'idle';
  public ghost: GhostState | null = null;

  /** Bâtiment choisi dans le menu ; conservé après une pose seulement par « Poser encore ». */
  private armed: BuildingId | null = null;
  /** L'outil route armé, à la place d'un bâtiment ; `null` sinon. */
  private road: RoadTool | null = null;
  /** Les tuiles du tracé de route, dans l'ordre du doigt. */
  private trail: TileCoord[] = [];
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  /** Le doigt a dépassé `TAP_SLOP` : ce n'est plus un tap. */
  private dragging = false;

  private readonly world: World;
  private readonly screenToWorld: (x: number, y: number) => { x: number; y: number };
  private readonly onChange: () => void;
  private readonly onRefuse: () => void;

  /** `onRefuse` : un clic de souris sur un emplacement refusé — un son, une secousse, rien de posé. */
  public constructor(
    world: World,
    screenToWorld: (x: number, y: number) => { x: number; y: number },
    onChange: () => void,
    onRefuse: () => void = () => {},
  ) {
    this.world = world;
    this.screenToWorld = screenToWorld;
    this.onChange = onChange;
    this.onRefuse = onRefuse;
  }

  /** Le curseur survole la carte sans bouton enfoncé : le fantôme le suit. */
  public hover(sample: PointerSample): void {
    if (this.mode === 'idle' || this.pointerId !== null || !sample.mouse) return;
    if (this.road) {
      // À la souris, la dalle sous le curseur dit où partira le tracé.
      this.startTrail(sample);
      return;
    }
    this.moveGhost(sample);
  }

  /** Le menu de construction a choisi un bâtiment. Un second appui désarme. */
  public select(building: BuildingId): void {
    if (this.armed === building) {
      this.cancel();
      return;
    }
    this.armed = building;
    this.road = null;
    this.trail = [];
    this.mode = 'armed';
    this.ghost = null;
    this.onChange();
  }

  /** Le menu a choisi la route — paver, ou retirer au marteau. Un tracé en cours change d'outil sans s'effacer. */
  public selectRoad(tool: RoadTool): void {
    this.armed = null;
    this.ghost = null;
    this.road = tool;
    if (this.trail.length === 0) this.mode = 'armed';
    this.onChange();
  }

  /** L'outil route armé, ou `null`. */
  public roadTool(): RoadTool | null {
    return this.road;
  }

  /** Le tracé de route en cours, ou `null` hors du mode route ou avant le premier doigt. */
  public roadTrail(): RoadTrail | null {
    return this.road && this.trail.length > 0 ? { tool: this.road, tiles: this.trail } : null;
  }

  /** Bâtiment actuellement armé, ou `null`. Le menu s'en sert pour s'allumer. */
  public armedBuilding(): BuildingId | null {
    return this.armed;
  }

  public cancel(): void {
    this.mode = 'idle';
    this.armed = null;
    this.road = null;
    this.trail = [];
    this.ghost = null;
    this.pointerId = null;
    this.onChange();
  }

  /**
   * Le bouton de confirmation. Seul chemin vers une construction réelle.
   * `again` : « Poser encore », on reste armé sur le même bâtiment.
   */
  public confirm(again = false): void {
    if (this.road) {
      this.confirmRoad(again);
      return;
    }
    if (this.mode !== 'placing' || !this.ghost) return;

    this.world.push({
      type: 'placeBuilding',
      building: this.ghost.building,
      tx: this.ghost.tx,
      ty: this.ghost.ty,
    });

    if (!again) {
      this.cancel();
      return;
    }
    this.mode = 'armed';
    this.ghost = null;
    this.onChange();
  }

  /** Pave, ou retire, le tracé ; `again` garde l'outil armé pour un tracé suivant. */
  private confirmRoad(again: boolean): void {
    const tool = this.road;

    if (!tool || this.trail.length === 0) return;

    this.world.push({ type: tool === 'pave' ? 'paveRoad' : 'removeRoad', tiles: [...this.trail] });

    if (!again) {
      this.cancel();
      return;
    }
    this.trail = [];
    this.mode = 'armed';
    this.onChange();
  }

  /** Le fantôme est-il posable là où il est ? Sert à griser le bouton. */
  public isConfirmable(): boolean {
    if (this.road) return this.roadConfirmable();
    return this.mode === 'placing' && this.ghost !== null && this.block() === null;
  }

  /** Un tracé vaut d'être confirmé s'il pave au moins une tuile — ou, au marteau, s'il couvre une dalle. */
  private roadConfirmable(): boolean {
    if (this.trail.length === 0) return false;
    if (this.road === 'remove') return this.trail.some(({ tx, ty }) => this.world.roads.has(tx, ty));
    return this.world.roadPlan(this.trail).some((step) => step.state === 'pave');
  }

  /** Pourquoi le fantôme n'est pas posable, et quelles cases bloquent ; `null` s'il l'est ou s'il n'y a pas de fantôme. */
  public block(): PlacementBlock | null {
    const ghost = this.ghost;

    if (this.mode !== 'placing' || !ghost) return null;
    return this.world.placementBlock(ghost.building, ghost.tx, ghost.ty);
  }

  public onDown(sample: PointerSample): boolean {
    if (this.mode === 'idle' || this.pointerId !== null) return false;

    // Clic droit, ou tout autre bouton que le gauche : jamais une pose.
    if (sample.mouse && sample.button !== undefined && sample.button !== 0) {
      if (sample.button === 2) this.cancel();
      return true;
    }

    this.pointerId = sample.id;
    this.startX = sample.x;
    this.startY = sample.y;
    this.dragging = false;
    // Un nouveau doigt part d'un nouveau tracé, là où il se pose.
    if (this.road) this.startTrail(sample);
    return true;
  }

  public onMove(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;

    if (this.road) {
      this.extendTrail(sample);
      return;
    }

    if (!this.dragging) {
      if (Math.hypot(sample.x - this.startX, sample.y - this.startY) <= TAP_SLOP) return;
      this.dragging = true;
    }
    this.moveGhost(sample);
  }

  public onUp(sample: PointerSample): void {
    if (sample.id !== this.pointerId) return;
    this.pointerId = null;
    if (this.road) {
      // À la souris, relâcher le clic pave ; au doigt, « Poser » le fera.
      if (!sample.mouse) return;
      if (this.isConfirmable()) this.confirmRoad(true);
      else this.onRefuse();
      return;
    }
    if (this.dragging) return;
    // Un tap pose le fantôme là où le doigt s'est levé.
    this.moveGhost(sample);
    // Un clic, lui, construit : le fantôme était déjà sous le curseur.
    if (!sample.mouse) return;
    if (this.isConfirmable()) this.confirm();
    else this.onRefuse();
  }

  /** La tuile visée : au-dessus du doigt, sous le curseur. */
  private tileAt(sample: PointerSample): TileCoord {
    const world = this.screenToWorld(sample.x, sample.y - (sample.mouse === true ? 0 : FINGER_OFFSET_Y));

    return { tx: floorDiv(world.x, TILE_SIZE), ty: floorDiv(world.y, TILE_SIZE) };
  }

  private startTrail(sample: PointerSample): void {
    const tile = this.tileAt(sample);
    const [only] = this.trail;

    if (this.trail.length === 1 && only?.tx === tile.tx && only.ty === tile.ty) return;
    this.trail = [tile];
    this.mode = 'placing';
    this.onChange();
  }

  /**
   * Le doigt a glissé : le tracé le rejoint tuile à tuile, sans diagonale.
   * Revenir sur l'avant-dernière tuile efface la dernière ; repasser sur une
   * tuile déjà tracée ne la compte pas deux fois.
   */
  private extendTrail(sample: PointerSample): void {
    const tile = this.tileAt(sample);
    const last = this.trail.at(-1);

    if (!last || (last.tx === tile.tx && last.ty === tile.ty)) return;

    let changed = false;

    for (const step of stepsBetween(last, tile)) {
      const back = this.trail.at(-2);

      if (back && back.tx === step.tx && back.ty === step.ty) {
        this.trail.pop();
        changed = true;
        continue;
      }
      if (this.trail.length >= ROADS.maxTiles) break;
      if (this.trail.some(({ tx, ty }) => tx === step.tx && ty === step.ty)) continue;
      this.trail.push(step);
      changed = true;
    }
    if (changed) this.onChange();
  }

  private moveGhost(sample: PointerSample): void {
    const building = this.armed;

    if (!building) return;

    const proto = BUILDINGS[building];
    const follow = sample.mouse === true;
    // Le curseur ne cache rien : il vise là où il est.
    const world = this.screenToWorld(sample.x, sample.y - (follow ? 0 : FINGER_OFFSET_Y));
    // Le doigt (ou le curseur) vise le centre de l'emprise, pas son coin.
    const tx = Math.round(world.x / TILE_SIZE - proto.width / 2);
    const ty = Math.round(world.y / TILE_SIZE - proto.height / 2);

    if (this.ghost && this.ghost.tx === tx && this.ghost.ty === ty && this.ghost.follow === follow) return;

    this.ghost = { building, tx, ty, follow };
    this.mode = 'placing';
    this.onChange();
  }
}
