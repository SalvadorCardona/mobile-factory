/**
 * Le monde : tout l'état de jeu, et le seul endroit qui le modifie.
 *
 * `World` n'importe ni Pixi, ni le DOM, ni rien de `render/` ou `ui/`. Un test
 * Vitest fait `new World(1234)` puis `world.tick()` en boucle, sans canvas.
 * ESLint fait respecter la frontière, pas la discipline.
 *
 * L'extérieur ne touche jamais l'état directement : il pousse une commande
 * avec `push()`, et le tick suivant la consomme. Une partie se résume donc à
 * une seed et à une liste de commandes horodatées. Le PRNG des vagues et des
 * enfants vit ici et n'avance qu'au tick : il fait partie de cette promesse.
 *
 * Le pitch tient dans `data/lore.ts` ; ce qu'il implique ici : la partie
 * commence sur le chantier de la mairie, et Adam récolte à mains nues, par
 * **contact** — un arbre ou un rocher heurté se récolte, un chantier heurté
 * reçoit ce qu'il attend, une foreuse ou une ferme heurtée donne ce que son
 * coffre contient. Une fois la mairie debout, les mutants arrivent par
 * vagues et marchent droit dessus ; l'arc d'Adam et les tours de guet tirent
 * seuls. Si la mairie tombe, la partie est perdue. Loin du village, la faune
 * — crabes sur les plages, loups en forêt — s'en prend à Adam s'il approche.
 */

import { Emitter } from '../core/events.ts';
import { CHUNK_TILES, TILE_SIZE, coordKey, distanceSq, floorDiv } from '../core/grid.ts';
import { mulberry32, type StatefulRng } from '../core/rng.ts';
import { BUILDINGS, NURSERY_BIRTH_TICKS, type BuildingId } from '../data/buildings.ts';
import { ENEMIES, WAVES, WILDLIFE, WILDLIFE_SPAWN, waveSize } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES, type RecipeId } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';
import { WEAPONS } from '../data/weapons.ts';
import { ChunkIndex } from './chunk.ts';
import { nearestFoe, shoot, stepArrow } from './combat.ts';
import type { Command, CommandLogEntry, PlacementRejection, SiteRejection, TakeRejection } from './commands.ts';
import type { WildlifeId } from '../data/enemies.ts';
import { spawnPoint, stepMutant } from './enemies.ts';
import { stepKid } from './kids.ts';
import { denSize, densOfChunk, stepBeast, type Den } from './wildlife.ts';
import { facingOf } from './motion.ts';
import {
  BUILD_REACH_TILES,
  PLAYER_CALM_TICKS,
  PLAYER_MAX_HP,
  PLAYER_REGEN_TICKS,
  createPlayer,
  playerOverlaps,
  stepPlayer,
} from './player.ts';
import { ResourceIndex } from './resources.ts';
import type { SavedEntity, WorldState } from './save.ts';
import { Scheduler } from './scheduler.ts';
import { Store } from './store.ts';
import { findSpawn, habitatAt, isBuildable, isWalkable, oreAt, terrainAt } from './terrain.ts';
import type {
  Beast,
  Building,
  Contact,
  Drill,
  Entity,
  EntityId,
  Farm,
  Foe,
  Kid,
  Mobile,
  MobileId,
  Mutant,
  Nursery,
  Player,
  Site,
  Tower,
} from './types.ts';

/** 20 ticks de simulation par seconde. */
export const TICKS_PER_SECOND = 20;
export const STEP_MS = 1000 / TICKS_PER_SECOND;
const STEP_SECONDS = 1 / TICKS_PER_SECOND;

/** Recette utilisée par une foreuse. Une seule pour l'instant, cf. `data/recipes.ts`. */
const DRILL_RECIPE: RecipeId = 'mineOre';

/** Recette d'une ferme. */
const FARM_RECIPE: RecipeId = 'growFood';

/** Ticks de contact entre deux objets livrés sur un chantier. Court : le chantier se remplit à vue. */
export const DELIVER_TICKS = 2;

/** Secondes annoncées avant chaque vague. */
const WAVE_COUNTDOWN_SECONDS = 3;

/** Le bâtiment que la partie ouvre en chantier au démarrage. */
export const STARTING_BUILDING: BuildingId = 'townHall';

/**
 * Id de réveil réservé aux vagues de mutants. Les entités commencent à 1 :
 * le scheduler ne fait pas la différence, `wake()` si.
 */
