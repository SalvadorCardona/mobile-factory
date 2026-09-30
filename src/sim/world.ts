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
 * consomme, la mairie finie heurtée reçoit tout le sac dans le stock de la
 * ville. Une fois la mairie debout, le jour et la nuit
 * alternent (`sim/dayNight.ts`) : on bâtit le jour, et la nuit les mutants
 * arrivent par vagues et marchent droit dessus ; l'arc d'Adam et les tours de
 * guet tirent seuls. À l'aube, les survivants fuient et le butin tombe. Si la mairie tombe, la partie est perdue. Loin du village, la faune
 * — crabes sur les plages, loups en forêt — s'en prend à Adam s'il approche.
 * Après la troisième vague repoussée, Ève arrive : elle vit à la mairie,
 * répare le bâti entre les vagues et donne les quêtes (`sim/eve.ts`).
 * Les ouvriers de la maison des constructeurs portent : ils vident foreuses,
 * fermes et cabanes de bûcheron dans la mairie, et livrent les chantiers
 * depuis la mairie. Les bûcherons coupent seuls les arbres autour de leur
 * cabane. Sans rien à faire, un ouvrier flâne devant chez lui, et n'y rentre
 * que pour dormir, la nuit, ou s'abriter d'une vague.
 * Une clinique change le sort des mutants vaincus : certains tombent
 * assommés, suivent Adam qui les touche jusqu'à elle, et en ressortent
 * ex-mutants — des porteurs de plus (`data/clinic.ts`).
 * Et le temps change : pluie acide, coup de vent, brouillard, arc-en-ciel,
 * lus dans la seed (`sim/weather.ts`) ; le monde n'en garde rien.
 */

import { Emitter } from '../core/events.ts';
import { CHUNK_TILES, TILE_SIZE, coordKey, distanceSq, floorDiv, type TileCoord } from '../core/grid.ts';
import { mulberry32, type StatefulRng } from '../core/rng.ts';
import { BUILDINGS, buildingLevel, nextUpgrade, type BuildingId } from '../data/buildings.ts';
import { CLINIC } from '../data/clinic.ts';
import { DAWN_REWARD } from '../data/dayNight.ts';
import { ENEMIES, LOOT_DROPS, WAVES, WILDLIFE, WILDLIFE_SPAWN, waveSize, type LootTable } from '../data/enemies.ts';
import { EVE } from '../data/eve.ts';
import type { ItemId } from '../data/items.ts';
import {
  PERKS,
  bagBonus,
  freeSites,
  harvestYieldWith,
  startingItems,
  type ColonyScore,
  type PerkId,
} from '../data/perks.ts';
import type { QuestId } from '../data/quests.ts';
import { RECIPES, type RecipeId, type RecipeProto } from '../data/recipes.ts';
import { RESEARCH, type ResearchId, type ResearchStat } from '../data/research.ts';
import { RESOURCES, type ResourceId } from '../data/resources.ts';
import { WEAPONS } from '../data/weapons.ts';
import { JOB_PRIORITY, LUMBERJACKS, PORTERS } from '../data/workers.ts';
import { WEATHER, WEATHER_CALENDAR, type WeatherId } from '../data/weather.ts';
import { ChunkIndex } from './chunk.ts';
import { NO_WIND, nearestFoe, shoot, stepArrow, type Wind } from './combat.ts';
import { clockAt, isWaveTick, ticksToNextWave, type DayClock } from './dayNight.ts';
import type {
  Command,
  CommandLogEntry,
  DepositRejection,
  PlacementRejection,
  ResearchRejection,
  SiteRejection,
  SupplyRejection,
  TakeRejection,
  UpgradeRejection,
} from './commands.ts';
import type { WildlifeId } from '../data/enemies.ts';
import { compassOf, spawnPoint, stepMutant, type Compass } from './enemies.ts';
import { createEve, currentQuest, harvestYieldWithTools, isUnlocked, mostDamaged, questProgress, rideHome, walkTo } from './eve.ts';
import { stepKid } from './kids.ts';
import { rollLoot, stepPickup } from './loot.ts';
import { denSize, densOfChunk, stepBeast, type Den } from './wildlife.ts';
import { FULL_TILE, facingOf, type TileBox } from './motion.ts';
import {
  BUILD_REACH_TILES,
  INVENTORY_CAPACITY,
  PLAYER_CALM_TICKS,
  PLAYER_MAX_HP,
  PLAYER_REGEN_TICKS,
  PLAYER_SPEED_TILES,
  SPARE_CARRY,
  createPlayer,
  playerOverlaps,
  stepPlayer,
} from './player.ts';
import { JobBoard, PORTER_CREW, doorOf, inDepotRange, isProducer, type Crew, type LineTest } from './jobs.ts';
import {
  extraUnits,
  isCollecting,
  labMissing,
  labNeeds,
  labSurplus,
  labWants,
  missingRequirements,
  researchBonus,
  researchCost,
} from './research.ts';
import { ResourceIndex } from './resources.ts';
import type { SavedEntity, WorldState } from './save.ts';
import { Scheduler } from './scheduler.ts';
import { Store } from './store.ts';
import { findSpawn, habitatAt, isBuildable, isWalkable, oreAt, terrainAt } from './terrain.ts';
import { inLogisticRange } from './warehouse.ts';
import { chopSpot, isTree, pickTree, treesInRange } from './lumberjacks.ts';
import { allocateStaff, canPause, clampStaff, employs, type Staffing } from './staffing.ts';
import { carryOf, clearLine, standStill, walkToward, wander, wanderFrom } from './workers.ts';
import { nextWeather, spoilsNight, weatherAt, type WeatherSpell } from './weather.ts';
import type {
  Beast,
  Building,
  Clinic,
  Contact,
  Depot,
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
  Lab,
  LumberCamp,
  Lumberjack,
  Mobile,
  MobileId,
  Mutant,
  Nursery,
  Patient,
  Pickup,
  Player,
  Site,
  Tower,
  TownHall,
  Worker,
} from './types.ts';

/** Ce qui remplit un coffre qu'Adam vient vider : foreuse, ferme, forge, cabane de bûcheron. */
type Producer = Drill | Farm | Forge | LumberCamp;

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

/**
 * Récolte de proximité : un passage toutes les 10 ticks, les ressources dont
 * le centre est à portée d'Adam, de la plus proche à la plus lointaine, une
 * unité chacune, quatre au plus.
 */
export const HARVEST_PASS_TICKS = 10;
export const HARVEST_REACH_TILES = 1.25;
export const HARVEST_MAX_NODES = 4;

/**
 * Le tronc d'un arbre, en pixels dans sa tuile : le pied du sprite, au centre
 * et en bas. Il laisse 22 px entre deux troncs voisins, dans un sens comme
 * dans l'autre — assez pour la boîte d'Adam (20 × 14).
 */
const TRUNK: TileBox = { left: 11, top: 20, right: 21, bottom: 30, glide: true };

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
  /** Les postes occupés dans les bâtiments qui emploient ; le reste du `total` est libre. */
  assigned: number;
  free: number;
  /** Postes demandés mais vides, faute d'ouvrier libre. */
  missing: number;
}

