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
 * coffre contient, une nurserie ou une forge heurtée reçoit ce que sa recette
 * consomme. Une fois la mairie debout, le jour et la nuit
 * alternent (`sim/dayNight.ts`) : on bâtit le jour, et la nuit les mutants
 * arrivent par vagues et marchent droit dessus ; l'arc d'Adam et les tours de
 * guet tirent seuls. À l'aube, les survivants fuient et le butin tombe. Si la mairie tombe, la partie est perdue. Loin du village, la faune
 * — crabes sur les plages, loups en forêt — s'en prend à Adam s'il approche.
 * Après la troisième vague repoussée, Ève arrive : elle vit à la mairie,
 * répare le bâti entre les vagues et donne les quêtes (`sim/eve.ts`).
 * Les ouvriers de la maison des constructeurs portent : ils vident foreuses
 * et fermes dans la mairie, et livrent les chantiers depuis la mairie.
 */

import { Emitter } from '../core/events.ts';
import { CHUNK_TILES, TILE_SIZE, coordKey, distanceSq, floorDiv, type TileCoord } from '../core/grid.ts';
import { mulberry32, type StatefulRng } from '../core/rng.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { DAWN_REWARD } from '../data/dayNight.ts';
import { ENEMIES, LOOT_DROPS, WAVES, WILDLIFE, WILDLIFE_SPAWN, waveSize, type LootTable } from '../data/enemies.ts';
import { EVE } from '../data/eve.ts';
import type { ItemId } from '../data/items.ts';
import {
  PERKS,
  bagBonus,
  freeSites,
  harvestTicksWith,
  startingItems,
  type ColonyScore,
  type PerkId,
} from '../data/perks.ts';
import type { QuestId } from '../data/quests.ts';
import { RECIPES, type RecipeId, type RecipeProto } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';
import { WEAPONS } from '../data/weapons.ts';
import { JOB_PRIORITY, PORTERS } from '../data/workers.ts';
import { ChunkIndex } from './chunk.ts';
import { nearestFoe, shoot, stepArrow } from './combat.ts';
import { clockAt, isWaveTick, ticksToNextWave, type DayClock } from './dayNight.ts';
import type {
  Command,
  CommandLogEntry,
  DepositRejection,
  PlacementRejection,
  SiteRejection,
  SupplyRejection,
  TakeRejection,
} from './commands.ts';
import type { WildlifeId } from '../data/enemies.ts';
import { compassOf, spawnPoint, stepMutant, type Compass } from './enemies.ts';
import { createEve, currentQuest, harvestTicksWithTools, isUnlocked, mostDamaged, questProgress, rideHome, walkTo } from './eve.ts';
import { stepKid } from './kids.ts';
import { rollLoot, stepPickup } from './loot.ts';
import { denSize, densOfChunk, stepBeast, type Den } from './wildlife.ts';
import { facingOf } from './motion.ts';
import {
  BUILD_REACH_TILES,
  INVENTORY_CAPACITY,
  PLAYER_CALM_TICKS,
  PLAYER_MAX_HP,
  PLAYER_REGEN_TICKS,
  createPlayer,
  playerOverlaps,
  stepPlayer,
} from './player.ts';
import { JobBoard, doorOf, type LineTest } from './jobs.ts';
import { ResourceIndex } from './resources.ts';
import type { SavedEntity, WorldState } from './save.ts';
import { Scheduler } from './scheduler.ts';
import { Store } from './store.ts';
import { findSpawn, habitatAt, isBuildable, isWalkable, oreAt, terrainAt } from './terrain.ts';
import { clearLine, standStill, walkToward } from './workers.ts';
import type {
  Beast,
  Building,
  Contact,
  Drill,
  Entity,
  Eve,
  EntityId,
  Farm,
  Foe,
  Forge,
  House,
  Job,
  Kid,
  Mobile,
  MobileId,
  Mutant,
  Nursery,
  Pickup,
  Player,
  Site,
  Tower,
  Worker,
} from './types.ts';

/** 20 ticks de simulation par seconde. */
export const TICKS_PER_SECOND = 20;
export const STEP_MS = 1000 / TICKS_PER_SECOND;
const STEP_SECONDS = 1 / TICKS_PER_SECOND;

/** Recette utilisée par une foreuse. Une seule pour l'instant, cf. `data/recipes.ts`. */
const DRILL_RECIPE: RecipeId = 'mineOre';

/** Recette d'une ferme. */
const FARM_RECIPE: RecipeId = 'growFood';

/** Ce que coûte une naissance à la nurserie, et tous les combien. */
const NURSERY_RECIPE: RecipeId = 'raiseChild';

/** Recette d'une forge. */
const FORGE_RECIPE: RecipeId = 'smeltPlate';

/** Ticks de contact entre deux objets livrés sur un chantier. Court : le chantier se remplit à vue. */
export const DELIVER_TICKS = 2;

/** Secondes annoncées avant chaque vague. */
const WAVE_COUNTDOWN_SECONDS = 3;

/** Adam piétine du butin avec le sac plein : « sac plein » au plus une fois par seconde. */
const LOOT_FULL_TICKS = TICKS_PER_SECOND;

/** Où tombe ce qu'Adam jette, en pixels : un peu devant ses pieds, un tas par objet côte à côte. */
const DROP_AHEAD = 12;
const DROP_SPACING = 14;

/** Le bâtiment que la partie ouvre en chantier au démarrage. */
export const STARTING_BUILDING: BuildingId = 'townHall';

/** Un refus de placement, et les cases de l'emprise qui le causent. */
export interface PlacementBlock {
  reason: PlacementRejection;
  tiles: TileCoord[];
}

/**
 * Les ouvriers de la ville, lus par le HUD : le total, bâtiment par
 * bâtiment, et ce que font les porteurs sur pied.
 */
export interface Workforce {
  total: number;
  /** Les bâtiments finis qui emploient, dans l'ordre de `BUILDINGS`, un seul par prototype. */
  byBuilding: { proto: BuildingId; count: number }[];
  /** Les porteurs logés : `busy` ont un job, `idle` attendent du travail. */
  porters: { busy: number; idle: number };
}