const WAVE_WAKE_ID = 0;

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
  /** `amount` objets du sac viennent d'être posés sur le chantier. `missing` : ce qui manque encore, tous objets confondus. */
  siteDelivered: { id: EntityId; item: ItemId; amount: number; missing: number };
  /** Le chantier a tout reçu : il attend que le joueur appuie sur « Construire ». */
  siteReady: { id: EntityId };
  /** Une commande sur un chantier a été refusée. */
  siteRejected: { id: EntityId; reason: SiteRejection };
  /** La ferme a récolté. */
  farmProduced: { id: EntityId; item: ItemId };
  /** Adam a pris `amount` objets dans le coffre d'une foreuse ou d'une ferme. */
  storeTaken: { id: EntityId; item: ItemId; amount: number };
  /** Un « Prendre » a été refusé. */
  takeRejected: { id: EntityId; reason: TakeRejection };
  /** Le sac est plein : la récolte s'arrête, il faut aller livrer. */
  inventoryFull: Record<string, never>;
  /** Plus que `seconds` secondes avant la prochaine vague (3, 2, puis 1). */
  waveCountdown: { seconds: number };
  /** Une vague de mutants vient d'apparaître autour de la mairie. */
  waveStarted: { wave: number; count: number };
  /** Un arc a tiré, depuis (x, y). */
  arrowShot: { x: number; y: number };
  /** Une flèche a touché un mutant ; `hp` est ce qui lui reste. */
  mutantHit: { id: MobileId; hp: number; x: number; y: number };
  mutantDied: { id: MobileId; x: number; y: number };
  /** Un mutant a frappé un bâtiment ; `hp` est ce qui lui reste. */
  buildingDamaged: { id: EntityId; hp: number };
  /** Le bâtiment est tombé à zéro : il n'existe plus. */
  buildingDestroyed: { id: EntityId; proto: BuildingId; tx: number; ty: number };
  /** La mairie est tombée : la partie est perdue. */
  townHallDestroyed: Record<string, never>;
  /** Une flèche a touché une bête ; `hp` est ce qui lui reste. */
  beastHit: { id: MobileId; proto: WildlifeId; hp: number; x: number; y: number };
  /** Une bête est tombée ; `loot` est ce qui est allé dans le sac, s'il y avait la place. */
  beastDied: { id: MobileId; proto: WildlifeId; x: number; y: number; loot: ItemId | null };
  /** Une bête a frappé Adam ; `hp` est ce qui lui reste. */
  playerHurt: { by: MobileId; hp: number };
  /** Adam est tombé : il se réveille à la mairie, remis sur pied. */
  playerKnockedOut: { x: number; y: number };
  /** La nurserie a produit un enfant. */
  childBorn: { nurseryId: EntityId; kidId: MobileId; x: number; y: number };
};

export class World {
  public readonly seed: number;
  public readonly chunks = new ChunkIndex();
  public readonly resources: ResourceIndex;
  public readonly entities = new Map<EntityId, Entity>();
  public readonly mobiles = new Map<MobileId, Mobile>();
  public readonly events = new Emitter<WorldEvents>();
  public readonly player: Player;

  /** Le chantier puis la mairie : l'objectif de départ, et la cible des mutants. */
  public readonly townHallId: EntityId;

  /** Tick courant. Sert d'horodatage aux commandes et de base au scheduler. */
  public tickCount = 0;

  /** Numéro de la dernière vague apparue ; 0 tant que la mairie est en chantier. */
  public wave = 0;

  /** Vrai une fois la mairie détruite. La simulation continue, les vagues s'arrêtent. */
  public defeated = false;

  /** Tick d'apparition de la prochaine vague ; 0 tant qu'aucune n'est planifiée. */
  public nextWaveTick = 0;

  /** Mutants abattus depuis le début de la partie — le score de l'écran de fin. */
  public kills = 0;

  /** Tick où la mairie est tombée ; 0 tant qu'elle tient. */
  public defeatTick = 0;

  private readonly scheduler = new Scheduler();
  private readonly queue: Command[] = [];
  private readonly log: CommandLogEntry[] = [];
  private rng: StatefulRng;
  private nextId: EntityId = 1;
  private nextMobileId: MobileId = 1;
  private moveX = 0;
  private moveY = 0;

  /** Tuile contre laquelle Adam pousse, et depuis combien de ticks. */
  private contactKey = '';
  private contactTicks = 0;

  /** Centre de la mairie en pixels monde : ce que les mutants visent. */
  private readonly target: { x: number; y: number };

  /** Où Adam s'est éveillé au début de la partie : il s'y réveille s'il tombe et que la mairie n'est plus. */
  private readonly spawnX: number;
  private readonly spawnY: number;

  /**
   * Les tanières habitées, ou vidées par l'arc : seules les tanières qui ont
   * servi sont de l'état. Les autres se relisent dans la seed.
   */
  private readonly dens = new Map<number, { members: number; readyTick: number }>();

  /** Cache des tanières par chunk : un calcul pur, gardé pour ne pas le refaire à chaque passage. */
  private readonly denCache = new Map<string, Den[]>();

