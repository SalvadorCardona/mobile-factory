/**
 * Le monde : tout l'état de jeu, et le seul endroit qui le modifie.
 *
 * `World` n'importe ni Pixi, ni le DOM, ni rien de `render/` ou `ui/`. Un test
 * Vitest fait `new World(1234)` puis `world.tick()` en boucle, sans canvas.
 * ESLint fait respecter la frontière, pas la discipline.
 *
 * L'extérieur ne touche jamais l'état directement : il pousse une commande
 * avec `push()`, et le tick suivant la consomme. Une partie se résume donc à
 * une seed et à une liste de commandes horodatées.
 */

import { Emitter } from '../core/events.ts';
import { CHUNK_TILES, TILE_SIZE, distanceSq, floorDiv } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES, type RecipeId } from '../data/recipes.ts';
import { ChunkIndex } from './chunk.ts';
import type { Command, CommandLogEntry, PlacementRejection } from './commands.ts';
import { BUILD_REACH_TILES, createPlayer, stepPlayer } from './player.ts';
import { Scheduler } from './scheduler.ts';
import { Store } from './store.ts';
import { isBuildable, oreAt, terrainAt } from './terrain.ts';
import type { Drill, Entity, EntityId, Player } from './types.ts';

/** 20 ticks de simulation par seconde. */
export const TICKS_PER_SECOND = 20;
export const STEP_MS = 1000 / TICKS_PER_SECOND;
const STEP_SECONDS = 1 / TICKS_PER_SECOND;

/** Recette utilisée par une foreuse. Une seule pour l'instant, cf. `data/recipes.ts`. */
const DRILL_RECIPE: RecipeId = 'mineOre';

export type WorldEvents = {
  buildingPlaced: { id: EntityId; tx: number; ty: number };
  placementRejected: { reason: PlacementRejection };
  drillBlocked: { id: EntityId };
  drillProduced: { id: EntityId; item: ItemId };
};

export class World {
  public readonly seed: number;
  public readonly chunks = new ChunkIndex();
  public readonly entities = new Map<EntityId, Entity>();
  public readonly events = new Emitter<WorldEvents>();
  public readonly player: Player;

  /** Tick courant. Sert d'horodatage aux commandes et de base au scheduler. */
  public tickCount = 0;

  private readonly scheduler = new Scheduler();
  private readonly queue: Command[] = [];
  private readonly log: CommandLogEntry[] = [];
  private nextId: EntityId = 1;
  private moveX = 0;
  private moveY = 0;

  public constructor(seed: number) {
    this.seed = seed >>> 0;
    this.player = createPlayer(...this.findSpawn());
  }

  /* ---------------------------------------------------------------- entrée */

  /**
   * Empile une commande. Appelé par `input/` et `ui/`, jamais par `sim/`.
   * Rien n'est appliqué ici : la commande attend le prochain tick.
   */
  public push(command: Command): void {
    this.queue.push(command);
  }

  /** Journal des commandes : seed + ce journal = la partie rejouable. */
  public commandLog(): readonly CommandLogEntry[] {
    return this.log;
  }

  /* ------------------------------------------------------------------ tick */

  public tick(): void {
    this.tickCount += 1;
    this.drainCommands();
    stepPlayer(this.player, this.moveX, this.moveY, this.seed, STEP_SECONDS);

    for (const id of this.scheduler.due(this.tickCount)) {
      const entity = this.entities.get(id);

      if (entity) this.wake(entity);
    }
  }

  private drainCommands(): void {
    for (const command of this.queue) {
      this.log.push({ tick: this.tickCount, command });
      this.apply(command);
    }
    this.queue.length = 0;
  }

  private apply(command: Command): void {
    switch (command.type) {
      case 'setMoveAxis':
        this.moveX = clamp(command.x, -1, 1);
        this.moveY = clamp(command.y, -1, 1);
        break;

      case 'placeBuilding': {
        const rejection = this.canPlace(command.building, command.tx, command.ty);

        if (rejection) {
          this.events.emit('placementRejected', { reason: rejection });
          break;
        }
        this.place(command.building, command.tx, command.ty);
        break;
      }
    }
  }

  /* ------------------------------------------------------------- placement */

  /**
   * Le placement est-il légal ? Renvoie le motif de refus, ou `null` si oui.
   *
   * Cette fonction est le juge unique : l'aperçu fantôme l'appelle à chaque
   * frame pour se colorer, et le tick l'appelle avant de construire. Deux
   * implémentations qui divergent, c'est un fantôme vert qui refuse de se
   * poser — le genre de bug qui se signale en test utilisateur seulement.
   */
  public canPlace(building: BuildingId, tx: number, ty: number): PlacementRejection | null {
    const proto = BUILDINGS[building];

    for (let y = ty; y < ty + proto.height; y += 1) {
      for (let x = tx; x < tx + proto.width; x += 1) {
        if (!isBuildable(terrainAt(this.seed, x, y))) return 'terrain';
      }
    }

    if (!this.chunks.isFree(tx, ty, proto.width, proto.height)) return 'occupied';

    // Portée mesurée depuis le centre de l'emprise, en distances au carré.
    const centerX = (tx + proto.width / 2) * TILE_SIZE;
    const centerY = (ty + proto.height / 2) * TILE_SIZE;
    const reach = BUILD_REACH_TILES * TILE_SIZE;

    if (distanceSq(this.player.x, this.player.y, centerX, centerY) > reach * reach) {
      return 'outOfReach';
    }

    return null;
  }

