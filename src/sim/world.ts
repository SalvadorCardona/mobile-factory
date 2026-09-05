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
 *
 * Le pitch tient dans `data/lore.ts` ; ce qu'il implique ici : la partie
 * commence sur le chantier de la mairie, et Adam récolte à mains nues, par
 * **contact** — un arbre ou un rocher heurté se récolte, un chantier heurté
 * reçoit ce qu'il attend.
 */

import { Emitter } from '../core/events.ts';
import { CHUNK_TILES, TILE_SIZE, coordKey, distanceSq, floorDiv } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES, type RecipeId } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';
import { ChunkIndex } from './chunk.ts';
import type { Command, CommandLogEntry, PlacementRejection } from './commands.ts';
import { BUILD_REACH_TILES, createPlayer, playerOverlaps, stepPlayer } from './player.ts';
import { ResourceIndex } from './resources.ts';
import { Scheduler } from './scheduler.ts';
import { Store } from './store.ts';
import { isBuildable, isWalkable, oreAt, terrainAt } from './terrain.ts';
import type { Building, Contact, Drill, Entity, EntityId, Player, Site } from './types.ts';

/** 20 ticks de simulation par seconde. */
export const TICKS_PER_SECOND = 20;
export const STEP_MS = 1000 / TICKS_PER_SECOND;
const STEP_SECONDS = 1 / TICKS_PER_SECOND;

/** Recette utilisée par une foreuse. Une seule pour l'instant, cf. `data/recipes.ts`. */
const DRILL_RECIPE: RecipeId = 'mineOre';

/** Ticks de contact entre deux objets livrés sur un chantier. Court : le chantier se remplit à vue. */
export const DELIVER_TICKS = 2;

/** Le bâtiment que la partie ouvre en chantier au démarrage. */
export const STARTING_BUILDING: BuildingId = 'townHall';

export type WorldEvents = {
  /** Un chantier est ouvert (ou un bâtiment à coût nul, posé fini). */
  buildingPlaced: { id: EntityId; tx: number; ty: number };
  /** Le chantier a reçu son dernier objet : l'entité est devenue le bâtiment, sous le même id. */
  buildingCompleted: { id: EntityId };
  placementRejected: { reason: PlacementRejection };
  drillBlocked: { id: EntityId };
  drillProduced: { id: EntityId; item: ItemId };
  /** Adam a arraché une unité à la tuile. `remaining` à 0 : elle a disparu. */
  resourceHarvested: { tx: number; ty: number; item: ItemId; remaining: number };
  /** Un objet du sac vient d'être posé sur le chantier. `missing` : ce qui manque encore, tous objets confondus. */
  siteDelivered: { id: EntityId; item: ItemId; missing: number };
  /** Le sac est plein : la récolte s'arrête, il faut aller livrer. */
  inventoryFull: Record<string, never>;
};

export class World {
  public readonly seed: number;
  public readonly chunks = new ChunkIndex();
  public readonly resources: ResourceIndex;
  public readonly entities = new Map<EntityId, Entity>();
  public readonly events = new Emitter<WorldEvents>();
  public readonly player: Player;

  /** Le chantier puis la mairie : l'objectif de départ. */
  public readonly townHallId: EntityId;

  /** Tick courant. Sert d'horodatage aux commandes et de base au scheduler. */
  public tickCount = 0;

  private readonly scheduler = new Scheduler();
  private readonly queue: Command[] = [];
  private readonly log: CommandLogEntry[] = [];
  private nextId: EntityId = 1;
  private moveX = 0;
  private moveY = 0;

  /** Tuile contre laquelle Adam pousse, et depuis combien de ticks. */
  private contactKey = '';
  private contactTicks = 0;