  public constructor(seed: number) {
    this.seed = seed >>> 0;
    this.resources = new ResourceIndex(this.seed);
    this.rng = mulberry32(this.seed ^ 0x3c6ef372);

    const [sx, sy] = findSpawn(this.seed);
    const proto = BUILDINGS[STARTING_BUILDING];

    // La clairière : la mairie au-dessus, Adam en dessous, et rien qui gêne.
    for (let ty = sy - proto.height; ty <= sy + 2; ty += 1) {
      for (let tx = sx - 2; tx <= sx + 2; tx += 1) {
        this.resources.clear(tx, ty);
      }
    }

    this.spawnX = (sx + 0.5) * TILE_SIZE;
    this.spawnY = (sy + 1.5) * TILE_SIZE;
    this.player = createPlayer(this.spawnX, this.spawnY);
    this.townHallId = this.openSite(STARTING_BUILDING, sx - 1, sy - proto.height);
    this.target = { x: (sx + 0.5) * TILE_SIZE, y: (sy - proto.height / 2) * TILE_SIZE };
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

  /* ------------------------------------------------------------ sauvegarde */

  /**
   * L'état complet, en données JSON, pris entre deux ticks. Ce qui se
   * régénère depuis la seed n'y est pas ; les commandes pas encore consommées
   * non plus — la sauvegarde se prend quand la file est vide.
   */
  public snapshot(): WorldState {
    const { inventory, ...player } = this.player;

    return {
      seed: this.seed,
      tick: this.tickCount,
      rng: this.rng.state(),
      nextId: this.nextId,
      nextMobileId: this.nextMobileId,
      moveX: this.moveX,
      moveY: this.moveY,
      contactKey: this.contactKey,
      contactTicks: this.contactTicks,
      wave: this.wave,
      nextWaveTick: this.nextWaveTick,
      kills: this.kills,
      defeated: this.defeated,
      defeatTick: this.defeatTick,
      player: { ...player, inventory: inventory.toJSON() },
      resources: this.resources.toJSON(),
      entities: [...this.entities.values()].map(saveEntity),
      mobiles: [...this.mobiles.values()].map((mobile) => ({ ...mobile })),
      dens: [...this.dens].map(([id, den]) => ({ id, ...den })),
      scheduler: this.scheduler.toJSON(this.tickCount),
    };
  }

  /**
   * Le monde d'une sauvegarde. La seed refait la carte, la clairière et la
   * cible des mutants ; l'état sauvegardé remplace ensuite tout le reste.
   * `state` doit avoir été validé (`sim/save.ts`).
   */
  public static restore(state: WorldState): World {
    const world = new World(state.seed);

    world.load(state);
    return world;
  }

  private load(state: WorldState): void {
    // Le chantier de départ ouvert par le constructeur laisse la place à ceux de la sauvegarde.
    for (const entity of this.entities.values()) {
      this.chunks.release(entity.id, entity.tx, entity.ty, entity.width, entity.height);
    }
    this.entities.clear();

    this.tickCount = state.tick;
    this.rng = mulberry32(state.rng);
    this.nextId = state.nextId;
    this.nextMobileId = state.nextMobileId;
    this.moveX = state.moveX;
    this.moveY = state.moveY;
    this.contactKey = state.contactKey;
    this.contactTicks = state.contactTicks;
    this.wave = state.wave;
    this.nextWaveTick = state.nextWaveTick;
    this.kills = state.kills;
    this.defeated = state.defeated;
    this.defeatTick = state.defeatTick;

    const { inventory, ...player } = state.player;

    Object.assign(this.player, player, { inventory: Store.fromJSON(this.player.inventory.capacity, inventory) });
    this.resources.restore(state.resources);

    for (const saved of state.entities) {
      const entity: Entity =
        saved.kind === 'site'
          ? { ...saved, delivered: { ...saved.delivered } }
          : { ...saved, store: Store.fromJSON(BUILDINGS[saved.proto].storage, saved.store) };

      this.entities.set(entity.id, entity);
      this.chunks.occupy(entity.id, entity.tx, entity.ty, entity.width, entity.height);
    }

    this.mobiles.clear();
    for (const mobile of state.mobiles) this.mobiles.set(mobile.id, { ...mobile });

    this.dens.clear();
    for (const { id, members, readyTick } of state.dens) this.dens.set(id, { members, readyTick });

    this.scheduler.restore(state.scheduler);
  }

  /* ------------------------------------------------------------------ tick */

  public tick(): void {
    this.tickCount += 1;
    this.drainCommands();

    const contact = stepPlayer(this.player, this.moveX, this.moveY, this.isSolid, STEP_SECONDS);

    this.handleContact(contact);
    this.announceWave();
    this.stepMobiles();
    this.recover();
    this.stepWildlife();
    this.shootPlayerBow();

    for (const id of this.scheduler.due(this.tickCount)) {
      if (id === WAVE_WAKE_ID) {
        this.spawnWave();
        continue;
      }

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

      case 'transferToSite':
        this.transfer(command.id);
        break;

      case 'buildSite':
        this.build(command.id);
        break;

      case 'takeFromBuilding':
        this.takeAll(command.id);
        break;
    }
  }

  /* ---------------------------------------------------------------- chantier */

  /** Le chantier existe-t-il encore, et Adam est-il à portée ? */
  private siteFor(id: EntityId): { site: Site } | { reason: SiteRejection } {
    const entity = this.entities.get(id);

    if (entity?.kind !== 'site') return { reason: 'missing' };
    if (!this.inReach(entity)) return { reason: 'outOfReach' };
    return { site: entity };
  }

  /** Adam est-il assez près de l'emprise pour y travailler ? Même portée que le placement. */
  public inReach(entity: Entity): boolean {
    const centerX = (entity.tx + entity.width / 2) * TILE_SIZE;
    const centerY = (entity.ty + entity.height / 2) * TILE_SIZE;
    const reach = BUILD_REACH_TILES * TILE_SIZE;

    return distanceSq(this.player.x, this.player.y, centerX, centerY) <= reach * reach;
  }

  /** Tout ce que le chantier attend et qu'Adam possède, en une fois. */
  private transfer(id: EntityId): void {
    const found = this.siteFor(id);

    if ('reason' in found) {
      this.events.emit('siteRejected', { id, reason: found.reason });
      return;
    }

    const { site } = found;
    const cost = BUILDINGS[site.proto].cost;
    const { inventory } = this.player;
    let moved = 0;

    for (const [item, needed] of Object.entries(cost) as [ItemId, number][]) {
      const delivered = site.delivered[item] ?? 0;
      const amount = Math.min(needed - delivered, inventory.count(item));

      if (amount <= 0) continue;

      inventory.remove(item, amount);
      site.delivered[item] = delivered + amount;
      moved += amount;
      this.events.emit('siteDelivered', { id: site.id, item, amount, missing: siteMissing(site) });
    }

    if (moved === 0) {
      this.events.emit('siteRejected', { id, reason: 'nothingToGive' });
      return;
    }
    if (siteMissing(site) === 0) this.events.emit('siteReady', { id: site.id });
  }

  /** Le bouton « Construire » : le chantier livré devient le bâtiment. */
  private build(id: EntityId): void {
    const found = this.siteFor(id);

    if ('reason' in found) {
      this.events.emit('siteRejected', { id, reason: found.reason });
      return;
    }
    if (siteMissing(found.site) > 0) {
      this.events.emit('siteRejected', { id, reason: 'incomplete' });
      return;
    }
    this.complete(found.site);
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

  /** Ce qui arrête une bête qui se faufile entre les arbres : l'eau et le bâti, rien d'autre. */
  private readonly isOpenGroundSolid = (tx: number, ty: number): boolean =>
    !isWalkable(terrainAt(this.seed, tx, ty)) || this.chunks.occupantAt(tx, ty) !== undefined;

  /* ---------------------------------------------------------------- contact */

  /**
   * Le contact est **la** mécanique du jeu : Adam n'a pas de bouton d'action.
   * Il pousse contre quelque chose, et selon ce que c'est, il récolte ou il
   * livre. Le compteur repart à zéro dès qu'il change de cible ou s'écarte,
   * pour qu'on ne puisse pas « charger » une récolte contre un mur.
   */
  private handleContact(contact: Contact | null): void {
    this.player.harvesting = false;

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
      this.player.harvesting = true;

      if (this.contactTicks % RESOURCES[resource.id].harvestTicks === 0) {
        this.harvest(contact.tx, contact.ty);
      }
      return;
    }

    const occupant = this.chunks.occupantAt(contact.tx, contact.ty);
    const entity = occupant === undefined ? undefined : this.entities.get(occupant);

    if (this.contactTicks % DELIVER_TICKS !== 0) return;

    if (entity?.kind === 'site') this.deliver(entity);
    else if (entity?.kind === 'drill' || entity?.kind === 'farm') this.collect(entity);
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

  /** Pose un objet du sac sur le chantier — le premier qui manque et qu'Adam possède. Au contact, le chantier se remplit à vue. */
  private deliver(site: Site): void {
    const cost = BUILDINGS[site.proto].cost;
    const { inventory } = this.player;

    for (const [item, needed] of Object.entries(cost) as [ItemId, number][]) {
      const delivered = site.delivered[item] ?? 0;

      if (delivered >= needed || inventory.count(item) === 0) continue;

      inventory.remove(item, 1);
      site.delivered[item] = delivered + 1;

      const missing = siteMissing(site);

      this.events.emit('siteDelivered', { id: site.id, item, amount: 1, missing });

      // Le chantier ne se termine jamais tout seul : il attend « Construire ».
      if (missing === 0) this.events.emit('siteReady', { id: site.id });
      return;
    }
  }

  /**
   * Prend un objet du coffre d'une foreuse ou d'une ferme heurtée : au
   * contact, le coffre se vide à vue, comme un chantier se remplit.
   */
  private collect(producer: Drill | Farm): void {
    const [item] = producer.store.entries()[0] ?? [];

    if (!item) return;
    if (this.player.inventory.freeSpace() <= 0) {
      this.events.emit('inventoryFull', {});
      return;
    }
    this.takeInto(producer, item, 1);
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
    const base = {
      id: site.id,
      proto: site.proto,
      tx: site.tx,
      ty: site.ty,
      width: site.width,
      height: site.height,
      store: new Store(proto.storage),
      hp: proto.hp,
    };
    let building: Building;

    switch (proto.kind) {
      case 'drill':
        building = {
          ...base,
          kind: 'drill',
          output: this.oreUnder(site.tx, site.ty, site.width, site.height),
          blocked: false,
        };
        break;

      case 'townHall':
        building = { ...base, kind: 'townHall' };
        break;

      case 'nursery':
        building = { ...base, kind: 'nursery', nextBirthTick: this.tickCount + NURSERY_BIRTH_TICKS, born: 0 };
        break;

      case 'tower':
        building = { ...base, kind: 'tower', armed: false };
        break;

      case 'house':
        building = { ...base, kind: 'house' };
        break;

      case 'farm':
        building = { ...base, kind: 'farm', blocked: false };
        break;
    }

    this.entities.set(site.id, building);
    this.dirtyTile(site.tx, site.ty);
    this.events.emit('buildingCompleted', { id: site.id });

    switch (building.kind) {
      case 'drill':
        // Une foreuse posée à sec ne se planifie pas du tout : zéro coût.
        if (building.output) this.scheduleDrill(building);
        else building.blocked = true;
        break;

      case 'nursery':
        this.scheduler.schedule(building.id, building.nextBirthTick, this.tickCount);
        break;

      case 'tower':
        if (this.hasMutants()) this.armTower(building, 1);
        break;

      case 'farm':
        this.scheduleFarm(building);
        break;

      case 'house':
        break;

      case 'townHall':
        // Le toit est posé : les mutants savent maintenant où aller.
        if (building.id === this.townHallId) this.scheduleWave(WAVES.firstDelay);
        break;
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

      case 'nursery':
        this.runNursery(entity);
        break;

      case 'tower':
        this.runTower(entity);
        break;

      case 'farm':
        this.runFarm(entity);
        break;

      case 'site':
      case 'townHall':
      case 'house':
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
   * Un cycle de ferme : même logique que la foreuse — coffre plein, la ferme
   * s'endort et ne coûte plus rien jusqu'à ce qu'on vienne la vider.
   */
  private runFarm(farm: Farm): void {
    const recipe = RECIPES[FARM_RECIPE];
    const [item, amount] = (Object.entries(recipe.outputs) as [ItemId, number][])[0] ?? ['food', 1];
    const accepted = farm.store.add(item, amount);

    if (accepted < amount) {
      farm.blocked = true;
      return;
    }

    farm.blocked = false;
    this.events.emit('farmProduced', { id: farm.id, item });
    this.scheduleFarm(farm);
  }

  private scheduleFarm(farm: Farm): void {
    this.scheduler.schedule(farm.id, this.tickCount + RECIPES[FARM_RECIPE].duration, this.tickCount);
  }

  /** Une naissance : un enfant apparaît sur la première tuile libre autour de la nurserie. */
  private runNursery(nursery: Nursery): void {
    const home = {
      x: (nursery.tx + nursery.width / 2) * TILE_SIZE,
      y: (nursery.ty + nursery.height / 2) * TILE_SIZE,
    };
    const spot = this.freeTileAround(nursery.tx, nursery.ty, nursery.width, nursery.height);
    const x = spot ? (spot.tx + 0.5) * TILE_SIZE : home.x;
    const y = spot ? (spot.ty + 0.5) * TILE_SIZE : nursery.ty * TILE_SIZE + nursery.height * TILE_SIZE + 8;
    const kid: Kid = {
      kind: 'kid',
      id: this.nextMobileId++,
      x,
      y,
      prevX: x,
      prevY: y,
      facing: 'down',
      moving: false,
      homeId: nursery.id,
      homeX: home.x,
      homeY: home.y,
      dirX: 0,
      dirY: 0,
      wanderTicks: 0,
    };

    this.mobiles.set(kid.id, kid);
    nursery.born += 1;
    nursery.nextBirthTick = this.tickCount + NURSERY_BIRTH_TICKS;
    this.scheduler.schedule(nursery.id, nursery.nextBirthTick, this.tickCount);
    this.events.emit('childBorn', { nurseryId: nursery.id, kidId: kid.id, x, y });
  }

  /**
   * Un tir de tour. La tour ne se replanifie que s'il reste des mutants :
   * sans eux, elle se rendort, et c'est la prochaine vague qui la réarme.
   */
  private runTower(tower: Tower): void {
    tower.armed = false;

    const weapon = BUILDINGS[tower.proto].weapon;

    if (!weapon) return;

    const x = (tower.tx + tower.width / 2) * TILE_SIZE;
    const y = (tower.ty + tower.height / 2) * TILE_SIZE;
    const target = nearestFoe(this.mutants(), x, y, WEAPONS[weapon].range);

    if (target) this.fire(weapon, x, y, target);
    if (this.hasMutants()) this.armTower(tower, WEAPONS[weapon].cooldown);
  }

  private armTower(tower: Tower, delay: number): void {
    if (tower.armed) return;
    tower.armed = true;
    this.scheduler.schedule(tower.id, this.tickCount + delay, this.tickCount);
  }

  /* ---------------------------------------------------------------- mobiles */

  private *mutants(): IterableIterator<Mutant> {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'mutant') yield mobile;
    }
  }

  /** Tout ce que l'arc d'Adam peut viser : les mutants et les bêtes. */
  private *foes(): IterableIterator<Foe> {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'mutant' || mobile.kind === 'beast') yield mobile;
    }
  }