export type WorldEvents = {
  /** Un chantier est ouvert (ou un bâtiment à coût nul, posé fini). */
  buildingPlaced: { id: EntityId; tx: number; ty: number };
  /** Le chantier a reçu son dernier objet : l'entité est devenue le bâtiment, sous le même id, sans autre action du joueur. */
  buildingCompleted: { id: EntityId };
  placementRejected: { reason: PlacementRejection };
  drillBlocked: { id: EntityId };
  drillProduced: { id: EntityId; item: ItemId };
  /** Adam a arraché une unité à la tuile. `remaining` à 0 : elle a disparu. */
  resourceHarvested: { tx: number; ty: number; item: ItemId; remaining: number };
  /**
   * `amount` objets viennent d'être posés sur le chantier, pris dans le sac
   * d'Adam ou dans le stock de la ville (`source`). `missing` : ce qui manque
   * encore, tous objets confondus.
   */
  siteDelivered: { id: EntityId; item: ItemId; amount: number; missing: number; source: 'bag' | 'town' };
  /** Un chantier offert par le jardin des souvenirs vient d'ouvrir déjà livré. */
  siteReady: { id: EntityId };
  /** Une commande sur un chantier a été refusée. */
  siteRejected: { id: EntityId; reason: SiteRejection };
  /** La ferme a récolté. */
  farmProduced: { id: EntityId; item: ItemId };
  /** La forge a fondu une plaque. */
  forgeProduced: { id: EntityId; item: ItemId };
  /** `amount` objets du sac viennent d'entrer dans le coffre d'une nurserie ou d'une forge. */
  buildingSupplied: { id: EntityId; item: ItemId; amount: number };
  /** Un « Transférer le sac » vers une nurserie ou une forge a été refusé. */
  supplyRejected: { id: EntityId; reason: SupplyRejection };
  /** L'heure de naître est passée, mais la nurserie n'a pas de quoi nourrir l'enfant. */
  nurseryHungry: { id: EntityId };
  /** Adam a pris `amount` objets dans le coffre d'une foreuse, d'une ferme ou d'une forge. */
  storeTaken: { id: EntityId; item: ItemId; amount: number };
  /** Un « Prendre » a été refusé. */
  takeRejected: { id: EntityId; reason: TakeRejection };
  /** Le sac est plein : la récolte s'arrête, il faut aller livrer. */
  inventoryFull: Record<string, never>;
  /**
   * Plus que `seconds` secondes avant la prochaine vague (3, 2, puis 1) : sa
   * nuit, son rang dans la nuit, son effectif, d'où elle vient et le point,
   * en pixels monde, où elle va surgir.
   */
  waveCountdown: { seconds: number; night: number; wave: number; count: number; from: Compass; x: number; y: number };
  /** Le crépuscule commence : la nuit `night` tombe dans `DAY_CYCLE.dusk` ticks. */
  duskFell: { night: number };
  /** Une vague de mutants vient d'apparaître autour de la mairie, du côté `from` ; `wave` compte à partir de 1 dans la nuit. */
  waveStarted: { night: number; wave: number; count: number; from: Compass; x: number; y: number };
  /** Le dernier mutant en vie vient de tomber : la vague de la nuit `night` est repoussée. */
  waveCleared: { night: number };
  /** Un mutant abattu a lâché du butin en (x, y). */
  lootDropped: { id: MobileId; item: ItemId; x: number; y: number };
  /** Adam a ramassé `amount` exemplaires d'un tas au sol, qui sont allés dans son sac. */
  lootPicked: { id: MobileId; item: ItemId; amount: number; x: number; y: number };
  /** `amount` objets du sac viennent d'entrer dans le stock de la ville. */
  townDeposited: { item: ItemId; amount: number };
  /** Un « Déposer en ville » a été refusé. */
  depositRejected: { reason: DepositRejection };
  /** Adam a jeté `amount` objets de son sac : un tas `id` à ses pieds, en (x, y). */
  itemDropped: { id: MobileId; item: ItemId; amount: number; x: number; y: number };
  /** L'aube : la nuit `night` est survécue, les mutants restants ont fui, `reward` est entré dans le sac. */
  dawnBroke: { night: number; reward: [ItemId, number][] };
  /** Un mutant a fui le jour : il disparaît sans compter comme abattu. */
  mutantFled: { id: MobileId; x: number; y: number };
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
  /** Une bête est tombée ; son butin suit, en `lootDropped`. */
  beastDied: { id: MobileId; proto: WildlifeId; x: number; y: number };
  /** Une bête a frappé Adam ; `hp` est ce qui lui reste. */
  playerHurt: { by: MobileId; hp: number };
  /** Adam est tombé : il se réveille à la mairie, remis sur pied. */
  playerKnockedOut: { x: number; y: number };
  /** La nurserie a produit un enfant. */
  childBorn: { nurseryId: EntityId; kidId: MobileId; x: number; y: number };
  /** Ève part du bord de la carte sur son vélo-cargo. */
  eveArriving: { id: MobileId };
  /** Ève est arrivée à la mairie : la population compte deux adultes. */
  eveArrived: { id: MobileId; x: number; y: number };
  /** Ève donne une quête. */
  questStarted: { quest: QuestId };
  /** L'objectif est atteint : la récompense est donnée. */
  questCompleted: { quest: QuestId };
  /** Ève a rendu `hp` points de vie au bâtiment. */
  buildingRepaired: { id: EntityId; hp: number };
  /** Un porteur a déposé sa charge : sur un chantier, ou dans la mairie. */
  porterDelivered: { workerId: MobileId; id: EntityId; item: ItemId; amount: number };
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

  /** Numéro de la dernière nuit tombée ; 0 tant que la première n'est pas venue. */
  public night = 0;

  /** Vrai une fois la mairie détruite. La simulation continue, les vagues s'arrêtent. */
  public defeated = false;

  /** Tick où le toit de la mairie a été posé : le lever du premier jour. 0 tant qu'elle est en chantier. */
  public cycleStartTick = 0;

  /** Direction, en radians depuis la mairie, d'où viendra la prochaine vague : tirée dès qu'elle est planifiée. */
  public nextWaveHeading = 0;

  /** Mutants abattus depuis le début de la partie — le score de l'écran de fin. */
  public kills = 0;

  /** Tick où la mairie est tombée ; 0 tant qu'elle tient. */
  public defeatTick = 0;

  /**
   * Quêtes d'Ève déjà finies, dans l'ordre de `QUEST_IDS`. C'est tout l'état
   * des quêtes : la quête en cours, les plans et les outils s'en déduisent.
   */
  public questsDone = 0;

  /** Les bonus du jardin des souvenirs avec lesquels la colonie est partie. Vide en « partie pure ». */
  public perks: readonly PerkId[] = [];

  /** Chantiers offerts par les bonus et pas encore ouverts : le prochain de ce bâtiment arrive livré. */
  private giftedSites: BuildingId[] = [];

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

  /** Les réservations des porteurs. Pas de l'état : elles se relisent dans leurs jobs. */
  private readonly jobs = new JobBoard();

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
      night: this.night,
      cycleStartTick: this.cycleStartTick,
      nextWaveHeading: this.nextWaveHeading,
      kills: this.kills,
      defeated: this.defeated,
      defeatTick: this.defeatTick,
      questsDone: this.questsDone,
      perks: [...this.perks],
      giftedSites: [...this.giftedSites],
      player: { ...player, inventory: inventory.toJSON() },
      resources: this.resources.toJSON(),
      entities: [...this.entities.values()].map(saveEntity),
      mobiles: [...this.mobiles.values()].map(copyMobile),
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
    this.night = state.night;
    this.cycleStartTick = state.cycleStartTick;
    this.nextWaveHeading = state.nextWaveHeading;
    this.kills = state.kills;
    this.defeated = state.defeated;
    this.defeatTick = state.defeatTick;
    this.questsDone = state.questsDone;
    this.perks = [...state.perks];
    this.giftedSites = [...state.giftedSites];

    const { inventory, ...player } = state.player;
    const capacity = INVENTORY_CAPACITY + bagBonus(this.perks);

    Object.assign(this.player, player, { inventory: Store.fromJSON(capacity, inventory) });
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
    for (const mobile of state.mobiles) this.mobiles.set(mobile.id, copyMobile(mobile));

    this.dens.clear();
    for (const { id, members, readyTick } of state.dens) this.dens.set(id, { members, readyTick });

    this.scheduler.restore(state.scheduler);
    this.restoreJobs();

    // Une sauvegarde d'avant l'achèvement automatique peut garder un chantier livré : il s'achève au chargement.
    for (const entity of [...this.entities.values()]) {
      if (entity.kind === 'site' && siteMissing(entity) === 0) this.complete(entity);
    }

    // Une maison d'une sauvegarde d'avant les porteurs : ses ouvriers s'y installent.
    for (const entity of this.entities.values()) {
      if (entity.kind === 'house') this.staff(entity);
    }
  }

  /* ------------------------------------------------------------------ tick */

  public tick(): void {
    this.tickCount += 1;
    this.drainCommands();

    const contact = stepPlayer(this.player, this.moveX, this.moveY, this.isSolid, STEP_SECONDS);

    this.handleContact(contact);
    this.stepClock();
    this.stepMobiles();
    this.recover();
    this.stepWildlife();
    this.watchOverColony();
    this.shootPlayerBow();

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

      case 'transferToSite':
        this.transfer(command.id);
        break;

      case 'takeFromBuilding':
        this.takeAll(command.id);
        break;

      case 'supplyBuilding':
        this.supplyAll(command.id);
        break;

      case 'depositToTown':
        this.depositToTown(command.item);
        break;

      case 'dropItem':
        this.dropFromBag(command.item);
        break;

      case 'applyPerks':
        this.applyPerks(command.perks);
        break;
    }
  }

  /**
   * Les bonus du jardin, au départ de la colonie : un sac plus grand, de quoi
   * démarrer, un chantier offert, une récolte plus vive. Refusés une fois la
   * partie lancée — un bonus ne s'ajoute pas en cours de route — et appliqués
   * une seule fois, doublons écartés.
   */
  private applyPerks(perks: readonly PerkId[]): void {
    if (this.tickCount > 1 || this.perks.length > 0) return;

    const unique = [...new Set(perks)].filter((id) => Object.hasOwn(PERKS, id));

    if (unique.length === 0) return;

    const { inventory } = this.player;

    this.perks = unique;
    this.giftedSites = freeSites(unique);
    this.player.inventory = Store.fromJSON(inventory.capacity + bagBonus(unique), inventory.toJSON());

    for (const [item, amount] of Object.entries(startingItems(unique)) as [ItemId, number][]) {
      this.player.inventory.add(item, amount);
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

  /**
   * Tout ce que le chantier attend, en une fois : le sac d'abord, puis le
   * stock de la ville pour ce qui manque encore. La ville ne donne que son
   * disponible — ce que les porteurs ont déjà promis n'est pas à elle.
   */
  private transfer(id: EntityId): void {
    const found = this.siteFor(id);

    if ('reason' in found) {
      this.events.emit('siteRejected', { id, reason: found.reason });
      return;
    }

    const { site } = found;
    const town = this.townStock();
    let moved = this.transferFrom(site, this.player.inventory, 'bag');

    if (town) moved += this.transferFrom(site, town, 'town');

    if (moved === 0) {
      this.events.emit('siteRejected', { id, reason: 'nothingToGive' });
      return;
    }
    if (siteMissing(site) === 0) this.complete(site);
  }

  /**
   * Ce que le chantier attend encore, pris dans `from`. Renvoie le nombre
   * d'objets posés. Le sac livre tout ce qui manque, comme au contact ; la
   * ville ne livre pas ce qu'un porteur apporte déjà.
   */
  private transferFrom(site: Site, from: Store, source: 'bag' | 'town'): number {
    let moved = 0;

    for (const item of Object.keys(BUILDINGS[site.proto].cost) as ItemId[]) {
      const amount = Math.min(this.siteNeeds(site, item, source), from.available(item));

      if (amount <= 0) continue;

      from.remove(item, amount);
      site.delivered[item] = (site.delivered[item] ?? 0) + amount;
      moved += amount;
      this.events.emit('siteDelivered', { id: site.id, item, amount, missing: siteMissing(site), source });
    }
    return moved;
  }

  /**
   * Ce qu'un « Transférer » poserait sur le chantier : l'UI grise le bouton
   * sur cette réponse, le tick décide sur la même.
   */
  public canTransfer(site: Site): boolean {
    const town = this.townStock();

    return (Object.keys(BUILDINGS[site.proto].cost) as ItemId[]).some(
      (item) =>
        (this.siteNeeds(site, item, 'bag') > 0 && this.player.inventory.count(item) > 0) ||
        (this.siteNeeds(site, item, 'town') > 0 && (town?.available(item) ?? 0) > 0),
    );
  }

  private siteNeeds(site: Site, item: ItemId, source: 'bag' | 'town'): number {
    if (source === 'town') return this.jobs.siteWants(site, item);

    const needed = (BUILDINGS[site.proto].cost as Partial<Record<ItemId, number>>)[item] ?? 0;

    return Math.max(0, needed - (site.delivered[item] ?? 0));
  }

  /* ------------------------------------------------------- ville et sac */

  /**
   * Le stock de la ville : le coffre de la mairie, une fois bâtie. `null`
   * tant qu'elle est en chantier, ou si elle est tombée.
   *
   * La frontière est là : le **sac** (`player.inventory`, plafonné) est ce
   * qu'Adam porte sur lui — ce qu'il a récolté, ramassé ou pris dans un
   * coffre et pas encore déposé ; la **ville** est ce qui a été déposé à la
   * mairie, par Adam ou par les porteurs. Les chantiers puisent dans les
   * deux : au contact et au bouton, dans le sac ; au bouton et par les
   * porteurs, dans la ville.
   */
  public townStock(): Store | null {
    const hall = this.entities.get(this.townHallId);

    return hall?.kind === 'townHall' ? hall.store : null;
  }

  /** Adam peut-il déposer en ville d'ici ? La mairie doit être debout et à portée. */
  public nearTown(): boolean {
    const hall = this.entities.get(this.townHallId);

    return hall?.kind === 'townHall' && this.inReach(hall);
  }

  /** Le bouton « Déposer en ville » : le sac, ou un seul objet, passe dans le coffre de la mairie. */
  private depositToTown(only?: ItemId): void {
    const town = this.townStock();

    if (!town) {
      this.events.emit('depositRejected', { reason: 'noTown' });
      return;
    }
    if (!this.nearTown()) {
      this.events.emit('depositRejected', { reason: 'outOfReach' });
      return;
    }

    const { inventory } = this.player;
    const entries = inventory.entries().filter(([item]) => only === undefined || item === only);

    if (entries.length === 0) {
      this.events.emit('depositRejected', { reason: 'empty' });
      return;
    }

    for (const [item, count] of entries) {
      const amount = town.add(item, inventory.remove(item, count));

      this.events.emit('townDeposited', { item, amount });
    }
  }

  /**
   * « Jeter » : ce qu'Adam porte tombe à ses pieds, un tas par objet — le
   * même tas que le butin, ramassable en repassant dessus, une fois qu'Adam
   * s'en est éloigné. Rien n'est détruit : le tas s'efface seulement s'il
   * est oublié, comme le butin.
   */
  private dropFromBag(only?: ItemId): void {
    const { inventory } = this.player;
    const dropped = inventory.entries().filter(([item]) => only === undefined || item === only);

    // Les tas s'alignent juste devant ses pieds : sous lui, son sprite les cacherait.
    for (const [index, [item, count]] of dropped.entries()) {
      const amount = inventory.remove(item, count);
      const x = this.player.x + (index - (dropped.length - 1) / 2) * DROP_SPACING;
      const pickup = this.spawnPickup(item, amount, x, this.player.y + DROP_AHEAD, true);

      this.events.emit('itemDropped', { id: pickup.id, item, amount, x: pickup.x, y: pickup.y });
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

      const ticks = harvestTicksWith(
        this.perks,
        resource.id,
        harvestTicksWithTools(resource.id, RESOURCES[resource.id].harvestTicks, this.questsDone),
      );

      if (this.contactTicks % ticks === 0) {
        this.harvest(contact.tx, contact.ty);
      }
      return;
    }

    const occupant = this.chunks.occupantAt(contact.tx, contact.ty);
    const entity = occupant === undefined ? undefined : this.entities.get(occupant);

    if (this.contactTicks % DELIVER_TICKS !== 0) return;

    if (entity?.kind === 'site') this.deliver(entity);
    else if (entity?.kind === 'drill' || entity?.kind === 'farm') this.collect(entity);
    else if (entity?.kind === 'nursery') this.supplyOne(entity);
    // La forge prend d'abord ce qu'Adam lui apporte, puis lui rend ses plaques.
    else if (entity?.kind === 'forge' && !this.supplyOne(entity)) this.collect(entity);
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

      this.events.emit('siteDelivered', { id: site.id, item, amount: 1, missing, source: 'bag' });

      // Le dernier objet posé achève le chantier : le joueur a déjà fait l'effort.
      if (missing === 0) this.complete(site);
      return;
    }
  }

  /**
   * Prend un objet du coffre d'une foreuse, d'une ferme ou d'une forge
   * heurtée : au contact, le coffre se vide à vue, comme un chantier se remplit.
   */
  private collect(producer: Drill | Farm | Forge): void {
    const [item] = this.takeable(producer)[0] ?? [];

    if (!item) return;
    if (this.player.inventory.freeSpace() <= 0) {
      this.events.emit('inventoryFull', {});
      return;
    }
    this.takeInto(producer, item, 1);
  }

  /* ------------------------------------------------------ approvisionnement */

  /**
   * Combien d'unités de `item` le bâtiment accepte encore. Seules la nurserie
   * et la forge consomment ; chaque entrée de leur recette a sa part du
   * coffre, au prorata de la recette — le fer ne prend pas la place du charbon.
   */
  public accepts(entity: Entity, item: ItemId): number {
    if (entity.kind !== 'nursery' && entity.kind !== 'forge') return 0;

    const recipe = consumerRecipe(entity);
    const needed = recipe.inputs[item] ?? 0;

    if (needed <= 0) return 0;

    const share = Math.floor((entity.store.capacity * needed) / totalOf(recipe.inputs));

    return Math.max(0, Math.min(share - entity.store.count(item), entity.store.freeSpace()));
  }

  /** Adam porte-t-il quelque chose que le bâtiment accepte ? */
  public canSupply(entity: Entity): boolean {
    if (entity.kind !== 'nursery' && entity.kind !== 'forge') return false;
    return inputItems(consumerRecipe(entity)).some(
      (item) => this.accepts(entity, item) > 0 && this.player.inventory.count(item) > 0,
    );
  }

  /** Au contact : un objet du sac entre dans le coffre. Renvoie `false` s'il n'y avait rien à donner. */
  private supplyOne(consumer: Nursery | Forge): boolean {
    const { inventory } = this.player;

    for (const item of inputItems(consumerRecipe(consumer))) {
      if (this.accepts(consumer, item) <= 0 || inventory.count(item) === 0) continue;

      inventory.remove(item, 1);
      consumer.store.add(item, 1);
      this.events.emit('buildingSupplied', { id: consumer.id, item, amount: 1 });
      this.afterSupply(consumer);
      return true;
    }
    return false;
  }

  /** Le bouton « Transférer le sac » : tout ce que le bâtiment accepte et qu'Adam porte, en une fois. */
  private supplyAll(id: EntityId): void {
    const entity = this.entities.get(id);

    if (entity?.kind !== 'nursery' && entity?.kind !== 'forge') {
      this.events.emit('supplyRejected', { id, reason: 'missing' });
      return;
    }
    if (!this.inReach(entity)) {
      this.events.emit('supplyRejected', { id, reason: 'outOfReach' });
      return;
    }

    const { inventory } = this.player;
    let moved = 0;

    for (const item of inputItems(consumerRecipe(entity))) {
      const amount = Math.min(this.accepts(entity, item), inventory.count(item));

      if (amount <= 0) continue;

      inventory.remove(item, amount);
      entity.store.add(item, amount);
      moved += amount;
      this.events.emit('buildingSupplied', { id: entity.id, item, amount });
    }

    if (moved === 0) {
      this.events.emit('supplyRejected', { id, reason: 'nothingToGive' });
      return;
    }
    this.afterSupply(entity);
  }

  /** Une livraison réveille ce qui l'attendait : la naissance en retard, la forge à l'arrêt. */
  private afterSupply(consumer: Nursery | Forge): void {
    if (consumer.kind === 'nursery') {
      if (consumer.hungry && hasInputs(consumer.store, RECIPES[NURSERY_RECIPE])) this.runNursery(consumer);
    } else if (consumer.blocked) {
      this.startForge(consumer);
    }
  }

  /* ------------------------------------------------------------- placement */

  /**
   * Le placement est-il légal ? Renvoie le motif de refus, ou `null` si oui.
   * Raccourci de `placementBlock()`, qui dit aussi quelles cases bloquent.
   */
  public canPlace(building: BuildingId, tx: number, ty: number): PlacementRejection | null {
    return this.placementBlock(building, tx, ty)?.reason ?? null;
  }

  /**
   * Pourquoi le placement est refusé, et **quelles cases** de l'emprise
   * bloquent — ou `null` s'il est légal.
   *
   * Cette fonction est le juge unique : l'aperçu fantôme l'appelle à chaque
   * frame pour se colorer, et le tick l'appelle avant de construire. Deux
   * implémentations qui divergent, c'est un fantôme vert qui refuse de se
   * poser — le genre de bug qui se signale en test utilisateur seulement.
   *
   * Un seul motif à la fois, dans l'ordre où le joueur peut y remédier ; ses
   * cases seulement. Trop loin : toute l'emprise l'est.
   */
  public placementBlock(building: BuildingId, tx: number, ty: number): PlacementBlock | null {
    const proto = BUILDINGS[building];
    const tiles = (blocks: (x: number, y: number) => boolean): TileCoord[] => {
      const found: TileCoord[] = [];

      for (let y = ty; y < ty + proto.height; y += 1) {
        for (let x = tx; x < tx + proto.width; x += 1) {
          if (blocks(x, y)) found.push({ tx: x, ty: y });
        }
      }
      return found;
    };

    // Pas de plan ou pas encore la vague, pas de chantier : le tick refuse comme le menu.
    if (!this.isUnlocked(building)) return { reason: 'locked', tiles: tiles(() => true) };

    const checks: [PlacementRejection, (x: number, y: number) => boolean][] = [
      ['terrain', (x, y) => !isBuildable(terrainAt(this.seed, x, y))],
      ['occupied', (x, y) => !this.chunks.isFree(x, y, 1, 1)],
      ['resource', (x, y) => this.resources.isSolid(x, y)],
      // Un bâtiment est solide : le poser sur Adam l'emmurerait.
      ['onPlayer', (x, y) => playerOverlaps(this.player, x, y, 1, 1)],
    ];

    for (const [reason, blocks] of checks) {
      const found = tiles(blocks);

      if (found.length > 0) return { reason, tiles: found };
    }

    // Portée mesurée depuis le centre de l'emprise, en distances au carré.
    const centerX = (tx + proto.width / 2) * TILE_SIZE;
    const centerY = (ty + proto.height / 2) * TILE_SIZE;
    const reach = BUILD_REACH_TILES * TILE_SIZE;

    if (distanceSq(this.player.x, this.player.y, centerX, centerY) > reach * reach) {
      return { reason: 'outOfReach', tiles: tiles(() => true) };
    }

    return null;
  }

  /**
   * Le bâtiment est-il débloqué ? Il faut son plan, s'il en demande un (quêtes
   * d'Ève), et avoir vu tomber la nuit `unlockNight`.
   */
  public isUnlocked(building: BuildingId): boolean {
    return isUnlocked(building, this.questsDone) && this.night >= BUILDINGS[building].unlockNight;
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

    if (siteMissing(site) === 0) {
      this.complete(site);
      return id;
    }

    // Un chantier offert par le jardin : livré d'avance, il attend quand même « Construire ».
    const gift = this.giftedSites.indexOf(building);

    if (gift >= 0) {
      this.giftedSites.splice(gift, 1);
      site.delivered = { ...proto.cost };
      this.events.emit('siteReady', { id });
    }

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
        building = {
          ...base,
          kind: 'nursery',
          nextBirthTick: this.tickCount + RECIPES[NURSERY_RECIPE].duration,
          born: 0,
          hungry: false,
        };
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

      case 'forge':
        building = { ...base, kind: 'forge', blocked: true };
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

      case 'forge':
        // Coffre vide : elle attend son fer et son charbon, sans rien coûter.
        break;

      case 'house':
        this.staff(building);
        break;

      case 'townHall':
        // Le toit est posé : le premier jour se lève, les mutants sauront où aller la nuit venue.
        if (building.id === this.townHallId) {
          this.cycleStartTick = this.tickCount;
          this.nextWaveHeading = this.rng() * Math.PI * 2;
        }
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

      case 'forge':
        this.runForge(entity);
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

  /**
   * Un cycle de forge : les entrées deviennent la plaque. Comme la foreuse,
   * une forge à qui il manque du fer ou du charbon ne se replanifie pas —
   * c'est la livraison d'Adam qui la relance.
   */
  private runForge(forge: Forge): void {
    const recipe: RecipeProto = RECIPES[FORGE_RECIPE];

    if (canCraft(forge.store, recipe)) {
      for (const [item, amount] of amountsOf(recipe.inputs)) forge.store.remove(item, amount);
      for (const [item, amount] of amountsOf(recipe.outputs)) {
        forge.store.add(item, amount);
        this.events.emit('forgeProduced', { id: forge.id, item });
      }
    }
    this.startForge(forge);
  }

  /** Planifie le prochain cycle s'il a de quoi tourner ; sinon, la forge s'arrête. */
  private startForge(forge: Forge): void {
    const recipe: RecipeProto = RECIPES[FORGE_RECIPE];

    if (!canCraft(forge.store, recipe)) {
      forge.blocked = true;
      return;
    }
    forge.blocked = false;
    this.scheduler.schedule(forge.id, this.tickCount + recipe.duration, this.tickCount);
  }

  /**
   * Une naissance : si le coffre a de quoi nourrir l'enfant, il apparaît sur
   * la première tuile libre autour de la nurserie. Sinon, la nurserie a faim
   * et ne se replanifie pas : c'est la nourriture apportée qui la réveille.
   */
  private runNursery(nursery: Nursery): void {
    const recipe: RecipeProto = RECIPES[NURSERY_RECIPE];

    if (!hasInputs(nursery.store, recipe)) {
      if (!nursery.hungry) this.events.emit('nurseryHungry', { id: nursery.id });
      nursery.hungry = true;
      return;
    }
    for (const [item, amount] of amountsOf(recipe.inputs)) nursery.store.remove(item, amount);
    nursery.hungry = false;

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
    nursery.nextBirthTick = this.tickCount + recipe.duration;
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

  /** Ève, si elle a rejoint la colonie — en route ou arrivée. */
  public eve(): Eve | undefined {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'eve') return mobile;
    }
    return undefined;
  }

  /**
   * La population : Adam et Ève, les enfants nés aux nurseries, et les
   * ouvriers qu'emploient les bâtiments finis. Un chantier n'emploie personne.
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
    return { adults: this.eve() ? 2 : 1, children, workers };
  }

  /**
   * Les ouvriers, comptés comme `population()` : ceux qu'emploient les
   * bâtiments finis. Les porteurs dont la maison est tombée quittent la
   * colonie : ils ne comptent plus.
   */
  public workforce(): Workforce {
    const counts = new Map<BuildingId, number>();
    let total = 0;
    let busy = 0;
    let idle = 0;

    for (const entity of this.entities.values()) {
      const { workers } = BUILDINGS[entity.proto];

      if (entity.kind === 'site' || workers === 0) continue;
      counts.set(entity.proto, (counts.get(entity.proto) ?? 0) + workers);
      total += workers;
    }
    for (const worker of this.workers()) {
      if (!this.entities.has(worker.homeId)) continue;
      if (worker.job) busy += 1;
      else idle += 1;
    }

    const byBuilding = (Object.keys(BUILDINGS) as BuildingId[]).flatMap((proto) => {
      const count = counts.get(proto);

      return count ? [{ proto, count }] : [];
    });

    return { total, byBuilding, porters: { busy, idle } };
  }

  /**
   * Le bilan de la colonie, lu par le barème des graines : nuits
   * repoussées, enfants encore là, bâtiments finis — la mairie comptée même
   * tombée, puisqu'elle a tenu jusqu'à la défaite.
   */
  public colonyScore(): ColonyScore {
    let buildings = 0;

    for (const entity of this.entities.values()) {
      if (entity.kind !== 'site') buildings += 1;
    }
    if (this.defeated) buildings += 1;

    return {
      waves: Math.max(0, this.night - 1),
      children: this.population().children,
      buildings,
    };
  }

  private stepMobiles(): void {
    // Une fois par tick, pas une fois par ouvrier.
    const alarm = this.hasMutants();
    let lootBlocked = false;

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

        case 'eve':
          this.stepEve(mobile);
          break;

        case 'worker':
          this.stepWorker(mobile, alarm);
          break;

        case 'pickup':
          lootBlocked = this.stepPickup(mobile) || lootBlocked;
          break;
      }
    }

    // Adam sur du butin, sac plein : le HUD le dit, au rythme de la récolte.
    if (lootBlocked && this.tickCount % LOOT_FULL_TICKS === 0) this.events.emit('inventoryFull', {});
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
    this.dropLoot(ENEMIES[mutant.proto].loot, mutant.x, mutant.y);

    if (!this.defeated && !this.hasMutants()) this.events.emit('waveCleared', { night: this.night });
  }

  /* ------------------------------------------------------------------ butin */

  /**
   * Le butin d'un ennemi abattu, tiré de sa table et posé au sol là où il est
   * tombé : un objet par exemplaire, un peu éparpillés. Au-delà du plafond,
   * le plus ancien au sol s'efface.
   */
  private dropLoot(table: LootTable, x: number, y: number): void {
    const spread = LOOT_DROPS.scatter * TILE_SIZE;

    for (const item of rollLoot(table, this.rng)) {
      const px = x + (this.rng() - 0.5) * 2 * spread;
      const py = y + (this.rng() - 0.5) * 2 * spread;
      const pickup = this.spawnPickup(item, 1, px, py, false);

      this.events.emit('lootDropped', { id: pickup.id, item, x: px, y: py });
    }
  }

  /** Pose un tas au sol, sous le plafond du butin. */
  private spawnPickup(item: ItemId, amount: number, x: number, y: number, waitForLeave: boolean): Pickup {
    const pickup: Pickup = {
      kind: 'pickup',
      id: this.nextMobileId++,
      x,
      y,
      prevX: x,
      prevY: y,
      facing: 'down',
      moving: false,
      item,
      amount,
      waitForLeave,
      ttl: LOOT_DROPS.lifetimeTicks,
    };

    this.trimLoot();
    this.mobiles.set(pickup.id, pickup);
    return pickup;
  }

  /** Plafond atteint : le butin le plus ancien — le moins de ticks restants — disparaît. */
  private trimLoot(): void {
    let count = 0;
    let oldest: Pickup | null = null;

    for (const mobile of this.mobiles.values()) {
      if (mobile.kind !== 'pickup') continue;
      count += 1;
      if (!oldest || mobile.ttl < oldest.ttl) oldest = mobile;
    }
    if (oldest && count >= LOOT_DROPS.cap) this.mobiles.delete(oldest.id);
  }

  /**
   * Adam passe dessus : le tas va dans le sac, autant qu'il y a de place — le
   * reste attend au sol, et la valeur rendue le signale. Oublié trop
   * longtemps, il disparaît.
   */
  private stepPickup(pickup: Pickup): boolean {
    const { inventory } = this.player;
    const step = stepPickup(pickup, this.player, inventory.freeSpace() > 0, STEP_SECONDS);

    if (step === 'reached') {
      const amount = inventory.add(pickup.item, pickup.amount);

      if (amount > 0) {
        pickup.amount -= amount;
        if (pickup.amount === 0) this.mobiles.delete(pickup.id);
        this.events.emit('lootPicked', { id: pickup.id, item: pickup.item, amount, x: pickup.x, y: pickup.y });
        if (pickup.amount === 0) return false;
      }
      if (pickup.ttl > 0) return true;
    }
    if (pickup.ttl <= 0) this.mobiles.delete(pickup.id);
    return false;
  }

  /* -------------------------------------------------------------------- Ève */

  /**
   * Une fois par seconde : Ève arrive-t-elle, a-t-elle un mur à réparer, la
   * quête en cours est-elle remplie ? Elle arrive quand la nuit
   * `EVE.arrivalNight` est repoussée, une fois la nuit finie ; elle ne
   * répare qu'entre deux vagues.
   */
  private watchOverColony(): void {
    if (this.tickCount % EVE.checkTicks !== 0 || this.defeated) return;

    const eve = this.eve();

    if (!eve) {
      if (this.night >= EVE.arrivalNight && this.clock()?.phase !== 'night' && !this.hasMutants()) this.sendEve();
      return;
    }
    if (eve.state === 'arriving') return;

    if (eve.state === 'idle' && !this.hasMutants()) {
      const damaged = mostDamaged(this.entities.values());

      if (damaged) {
        eve.state = 'repair';
        eve.targetId = damaged.id;
      }
    }

    const quest = currentQuest(this.questsDone);

    if (quest) {
      const { have, need } = questProgress(quest, this.entities.values());

      if (have >= need) {
        this.questsDone += 1;
        this.events.emit('questCompleted', { quest });
        this.startQuest();
      }
    }
  }

  /** Ève part du bord de la carte, vers la tuile libre devant la mairie. */
  private sendEve(): void {
    const hall = this.entities.get(this.townHallId);

    if (!hall) return;

    const spot = this.freeTileAround(hall.tx, hall.ty, hall.width, hall.height);
    const homeX = spot ? (spot.tx + 0.5) * TILE_SIZE : this.spawnX;
    const homeY = spot ? (spot.ty + 0.5) * TILE_SIZE : this.spawnY;
    const eve = createEve(this.nextMobileId++, homeX, homeY);

    this.mobiles.set(eve.id, eve);
    this.events.emit('eveArriving', { id: eve.id });
  }

  private startQuest(): void {
    const quest = currentQuest(this.questsDone);

    if (quest) this.events.emit('questStarted', { quest });
  }

  private stepEve(eve: Eve): void {
    eve.working = false;

    switch (eve.state) {
      case 'arriving':
        if (rideHome(eve, STEP_SECONDS)) {
          eve.state = 'idle';
          this.events.emit('eveArrived', { id: eve.id, x: eve.x, y: eve.y });
          this.startQuest();
        }
        break;

      case 'repair': {
        const target = eve.targetId === null ? undefined : this.entities.get(eve.targetId);

        // Réparé, rasé, ou une vague qui arrive : elle rentre.
        if (!target || target.kind === 'site' || target.hp >= BUILDINGS[target.proto].hp || this.hasMutants()) {
          eve.state = 'idle';
          eve.targetId = null;
          break;
        }
        if (!walkTo(eve, target, this.isOpenGroundSolid, STEP_SECONDS)) break;

        eve.working = true;
        if (eve.repairCooldown > 0) {
          eve.repairCooldown -= 1;
          break;
        }
        target.hp = Math.min(BUILDINGS[target.proto].hp, target.hp + EVE.repairAmount);
        eve.repairCooldown = EVE.repairTicks;
        this.events.emit('buildingRepaired', { id: target.id, hp: target.hp });
        break;
      }

      case 'idle':
        stepKid(eve, { x: eve.homeX, y: eve.homeY }, this.isOpenGroundSolid, this.rng, STEP_SECONDS, EVE.homeRange, EVE.walkSpeed / 2);
        break;
    }
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

    this.events.emit('beastDied', { id: beast.id, proto: beast.proto, x: beast.x, y: beast.y });
    this.dropLoot(proto.loot, beast.x, beast.y);
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

  /* ------------------------------------------------------ jour, nuit, vagues */

  /** L'heure qu'il est, ou `null` tant que la mairie est en chantier : le cycle n'a pas commencé. */
  public clock(): DayClock | null {
    return this.cycleStartTick === 0 ? null : clockAt(this.tickCount - this.cycleStartTick);
  }

  /** Les changements de phase, le compte à rebours et les vagues de la nuit. */
  private stepClock(): void {
    const clock = this.clock();

    if (!clock || this.defeated) return;

    if (clock.elapsed === 0) {
      if (clock.phase === 'dusk') this.events.emit('duskFell', { night: clock.cycle });
      if (clock.phase === 'night') this.night = clock.cycle;
      if (clock.phase === 'dawn') this.dawn();
    }

    const left = ticksToNextWave(clock);

    if (left > 0 && left <= WAVE_COUNTDOWN_SECONDS * TICKS_PER_SECOND && left % TICKS_PER_SECOND === 0) {
      // Trois secondes avant, on est au crépuscule pour la première vague, dans la nuit pour les suivantes.
      this.events.emit('waveCountdown', {
        seconds: left / TICKS_PER_SECOND,
        night: clock.cycle,
        wave: clock.phase === 'night' ? Math.floor(clock.elapsed / WAVES.interval) + 2 : 1,
        count: waveSize(clock.cycle),
        from: compassOf(this.nextWaveHeading),
        ...this.waveOrigin(),
      });
    }

    if (isWaveTick(clock)) this.spawnWave(Math.floor(clock.elapsed / WAVES.interval) + 1);
  }

  /**
   * Une vague : `waveSize(nuit)` mutants du côté annoncé, qui sortent de leur
   * flaque l'un après l'autre, et les tours s'éveillent. Le côté de la
   * vague suivante est tiré aussitôt, pour que son annonce puisse le donner.
   */
  private spawnWave(wave: number): void {
    const count = waveSize(this.night);
    const origin = this.waveOrigin();
    const from = compassOf(this.nextWaveHeading);

    for (let i = 0; i < count; i += 1) this.spawnMutant(WAVES.emergeTicks + i * WAVES.emergeStagger);

    this.events.emit('waveStarted', { night: this.night, wave, count, from, ...origin });

    for (const entity of this.entities.values()) {
      if (entity.kind === 'tower') this.armTower(entity, 1);
    }

    this.nextWaveHeading = this.rng() * Math.PI * 2;
  }

  /**
   * L'aube : les mutants encore debout fuient le jour — une journée reste
   * sans mutant — et la nuit survécue paie son butin, dans la limite du sac.
   */
  private dawn(): void {
    for (const mobile of [...this.mobiles.values()]) {
      if (mobile.kind !== 'mutant') continue;
      this.mobiles.delete(mobile.id);
      this.events.emit('mutantFled', { id: mobile.id, x: mobile.x, y: mobile.y });
    }

    const reward: [ItemId, number][] = [];

    for (const [item, amount] of Object.entries(DAWN_REWARD) as [ItemId, number][]) {
      const added = this.player.inventory.add(item, amount);

      if (added > 0) reward.push([item, added]);
    }
    this.events.emit('dawnBroke', { night: this.night, reward });
  }

  /** Le point, en pixels monde, d'où surgira la prochaine vague : ce que l'annonce montre du doigt. */
  public waveOrigin(): { x: number; y: number } {
    const distance = ((WAVES.minDistance + WAVES.maxDistance) / 2) * TILE_SIZE;

    return {
      x: this.target.x + Math.cos(this.nextWaveHeading) * distance,
      y: this.target.y + Math.sin(this.nextWaveHeading) * distance,
    };
  }

  private spawnMutant(emerge: number): void {
    let point = spawnPoint(this.rng, this.target, this.nextWaveHeading);

    // Pas dans un bâtiment : il y resterait coincé à le ronger de l'intérieur.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (this.occupantAt(floorDiv(point.x, TILE_SIZE), floorDiv(point.y, TILE_SIZE)) === undefined) break;
      point = spawnPoint(this.rng, this.target, this.nextWaveHeading);
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
      emerge,
    };

    this.mobiles.set(mutant.id, mutant);
  }

  /* ---------------------------------------------------------------- porteurs */

  private *workers(): IterableIterator<Worker> {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'worker') yield mobile;
    }
  }

  /** Ce que le chantier attend encore et qu'aucun porteur n'apporte — la fenêtre du chantier peut l'afficher. */
  public siteIncoming(id: EntityId, item: ItemId): number {
    return this.jobs.siteIncoming(id, item);
  }

  private readonly lineIsClear: LineTest = (x0, y0, x1, y1) => clearLine(this.seed, x0, y0, x1, y1);

  /** Loge les ouvriers de la maison qui n'y sont pas encore. Ils sortent un par un, dès qu'il y a à porter. */
  private staff(house: House): void {
    let lodged = 0;

    for (const worker of this.workers()) {
      if (worker.homeId === house.id) lodged += 1;
    }

    const door = doorOf(house);

    for (let i = lodged; i < BUILDINGS[house.proto].workers; i += 1) {
      const worker: Worker = {
        kind: 'worker',
        id: this.nextMobileId++,
        x: door.x,
        y: door.y,
        prevX: door.x,
        prevY: door.y,
        facing: 'down',
        moving: false,
        homeId: house.id,
        inside: true,
        job: null,
        searchTicks: 1 + i * 8,
      };

      this.mobiles.set(worker.id, worker);
    }
  }

  /**
   * Un tick d'ouvrier. Pendant une vague, il rentre s'abriter avec sa
   * charge et n'en ressort qu'une fois le dernier mutant tombé. Sinon, il
   * suit son job — la source, puis la destination — ou en cherche un toutes
   * les `retryTicks` ; sans rien à porter, il rentre dormir chez lui.
   */
  private stepWorker(worker: Worker, alarm: boolean): void {
    const home = this.entities.get(worker.homeId);
    const homeDoor = home ? doorOf(home) : null;

    if (alarm && homeDoor) {
      this.goHome(worker, homeDoor);
      return;
    }

    if (!worker.job) {
      worker.searchTicks -= 1;

      if (worker.searchTicks <= 0) {
        worker.searchTicks = PORTERS.retryTicks;
        worker.job = this.jobs.assign(this.entities, this.townHallId, worker, homeDoor ?? worker, this.lineIsClear);
      }
    }

    const { job } = worker;

    if (!job) {
      // Sa maison est tombée et il n'a plus rien à porter : il quitte la colonie.
      if (homeDoor) this.goHome(worker, homeDoor);
      else this.mobiles.delete(worker.id);
      return;
    }

    worker.inside = false;

    const stop = this.entities.get(job.carried ? job.to : job.from);

    if (!stop) {
      this.abandon(worker, job);
      standStill(worker);
      return;
    }

    const door = doorOf(stop);

    if (!walkToward(worker, door.x, door.y, STEP_SECONDS)) return;

    if (job.carried) this.dropOff(worker, job);
    else this.pickUp(worker, job);
  }

  private goHome(worker: Worker, door: { x: number; y: number }): void {
    if (worker.inside) standStill(worker);
    else if (walkToward(worker, door.x, door.y, STEP_SECONDS)) worker.inside = true;
  }

  /** À la source : la promesse sortante devient un retrait réel, qui réveille une foreuse endormie. */
  private pickUp(worker: Worker, job: Job): void {
    const source = this.entities.get(job.from);

    if (!source || source.kind === 'site') {
      this.abandon(worker, job);
      return;
    }

    source.store.releaseOut(job.item, job.amount);

    const taken = this.withdraw(source.id, job.item, job.amount);

    // Moins que promis — ce qui ne devrait pas arriver : la place réservée en trop est rendue.
    if (taken < job.amount) this.jobs.releaseIn(this.entities, { ...job, amount: job.amount - taken });

    if (taken === 0) {
      worker.job = null;
      return;
    }
    job.amount = taken;
    job.carried = true;
  }

  /**
   * À destination : la place réservée devient un dépôt réel. Un chantier
   * qu'Adam a rempli entre-temps, ou déjà achevé, ne prend que ce qui lui
   * manque ; le reste repart à la mairie — rien ne se perd.
   */
  private dropOff(worker: Worker, job: Job): void {
    const target = this.entities.get(job.to);

    this.jobs.releaseIn(this.entities, job);

    if (!target) {
      this.reroute(worker, job);
      return;
    }

    let accepted: number;

    if (target.kind === 'site') {
      const needed = (BUILDINGS[target.proto].cost as Partial<Record<ItemId, number>>)[job.item] ?? 0;
      const delivered = target.delivered[job.item] ?? 0;

      accepted = Math.max(0, Math.min(job.amount, needed - delivered));
      if (accepted > 0) target.delivered[job.item] = delivered + accepted;
    } else {
      accepted = target.store.add(job.item, job.amount);
    }

    if (accepted > 0) {
      this.events.emit('porterDelivered', { workerId: worker.id, id: target.id, item: job.item, amount: accepted });

      // Le dernier objet posé achève le chantier, qu'il vienne d'Adam ou d'un porteur.
      if (target.kind === 'site' && siteMissing(target) === 0) this.complete(target);
    }

    worker.searchTicks = 0;

    if (accepted < job.amount) this.reroute(worker, { ...job, amount: job.amount - accepted });
    else worker.job = null;
  }

  /** La source ou la destination a disparu. Sans charge, le job est rendu ; avec, elle repart à la mairie. */
  private abandon(worker: Worker, job: Job): void {
    if (!job.carried) {
      this.jobs.cancel(this.entities, job);
      worker.job = null;
      return;
    }
    this.jobs.releaseIn(this.entities, job);
    this.reroute(worker, job);
  }

  /**
   * Une charge en main dont la destination ne veut plus : elle part à la
   * mairie, qui prend tout. La réservation de l'ancienne destination doit
   * déjà être rendue. Sans mairie, la partie est perdue, et la charge avec.
   */
  private reroute(worker: Worker, job: Job): void {
    const rerouted: Job = { ...job, to: this.townHallId, priority: JOB_PRIORITY.surplus, carried: true };

    worker.job = job.to !== this.townHallId && this.jobs.open(this.entities, rerouted) ? rerouted : null;
  }

  /** Après un chargement : les réservations se rejouent depuis les jobs sauvegardés. */
  private restoreJobs(): void {
    const workers = [...this.workers()];
    const broken = new Set(this.jobs.rebuild(this.entities, workers.flatMap((worker) => (worker.job ? [worker.job] : []))));

    for (const worker of workers) {
      if (!worker.job || !broken.has(worker.job)) continue;
      if (worker.job.carried) this.reroute(worker, worker.job);
      else worker.job = null;
    }
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
      this.events.emit('townHallDestroyed', {});
    }
  }

  /**
   * Retire des objets du coffre d'un bâtiment et le relance s'il était bloqué.
   *
   * Adam y passe (heurt et « Prendre »), les porteurs aussi : une foreuse ou
   * une ferme au coffre plein dort, et c'est celui qui la vide qui la réveille.
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
    } else if (entity.kind === 'forge' && entity.blocked) {
      this.startForge(entity);
    }
    return removed;
  }

  /** Le bouton « Prendre » : tout le coffre passe dans le sac, dans la limite de la place. */
  private takeAll(id: EntityId): void {
    const entity = this.entities.get(id);

    if (entity?.kind !== 'drill' && entity?.kind !== 'farm' && entity?.kind !== 'forge') {
      this.events.emit('takeRejected', { id, reason: 'missing' });
      return;
    }

    const reason: TakeRejection | null = !this.inReach(entity)
      ? 'outOfReach'
      : this.takeable(entity).length === 0
        ? 'empty'
        : this.player.inventory.freeSpace() <= 0
          ? 'bagFull'
          : null;

    if (reason) {
      this.events.emit('takeRejected', { id, reason });
      return;
    }

    for (const [item, amount] of this.takeable(entity)) {
      const room = this.player.inventory.freeSpace();

      if (room <= 0) break;
      this.takeInto(entity, item, Math.min(amount, room));
    }
  }

  /**
   * Ce qu'Adam peut prendre dans un coffre : tout, pour une foreuse ou une
   * ferme ; les plaques seulement pour une forge — son fer et son charbon
   * restent au four.
   */
  public takeable(producer: Drill | Farm | Forge): [ItemId, number][] {
    const entries = producer.store.entries();

    if (producer.kind !== 'forge') return entries;

    const outputs: RecipeProto['outputs'] = RECIPES[FORGE_RECIPE].outputs;

    return entries.filter(([item]) => (outputs[item] ?? 0) > 0);
  }

  /** Du coffre au sac : le coffre se vide (et la machine repart), le sac reçoit. */
  private takeInto(producer: Drill | Farm | Forge, item: ItemId, amount: number): void {
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

/** Un mobile copié : un ouvrier emporte son job, qui ne doit pas être partagé entre deux mondes. */
function copyMobile(mobile: Mobile): Mobile {
  if (mobile.kind === 'worker') return { ...mobile, job: mobile.job && { ...mobile.job } };
  return { ...mobile };
}

/** Ce qu'il manque encore à un chantier, tous objets confondus. */
export function siteMissing(site: Site): number {
  let missing = 0;

  for (const [item, needed] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    missing += Math.max(0, needed - (site.delivered[item] ?? 0));
  }
  return missing;
}

/** La recette d'un bâtiment qui consomme. */
function consumerRecipe(consumer: Nursery | Forge): RecipeProto {
  return RECIPES[consumer.kind === 'nursery' ? NURSERY_RECIPE : FORGE_RECIPE];
}

function amountsOf(amounts: RecipeProto['inputs']): [ItemId, number][] {
  return Object.entries(amounts) as [ItemId, number][];
}

function inputItems(recipe: RecipeProto): ItemId[] {
  return amountsOf(recipe.inputs).map(([item]) => item);
}

function totalOf(amounts: RecipeProto['inputs']): number {
  return amountsOf(amounts).reduce((total, [, amount]) => total + amount, 0);
}

/** Le coffre contient-il toutes les entrées de la recette ? */
function hasInputs(store: Store, recipe: RecipeProto): boolean {
  return amountsOf(recipe.inputs).every(([item, amount]) => store.count(item) >= amount);
}

/** Toutes les entrées, et la place pour les sorties une fois les entrées consommées. */
function canCraft(store: Store, recipe: RecipeProto): boolean {
  return hasInputs(store, recipe) && store.freeSpace() + totalOf(recipe.inputs) >= totalOf(recipe.outputs);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