  public constructor(seed: number) {
    this.seed = seed >>> 0;
    this.resources = new ResourceIndex(this.seed);

    const [sx, sy] = this.findSpawn();
    const proto = BUILDINGS[STARTING_BUILDING];

    // La clairière : la mairie au-dessus, Adam en dessous, et rien qui gêne.
    for (let ty = sy - proto.height; ty <= sy + 2; ty += 1) {
      for (let tx = sx - 2; tx <= sx + 2; tx += 1) {
        this.resources.clear(tx, ty);
      }
    }

    this.player = createPlayer((sx + 0.5) * TILE_SIZE, (sy + 1.5) * TILE_SIZE);
    this.townHallId = this.openSite(STARTING_BUILDING, sx - 1, sy - proto.height);
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

    const contact = stepPlayer(this.player, this.moveX, this.moveY, this.isSolid, STEP_SECONDS);

    this.handleContact(contact);

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
        this.openSite(command.building, command.tx, command.ty);
        break;
      }
    }
  }

  /* -------------------------------------------------------------- collision */

  /**
   * Une tuile est solide si on ne peut pas y marcher : eau, ressource de
   * surface encore debout, ou emprise d'un bâtiment — chantier compris.
   * Fonction fléchée : elle est passée telle quelle à `stepPlayer`.
   */
  public readonly isSolid = (tx: number, ty: number): boolean =>
    !isWalkable(terrainAt(this.seed, tx, ty)) ||
    this.resources.isSolid(tx, ty) ||
    this.chunks.occupantAt(tx, ty) !== undefined;

  /* ---------------------------------------------------------------- contact */

  /**
   * Le contact est **la** mécanique du jeu : Adam n'a pas de bouton d'action.
   * Il pousse contre quelque chose, et selon ce que c'est, il récolte ou il
   * livre. Le compteur repart à zéro dès qu'il change de cible ou s'écarte,
   * pour qu'on ne puisse pas « charger » une récolte contre un mur.
   */
  private handleContact(contact: Contact | null): void {
    if (!contact) {
      this.contactKey = '';
      this.contactTicks = 0;
      return;
    }

    const key = coordKey(contact.tx, contact.ty);

    if (key !== this.contactKey) {
      this.contactKey = key;
      this.contactTicks = 0;
    }
    this.contactTicks += 1;

    const resource = this.resources.at(contact.tx, contact.ty);

    if (resource) {
      if (this.contactTicks % RESOURCES[resource.id].harvestTicks === 0) {
        this.harvest(contact.tx, contact.ty);
      }
      return;
    }

    const occupant = this.chunks.occupantAt(contact.tx, contact.ty);
    const entity = occupant === undefined ? undefined : this.entities.get(occupant);

    if (entity?.kind === 'site' && this.contactTicks % DELIVER_TICKS === 0) {
      this.deliver(entity);
    }
  }

  private harvest(tx: number, ty: number): void {
    const { inventory } = this.player;

    if (inventory.freeSpace() <= 0) {
      this.events.emit('inventoryFull', {});
      return;
    }

    const taken = this.resources.take(tx, ty);

    if (!taken) return;

    const item = RESOURCES[taken.resource.id].item;

    inventory.add(item, 1);

    // Le chunk ne rebake que si l'aspect de la tuile change : entamé, ou disparu.
    if (taken.stageChanged) this.dirtyTile(tx, ty);

    this.events.emit('resourceHarvested', { tx, ty, item, remaining: taken.resource.remaining });
  }

  /** Pose un objet du sac sur le chantier — le premier qui manque et qu'Adam possède. */
  private deliver(site: Site): void {
    const cost = BUILDINGS[site.proto].cost;
    const { inventory } = this.player;

    for (const [item, needed] of Object.entries(cost) as [ItemId, number][]) {
      const delivered = site.delivered[item] ?? 0;

      if (delivered >= needed || inventory.count(item) === 0) continue;

      inventory.remove(item, 1);
      site.delivered[item] = delivered + 1;

      const missing = siteMissing(site);

      this.events.emit('siteDelivered', { id: site.id, item, missing });

      if (missing === 0) this.complete(site);
      return;
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

    for (let y = ty; y < ty + proto.height; y += 1) {
      for (let x = tx; x < tx + proto.width; x += 1) {
        if (this.resources.isSolid(x, y)) return 'resource';
      }
    }

    // Un bâtiment est solide : le poser sur Adam l'emmurerait.
    if (playerOverlaps(this.player, tx, ty, proto.width, proto.height)) return 'onPlayer';

    // Portée mesurée depuis le centre de l'emprise, en distances au carré.
    const centerX = (tx + proto.width / 2) * TILE_SIZE;
    const centerY = (ty + proto.height / 2) * TILE_SIZE;
    const reach = BUILD_REACH_TILES * TILE_SIZE;

    if (distanceSq(this.player.x, this.player.y, centerX, centerY) > reach * reach) {
      return 'outOfReach';
    }

    return null;
  }

  /** Réserve l'emprise et ouvre le chantier. Un coût vide le termine sur-le-champ. */
  private openSite(building: BuildingId, tx: number, ty: number): EntityId {
    const proto = BUILDINGS[building];
    const id = this.nextId++;
    const site: Site = {
      kind: 'site',
      id,
      proto: building,
      tx,
      ty,
      width: proto.width,
      height: proto.height,
      delivered: {},
    };

    this.entities.set(id, site);
    this.chunks.occupy(id, tx, ty, proto.width, proto.height);
    this.events.emit('buildingPlaced', { id, tx, ty });

    if (siteMissing(site) === 0) this.complete(site);

    return id;
  }

  /** Le chantier devient le bâtiment, sous le même id : le rendu n'a qu'à changer de texture. */
  private complete(site: Site): void {
    const proto = BUILDINGS[site.proto];
    const base = { id: site.id, proto: site.proto, tx: site.tx, ty: site.ty, width: site.width, height: site.height };
    let building: Building;

    switch (proto.kind) {
      case 'drill':
        building = {
          ...base,
          kind: 'drill',
          store: new Store(proto.storage),
          output: this.oreUnder(site.tx, site.ty, site.width, site.height),
          blocked: false,
        };
        break;

      case 'townHall':
        building = { ...base, kind: 'townHall', store: new Store(proto.storage) };
        break;
    }

    this.entities.set(site.id, building);
    this.dirtyTile(site.tx, site.ty);
    this.events.emit('buildingCompleted', { id: site.id });

    // Une foreuse posée à sec ne se planifie pas du tout : zéro coût.
    if (building.kind === 'drill') {
      if (building.output) this.scheduleDrill(building);
      else building.blocked = true;
    }
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

  private dirtyTile(tx: number, ty: number): void {
    this.chunks.get(floorDiv(tx, CHUNK_TILES), floorDiv(ty, CHUNK_TILES)).dirty = true;
  }

  /* ---------------------------------------------------------------- réveils */

  private wake(entity: Entity): void {
    switch (entity.kind) {
      case 'drill':
        this.runDrill(entity);
        break;

      case 'site':
      case 'townHall':
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
   * Personne ne l'appelle encore : les porteurs sont un ticket suivant. C'est
   * le point d'entrée qu'ils utiliseront, et il est testé — c'est aussi la
   * démonstration que le réveil sur événement fonctionne.
   */
  public withdraw(id: EntityId, item: ItemId, amount: number): number {
    const entity = this.entities.get(id);

    if (!entity || entity.kind === 'site') return 0;

    const removed = entity.store.remove(item, amount);

    if (removed > 0 && entity.kind === 'drill' && entity.blocked && entity.output) {
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
   * Cherche, en spirale carrée depuis l'origine, une clairière de 5 × 6 tuiles
   * entièrement constructible : la mairie (3 × 3) en haut, Adam en dessous,
   * une tuile de marge autour. Sans ça, une seed qui met de l'eau en (0, 0)
   * fait apparaître le joueur dans un lac dont il ne peut pas sortir — ou la
   * mairie les pieds dedans.
   *
   * Renvoie la tuile sous la mairie, celle où Adam se tient.
   */
  private findSpawn(): [number, number] {
    const { height } = BUILDINGS[STARTING_BUILDING];

    for (let radius = 0; radius < CHUNK_TILES * 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (this.isClearing(dx, dy, height)) return [dx, dy];
        }
      }
    }
    return [0, 0];
  }

  private isClearing(sx: number, sy: number, height: number): boolean {
    for (let ty = sy - height; ty <= sy + 2; ty += 1) {
      for (let tx = sx - 2; tx <= sx + 2; tx += 1) {
        if (!isBuildable(terrainAt(this.seed, tx, ty))) return false;
      }
    }
    return true;
  }

  /** Chunk sous le joueur — pratique pour le HUD et le culling. */
  public playerChunk(): { cx: number; cy: number } {
    return {
      cx: floorDiv(floorDiv(this.player.x, TILE_SIZE), CHUNK_TILES),
      cy: floorDiv(floorDiv(this.player.y, TILE_SIZE), CHUNK_TILES),
    };
  }
}

/** Ce qu'il manque encore à un chantier, tous objets confondus. */
export function siteMissing(site: Site): number {
  let missing = 0;

  for (const [item, needed] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    missing += Math.max(0, needed - (site.delivered[item] ?? 0));
  }
  return missing;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