export type WorldEvents = {
  /** Un chantier est ouvert (ou un bâtiment à coût nul, posé fini). */
  buildingPlaced: { id: EntityId; tx: number; ty: number };
  /** Le chantier a reçu son dernier objet : l'entité est devenue le bâtiment, sous le même id, sans autre action du joueur. */
  buildingCompleted: { id: EntityId };
  placementRejected: { reason: PlacementRejection };
  drillBlocked: { id: EntityId };
  drillProduced: { id: EntityId; item: ItemId };
  /** Adam a arraché une unité à la tuile, et `amount` objets sont allés dans le sac. `remaining` à 0 : elle a disparu. */
  resourceHarvested: { tx: number; ty: number; item: ItemId; amount: number; remaining: number };
  /**
   * `amount` objets viennent d'être posés sur le chantier, pris dans le sac
   * d'Adam ou dans le stock de la ville (`source`). `missing` : ce qui manque
   * encore, tous objets confondus.
   */
  siteDelivered: { id: EntityId; item: ItemId; amount: number; missing: number; source: 'bag' | 'town' };
  /** Un chantier offert par le jardin des souvenirs vient d'ouvrir déjà livré. */
  siteReady: { id: EntityId };
  /**
   * Le bâtiment est passé au niveau `level`, sous le même id : le rendu
   * change de sprite. `fromBag` : ce qui est sorti du sac pour le payer.
   */
  buildingUpgraded: { id: EntityId; level: number; fromBag: [ItemId, number][] };
  /** Une amélioration a été refusée. */
  upgradeRejected: { id: EntityId; reason: UpgradeRejection };
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
   * Adam heurte un arbre ou un rocher mais porte déjà assez de cet objet
   * (`carryLimit`) : rien n'est pris, et le joueur le voit.
   */
  harvestRefused: { tx: number; ty: number; item: ItemId };
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
  /** Un bûcheron a donné un coup de hache : une unité de bois s'est détachée de l'arbre. `remaining` à 0 : il est tombé. */
  treeChopped: { lumberjackId: MobileId; tx: number; ty: number; remaining: number };
  /** Un bâtiment producteur a été mis en pause, ou il repart. */
  buildingPaused: { id: EntityId; paused: boolean };
  /** L'effectif voulu d'un bâtiment a changé. */
  workersChanged: { id: EntityId; staff: number };
  /** Un bûcheron a rangé `amount` bois dans le coffre de sa cabane. */
  woodStored: { lumberjackId: MobileId; id: EntityId; amount: number };
  /** Un mutant vaincu est tombé assommé plutôt que de s'évaporer : `id` est le patient qu'il devient. */
  mutantStunned: { id: MobileId; clinicId: EntityId; x: number; y: number };
  /** Adam a touché le mutant assommé : il le suit en boitillant. */
  patientFollowing: { id: MobileId; x: number; y: number };
  /** Le patient est entré à la clinique : la nuit de soins commence. */
  patientAdmitted: { id: MobileId; clinicId: EntityId };
  /** Il en ressort guéri : `id` est l'ex-mutant, un ouvrier de plus. */
  mutantHealed: { id: MobileId; clinicId: EntityId; x: number; y: number };
  /** Le labo `id` a choisi une recherche : il attend son coût. */
  researchChosen: { id: EntityId; research: ResearchId };
  /** La recherche choisie est abandonnée ; ce qui était déposé reste au coffre. */
  researchCancelled: { id: EntityId; research: ResearchId };
  /** Le coût est réuni et consommé : le compte à rebours tourne jusqu'à `endTick`. */
  researchStarted: { id: EntityId; research: ResearchId; endTick: number };
  /** La recherche est finie : son effet vaut désormais pour toute la partie. */
  researchCompleted: { id: EntityId; research: ResearchId };
  /** Une commande sur le labo a été refusée. */
  researchRejected: { id: EntityId; reason: ResearchRejection };
  /** `amount` objets viennent d'entrer au labo, pris dans le sac d'Adam ou dans le stock de la ville. */
  labSupplied: { id: EntityId; item: ItemId; amount: number; source: 'bag' | 'town' };
  /** Une météo arrive dans `seconds` secondes. */
  weatherAnnounced: { id: WeatherId; seconds: number };
  weatherStarted: { id: WeatherId };
  weatherEnded: { id: WeatherId };
  /** La pluie acide a rongé un bâtiment abîmé ; `hp` est ce qui lui reste. */
  buildingCorroded: { id: EntityId; hp: number };
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

  /**
   * Les recherches finies, dans l'ordre où elles l'ont été. Elles sont à la
   * colonie, pas au labo : elles survivent s'il tombe. La recherche en cours,
   * elle, est l'état du labo (`Lab.research`).
   */
  public researchDone: ResearchId[] = [];

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

  /** Les arbres qu'un bûcheron vise : aucun autre ne les voit. Pas sauvegardé — rejoué depuis les bûcherons. */
  private readonly claimedTrees = new Set<string>();

  /** Le dernier compte d'arbres d'une cabane, cf. `treesLeft()`. */
  private treeCount: { id: EntityId; tick: number; count: number } | null = null;

  /** La météo du tick en cours : relue dans la seed au début de chaque tick, jamais sauvegardée. */
  private spell: WeatherSpell | null = null;

  /**
   * La répartition des ouvriers, cf. `staffing()` : refaite une fois par tick,
   * ou quand un effectif, un bâtiment fini ou tombé la change. Jamais sauvegardée.
   */
  private duty: { tick: number; filled: Map<EntityId, number>; onDuty: Set<MobileId> } | null = null;

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
      researchDone: [...this.researchDone],
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
    this.researchDone = [...state.researchDone];

    const { inventory, ...player } = state.player;
    const capacity = INVENTORY_CAPACITY + bagBonus(this.perks) + this.bonus('bagCapacity');

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
    this.restoreLumberjacks();

    // Une sauvegarde d'avant l'achèvement automatique peut garder un chantier livré : il s'achève au chargement.
    for (const entity of [...this.entities.values()]) {
      if (entity.kind === 'site' && siteMissing(entity) === 0) this.complete(entity);
    }

    // Une maison d'une sauvegarde d'avant les porteurs : ses ouvriers s'y installent.
    for (const entity of this.entities.values()) {
      if (entity.kind === 'house' || entity.kind === 'depot') this.staff(entity);
      if (entity.kind === 'lumberCamp') this.staffCamp(entity);
    }
  }

  /* ------------------------------------------------------------------ tick */

  public tick(): void {
    this.tickCount += 1;
    this.drainCommands();
    this.updateWeather();

    const slowed = this.spell && !this.sheltered(this.player.x, this.player.y);
    const speed = slowed && this.spell ? WEATHER[this.spell.id].playerSpeed : 1;
    const contact = stepPlayer(
      this.player,
      this.moveX,
      this.moveY,
      this.playerObstacleAt,
      STEP_SECONDS,
      (PLAYER_SPEED_TILES + this.bonus('walkSpeed')) * speed,
    );

    this.handleContact(contact);
    this.harvestNearby();
    this.stepClock();
    this.corrode();
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

      case 'upgradeBuilding':
        this.upgrade(command.id);
        break;

      case 'applyPerks':
        this.applyPerks(command.perks);
        break;

      case 'startResearch':
        this.chooseResearch(command.lab, command.research);
        break;

      case 'cancelResearch':
        this.cancelResearch(command.lab);
        break;

      case 'transferToLab':
        this.transferToLab(command.id);
        break;

      case 'pauseBuilding':
        this.setPaused(command.id, command.paused);
        break;

      case 'setWorkers':
        this.setStaff(command.id, command.count);
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
   * stock de la ville pour ce qui manque encore, si le chantier est dans le
   * rayon de la mairie. La ville ne donne que son disponible — ce que les
   * porteurs ont déjà promis n'est pas à elle.
   */
  private transfer(id: EntityId): void {
    const found = this.siteFor(id);

    if ('reason' in found) {
      this.events.emit('siteRejected', { id, reason: found.reason });
      return;
    }

    const { site } = found;
    const town = this.townStockFor(site);
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
    const town = this.townStockFor(site);

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

  /* ------------------------------------------------------------ amélioration */

  /**
   * Ce qui manque, objet par objet, pour payer le niveau suivant : ni dans
   * le sac, ni dans le disponible de la ville à portée. Vide si tout y est ;
   * `null` si le bâtiment ne peut plus monter. L'UI écrit ces manques en
   * rouge, le tick décide sur la même réponse.
   */
  public upgradeMissing(building: Building): Partial<Record<ItemId, number>> | null {
    const upgrade = nextUpgrade(building.proto, building.level);

    if (!upgrade) return null;

    const town = this.townStockFor(building);
    const missing: Partial<Record<ItemId, number>> = {};

    for (const [item, needed] of Object.entries(upgrade.cost) as [ItemId, number][]) {
      const short = needed - this.player.inventory.available(item) - (town?.available(item) ?? 0);

      if (short > 0) missing[item] = short;
    }
    return missing;
  }

  /**
   * Le niveau suivant, tout de suite, contre son coût entier : le sac
   * d'abord, puis la ville — comme un « Transférer » sur un chantier. Les
   * points de vie gardent leur proportion : une tour à moitié cassée le
   * reste, sur un maximum plus haut.
   */
  private upgrade(id: EntityId): void {
    const building = this.entities.get(id);
    const reject = (reason: UpgradeRejection): void => this.events.emit('upgradeRejected', { id, reason });

    if (!building || building.kind === 'site') return reject('missing');
    if (!this.inReach(building)) return reject('outOfReach');

    const upgrade = nextUpgrade(building.proto, building.level);
    const missing = this.upgradeMissing(building);

    if (!upgrade || !missing) return reject('maxLevel');
    if (Object.keys(missing).length > 0) return reject('missingItems');

    const town = this.townStockFor(building);
    const fromBag: [ItemId, number][] = [];

    for (const [item, needed] of Object.entries(upgrade.cost) as [ItemId, number][]) {
      const bag = Math.min(needed, this.player.inventory.available(item));

      if (bag > 0) {
        this.player.inventory.remove(item, bag);
        fromBag.push([item, bag]);
      }
      if (needed > bag) town?.remove(item, needed - bag);
    }

    const before = buildingLevel(building.proto, building.level).hp;

    building.level += 1;
    building.hp = Math.max(1, Math.round((building.hp / before) * upgrade.hp));
    this.events.emit('buildingUpgraded', { id, level: building.level, fromBag });
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
    return this.warehouse()?.store ?? null;
  }

  /** La mairie finie, dont le coffre est le stock de la ville ; `null` tant qu'elle est en chantier ou tombée. */
  public warehouse(): TownHall | null {
    const hall = this.entities.get(this.townHallId);

    return hall?.kind === 'townHall' ? hall : null;
  }

  /**
   * Le stock de la ville, si le chantier est dans le rayon logistique de la
   * mairie (`logisticRadius`, le cercle jaune du mode construction). Hors du
   * rayon, on livre à la main ou par les porteurs : un stock global trop
   * pratique les rendrait inutiles.
   */
  private townStockFor(entity: Entity): Store | null {
    const hall = this.warehouse();

    return hall && inLogisticRange(hall, entity) ? hall.store : null;
  }

  /** Le chantier (ou le bâtiment) est-il dans le rayon de la mairie finie ? */
  public inTownRange(entity: Entity): boolean {
    return this.townStockFor(entity) !== null;
  }

  /** Ce qui manquerait encore au chantier après « Transférer » : ni dans le sac, ni dans la ville à sa portée. */
  public shortfall(site: Site): number {
    const town = this.townStockFor(site);
    let short = 0;

    // Le même calcul que `transferFrom`, sac puis ville, sans rien déplacer.
    for (const item of Object.keys(BUILDINGS[site.proto].cost) as ItemId[]) {
      const needed = this.siteNeeds(site, item, 'bag');
      const fromBag = Math.min(needed, this.player.inventory.available(item));
      const fromTown = Math.min(Math.max(0, this.siteNeeds(site, item, 'town') - fromBag), town?.available(item) ?? 0);

      short += needed - fromBag - fromTown;
    }
    return short;
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

    this.depositFromBag(town, entries);
  }

  /** Passe ces objets du sac dans le coffre de la mairie — au bouton, ou quand Adam la heurte. */
  private depositFromBag(town: Store, entries: [ItemId, number][]): void {
    const { inventory } = this.player;

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

  /**
   * Ce qui arrête Adam, au pixel près : la tuile pleine, sauf sous un arbre
   * où seul le tronc compte. Une forêt ne l'enferme jamais, sac plein ou non.
   */
  private readonly playerObstacleAt = (tx: number, ty: number): TileBox | null => {
    if (!isWalkable(terrainAt(this.seed, tx, ty)) || this.chunks.occupantAt(tx, ty) !== undefined) return FULL_TILE;

    const resource = this.resources.at(tx, ty);

    if (!resource) return null;
    return RESOURCES[resource.id].hitbox === 'trunk' ? TRUNK : FULL_TILE;
  };

  /** Ce qui arrête une bête qui se faufile entre les arbres : l'eau et le bâti, rien d'autre. */
  private readonly isOpenGroundSolid = (tx: number, ty: number): boolean =>
    !isWalkable(terrainAt(this.seed, tx, ty)) || this.chunks.occupantAt(tx, ty) !== undefined;

  /* ---------------------------------------------------------------- contact */

  /**
   * Adam n'a pas de bouton d'action : il pousse contre un chantier, et le
   * chantier se remplit ; contre une foreuse ou une ferme, et leur coffre
   * passe dans son sac. Le compteur repart à zéro dès qu'il change de cible
   * ou s'écarte, pour qu'on ne puisse pas « charger » une livraison ailleurs.
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

    const occupant = this.chunks.occupantAt(contact.tx, contact.ty);
    const entity = occupant === undefined ? undefined : this.entities.get(occupant);

    // La mairie finie heurtée avale tout le sac, une fois par contact.
    if (entity?.kind === 'townHall' && this.contactTicks === DELIVER_TICKS) {
      this.depositFromBag(entity.store, this.player.inventory.entries());
    }

    if (this.contactTicks % DELIVER_TICKS !== 0) return;

    if (entity?.kind === 'site') this.deliver(entity);
    else if (entity?.kind === 'drill' || entity?.kind === 'farm' || entity?.kind === 'lumberCamp') this.collect(entity);
    else if (entity?.kind === 'nursery') this.supplyOne(entity);
    else if (entity?.kind === 'lab') this.supplyLabOne(entity);
    // La forge prend d'abord ce qu'Adam lui apporte, puis lui rend ses plaques.
    else if (entity?.kind === 'forge' && !this.supplyOne(entity)) this.collect(entity);
  }

  /**
   * La récolte de proximité : Adam s'approche, la récolte est automatique,
   * qu'il marche ou non. Seules les tuiles autour de lui sont interrogées,
   * jamais la carte, et en distances au carré. Sac plein, rien n'est pris et
   * le HUD le dit — rien n'est jeté.
   */
  private harvestNearby(): void {
    if (this.tickCount % HARVEST_PASS_TICKS !== 0) return;

    const { player } = this;
    const reach = HARVEST_REACH_TILES * TILE_SIZE;
    const span = Math.ceil(HARVEST_REACH_TILES);
    const px = floorDiv(player.x, TILE_SIZE);
    const py = floorDiv(player.y, TILE_SIZE);
    const nodes: { tx: number; ty: number; id: ResourceId; d2: number }[] = [];

    player.harvesting = false;

    for (let ty = py - span; ty <= py + span; ty += 1) {
      for (let tx = px - span; tx <= px + span; tx += 1) {
        const resource = this.resources.at(tx, ty);

        if (!resource) continue;

        const d2 = distanceSq(player.x, player.y, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);

        if (d2 <= reach * reach) nodes.push({ tx, ty, id: resource.id, d2 });
      }
    }

    if (nodes.length === 0) return;
    if (player.inventory.freeSpace() <= 0) {
      this.events.emit('inventoryFull', {});
      return;
    }

    nodes.sort((a, b) => a.d2 - b.d2);

    const refused = new Set<ItemId>();

    for (const node of nodes.slice(0, HARVEST_MAX_NODES)) {
      const { item } = RESOURCES[node.id];

      // Assez de cet objet dans le sac : Adam n'en prend plus, et le joueur le voit.
      if (player.inventory.count(item) >= this.carryLimit(item)) {
        if (!refused.has(item)) this.events.emit('harvestRefused', { tx: node.tx, ty: node.ty, item });
        refused.add(item);
        continue;
      }
      player.harvesting = true;

      // Hache ou pioche reçues d'Ève : un nœud donne plus d'une unité par passage.
      const pass = this.tickCount / HARVEST_PASS_TICKS;
      const base = harvestYieldWith(this.perks, node.id, harvestYieldWithTools(node.id, this.questsDone), pass);
      // Haches affûtées (labo) : une part de bois en plus, répartie sur les passages.
      const units = item === 'wood' ? base + extraUnits(base, this.bonus('woodYield'), pass) : base;

      for (let i = 0; i < units; i += 1) {
        if (player.inventory.freeSpace() <= 0) {
          this.events.emit('inventoryFull', {});
          return;
        }
        if (player.inventory.count(item) >= this.carryLimit(item)) break;
        this.harvest(node.tx, node.ty);
      }
    }
  }

  private harvest(tx: number, ty: number): void {
    const { inventory } = this.player;
    const taken = this.resources.take(tx, ty);

    if (!taken) return;

    const item = RESOURCES[taken.resource.id].item;
    // L'arc-en-ciel double la récolte ; ce qui ne tient pas dans le sac reste sur place, pas perdu : la tuile n'a perdu qu'une unité.
    const amount = inventory.add(item, this.spell ? WEATHER[this.spell.id].harvestYield : 1);

    // Le chunk ne rebake que si l'aspect de la tuile change : entamé, ou disparu.
    if (taken.stageChanged) this.dirtyTile(tx, ty);

    this.events.emit('resourceHarvested', { tx, ty, item, amount, remaining: taken.resource.remaining });
  }

  /**
   * Ce qui attend encore cet objet : les chantiers ouverts, tous confondus,
   * plus ce que nurseries et forges acceptent pour leur recette. Une fois la
   * mairie debout, la ville prend tout — son coffre est sans fond : tout
   * objet y est utile. C'est ce qui rend un objet utile dans le sac.
   */
  public wanted(item: ItemId): number {
    if (this.townStock()) return Infinity;

    let wanted = 0;

    for (const entity of this.entities.values()) {
      if (entity.kind !== 'site') {
        wanted += this.accepts(entity, item);
        continue;
      }
      wanted += this.siteNeeds(entity, item, 'bag');
    }
    return wanted;
  }

  /**
   * Combien Adam accepte d'en porter : ce qui l'attend, plus une petite
   * réserve. Au-delà, la récolte de cet objet est refusée.
   */
  public carryLimit(item: ItemId): number {
    return this.wanted(item) + SPARE_CARRY;
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
  private collect(producer: Producer): void {
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

  /* ------------------------------------------------------ labo de recherche */

  /**
   * Ce que les recherches finies ajoutent à une statistique : **le** point
   * où la simulation lit leurs effets. L'arc, le sac, la marche d'Adam, les
   * porteurs, la récolte du bois, les foreuses et les fermes l'appellent au
   * moment d'agir ; les données, elles, ne changent jamais.
   */
  public bonus(stat: ResearchStat): number {
    return researchBonus(this.researchDone, stat);
  }

  /** Le labo fini de la colonie — il n'y en a qu'un —, ou `null`. */
  public lab(): Lab | null {
    for (const entity of this.entities.values()) {
      if (entity.kind === 'lab') return entity;
    }
    return null;
  }

  /** Le labo désigné par une commande, s'il existe et qu'il est bâti. */
  private labFor(id: EntityId): Lab | null {
    const entity = this.entities.get(id);

    if (entity?.kind === 'lab') return entity;
    this.events.emit('researchRejected', { id, reason: 'missing' });
    return null;
  }

  /**
   * « Lancer » : le labo choisit sa recherche et attend son coût. Une seule
   * à la fois — refusé si le compte à rebours d'une autre tourne ; une
   * recherche qui attendait encore son coût est remplacée, ce qui était
   * déposé reste au coffre et compte pour la nouvelle s'il lui sert. Si le
   * coffre a déjà tout, le compte à rebours part aussitôt.
   */
  private chooseResearch(id: EntityId, research: ResearchId): void {
    const lab = this.labFor(id);

    if (!lab) return;
    if (lab.endTick > 0) {
      this.events.emit('researchRejected', { id, reason: 'busy' });
      return;
    }
    if (!Object.hasOwn(RESEARCH, research) || this.researchDone.includes(research) || missingRequirements(research, this.researchDone).length > 0) {
      this.events.emit('researchRejected', { id, reason: 'locked' });
      return;
    }
    if (lab.research === research) return;

    lab.research = research;
    this.events.emit('researchChosen', { id, research });
    this.startCountdown(lab);
  }

  /** « Abandonner » : tant que le coût n'est pas réuni, le labo lâche sa recherche. Rien de déposé n'est perdu. */
  private cancelResearch(id: EntityId): void {
    const lab = this.labFor(id);

    if (!lab) return;
    if (!isCollecting(lab)) {
      this.events.emit('researchRejected', { id, reason: lab.endTick > 0 ? 'busy' : 'idle' });
      return;
    }

    const research = lab.research!;

    lab.research = null;
    this.events.emit('researchCancelled', { id, research });
  }

  /**
   * « Transférer » : ce que la recherche attend, le sac d'abord, puis le
   * stock de la ville si le labo est dans le rayon de la mairie — comme un
   * chantier. La ville ne donne que son disponible, et pas ce qu'un porteur
   * apporte déjà.
   */
  private transferToLab(id: EntityId): void {
    const lab = this.labFor(id);

    if (!lab) return;

    const reason: ResearchRejection | null = !isCollecting(lab) ? 'idle' : !this.inReach(lab) ? 'outOfReach' : null;

    if (reason) {
      this.events.emit('researchRejected', { id, reason });
      return;
    }

    const town = this.townStockForLab(lab);
    let moved = 0;

    for (const [item] of researchCost(lab.research!)) {
      moved += this.supplyLab(lab, item, Math.min(labNeeds(lab, item), this.player.inventory.count(item)), this.player.inventory, 'bag');
      if (town) moved += this.supplyLab(lab, item, Math.min(labWants(lab, item), town.available(item)), town, 'town');
    }

    if (moved === 0) {
      this.events.emit('researchRejected', { id, reason: 'nothingToGive' });
      return;
    }
    this.startCountdown(lab);
  }

  /** Au contact : un objet du sac que la recherche attend entre au labo. */
  private supplyLabOne(lab: Lab): void {
    if (!isCollecting(lab)) return;

    for (const [item] of researchCost(lab.research!)) {
      if (this.supplyLab(lab, item, Math.min(1, labNeeds(lab, item), this.player.inventory.count(item)), this.player.inventory, 'bag') > 0) {
        this.startCountdown(lab);
        return;
      }
    }
  }

  /** Passe `amount` objets de `from` au coffre du labo. Renvoie ce qui est passé. */
  private supplyLab(lab: Lab, item: ItemId, amount: number, from: Store, source: 'bag' | 'town'): number {
    // Jamais plus que la place libre : ce qui sortirait du sac sans entrer au labo serait perdu.
    const count = Math.min(amount, lab.store.freeSpace());

    if (count <= 0) return 0;

    const moved = lab.store.add(item, from.remove(item, count));

    if (moved > 0) this.events.emit('labSupplied', { id: lab.id, item, amount: moved, source });
    return moved;
  }

  /** Le stock de la ville, si le labo est dans le rayon de la mairie. */
  private townStockForLab(lab: Lab): Store | null {
    const hall = this.warehouse();

    return hall && inLogisticRange(hall, lab) ? hall.store : null;
  }

  /** Un « Transférer » poserait-il quelque chose au labo ? L'UI grise le bouton sur cette réponse. */
  public canTransferToLab(lab: Lab): boolean {
    if (!isCollecting(lab)) return false;

    const town = this.townStockForLab(lab);

    return researchCost(lab.research!).some(
      ([item]) =>
        (labNeeds(lab, item) > 0 && this.player.inventory.count(item) > 0) ||
        (labWants(lab, item) > 0 && (town?.available(item) ?? 0) > 0),
    );
  }

  /** Le labo est-il dans le rayon de la mairie finie ? */
  public labInTownRange(lab: Lab): boolean {
    return this.townStockForLab(lab) !== null;
  }

  /** Le coût est-il réuni ? Alors il est consommé, et le compte à rebours part. */
  private startCountdown(lab: Lab): void {
    if (!isCollecting(lab) || labMissing(lab) > 0) return;

    const research = lab.research!;

    for (const [item, amount] of researchCost(research)) lab.store.remove(item, amount);
    lab.endTick = this.tickCount + RESEARCH[research].duration;
    this.scheduler.schedule(lab.id, lab.endTick, this.tickCount);
    this.events.emit('researchStarted', { id: lab.id, research, endTick: lab.endTick });
  }

  /** Le labo se réveille à la fin du compte à rebours : l'effet vaut pour toute la partie. */
  private finishResearch(lab: Lab): void {
    const research = lab.research;

    if (research === null || lab.endTick === 0 || this.tickCount < lab.endTick) return;

    lab.research = null;
    lab.endTick = 0;
    this.researchDone.push(research);

    // Grand sac : le sac grandit sur-le-champ, avec tout ce qu'il contient.
    const { effect } = RESEARCH[research];

    if (effect.stat === 'bagCapacity') {
      const { inventory } = this.player;

      this.player.inventory = Store.fromJSON(inventory.capacity + effect.amount, inventory.toJSON());
    }
    this.events.emit('researchCompleted', { id: lab.id, research });
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

    // Un seul labo par colonie : le menu le grise déjà, le tick refuse pareil.
    if (this.atLimit(building)) return { reason: 'unique', tiles: tiles(() => true) };

    return null;
  }

  /**
   * Le bâtiment est-il débloqué ? Il faut son plan, s'il en demande un (quêtes
   * d'Ève), et avoir vu tomber la nuit `unlockNight`.
   */
  public isUnlocked(building: BuildingId): boolean {
    return isUnlocked(building, this.questsDone) && this.night >= BUILDINGS[building].unlockNight;
  }

  /** Un bâtiment unique (`unique`) déjà posé — chantier compris — n'en admet pas un second. */
  public atLimit(building: BuildingId): boolean {
    if (!BUILDINGS[building].unique) return false;

    for (const entity of this.entities.values()) {
      if (entity.proto === building) return true;
    }
    return false;
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
      level: 1,
      paused: false,
      staff: proto.workers,
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

      case 'clinic':
        building = { ...base, kind: 'clinic' };
        break;

      case 'lab':
        building = { ...base, kind: 'lab', research: null, endTick: 0 };
        break;

      case 'lumberCamp':
        building = { ...base, kind: 'lumberCamp' };
        break;

      case 'depot':
        building = { ...base, kind: 'depot' };
        break;
    }

    this.entities.set(site.id, building);
    this.dirtyTile(site.tx, site.ty);
    this.duty = null;
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

      case 'lumberCamp':
        this.staffCamp(building);
        break;

      case 'depot':
        this.staff(building);
        break;

      case 'clinic':
        // Des lits vides : elle attend qu'un mutant tombe assommé.
        break;

      case 'lab':
        // Aucune recherche choisie : il attend le joueur, sans rien coûter.
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

      case 'lab':
        this.finishResearch(entity);
        break;

      case 'site':
      case 'townHall':
      case 'house':
      case 'clinic':
      case 'lumberCamp':
      case 'depot':
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

    // À sec ou en pause : elle ne se replanifie plus — « Reprendre » la relance.
    if (!item || drill.paused) {
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
    // Foreuses rapides (labo) : le cycle raccourcit, jamais sous un tick.
    const duration = Math.max(1, recipe.duration + this.bonus('drillTicks'));

    this.scheduler.schedule(drill.id, this.tickCount + duration, this.tickCount);
  }

  /**
   * Un cycle de ferme : même logique que la foreuse — coffre plein, la ferme
   * s'endort et ne coûte plus rien jusqu'à ce qu'on vienne la vider.
   */
  private runFarm(farm: Farm): void {
    // En pause, ou personne aux champs : elle s'endort jusqu'à ce qu'on la relance.
    if (this.stopped(farm)) {
      farm.blocked = true;
      return;
    }

    const recipe = RECIPES[FARM_RECIPE];
    const [item, base] = (Object.entries(recipe.outputs) as [ItemId, number][])[0] ?? ['food', 1];
    // Fermes fertiles (labo) : la même récolte, plus généreuse.
    const amount = base + this.bonus('farmYield');
    const accepted = farm.store.add(item, amount);

    if (accepted < amount) {
      farm.blocked = true;
      return;
    }

    farm.blocked = false;
    this.events.emit('farmProduced', { id: farm.id, item });
    this.scheduleFarm(farm);
  }

  /** La cadence de la recette est celle de la ferme au complet : à moitié d'ouvriers, deux fois plus lente. */
  private scheduleFarm(farm: Farm): void {
    const { filled, max } = this.staffing(farm) ?? { filled: 1, max: 1 };
    const duration = Math.ceil((RECIPES[FARM_RECIPE].duration * max) / Math.max(1, filled));

    this.scheduler.schedule(farm.id, this.tickCount + duration, this.tickCount);
  }

  /**
   * Un cycle de forge : les entrées deviennent la plaque. Comme la foreuse,
   * une forge à qui il manque du fer ou du charbon ne se replanifie pas —
   * c'est la livraison d'Adam qui la relance.
   */
  private runForge(forge: Forge): void {
    const recipe: RecipeProto = RECIPES[FORGE_RECIPE];

    // En pause, le four ne mange rien : le cycle en cours ne se termine pas.
    if (!forge.paused && canCraft(forge.store, recipe)) {
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

    if (forge.paused || !canCraft(forge.store, recipe)) {
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

    // En pause : l'heure passe sans naissance ni repas, et rien n'est replanifié — « Reprendre » la relance.
    if (nursery.paused) return;

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

    const { weapon } = buildingLevel(tower.proto, tower.level);

    if (!weapon) return;

    const x = (tower.tx + tower.width / 2) * TILE_SIZE;
    const y = (tower.ty + tower.height / 2) * TILE_SIZE;
    const target = nearestFoe(this.mutants(), x, y, WEAPONS[weapon].range * this.rangeFactor());

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
   * ouvriers qu'emploient les bâtiments finis — plus les ex-mutants sortis
   * de la clinique. Un chantier n'emploie personne.
   */
  public population(): { adults: number; children: number; workers: number } {
    let children = 0;
    let workers = 0;

    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'kid') children += 1;
      if (mobile.kind === 'worker' && mobile.exMutant) workers += 1;
    }
    for (const entity of this.entities.values()) {
      if (entity.kind !== 'site') workers += BUILDINGS[entity.proto].workers;
    }
    return { adults: this.eve() ? 2 : 1, children, workers };
  }

  /**
   * Les ouvriers, comptés comme `population()` : ceux qu'emploient les
   * bâtiments finis. Les porteurs dont la maison est tombée quittent la
   * colonie : ils ne comptent plus. Ceux qu'on a retirés d'un poste
   * (`setWorkers`) sont libres.
   */
  public workforce(): Workforce {
    const counts = new Map<BuildingId, number>();
    let total = 0;
    let busy = 0;
    let idle = 0;
    let assigned = 0;
    let missing = 0;

    for (const entity of this.entities.values()) {
      const { workers } = BUILDINGS[entity.proto];

      if (entity.kind === 'site' || workers === 0) continue;
      counts.set(entity.proto, (counts.get(entity.proto) ?? 0) + workers);
      total += workers;

      const filled = this.roster().filled.get(entity.id) ?? 0;

      assigned += filled;
      missing += entity.staff - filled;
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

    return { total, byBuilding, porters: { busy, idle }, assigned, free: total - assigned, missing };
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
    const bedtime = this.isBedtime();
    let lootBlocked = false;

    for (const mobile of this.mobiles.values()) {
      switch (mobile.kind) {
        case 'mutant': {
          const spell = this.spell;
          const wind = spell && { windX: spell.windX, windY: spell.windY, downwind: WEATHER[spell.id].mutantDownwind };
          const step = stepMutant(mobile, this.target, this.occupantAt, STEP_SECONDS, wind);

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
          const hit = stepArrow(mobile, this.foes(), this.wind());

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
          this.stepWorker(mobile, alarm, bedtime);
          break;

        case 'lumberjack':
          this.stepLumberjack(mobile, alarm, bedtime);
          break;

        case 'pickup':
          lootBlocked = this.stepPickup(mobile) || lootBlocked;
          break;

        case 'patient':
          this.stepPatient(mobile);
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

    const target = nearestFoe(this.foes(), player.x, player.y, WEAPONS.bow.range * this.rangeFactor());

    player.target = target?.id ?? null;

    if (!target || player.bowCooldown > 0) return;

    // Le corps est au-dessus des pieds : la flèche part de la poitrine.
    this.fire('bow', player.x, player.y - 8, target, this.bonus('bowDamage'));
    // Tir rapide (labo) : le délai raccourcit, jamais sous un tick.
    player.bowCooldown = Math.max(1, WEAPONS.bow.cooldown + this.bonus('bowCooldown'));

    // À l'arrêt, Adam se tourne vers ce qu'il vise.
    if (this.moveX === 0 && this.moveY === 0) {
      player.facing = facingOf(target.x - player.x, target.y - player.y);
    }
  }

  /** `extraDamage` : ce que la recherche ajoute aux dégâts de l'arme. */
  private fire(weapon: keyof typeof WEAPONS, x: number, y: number, target: Foe, extraDamage = 0): void {
    const arrow = shoot(this.nextMobileId++, weapon, x, y, target, this.wind());

    arrow.damage += extraDamage;
    this.mobiles.set(arrow.id, arrow);
    this.events.emit('arrowShot', { x, y });
  }

  /**
   * Une flèche touche un mutant. À zéro, il s'évapore et lâche son butin —
   * sauf si une clinique a une place pour lui et que le sort le veut : il
   * tombe alors assommé, sans butin, mais avec une chance d'être recruté.
   */
  private hurtMutant(mutant: Mutant, damage: number): void {
    mutant.hp -= damage;

    if (mutant.hp > 0) {
      this.events.emit('mutantHit', { id: mutant.id, hp: mutant.hp, x: mutant.x, y: mutant.y });
      return;
    }
    this.mobiles.delete(mutant.id);
    this.kills += 1;

    const clinic = this.freeClinic(mutant.x, mutant.y);

    if (clinic && this.rng() < CLINIC.stunChance) {
      this.stun(mutant, clinic);
    } else {
      this.events.emit('mutantDied', { id: mutant.id, x: mutant.x, y: mutant.y });
      this.dropLoot(ENEMIES[mutant.proto].loot, mutant.x, mutant.y);
    }

    if (!this.defeated && !this.hasMutants()) this.events.emit('waveCleared', { night: this.night });
  }

  /* --------------------------------------------------------------- clinique */

  /**
   * Places prises dans une clinique : ses patients, où qu'ils en soient, et
   * les ex-mutants qu'elle loge.
   */
  public clinicBedsUsed(id: EntityId): number {
    let used = 0;

    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'patient' && mobile.clinicId === id) used += 1;
      else if (mobile.kind === 'worker' && mobile.exMutant && mobile.homeId === id) used += 1;
    }
    return used;
  }

  /** La clinique finie la plus proche qui a encore une place, ou `null`. */
  private freeClinic(x: number, y: number): Clinic | null {
    let best: Clinic | null = null;
    let bestDistance = Infinity;

    for (const entity of this.entities.values()) {
      if (entity.kind !== 'clinic' || this.clinicBedsUsed(entity.id) >= CLINIC.beds) continue;

      const door = doorOf(entity);
      const distance = distanceSq(x, y, door.x, door.y);

      if (distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Le mutant tombe assommé là où il est : un patient, à qui la clinique garde une place. */
  private stun(mutant: Mutant, clinic: Clinic): void {
    const patient: Patient = {
      kind: 'patient',
      id: this.nextMobileId++,
      x: mutant.x,
      y: mutant.y,
      prevX: mutant.x,
      prevY: mutant.y,
      facing: 'down',
      moving: false,
      state: 'stunned',
      clinicId: clinic.id,
      ticks: CLINIC.stunTicks,
    };

    this.mobiles.set(patient.id, patient);
    this.events.emit('mutantStunned', { id: patient.id, clinicId: clinic.id, x: patient.x, y: patient.y });
  }

  /**
   * Un tick de patient. Assommé, il attend qu'Adam le touche ; après, il le
   * suit en boitillant, en ligne droite comme un porteur, jusqu'à la porte
   * de sa clinique ; dedans, il guérit. Si personne ne vient, ou si sa
   * clinique tombe, il s'évapore comme un mutant abattu.
   */
  private stepPatient(patient: Patient): void {
    const clinic = this.entities.get(patient.clinicId);

    if (clinic?.kind !== 'clinic') {
      this.evaporate(patient);
      return;
    }

    const { player } = this;

    switch (patient.state) {
      case 'stunned': {
        const reach = CLINIC.touchRadius * TILE_SIZE;

        standStill(patient);
        patient.ticks -= 1;

        if (distanceSq(player.x, player.y, patient.x, patient.y) <= reach * reach) {
          patient.state = 'following';
          this.events.emit('patientFollowing', { id: patient.id, x: patient.x, y: patient.y });
        } else if (patient.ticks <= 0) {
          this.evaporate(patient);
        }
        break;
      }

      case 'following': {
        const door = doorOf(clinic);
        const admit = CLINIC.admitRadius * TILE_SIZE;
        const gap = CLINIC.followGap * TILE_SIZE;

        if (distanceSq(patient.x, patient.y, door.x, door.y) <= admit * admit) {
          patient.state = 'care';
          patient.ticks = CLINIC.careTicks;
          patient.x = patient.prevX = door.x;
          patient.y = patient.prevY = door.y;
          patient.moving = false;
          this.events.emit('patientAdmitted', { id: patient.id, clinicId: clinic.id });
        } else if (distanceSq(player.x, player.y, patient.x, patient.y) <= gap * gap) {
          standStill(patient);
        } else {
          walkToward(patient, player.x, player.y, STEP_SECONDS);
        }
        break;
      }

      case 'care':
        standStill(patient);
        patient.ticks -= 1;
        if (patient.ticks <= 0) this.heal(patient, clinic);
        break;
    }
  }

  /** Oublié ou sans clinique : il s'évapore comme un mutant abattu, et lâche son butin. */
  private evaporate(patient: Patient): void {
    this.mobiles.delete(patient.id);
    this.events.emit('mutantDied', { id: patient.id, x: patient.x, y: patient.y });
    this.dropLoot(ENEMIES.mutant.loot, patient.x, patient.y);
  }

  /** La nuit de soins est finie : il sort sur le seuil, ex-mutant et porteur, logé à la clinique. */
  private heal(patient: Patient, clinic: Clinic): void {
    const door = doorOf(clinic);
    const worker: Worker = {
      kind: 'worker',
      id: this.nextMobileId++,
      x: door.x,
      y: door.y,
      prevX: door.x,
      prevY: door.y,
      facing: 'down',
      moving: false,
      homeId: clinic.id,
      exMutant: true,
      logistician: false,
      // Il reste un instant sur le seuil, qu'on le voie sortir, avant de chercher du travail.
      inside: false,
      job: null,
      searchTicks: PORTERS.retryTicks,
      ...wanderFrom(door.x, door.y),
    };

    this.mobiles.delete(patient.id);
    this.mobiles.set(worker.id, worker);
    this.events.emit('mutantHealed', { id: worker.id, clinicId: clinic.id, x: door.x, y: door.y });
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
        if (!target || target.kind === 'site' || target.hp >= buildingLevel(target.proto, target.level).hp || this.hasMutants()) {
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
        target.hp = Math.min(buildingLevel(target.proto, target.level).hp, target.hp + EVE.repairAmount);
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

  /** Les producteurs — foreuses, fermes, cabanes de bûcheron — que les logisticiens du poste vident : ceux de son rayon. */
  public depotProducers(depot: Depot): number {
    let count = 0;

    for (const entity of this.entities.values()) {
      if (isProducer(entity) && inDepotRange(depot, entity)) count += 1;
    }
    return count;
  }

  /** Ce que le chantier attend encore et qu'aucun porteur n'apporte — la fenêtre du chantier peut l'afficher. */
  public siteIncoming(id: EntityId, item: ItemId): number {
    return this.jobs.siteIncoming(id, item);
  }

  private readonly lineIsClear: LineTest = (x0, y0, x1, y1) => clearLine(this.seed, x0, y0, x1, y1);

  /**
   * Loge les ouvriers de la maison — ou les logisticiens du poste — qui n'y
   * sont pas encore. Ils sortent un par un, dès qu'il y a à porter.
   */
  private staff(house: House | Depot): void {
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
        exMutant: false,
        logistician: house.kind === 'depot',
        inside: true,
        job: null,
        searchTicks: 1 + i * 8,
        ...wanderFrom(door.x, door.y),
      };

      this.mobiles.set(worker.id, worker);
    }
  }

  /**
   * Un tick d'ouvrier. Pendant une vague, il rentre s'abriter avec sa
   * charge et n'en ressort qu'une fois le dernier mutant tombé. Sinon, il
   * suit son job — la source, puis la destination — ou en cherche un toutes
   * les `retryTicks` ; sans rien à porter, il flâne devant chez lui, et
   * rentre dormir à la tombée de la nuit.
   */
  private stepWorker(worker: Worker, alarm: boolean, bedtime: boolean): void {
    const home = this.entities.get(worker.homeId);
    const homeDoor = home ? doorOf(home) : null;

    if (alarm && homeDoor) {
      this.goHome(worker, homeDoor);
      return;
    }

    // Sans poste — on l'a retiré de la maison —, il finit sa livraison puis ne cherche plus rien.
    if (!worker.job && this.onDuty(worker)) {
      worker.searchTicks -= 1;

      // Un logisticien dont le poste est tombé ne cherche plus rien.
      const crew: Crew | null = !worker.logistician
        ? PORTER_CREW
        : home?.kind === 'depot'
          ? { kind: 'logistician', depot: home }
          : null;

      if (worker.searchTicks <= 0 && crew) {
        worker.searchTicks = PORTERS.retryTicks;
        worker.job = this.jobs.assign(
          this.entities,
          this.townHallId,
          worker,
          homeDoor ?? worker,
          this.lineIsClear,
          carryOf(worker) + this.bonus('porterCarry'),
          crew,
        );
      }
    }

    const { job } = worker;

    if (!job) {
      // Sa maison est tombée et il n'a plus rien à porter : il quitte la colonie.
      if (!homeDoor) this.mobiles.delete(worker.id);
      else this.idle(worker, homeDoor, bedtime);
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

  private goHome(worker: Worker | Lumberjack, door: { x: number; y: number }): void {
    if (worker.inside) standStill(worker);
    else if (walkToward(worker, door.x, door.y, STEP_SECONDS)) worker.inside = true;
  }

  /** Sans travail : il dort chez lui à la nuit tombée, et flâne devant sa porte le reste du temps. */
  private idle(worker: Worker | Lumberjack, door: { x: number; y: number }, bedtime: boolean): void {
    if (bedtime) {
      this.goHome(worker, door);
      return;
    }
    if (worker.inside) {
      // Il sort : sa flânerie repart de sa porte.
      worker.inside = false;
      Object.assign(worker, wanderFrom(door.x, door.y));
    }
    wander(worker, door, this.seed, this.tickCount, STEP_SECONDS);
  }

  /** Le crépuscule et la nuit : les ouvriers sans travail vont se coucher. Sans cycle — mairie en chantier —, jamais. */
  private isBedtime(): boolean {
    const phase = this.clock()?.phase;

    return phase === 'dusk' || phase === 'night';
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
      // Au labo, il lance le compte à rebours.
      if (target.kind === 'lab') this.startCountdown(target);
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

  /* -------------------------------------------------------------- bûcherons */

  private *lumberjacks(): IterableIterator<Lumberjack> {
    for (const mobile of this.mobiles.values()) {
      if (mobile.kind === 'lumberjack') yield mobile;
    }
  }

  /** Loge les bûcherons de la cabane qui n'y sont pas encore. */
  private staffCamp(camp: LumberCamp): void {
    let lodged = 0;

    for (const lumberjack of this.lumberjacks()) {
      if (lumberjack.homeId === camp.id) lodged += 1;
    }

    const door = doorOf(camp);

    for (let i = lodged; i < BUILDINGS[camp.proto].workers; i += 1) {
      const lumberjack: Lumberjack = {
        kind: 'lumberjack',
        id: this.nextMobileId++,
        x: door.x,
        y: door.y,
        prevX: door.x,
        prevY: door.y,
        facing: 'down',
        moving: false,
        homeId: camp.id,
        inside: true,
        state: 'idle',
        tree: null,
        chopTicks: 0,
        load: 0,
        // Ils ne sortent pas du même pas : le second suit le premier.
        searchTicks: 1 + i * 12,
        ...wanderFrom(door.x, door.y),
      };

      this.mobiles.set(lumberjack.id, lumberjack);
    }
  }

  /**
   * Les arbres encore debout dans le rayon de la cabane — zéro : « Plus
   * d'arbres à portée ». La fenêtre le demande à chaque image : le compte
   * n'est refait qu'une fois par tick.
   */
  public treesLeft(camp: LumberCamp): number {
    if (this.treeCount?.id !== camp.id || this.treeCount.tick !== this.tickCount) {
      this.treeCount = { id: camp.id, tick: this.tickCount, count: treesInRange(camp, this.resources).length };
    }
    return this.treeCount.count;
  }

  /**
   * Un tick de bûcheron. Hors d'un voyage, il cherche un arbre toutes les
   * `retryTicks` — à condition qu'il y ait au coffre la place d'un voyage,
   * réservée aussitôt : le bois rapporté y entre toujours. Coffre plein, il
   * attend devant la porte ; plus d'arbre à portée, il flâne. La nuit, il ne
   * repart pas ; pendant une vague, il rentre s'abriter, bois compris, et
   * reprend son voyage ensuite.
   */
  private stepLumberjack(lumberjack: Lumberjack, alarm: boolean, bedtime: boolean): void {
    const camp = this.entities.get(lumberjack.homeId);

    // Sa cabane est tombée : il lâche son arbre et quitte la colonie.
    if (camp?.kind !== 'lumberCamp') {
      this.releaseTree(lumberjack);
      this.mobiles.delete(lumberjack.id);
      return;
    }

    const door = doorOf(camp);

    if (alarm) {
      // Il reprendra son arbre après la vague : il lui faudra d'abord y retourner.
      if (lumberjack.state === 'chop') lumberjack.state = 'toTree';
      this.goHome(lumberjack, door);
      return;
    }

    // Cabane en pause, ou lui retiré de son poste : il finit son geste — rapporter le bois qu'il a —, puis flâne.
    const working = !camp.paused && this.onDuty(lumberjack);

    if (!working) {
      if (lumberjack.state === 'toTree' || lumberjack.state === 'chop') this.endTrip(lumberjack, door);
      else if (lumberjack.state === 'wait' && lumberjack.load === 0) lumberjack.state = 'idle';
    }

    switch (lumberjack.state) {
      case 'idle':
      case 'wait':
        lumberjack.searchTicks -= 1;
        if (lumberjack.searchTicks <= 0 && working && !bedtime && lumberjack.load === 0) {
          lumberjack.searchTicks = LUMBERJACKS.retryTicks;
          this.startTrip(lumberjack, camp, door);
        }
        if (lumberjack.state === 'idle') this.idle(lumberjack, door, bedtime);
        else if (lumberjack.state === 'wait') this.waitAtCamp(lumberjack, door, bedtime);
        else lumberjack.inside = false;
        break;

      case 'toTree': {
        const tree = lumberjack.tree;

        lumberjack.inside = false;
        if (!tree || !isTree(this.resources, tree.tx, tree.ty)) {
          // Adam l'a coupé avant lui : il en cherche un autre sans attendre.
          this.endTrip(lumberjack, door);
          break;
        }

        const spot = chopSpot(tree);

        if (walkToward(lumberjack, spot.x, spot.y, STEP_SECONDS)) {
          lumberjack.state = 'chop';
          lumberjack.facing = 'right';
          lumberjack.chopTicks = LUMBERJACKS.chopTicks;
        }
        break;
      }

      case 'chop':
        standStill(lumberjack);
        lumberjack.inside = false;
        lumberjack.chopTicks -= 1;
        if (lumberjack.chopTicks <= 0) this.chop(lumberjack, door);
        break;

      case 'toCamp':
        lumberjack.inside = false;
        if (walkToward(lumberjack, door.x, door.y, STEP_SECONDS)) this.storeWood(lumberjack, camp);
        break;
    }
  }

  /** Un voyage commence : la place au coffre, puis l'arbre — les deux réservés, ou rien. */
  private startTrip(lumberjack: Lumberjack, camp: LumberCamp, door: { x: number; y: number }): void {
    if (!camp.store.reserveIn('wood', LUMBERJACKS.carry)) {
      lumberjack.state = 'wait';
      return;
    }

    const tree = pickTree(camp, door, this.resources, this.claimedTrees, this.lineIsClear);

    if (!tree) {
      camp.store.releaseIn('wood', LUMBERJACKS.carry);
      lumberjack.state = 'idle';
      return;
    }

    this.claimedTrees.add(coordKey(tree.tx, tree.ty));
    lumberjack.tree = tree;
    lumberjack.state = 'toTree';
  }

  /** Un coup de hache : une unité de bois dans les bras. Arbre tombé ou bras pleins, il rentre. */
  private chop(lumberjack: Lumberjack, door: { x: number; y: number }): void {
    const tree = lumberjack.tree;
    const taken = tree ? this.resources.take(tree.tx, tree.ty) : null;

    if (!tree || !taken || taken.resource.id !== 'tree') {
      this.endTrip(lumberjack, door);
      return;
    }

    lumberjack.load += 1;
    lumberjack.chopTicks = LUMBERJACKS.chopTicks;
    // La même règle que pour Adam : entamé à mi-chemin, disparu à la dernière unité.
    if (taken.stageChanged) this.dirtyTile(tree.tx, tree.ty);
    this.events.emit('treeChopped', {
      lumberjackId: lumberjack.id,
      tx: tree.tx,
      ty: tree.ty,
      remaining: taken.resource.remaining,
    });

    if (taken.resource.remaining <= 0 || lumberjack.load >= LUMBERJACKS.carry) this.endTrip(lumberjack, door);
  }

  /** Plus rien à couper ici : l'arbre est lâché ; avec du bois, il le rapporte, sinon il repart aussitôt. */
  private endTrip(lumberjack: Lumberjack, door: { x: number; y: number }): void {
    this.releaseTree(lumberjack);

    if (lumberjack.load > 0) {
      lumberjack.state = 'toCamp';
      return;
    }

    const camp = this.entities.get(lumberjack.homeId);

    if (camp?.kind === 'lumberCamp') camp.store.releaseIn('wood', LUMBERJACKS.carry);
    lumberjack.state = 'idle';
    lumberjack.searchTicks = 0;
    Object.assign(lumberjack, wanderFrom(door.x, door.y));
  }

  /** À la porte : la place réservée devient du bois dans le coffre. */
  private storeWood(lumberjack: Lumberjack, camp: LumberCamp): void {
    camp.store.releaseIn('wood', LUMBERJACKS.carry);

    const stored = camp.store.add('wood', lumberjack.load);

    lumberjack.load -= stored;
    if (stored > 0) this.events.emit('woodStored', { lumberjackId: lumberjack.id, id: camp.id, amount: stored });

    // Ce qui ne rentre pas — une sauvegarde retouchée, jamais en jeu — reste dans ses bras : il attend.
    lumberjack.state = lumberjack.load > 0 ? 'wait' : 'idle';
    lumberjack.searchTicks = 0;
  }

  /** Coffre plein : devant la porte, bois dans les bras s'il en a, jusqu'à ce qu'un porteur fasse de la place. */
  private waitAtCamp(lumberjack: Lumberjack, door: { x: number; y: number }, bedtime: boolean): void {
    if (lumberjack.load > 0) {
      const camp = this.entities.get(lumberjack.homeId);

      if (camp?.kind === 'lumberCamp' && camp.store.freeSpace() > 0) {
        const stored = camp.store.add('wood', lumberjack.load);

        lumberjack.load -= stored;
        if (stored > 0) this.events.emit('woodStored', { lumberjackId: lumberjack.id, id: camp.id, amount: stored });
      }
    }
    if (bedtime && lumberjack.load === 0) {
      this.goHome(lumberjack, door);
      return;
    }
    lumberjack.inside = false;
    if (walkToward(lumberjack, door.x, door.y, STEP_SECONDS)) lumberjack.facing = 'down';
  }

  private releaseTree(lumberjack: Lumberjack): void {
    if (lumberjack.tree) this.claimedTrees.delete(coordKey(lumberjack.tree.tx, lumberjack.tree.ty));
    lumberjack.tree = null;
  }

  /**
   * Après un chargement : les arbres visés et la place réservée au coffre se
   * rejouent depuis les bûcherons sauvegardés. Un arbre déjà pris par un
   * autre — une sauvegarde retouchée — est lâché.
   */
  private restoreLumberjacks(): void {
    this.claimedTrees.clear();

    for (const lumberjack of this.lumberjacks()) {
      const camp = this.entities.get(lumberjack.homeId);
      const onTrip = lumberjack.state === 'toTree' || lumberjack.state === 'chop' || lumberjack.state === 'toCamp';

      if (lumberjack.tree) {
        const key = coordKey(lumberjack.tree.tx, lumberjack.tree.ty);

        if (this.claimedTrees.has(key) || !onTrip) lumberjack.tree = null;
        else this.claimedTrees.add(key);
      }
      if (onTrip && camp?.kind === 'lumberCamp') camp.store.reserveIn('wood', LUMBERJACKS.carry);
    }
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

  /* ----------------------------------------------------------------- météo */

  /** La météo en cours, pour le rendu et le HUD : lue dans la seed, comme la carte. */
  public weather(): WeatherSpell | null {
    return this.weatherAt(this.tickCount);
  }

  /** La prochaine météo qui commence strictement après ce tick, pour l'annonce du HUD. */
  public nextWeather(): WeatherSpell | null {
    let spell = nextWeather(this.seed, this.tickCount);

    // Une pluie qui gâcherait une nuit n'arrive pas : on regarde la suivante.
    while (spell && this.spoils(spell)) spell = nextWeather(this.seed, spell.start);
    return spell;
  }

  /** La météo au tick `tick` : celle de la seed, sauf une météo rude qui tomberait sur une nuit. */
  private weatherAt(tick: number): WeatherSpell | null {
    const spell = weatherAt(this.seed, tick);

    return spell && !this.spoils(spell) ? spell : null;
  }

  private spoils(spell: WeatherSpell): boolean {
    return spoilsNight(spell, this.cycleStartTick, WEATHER_CALENDAR.waveMarginTicks);
  }

  /** Relit la météo du tick, et annonce ce qui arrive, commence ou s'achève. */
  private updateWeather(): void {
    const previous = this.spell;
    const announced = this.weatherAt(this.tickCount + WEATHER_CALENDAR.announceTicks);

    this.spell = this.weatherAt(this.tickCount);

    if (announced && announced.start === this.tickCount + WEATHER_CALENDAR.announceTicks) {
      this.events.emit('weatherAnnounced', {
        id: announced.id,
        seconds: WEATHER_CALENDAR.announceTicks / TICKS_PER_SECOND,
      });
    }
    if (previous && previous.start !== this.spell?.start) this.events.emit('weatherEnded', { id: previous.id });
    if (this.spell?.start === this.tickCount) this.events.emit('weatherStarted', { id: this.spell.id });
  }

  /** (x, y) est-il à l'abri, près d'une mairie debout ? */
  public sheltered(x: number, y: number): boolean {
    const hall = this.entities.get(this.townHallId);
    const radius = WEATHER_CALENDAR.shelterRadius * TILE_SIZE;

    return hall?.kind === 'townHall' && distanceSq(x, y, this.target.x, this.target.y) <= radius * radius;
  }

  /** La poussée du vent sur une flèche ce tick. */
  private wind(): Wind {
    if (!this.spell) return NO_WIND;

    const drift = WEATHER[this.spell.id].arrowDrift;

    return drift === 0 ? NO_WIND : { x: this.spell.windX * drift, y: this.spell.windY * drift };
  }

  /** Le facteur de portée des arcs ce tick : le brouillard raccourcit la vue. */
  private rangeFactor(): number {
    return this.spell ? WEATHER[this.spell.id].weaponRange : 1;
  }

  /**
   * La pluie acide ronge ce qui est déjà abîmé, hors de l'abri. Elle use,
   * elle n'achève pas : un bâtiment garde toujours son dernier point de vie.
   */
  private corrode(): void {
    const corrosion = this.spell ? WEATHER[this.spell.id].corrosion : null;

    if (!this.spell || !corrosion || (this.tickCount - this.spell.start) % corrosion.everyTicks !== corrosion.everyTicks - 1) {
      return;
    }

    for (const entity of this.entities.values()) {
      if (entity.kind === 'site' || entity.hp >= BUILDINGS[entity.proto].hp || entity.hp <= 1) continue;

      const x = (entity.tx + entity.width / 2) * TILE_SIZE;
      const y = (entity.ty + entity.height / 2) * TILE_SIZE;

      if (this.sheltered(x, y)) continue;

      entity.hp = Math.max(1, entity.hp - corrosion.damage);
      this.events.emit('buildingCorroded', { id: entity.id, hp: entity.hp });
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
    this.duty = null;
    this.restartFarms();
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

  /* ------------------------------------------------- pause et effectifs */

  /** La commande `pauseBuilding` : un producteur s'arrête, ou repart. Sans effet sur un bâtiment qui ne produit rien. */
  private setPaused(id: EntityId, paused: boolean): void {
    const entity = this.entities.get(id);

    if (!entity || entity.kind === 'site' || !canPause(entity.proto) || entity.paused === paused) return;

    entity.paused = paused;
    this.events.emit('buildingPaused', { id, paused });
    // En pause, rien à faire : le prochain réveil trouvera la machine arrêtée et ne se replanifiera pas.
    if (!paused) this.restart(entity);
  }

  /** La commande `setWorkers` : l'effectif voulu, ramené dans les bornes du bâtiment. */
  private setStaff(id: EntityId, count: number): void {
    const entity = this.entities.get(id);

    if (!entity || entity.kind === 'site' || !employs(entity.proto)) return;

    const staff = clampStaff(entity.proto, count);

    if (staff === entity.staff) return;

    entity.staff = staff;
    this.duty = null;
    this.events.emit('workersChanged', { id, staff });
    this.restartFarms();
  }

  /**
   * Les postes d'un bâtiment qui emploie : bornes, effectif voulu, postes
   * occupés. `null` pour un bâtiment sans ouvriers.
   */
  public staffing(building: Building): Staffing | null {
    if (!employs(building.proto)) return null;

    const { minWorkers, workers } = BUILDINGS[building.proto];

    return {
      min: minWorkers,
      max: workers,
      wanted: building.staff,
      filled: this.roster().filled.get(building.id) ?? 0,
    };
  }

  /** Un producteur à l'arrêt : en pause, ou sans un seul ouvrier en poste. */
  public stopped(building: Building): boolean {
    if (building.paused) return true;

    const staffing = this.staffing(building);

    return staffing !== null && staffing.filled === 0;
  }

  /**
   * Qui travaille : la population de la ville — les ouvriers que logent les
   * bâtiments finis — répartie entre les bâtiments qui emploient
   * (`allocateStaff`, par id). Dans chaque bâtiment, ce sont ses premiers
   * logés, par id, qui prennent les postes ; les autres finissent leur geste
   * et sont libres. Un ex-mutant n'occupe pas de poste : il porte toujours.
   */
  private roster(): { filled: Map<EntityId, number>; onDuty: Set<MobileId> } {
    if (this.duty?.tick === this.tickCount) return this.duty;

    let pool = 0;
    const demands: { id: EntityId; wanted: number }[] = [];

    for (const entity of this.entities.values()) {
      if (entity.kind === 'site' || !employs(entity.proto)) continue;
      pool += BUILDINGS[entity.proto].workers;
      demands.push({ id: entity.id, wanted: entity.staff });
    }

    const filled = allocateStaff(demands, pool);
    const crews = new Map<EntityId, MobileId[]>();

    for (const mobile of this.mobiles.values()) {
      if (mobile.kind !== 'lumberjack' && (mobile.kind !== 'worker' || mobile.exMutant)) continue;

      const crew = crews.get(mobile.homeId);

      if (crew) crew.push(mobile.id);
      else crews.set(mobile.homeId, [mobile.id]);
    }

    const onDuty = new Set<MobileId>();

    for (const [home, crew] of crews) {
      crew.sort((a, b) => a - b);
      for (const id of crew.slice(0, filled.get(home) ?? 0)) onDuty.add(id);
    }

    this.duty = { tick: this.tickCount, filled, onDuty };
    return this.duty;
  }

  /** L'ouvrier a-t-il un poste ? Sinon, il finit son geste, puis flâne. */
  private onDuty(mobile: Worker | Lumberjack): boolean {
    return (mobile.kind === 'worker' && mobile.exMutant) || this.roster().onDuty.has(mobile.id);
  }

  /**
   * Relance un producteur endormi qui a de nouveau de quoi tourner : un
   * coffre qu'on vide, une pause levée, des ouvriers revenus. Une machine qui
   * attend déjà un réveil n'est pas touchée — elle n'en a jamais deux.
   */
  private restart(building: Building): void {
    if (this.stopped(building)) return;

    if (building.kind === 'drill' && building.blocked && building.output) {
      building.blocked = false;
      this.scheduleDrill(building);
    } else if (building.kind === 'farm' && building.blocked) {
      building.blocked = false;
      this.scheduleFarm(building);
    } else if (building.kind === 'forge' && building.blocked) {
      this.startForge(building);
    } else if (
      building.kind === 'nursery' &&
      // Son réveil est passé pendant la pause ; à ce tick même, il n'a pas encore sonné et s'en chargera.
      building.nextBirthTick < this.tickCount &&
      (!building.hungry || hasInputs(building.store, RECIPES[NURSERY_RECIPE]))
    ) {
      this.runNursery(building);
    }
  }

  /** Les effectifs ont changé : une ferme qui n'avait plus personne peut repartir. */
  private restartFarms(): void {
    for (const entity of this.entities.values()) {
      if (entity.kind === 'farm') this.restart(entity);
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
    this.restart(entity);
    return removed;
  }

  /** Le bouton « Prendre » : tout le coffre passe dans le sac, dans la limite de la place. */
  private takeAll(id: EntityId): void {
    const entity = this.entities.get(id);

    if (
      entity?.kind !== 'drill' &&
      entity?.kind !== 'farm' &&
      entity?.kind !== 'forge' &&
      entity?.kind !== 'lab' &&
      entity?.kind !== 'lumberCamp'
    ) {
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
   * restent au four ; au labo, le reste d'une recherche abandonnée, jamais
   * ce que la recherche en cours attend.
   */
  public takeable(producer: Producer | Lab): [ItemId, number][] {
    if (producer.kind === 'lab') {
      return producer.store.entries().flatMap(([item]): [ItemId, number][] => {
        const surplus = labSurplus(producer, item);

        return surplus > 0 ? [[item, surplus]] : [];
      });
    }

    const entries = producer.store.entries();

    if (producer.kind !== 'forge') return entries;

    const outputs: RecipeProto['outputs'] = RECIPES[FORGE_RECIPE].outputs;

    return entries.filter(([item]) => (outputs[item] ?? 0) > 0);
  }

  /** Du coffre au sac : le coffre se vide (et la machine repart), le sac reçoit. */
  private takeInto(producer: Producer | Lab, item: ItemId, amount: number): void {
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
  if (mobile.kind === 'lumberjack') return { ...mobile, tree: mobile.tree && { ...mobile.tree } };
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