  private place(building: BuildingId, tx: number, ty: number): EntityId {
    const proto = BUILDINGS[building];
    const id = this.nextId++;
    const drill: Drill = {
      kind: 'drill',
      id,
      proto: building,
      tx,
      ty,
      width: proto.width,
      height: proto.height,
      store: new Store(proto.storage),
      output: this.oreUnder(tx, ty, proto.width, proto.height),
      blocked: false,
    };

    this.entities.set(id, drill);
    this.chunks.occupy(id, tx, ty, proto.width, proto.height);
    this.events.emit('buildingPlaced', { id, tx, ty });

    // Une foreuse posée à sec ne se planifie pas du tout : zéro coût.
    if (drill.output) this.scheduleDrill(drill);
    else drill.blocked = true;

    return id;
  }

  /** Le premier objet extractible sous l'emprise, ou `null` si aucun gisement. */
  private oreUnder(tx: number, ty: number, width: number, height: number): ItemId | null {
    for (let y = ty; y < ty + height; y += 1) {
      for (let x = tx; x < tx + width; x += 1) {
        const node = oreAt(this.seed, x, y);

        if (node) return node.item;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- réveils */

  private wake(entity: Entity): void {
    switch (entity.kind) {
      case 'drill':
        this.runDrill(entity);
        break;
    }
  }

  /**
   * Un cycle de foreuse.
   *
   * Le point important n'est pas la production, c'est la dernière ligne :
   * quand le coffre est plein, la foreuse **ne se replanifie pas**. Elle
   * disparaît complètement du coût par tick jusqu'à ce que `withdraw()` la
   * réveille. C'est ce qui fait tenir dix mille machines.
   */
  private runDrill(drill: Drill): void {
    const recipe = RECIPES[DRILL_RECIPE];
    const item = drill.output;

    if (!item) {
      drill.blocked = true;
      return;
    }

    // La recette décrit la cadence ; la nature de l'objet vient du gisement.
    const amount = Object.values(recipe.outputs)[0] ?? 1;
    const accepted = drill.store.add(item, amount);

    if (accepted < amount) {
      drill.blocked = true;
      this.events.emit('drillBlocked', { id: drill.id });
      return;
    }

    drill.blocked = false;
    this.events.emit('drillProduced', { id: drill.id, item });
    this.scheduleDrill(drill);
  }

  private scheduleDrill(drill: Drill): void {
    const recipe = RECIPES[DRILL_RECIPE];

    this.scheduler.schedule(drill.id, this.tickCount + recipe.duration, this.tickCount);
  }

  /**
   * Retire des objets du coffre d'un bâtiment et le relance s'il était bloqué.
   *
   * Personne ne l'appelle encore : les porteurs et l'entrepôt sont des tickets
   * suivants. C'est le point d'entrée qu'ils utiliseront, et il est testé —
   * c'est aussi la démonstration que le réveil sur événement fonctionne.
   */
  public withdraw(id: EntityId, item: ItemId, amount: number): number {
    const entity = this.entities.get(id);

    if (!entity) return 0;

    const removed = entity.store.remove(item, amount);

    if (removed > 0 && entity.blocked && entity.output) {
      entity.blocked = false;
      this.scheduleDrill(entity);
    }
    return removed;
  }

  /** Nombre de réveils en attente — affiché dans le HUD de debug. */
  public pendingWakes(): number {
    return this.scheduler.size();
  }

  /* ----------------------------------------------------------------- spawn */

  /**
   * Cherche une tuile constructible près de l'origine, en spirale carrée.
   * Sans ça, une seed qui met de l'eau en (0, 0) fait apparaître le joueur
   * dans un lac dont il ne peut pas sortir.
   */
  private findSpawn(): [number, number] {
    for (let radius = 0; radius < CHUNK_TILES * 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (!isBuildable(terrainAt(this.seed, dx, dy))) continue;

          return [(dx + 0.5) * TILE_SIZE, (dy + 0.5) * TILE_SIZE];
        }
      }
    }
    return [0, 0];
  }

  /** Chunk sous le joueur — pratique pour le HUD et le culling. */
  public playerChunk(): { cx: number; cy: number } {
    return {
      cx: floorDiv(floorDiv(this.player.x, TILE_SIZE), CHUNK_TILES),
      cy: floorDiv(floorDiv(this.player.y, TILE_SIZE), CHUNK_TILES),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