  private *beasts(): IterableIterator<Beast> {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'beast') yield mobile;
    }
  }

  private hasMutants(): boolean {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'mutant') return true;
    }
    return false;
  }

  /**
   * La population : Adam, les enfants nés aux nurseries, et les ouvriers
   * qu'emploient les bâtiments finis. Un chantier n'emploie personne.
   */
  public population(): { adults: number; children: number; workers: number } {
    let children = 0;
    let workers = 0;

    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'kid') children += 1;
    }
    for (const entity of this.entities.values()) {
      if (entity.kind !== 'site') workers += BUILDINGS[entity.proto].workers;
    }
    return { adults: 1, children, workers };
  }

  private stepMobiles(): void {
    for (const mobile of this.mobiles.values()) {
      switch (mobile.kind) {
        case 'mutant': {
          const step = stepMutant(mobile, this.target, this.occupantAt, STEP_SECONDS);

          if (step.strikes && step.blockedBy !== null) {
            this.damageBuilding(step.blockedBy, ENEMIES[mobile.proto].damage);
          }
          break;
        }

        case 'beast': {
          const solid = WILDLIFE[mobile.proto].throughTrees ? this.isOpenGroundSolid : this.isSolid;
          const step = stepBeast(mobile, this.player, solid, this.seed, this.rng, STEP_SECONDS);

          if (step.strikes) this.hurtPlayer(mobile, WILDLIFE[mobile.proto].damage);
          break;
        }

        case 'arrow': {
          const hit = stepArrow(mobile, this.foes());

          if (hit) {
            this.mobiles.delete(mobile.id);
            if (hit.kind === 'mutant') this.hurtMutant(hit, mobile.damage);
            else this.hurtBeast(hit, mobile.damage);
          } else if (mobile.ttl <= 0) {
            this.mobiles.delete(mobile.id);
          }
          break;
        }

        case 'kid':
          stepKid(mobile, { x: mobile.homeX, y: mobile.homeY }, this.isSolid, this.rng, STEP_SECONDS);
          break;
      }
    }
  }

  private readonly occupantAt = (tx: number, ty: number): EntityId | undefined => this.chunks.occupantAt(tx, ty);

  /**
   * L'arc d'Adam : automatique. À chaque tick, il vise l'ennemi le plus
   * proche à portée — mutant, crabe ou loup — et tire dès que le délai est
   * écoulé. Le joueur ne fait que se déplacer ; la cible est retenue dans
   * `player.target` pour que le rendu y pose son marqueur.
   */
  private shootPlayerBow(): void {
    const { player } = this;

    if (player.bowCooldown > 0) player.bowCooldown -= 1;

    const target = nearestFoe(this.foes(), player.x, player.y, WEAPONS.bow.range);

    player.target = target?.id ?? null;

    if (!target || player.bowCooldown > 0) return;

    // Le corps est au-dessus des pieds : la flèche part de la poitrine.
    this.fire('bow', player.x, player.y - 8, target);
    player.bowCooldown = WEAPONS.bow.cooldown;

    // À l'arrêt, Adam se tourne vers ce qu'il vise.
    if (this.moveX === 0 && this.moveY === 0) {
      player.facing = facingOf(target.x - player.x, target.y - player.y);
    }
  }

  private fire(weapon: keyof typeof WEAPONS, x: number, y: number, target: Foe): void {
    const arrow = shoot(this.nextMobileId++, weapon, x, y, target);

    this.mobiles.set(arrow.id, arrow);
    this.events.emit('arrowShot', { x, y });
  }

  private hurtMutant(mutant: Mutant, damage: number): void {
    mutant.hp -= damage;

    if (mutant.hp > 0) {
      this.events.emit('mutantHit', { id: mutant.id, hp: mutant.hp, x: mutant.x, y: mutant.y });
      return;
    }
    this.mobiles.delete(mutant.id);
    this.kills += 1;
    this.events.emit('mutantDied', { id: mutant.id, x: mutant.x, y: mutant.y });
  }

  /* ------------------------------------------------------------------ faune */

  /** Une bête touchée charge qui l'a blessée ; abattue, elle laisse sa tanière et parfois son butin. */
  private hurtBeast(beast: Beast, damage: number): void {
    beast.hp -= damage;

    if (beast.hp > 0) {
      if (beast.state === 'roam') beast.state = 'chase';
      this.events.emit('beastHit', { id: beast.id, proto: beast.proto, hp: beast.hp, x: beast.x, y: beast.y });
      return;
    }

    const proto = WILDLIFE[beast.proto];
    const den = this.dens.get(beast.denId);

    this.mobiles.delete(beast.id);

    // Tanière vidée par l'arc : elle attend avant de se repeupler.
    if (den) {
      den.members -= 1;
      if (den.members <= 0) den.readyTick = this.tickCount + proto.respawnTicks;
    }

    const loot = proto.loot !== null && this.player.inventory.add(proto.loot, 1) > 0 ? proto.loot : null;

    this.events.emit('beastDied', { id: beast.id, proto: beast.proto, x: beast.x, y: beast.y, loot });
  }

  /** Un coup de pince ou de croc. À zéro, Adam tombe et se réveille à la mairie. */
  private hurtPlayer(by: Beast, damage: number): void {
    const { player } = this;

    player.hp = Math.max(0, player.hp - damage);
    player.calmTicks = 0;
    this.events.emit('playerHurt', { by: by.id, hp: player.hp });

    if (player.hp > 0) return;

    const hall = this.entities.get(this.townHallId);
    const spot = hall ? this.freeTileAround(hall.tx, hall.ty, hall.width, hall.height) : null;
    const x = spot ? (spot.tx + 0.5) * TILE_SIZE : this.spawnX;
    const y = spot ? (spot.ty + 0.5) * TILE_SIZE : this.spawnY;

    player.x = player.prevX = x;
    player.y = player.prevY = y;
    player.hp = PLAYER_MAX_HP;
    this.events.emit('playerKnockedOut', { x, y });
  }

  /** Au calme, Adam reprend des forces, un point à la fois. */
  private recover(): void {
    const { player } = this;

    player.calmTicks += 1;

    if (player.hp >= PLAYER_MAX_HP || player.calmTicks < PLAYER_CALM_TICKS) return;
    if ((player.calmTicks - PLAYER_CALM_TICKS) % PLAYER_REGEN_TICKS === 0) player.hp += 1;
  }

  /**
   * Les tanières autour d'Adam, une fois par seconde : range les bêtes trop
   * loin de lui, puis peuple les tanières vides des chunks voisins — hors de
   * sa vue, loin du village, sous le plafond. Tout vient de la seed et de
   * l'état : deux parties jouées pareil voient les mêmes bêtes.
   */
  private stepWildlife(): void {
    if (this.tickCount % WILDLIFE_SPAWN.checkTicks !== 0) return;

    const { player } = this;
    const despawn = WILDLIFE_SPAWN.despawnDistance * TILE_SIZE;
    let alive = 0;

    for (const beast of this.beasts()) {
      if (beast.state !== 'chase' && distanceSq(player.x, player.y, beast.x, beast.y) > despawn * despawn) {
        // Rangée, pas tuée : la tanière se repeuplera sans attendre au retour d'Adam.
        this.mobiles.delete(beast.id);

        const den = this.dens.get(beast.denId);

        if (den) den.members -= 1;
        continue;
      }
      alive += 1;
    }

    const { cx, cy } = this.playerChunk();
    const radius = WILDLIFE_SPAWN.chunkRadius;
    const near = WILDLIFE_SPAWN.minPlayerDistance * TILE_SIZE;

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (const den of this.densAt(cx + dx, cy + dy)) {
          const state = this.dens.get(den.id);

          if (state && (state.members > 0 || this.tickCount < state.readyTick)) continue;

          const size = denSize(den);
          const x = (den.tx + 0.5) * TILE_SIZE;
          const y = (den.ty + 0.5) * TILE_SIZE;

          if (alive + size > WILDLIFE_SPAWN.cap) return;
          if (distanceSq(player.x, player.y, x, y) < near * near) continue;
          if (!this.isWild(den)) continue;

          this.populate(den, size);
          alive += size;
        }
      }
    }
  }

  /** Les tanières d'un chunk, calculées une fois. */
  public densAt(cx: number, cy: number): readonly Den[] {
    const key = coordKey(cx, cy);
    let dens = this.denCache.get(key);

    if (!dens) {
      dens = densOfChunk(this.seed, cx, cy);
      this.denCache.set(key, dens);
    }
    return dens;
  }

  /** Une tanière est-elle assez loin de la mairie et du village, et libre ? */
  private isWild(den: Den): boolean {
    const x = (den.tx + 0.5) * TILE_SIZE;
    const y = (den.ty + 0.5) * TILE_SIZE;
    const hall = WILDLIFE_SPAWN.townHallClearance * TILE_SIZE;
    const clearance = WILDLIFE_SPAWN.buildingClearance * TILE_SIZE;

    if (distanceSq(x, y, this.target.x, this.target.y) < hall * hall) return false;
    if (this.isSolid(den.tx, den.ty)) return false;

    for (const entity of this.entities.values()) {
      const ex = (entity.tx + entity.width / 2) * TILE_SIZE;
      const ey = (entity.ty + entity.height / 2) * TILE_SIZE;

      if (distanceSq(x, y, ex, ey) < clearance * clearance) return false;
    }
    return true;
  }

  /** La tanière se peuple : `size` bêtes côte à côte, sur l'habitat, jamais dans un obstacle. */
  private populate(den: Den, size: number): void {
    const proto = WILDLIFE[den.species];
    const homeX = (den.tx + 0.5) * TILE_SIZE;
    const homeY = (den.ty + 0.5) * TILE_SIZE;

    for (let i = 0; i < size; i += 1) {
      let x = homeX + (i - (size - 1) / 2) * 14;
      const y = homeY + (i % 2) * 6;
      const tx = floorDiv(x, TILE_SIZE);
      const ty = floorDiv(y, TILE_SIZE);

      if (this.isSolid(tx, ty) || habitatAt(this.seed, tx, ty) !== proto.habitat) x = homeX;

      const beast: Beast = {
        kind: 'beast',
        id: this.nextMobileId++,
        proto: den.species,
        x,
        y,
        prevX: x,
        prevY: y,
        facing: 'down',
        moving: false,
        hp: proto.hp,
        denId: den.id,
        homeX,
        homeY,
        state: 'roam',
        dirX: 0,
        dirY: 0,
        wanderTicks: 0,
        attackCooldown: 0,
      };

      this.mobiles.set(beast.id, beast);
    }
    this.dens.set(den.id, { members: size, readyTick: 0 });
  }

  /* ----------------------------------------------------------------- vagues */

  /** Une vague : `waveSize(n)` mutants autour de la mairie, puis la suivante est planifiée. */
  private spawnWave(): void {
    if (this.defeated) return;

    this.wave += 1;

    const count = waveSize(this.wave);

    for (let i = 0; i < count; i += 1) this.spawnMutant();

    this.events.emit('waveStarted', { wave: this.wave, count });

    for (const entity of this.entities.values()) {
      if (entity.kind === 'tower') this.armTower(entity, 1);
    }

    this.scheduleWave(WAVES.interval);
  }

  /** Les trois dernières secondes avant une vague, une par une. */
  private announceWave(): void {
    if (this.nextWaveTick === 0 || this.defeated) return;

    const left = this.nextWaveTick - this.tickCount;

    if (left > 0 && left <= WAVE_COUNTDOWN_SECONDS * TICKS_PER_SECOND && left % TICKS_PER_SECOND === 0) {
      this.events.emit('waveCountdown', { seconds: left / TICKS_PER_SECOND });
    }
  }

  private scheduleWave(delay: number): void {
    this.nextWaveTick = this.tickCount + delay;
    this.scheduler.schedule(WAVE_WAKE_ID, this.nextWaveTick, this.tickCount);
  }

  private spawnMutant(): void {
    let point = spawnPoint(this.rng, this.target);

    // Pas dans un bâtiment : il y resterait coincé à le ronger de l'intérieur.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (this.occupantAt(floorDiv(point.x, TILE_SIZE), floorDiv(point.y, TILE_SIZE)) === undefined) break;
      point = spawnPoint(this.rng, this.target);
    }

    const mutant: Mutant = {
      kind: 'mutant',
      id: this.nextMobileId++,
      proto: 'mutant',
      x: point.x,
      y: point.y,
      prevX: point.x,
      prevY: point.y,
      facing: 'down',
      moving: false,
      hp: ENEMIES.mutant.hp,
      attackCooldown: 0,
    };

    this.mobiles.set(mutant.id, mutant);
  }

  /* ------------------------------------------------------------ destruction */

  private damageBuilding(id: EntityId, amount: number): void {
    const entity = this.entities.get(id);

    if (!entity || entity.kind === 'site') return;

    entity.hp = Math.max(0, entity.hp - amount);
    this.events.emit('buildingDamaged', { id, hp: entity.hp });

    if (entity.hp === 0) this.destroyBuilding(entity);
  }

  private destroyBuilding(building: Building): void {
    this.entities.delete(building.id);
    this.chunks.release(building.id, building.tx, building.ty, building.width, building.height);
    this.dirtyTile(building.tx, building.ty);
    this.events.emit('buildingDestroyed', {
      id: building.id,
      proto: building.proto,
      tx: building.tx,
      ty: building.ty,
    });

    if (building.id === this.townHallId && !this.defeated) {
      this.defeated = true;
      this.defeatTick = this.tickCount;
      this.nextWaveTick = 0;
      this.events.emit('townHallDestroyed', {});
    }
  }

  /**
   * Retire des objets du coffre d'un bâtiment et le relance s'il était bloqué.
   *
   * Adam y passe (heurt et « Prendre ») ; c'est aussi le point d'entrée des
   * porteurs, un ticket suivant — et la démonstration que le réveil sur
   * événement fonctionne.
   */
  public withdraw(id: EntityId, item: ItemId, amount: number): number {
    const entity = this.entities.get(id);

    if (!entity || entity.kind === 'site') return 0;

    const removed = entity.store.remove(item, amount);

    if (removed <= 0) return 0;

    // Une machine bloquée ne se replanifiait plus : c'est ce retrait qui la réveille.
    if (entity.kind === 'drill' && entity.blocked && entity.output) {
      entity.blocked = false;
      this.scheduleDrill(entity);
    } else if (entity.kind === 'farm' && entity.blocked) {
      entity.blocked = false;
      this.scheduleFarm(entity);
    }
    return removed;
  }

  /** Le bouton « Prendre » : tout le coffre passe dans le sac, dans la limite de la place. */
  private takeAll(id: EntityId): void {
    const entity = this.entities.get(id);

    if (entity?.kind !== 'drill' && entity?.kind !== 'farm') {
      this.events.emit('takeRejected', { id, reason: 'missing' });
      return;
    }

    const reason: TakeRejection | null = !this.inReach(entity)
      ? 'outOfReach'
      : entity.store.isEmpty()
        ? 'empty'
        : this.player.inventory.freeSpace() <= 0
          ? 'bagFull'
          : null;

    if (reason) {
      this.events.emit('takeRejected', { id, reason });
      return;
    }

    for (const [item, amount] of entity.store.entries()) {
      const room = this.player.inventory.freeSpace();

      if (room <= 0) break;
      this.takeInto(entity, item, Math.min(amount, room));
    }
  }

  /** Du coffre au sac : le coffre se vide (et la machine repart), le sac reçoit. */
  private takeInto(producer: Drill | Farm, item: ItemId, amount: number): void {
    const taken = this.withdraw(producer.id, item, amount);

    if (taken <= 0) return;
    this.player.inventory.add(item, taken);
    this.events.emit('storeTaken', { id: producer.id, item, amount: taken });
  }

  /** Nombre de réveils en attente — affiché dans le HUD de debug. */
  public pendingWakes(): number {
    return this.scheduler.size();
  }

  /** La première tuile praticable collée à l'emprise, en commençant par le bas, ou `null`. */
  private freeTileAround(tx: number, ty: number, width: number, height: number): Contact | null {
    const candidates: Contact[] = [];

    for (let x = tx; x < tx + width; x += 1) {
      candidates.push({ tx: x, ty: ty + height }, { tx: x, ty: ty - 1 });
    }
    for (let y = ty; y < ty + height; y += 1) {
      candidates.push({ tx: tx + width, ty: y }, { tx: tx - 1, ty: y });
    }
    return candidates.find((tile) => !this.isSolid(tile.tx, tile.ty)) ?? null;
  }

  /** Chunk sous le joueur — pratique pour le HUD et le culling. */
  public playerChunk(): { cx: number; cy: number } {
    return {
      cx: floorDiv(floorDiv(this.player.x, TILE_SIZE), CHUNK_TILES),
      cy: floorDiv(floorDiv(this.player.y, TILE_SIZE), CHUNK_TILES),
    };
  }
}

/** Une entité en données : le coffre devient son stock, le reste est copié. */
function saveEntity(entity: Entity): SavedEntity {
  if (entity.kind === 'site') return { ...entity, delivered: { ...entity.delivered } };
  return { ...entity, store: entity.store.toJSON() };
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
