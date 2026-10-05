/**
 * Sauvegarde : l'état de la simulation en JSON, et retour.
 *
 * C'est ce que la règle d'isolation de `sim/` promettait : sauvegarder, c'est
 * sérialiser l'état, rien de plus. Ce module est pur — pas de `localStorage`
 * ici, c'est `storage/` qui s'en charge — donc testable en Node.
 *
 * Ce qui ne part pas dans la sauvegarde : tout ce qui se régénère depuis la
 * seed (terrain, filons, ressources intactes, décor). Seules les tuiles
 * entamées y figurent, avec le bâti, les mobiles, le sac, les réveils en
 * attente et l'état du PRNG — de quoi reprendre la même suite de ticks que si
 * l'onglet n'avait jamais été fermé.
 *
 * Le format est versionné. Une sauvegarde d'une autre version, ou illisible,
 * est refusée proprement : `decodeSave` ne lève jamais.
 */

import { CHUNK_TILES } from '../core/grid.ts';
import { BUILDINGS, MENU_BUILDING_IDS, maxLevel, type BuildingId } from '../data/buildings.ts';
import { RARE_OFFERS, type RareOfferId } from '../data/caravan.ts';
import { ENEMIES, WILDLIFE, type EnemyId, type WildlifeId } from '../data/enemies.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { OBJECTIVES } from '../data/objectives.ts';
import { JOB_PRIORITY, type JobPriority } from '../data/workers.ts';
import { PERKS, type PerkId } from '../data/perks.ts';
import { RESEARCH, type ResearchId } from '../data/research.ts';
import type { SchedulerSnapshot } from './scheduler.ts';
import { ADAM_SALT, adultAge } from './inhabitants.ts';
import { canPause, clampStaff } from './staffing.ts';
import type { Store, StoreSnapshot } from './store.ts';
import type {
  BeastState,
  CaravanState,
  Entity,
  EntityId,
  EveState,
  Facing,
  Job,
  LumberjackState,
  Mobile,
  Mutant,
  PatientState,
  Player,
  TradeOffer,
  QueenState,
  Wandering,
  WorldStats,
} from './types.ts';
import { World } from './world.ts';

/**
 * Version du format. À incrémenter à chaque changement incompatible de
 * `WorldState` ; une migration de l'ancienne version se branche alors dans
 * `decodeSave`, sinon l'ancienne sauvegarde est ignorée.
 */
export const SAVE_VERSION = 8;

/** Une entité telle qu'elle est rangée : son coffre devient un simple stock. */
export type SavedEntity = Stored<Entity>;

type Stored<E> = E extends { store: Store } ? Omit<E, 'store'> & { store: StoreSnapshot } : E;

export type SavedPlayer = Omit<Player, 'inventory'> & { inventory: StoreSnapshot };

/** Une tanière qui a servi : combien de bêtes dehors, et quand elle se repeuple. */
export interface SavedDen {
  id: number;
  members: number;
  readyTick: number;
}

/** Tout l'état de la simulation, en données JSON. */
export interface WorldState {
  seed: number;
  tick: number;
  /** État du PRNG des vagues et des enfants. */
  rng: number;
  nextId: EntityId;
  nextMobileId: number;
  moveX: number;
  moveY: number;
  contactKey: string;
  contactTicks: number;
  /** Dernière nuit tombée ; 0 avant la première. */
  night: number;
  /** Lever du premier jour, cf. `World.cycleStartTick` ; 0 tant que la mairie est en chantier. */
  cycleStartTick: number;
  /** Direction, en radians, d'où viendra la prochaine vague. */
  nextWaveHeading: number;
  /** Le bâtiment que vise la prochaine vague, une fois annoncée. Absent : pas encore tirée. */
  nextWaveTarget?: EntityId;
  kills: number;
  defeated: boolean;
  defeatTick: number;
  /** Quêtes d'Ève déjà finies. Absent des sauvegardes d'avant Ève : 0. */
  questsDone: number;
  /** Bonus du jardin avec lesquels la colonie est partie. */
  perks: PerkId[];
  /** Chantiers offerts par ces bonus, pas encore ouverts. */
  giftedSites: BuildingId[];
  /** Recherches finies, dans l'ordre. Absent des sauvegardes d'avant le labo : aucune. */
  researchDone: ResearchId[];
  /** Bâtiments du menu dont la carte a perdu son badge « Nouveau ». */
  seenBuildings: BuildingId[];
  /** Offres rares de la caravane déjà prises, par offre. Absent des sauvegardes d'avant elle : aucune. */
  rareTrades: Partial<Record<RareOfferId, number>>;
  /** Index de l'objectif en cours ; `OBJECTIVES.length` une fois la chaîne bouclée. */
  objective: number;
  /** Le Signal est lancé : l'antenne a son troisième étage, la chaîne est bouclée. */
  victory: boolean;
  victoryTick: number;
  /** Nuits survécues au moment du Signal : le record compte celles d'après. Absent d'avant le Signal : 0. */
  signalNights?: number;
  /** La nuit dont toutes les vagues marchent sur l'antenne — celle qui suit un étage fini. 0 : aucune. */
  lureNight?: number;
  /** Les ouvriers adultes de la colonie. Absent d'avant eux : ceux qu'employaient les bâtiments finis. */
  colonists?: number;
  stats: WorldStats;
  /** Les compteurs au début de l'objectif en cours. */
  objectiveBase: WorldStats;
  player: SavedPlayer;
  /** Tuiles entamées : `"tx,ty"` → unités déjà prises. */
  resources: Record<string, number>;
  /** Tuiles pavées : `"cx,cy"` → index des tuiles dans le chunk. */
  roads: Record<string, number[]>;
  entities: SavedEntity[];
  mobiles: Mobile[];
  /** Tanières habitées ou vidées ; les autres se relisent dans la seed. */
  dens: SavedDen[];
  scheduler: SchedulerSnapshot;
}

/** Le fichier tel qu'il est écrit : une version, une date, un état. */
export interface SaveFile {
  version: number;
  /** Horodatage en ms (`Date.now()`), fourni par l'appelant : `sim/` ne lit pas l'horloge. */
  savedAt: number;
  state: WorldState;
}

export type DecodedSave =
  | { ok: true; world: World; savedAt: number }
  /** `version` : sauvegarde d'un autre format ; `corrupt` : illisible ou incohérente. */
  | { ok: false; reason: 'version' | 'corrupt' };

export function serialize(world: World): WorldState {
  return world.snapshot();
}

/** Reconstruit un monde depuis un état. Lève si l'état est incohérent. */
export function deserialize(state: unknown): World {
  return World.restore(parseState(state));
}

export function encodeSave(world: World, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state: serialize(world) };

  return JSON.stringify(file);
}

/** Lit une sauvegarde. Ne lève jamais : un texte douteux donne `{ ok: false }`. */
export function decodeSave(text: string): DecodedSave {
  let file: unknown;

  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }

  if (!isRecord(file) || typeof file['version'] !== 'number') return { ok: false, reason: 'corrupt' };
  const version = file['version'];

  if (version !== SAVE_VERSION && version !== 7 && version !== 6 && version !== 5 && version !== 4) return { ok: false, reason: 'version' };

  try {
    const v5 = version === 4 ? migrateV4(file['state']) : file['state'];
    const v6 = version === 4 || version === 5 ? migrateV5(v5) : v5;
    const v7 = version <= 6 ? migrateV6(v6) : v6;
    const state = version === SAVE_VERSION ? v7 : migrateV7(v7);

    return { ok: true, world: deserialize(state), savedAt: finite(file['savedAt']) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

/**
 * Version 4 : des vagues à cadence fixe, sans jour ni nuit. La vague devient
 * la nuit, et si la mairie était debout, un jour se lève au rechargement.
 * Le réveil de vague qui traîne dans le scheduler ne réveille plus personne.
 */
function migrateV4(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const { wave, nextWaveTick, ...rest } = raw;

  return { ...rest, night: wave, cycleStartTick: typeof nextWaveTick === 'number' && nextWaveTick > 0 ? raw['tick'] : 0 };
}

/**
 * Version 5 : la tour de guet renforcée était un bâtiment à part. Elle
 * devient une tour de guet au niveau 2, sous le même id, avec ses points de
 * vie ; tout autre bâtiment fini est au niveau 1. Son chantier devient celui
 * d'une tour de guet : ce qui y était livré au-delà de ce qu'elle attend
 * (les plaques de fer…) passe dans le stock de la ville plutôt que de se perdre.
 */
function migrateV5(raw: unknown): unknown {
  if (!isRecord(raw) || !Array.isArray(raw['entities'])) return raw;

  const entities = raw['entities'].map((entity: unknown) => (isRecord(entity) ? { ...entity } : entity));
  const hall = entities.find((entity) => isRecord(entity) && entity['kind'] === 'townHall' && isRecord(entity['store']));
  const surplus: Record<string, number> = {};

  for (const entity of entities) {
    if (!isRecord(entity)) continue;

    const reinforced = entity['proto'] === 'reinforcedTower';

    if (reinforced) entity['proto'] = 'watchtower';

    if (entity['kind'] !== 'site') {
      entity['level'] = reinforced ? 2 : 1;
    } else if (reinforced && isRecord(entity['delivered'])) {
      const cost = BUILDINGS.watchtower.cost as Partial<Record<string, number>>;
      const delivered: Record<string, unknown> = {};

      for (const [item, amount] of Object.entries(entity['delivered'])) {
        // Un stock illisible passe tel quel : la validation le refusera.
        if (typeof amount !== 'number') {
          delivered[item] = amount;
          continue;
        }

        const kept = Math.min(amount, cost[item] ?? 0);

        if (kept > 0) delivered[item] = kept;
        if (amount > kept) surplus[item] = (surplus[item] ?? 0) + amount - kept;
      }
      entity['delivered'] = delivered;
    }
  }

  if (isRecord(hall) && isRecord(hall['store'])) {
    const store: Record<string, unknown> = { ...hall['store'] };

    for (const [item, amount] of Object.entries(surplus)) store[item] = (typeof store[item] === 'number' ? store[item] : 0) + amount;
    hall['store'] = store;
  }

  return { ...raw, entities };
}

/**
 * Version 6 : personne n'avait d'âge. Chaque habitant — Adam, Ève, les
 * ouvriers, les bûcherons, et les enfants aussi — reçoit un âge d'adulte,
 * tiré de la seed et de son id : aucune partie ne casse, et un enfant de
 * l'ancienne sauvegarde devient ouvrier au chargement (`World.load`).
 */
function migrateV6(raw: unknown): unknown {
  if (!isRecord(raw) || typeof raw['seed'] !== 'number') return raw;

  const seed = raw['seed'] >>> 0;
  const player = isRecord(raw['player']) ? { ...raw['player'], age: adultAge(seed, ADAM_SALT) } : raw['player'];
  const mobiles = Array.isArray(raw['mobiles'])
    ? raw['mobiles'].map((mobile: unknown) => {
        if (!isRecord(mobile) || !INHABITANTS.includes(mobile['kind'] as string) || typeof mobile['id'] !== 'number') return mobile;

        const age = adultAge(seed, mobile['id']);

        return mobile['kind'] === 'worker' ? { ...mobile, age, grown: false } : { ...mobile, age };
      })
    : raw['mobiles'];

  return { ...raw, player, mobiles };
}

/**
 * Version 7 : la forge, le four à charbon et la clinique se débloquaient à
 * la tombée de la première nuit ; ils s'obtiennent désormais au labo. Une
 * colonie qui a déjà vu une nuit garde ce qu'elle avait : les recherches
 * qui les débloquent sont tenues pour finies. Et rien n'est « Nouveau » au
 * menu d'une partie déjà commencée : tout y a été vu.
 */
function migrateV7(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const done: unknown[] = Array.isArray(raw['researchDone']) ? raw['researchDone'] : [];
  const granted = typeof raw['night'] === 'number' && raw['night'] >= 1 ? NIGHT_ONE_RESEARCH.filter((id) => !done.includes(id)) : [];

  return { ...raw, researchDone: [...done, ...granted], seenBuildings: [...MENU_BUILDING_IDS] };
}

/** Les recherches qui débloquent ce que la première nuit débloquait en version 7. */
const NIGHT_ONE_RESEARCH: readonly ResearchId[] = ['metalworking', 'fieldMedicine'];

/** Les mobiles qui ont un âge. */
const INHABITANTS: readonly string[] = ['kid', 'eve', 'worker', 'lumberjack'];

/* ------------------------------------------------------------- validation */

/*
 * Une sauvegarde vient du disque : elle peut être tronquée, retouchée à la
 * main ou écrite par une autre version du jeu. Chaque champ est vérifié avant
 * d'entrer dans la simulation — un `NaN` dans une position ou un bâtiment
 * inconnu la casseraient bien plus loin, là où on ne comprend plus pourquoi.
 */

class SaveError extends Error {}

type Json = Record<string, unknown>;

const FACINGS: readonly Facing[] = ['down', 'up', 'left', 'right'];

const BEAST_STATES: readonly BeastState[] = ['roam', 'chase', 'return'];

const EVE_STATES: readonly EveState[] = ['arriving', 'idle', 'repair'];

const PATIENT_STATES: readonly PatientState[] = ['stunned', 'following', 'care'];

const CARAVAN_STATES: readonly CaravanState[] = ['arriving', 'parked', 'leaving'];

const TRADE_KINDS: readonly TradeOffer['kind'][] = ['surplus', 'loot', 'rare'];

const LUMBERJACK_STATES: readonly LumberjackState[] = ['idle', 'toTree', 'chop', 'toCamp', 'wait'];

function parseState(raw: unknown): WorldState {
  const state = record(raw);

  return {
    seed: int(state['seed']),
    tick: int(state['tick']),
    rng: int(state['rng']),
    nextId: int(state['nextId']),
    nextMobileId: int(state['nextMobileId']),
    moveX: finite(state['moveX']),
    moveY: finite(state['moveY']),
    contactKey: string(state['contactKey']),
    contactTicks: int(state['contactTicks']),
    night: int(state['night']),
    cycleStartTick: int(state['cycleStartTick']),
    nextWaveHeading: finite(state['nextWaveHeading']),
    ...(state['nextWaveTarget'] !== undefined && { nextWaveTarget: int(state['nextWaveTarget']) }),
    kills: int(state['kills']),
    defeated: bool(state['defeated']),
    defeatTick: int(state['defeatTick']),
    questsDone: state['questsDone'] === undefined ? 0 : int(state['questsDone']),
    // Absents d'une sauvegarde d'avant le jardin : une colonie partie sans bonus.
    perks: array(state['perks'] ?? []).map((id) => oneOf(id, PERKS) as PerkId),
    giftedSites: array(state['giftedSites'] ?? []).map((id) => oneOf(id, BUILDINGS) as BuildingId),
    researchDone: [...new Set(array(state['researchDone'] ?? []).map((id) => oneOf(id, RESEARCH) as ResearchId))],
    seenBuildings: [...new Set(array(state['seenBuildings'] ?? []).map((id) => oneOf(id, BUILDINGS) as BuildingId))],
    rareTrades: parseRareTrades(state['rareTrades'] ?? {}),
    ...(state['colonists'] !== undefined && { colonists: int(state['colonists']) }),
    ...parseObjectives(state),
    player: parsePlayer(state['player']),
    resources: parseResources(state['resources']),
    // Absentes d'une sauvegarde d'avant les routes : rien n'était pavé.
    roads: parseRoads(state['roads'] ?? {}),
    entities: unique(array(state['entities']).map(parseEntity)),
    mobiles: unique(array(state['mobiles']).map(parseMobile)),
    dens: unique(array(state['dens']).map(parseDen)),
    scheduler: parseScheduler(state['scheduler']),
  };
}

/**
 * La chaîne d'objectifs. Une sauvegarde d'avant les objectifs reprend au
 * premier : ce qui est déjà fait tombe au tick suivant, récompenses
 * comprises ; les nuits déjà survécues se relisent dans le numéro de nuit.
 */
function parseObjectives(
  state: Json,
): Pick<WorldState, 'objective' | 'victory' | 'victoryTick' | 'signalNights' | 'lureNight' | 'stats' | 'objectiveBase'> {
  if (state['objective'] === undefined) {
    const mutants = array(state['mobiles']).some((mobile) => isRecord(mobile) && mobile['kind'] === 'mutant');
    const night = int(state['night']);
    const stats: WorldStats = { nightsSurvived: mutants ? Math.max(0, night - 1) : night, births: 0, produced: {} };

    return { objective: 0, victory: false, victoryTick: 0, stats, objectiveBase: { ...stats, produced: {} } };
  }

  const objective = int(state['objective']);

  if (objective < 0 || objective > OBJECTIVES.length) throw new SaveError(`objectif inconnu : ${objective}`);

  // Une victoire d'avant l'Antenne n'était que la fin de l'acte I : la partie reprend à l'acte II.
  const victory = bool(state['victory']) && objective === OBJECTIVES.length;

  return {
    objective,
    victory,
    victoryTick: victory ? int(state['victoryTick']) : 0,
    signalNights: state['signalNights'] === undefined ? 0 : int(state['signalNights']),
    lureNight: state['lureNight'] === undefined ? 0 : int(state['lureNight']),
    stats: parseStats(state['stats']),
    objectiveBase: parseStats(state['objectiveBase']),
  };
}

function parseStats(raw: unknown): WorldStats {
  const stats = record(raw);

  return { nightsSurvived: int(stats['nightsSurvived']), births: int(stats['births']), produced: stock(stats['produced']) };
}

function parsePlayer(raw: unknown): SavedPlayer {
  const player = record(raw);

  return {
    ...moving(player),
    harvesting: bool(player['harvesting']),
    age: age(player['age']),
    bowCooldown: int(player['bowCooldown']),
    target: player['target'] === null ? null : int(player['target']),
    hp: finite(player['hp']),
    calmTicks: int(player['calmTicks']),
    inventory: stock(player['inventory']),
  };
}

function parseResources(raw: unknown): Record<string, number> {
  const taken: Record<string, number> = {};

  for (const [key, amount] of Object.entries(record(raw))) {
    if (!/^-?\d+,-?\d+$/.test(key)) throw new SaveError(`tuile illisible : ${key}`);
    taken[key] = int(amount);
  }
  return taken;
}

function parseRoads(raw: unknown): Record<string, number[]> {
  const roads: Record<string, number[]> = {};

  for (const [key, tiles] of Object.entries(record(raw))) {
    if (!/^-?\d+,-?\d+$/.test(key)) throw new SaveError(`chunk illisible : ${key}`);
    roads[key] = array(tiles).map((tile) => {
      const index = int(tile);

      if (index < 0 || index >= CHUNK_TILES * CHUNK_TILES) throw new SaveError(`dalle hors du chunk : ${index}`);
      return index;
    });
  }
  return roads;
}

function parseEntity(raw: unknown): SavedEntity {
  const entity = record(raw);
  const proto = oneOf(entity['proto'], BUILDINGS) as BuildingId;
  const placed = {
    id: int(entity['id']),
    proto,
    tx: int(entity['tx']),
    ty: int(entity['ty']),
    // L'emprise vient du prototype : elle ne peut pas diverger de la donnée.
    width: BUILDINGS[proto].width,
    height: BUILDINGS[proto].height,
  };

  if (entity['kind'] === 'site') {
    // Absent des sauvegardes d'avant le poste de construction : aucun coup de marteau.
    const work = entity['work'] === undefined ? 0 : int(entity['work']);

    if (work < 0) throw new SaveError(`chantier ${placed.id} au travail négatif`);
    return { ...placed, kind: 'site', delivered: stock(entity['delivered']), work };
  }

  const kind = BUILDINGS[proto].kind;

  if (entity['kind'] !== kind) throw new SaveError(`${proto} n'est pas un ${String(entity['kind'])}`);

  const built = {
    ...placed,
    store: stock(entity['store']),
    hp: int(entity['hp']),
    level: int(entity['level']),
    // Absents des sauvegardes d'avant la pause et les effectifs : en marche, au complet.
    paused: entity['paused'] === undefined ? false : bool(entity['paused']) && canPause(proto),
    staff: entity['staff'] === undefined ? BUILDINGS[proto].workers : clampStaff(proto, int(entity['staff'])),
  };

  if (built.hp <= 0) throw new SaveError(`${proto} sans points de vie`);
  if (built.level < 1 || built.level > maxLevel(proto)) throw new SaveError(`${proto} au niveau ${built.level}`);

  switch (kind) {
    case 'drill':
      return {
        ...built,
        kind,
        output: entity['output'] === null ? null : (oneOf(entity['output'], ITEMS) as ItemId),
        blocked: bool(entity['blocked']),
      };
    case 'nursery':
      return {
        ...built,
        kind,
        nextBirthTick: int(entity['nextBirthTick']),
        born: int(entity['born']),
        // Absent des sauvegardes d'avant la nourriture : la nurserie n'avait jamais faim.
        hungry: entity['hungry'] === undefined ? false : bool(entity['hungry']),
      };
    case 'tower':
      return { ...built, kind, armed: bool(entity['armed']) };
    case 'farm':
    case 'quarry':
    case 'forge':
      return { ...built, kind, blocked: bool(entity['blocked']) };
    case 'townHall':
    case 'house':
    case 'clinic':
    case 'lumberCamp':
    case 'depot':
    case 'yard':
    case 'antenna':
      return { ...built, kind };
    case 'lab': {
      const research = entity['research'] === null ? null : (oneOf(entity['research'], RESEARCH) as ResearchId);
      const endTick = int(entity['endTick']);

      if (endTick < 0 || (research === null && endTick > 0)) throw new SaveError('compte à rebours sans recherche');
      return { ...built, kind, research, endTick };
    }
  }
}

function parseQueen(raw: unknown): QueenState {
  const queen = record(raw);
  const phase = queen['phase'];

  if (phase !== 1 && phase !== 2) throw new SaveError(`phase de Reine inconnue : ${String(phase)}`);
  return { phase, layTicks: int(queen['layTicks']), prey: queen['prey'] === null ? null : int(queen['prey']) };
}

function parseMobile(raw: unknown): Mobile {
  const mobile = record(raw);
  const base = { id: int(mobile['id']), ...moving(mobile) };

  switch (mobile['kind']) {
    case 'mutant': {
      const mutant: Mutant = {
        ...base,
        kind: 'mutant',
        proto: oneOf(mobile['proto'], ENEMIES) as EnemyId,
        hp: finite(mobile['hp']),
        attackCooldown: int(mobile['attackCooldown']),
        emerge: int(mobile['emerge']),
        // Absente d'une sauvegarde d'avant les cibles de vague : la mairie.
        ...(mobile['target'] !== undefined && { target: int(mobile['target']) }),
      };

      // La Reine seule retient sa phase, sa ponte et sa proie.
      if (mutant.proto === 'queen') mutant.queen = parseQueen(mobile['queen']);
      return mutant;
    }
    case 'beast': {
      const state = mobile['state'];

      if (!BEAST_STATES.includes(state as BeastState)) throw new SaveError(`humeur inconnue : ${String(state)}`);
      return {
        ...base,
        kind: 'beast',
        proto: oneOf(mobile['proto'], WILDLIFE) as WildlifeId,
        hp: finite(mobile['hp']),
        denId: int(mobile['denId']),
        homeX: finite(mobile['homeX']),
        homeY: finite(mobile['homeY']),
        state: state as BeastState,
        dirX: finite(mobile['dirX']),
        dirY: finite(mobile['dirY']),
        wanderTicks: int(mobile['wanderTicks']),
        attackCooldown: int(mobile['attackCooldown']),
      };
    }
    case 'arrow':
      return {
        ...base,
        kind: 'arrow',
        vx: finite(mobile['vx']),
        vy: finite(mobile['vy']),
        ttl: int(mobile['ttl']),
        damage: finite(mobile['damage']),
      };
    case 'kid':
      return {
        ...base,
        kind: 'kid',
        age: age(mobile['age']),
        homeId: int(mobile['homeId']),
        homeX: finite(mobile['homeX']),
        homeY: finite(mobile['homeY']),
        dirX: finite(mobile['dirX']),
        dirY: finite(mobile['dirY']),
        wanderTicks: int(mobile['wanderTicks']),
      };
    case 'eve': {
      const state = mobile['state'];

      if (!EVE_STATES.includes(state as EveState)) throw new SaveError(`Ève ne sait pas faire : ${String(state)}`);

      return {
        ...base,
        kind: 'eve',
        age: age(mobile['age']),
        state: state as EveState,
        homeX: finite(mobile['homeX']),
        homeY: finite(mobile['homeY']),
        targetId: mobile['targetId'] === null ? null : int(mobile['targetId']),
        working: bool(mobile['working']),
        repairCooldown: int(mobile['repairCooldown']),
        dirX: finite(mobile['dirX']),
        dirY: finite(mobile['dirY']),
        wanderTicks: int(mobile['wanderTicks']),
      };
    }
    case 'worker':
      return {
        ...base,
        kind: 'worker',
        age: age(mobile['age']),
        homeId: int(mobile['homeId']),
        // Absent des sauvegardes d'avant la clinique : aucun ex-mutant.
        exMutant: mobile['exMutant'] === undefined ? false : bool(mobile['exMutant']),
        // Absent des sauvegardes d'avant le poste de logistique : aucun logisticien.
        logistician: mobile['logistician'] === undefined ? false : bool(mobile['logistician']),
        // Absents des sauvegardes d'avant le poste de construction : aucun bâtisseur.
        builder: mobile['builder'] === undefined ? false : bool(mobile['builder']),
        // Absent des sauvegardes d'avant le Signal : aucun survivant.
        survivor: mobile['survivor'] === undefined ? false : bool(mobile['survivor']),
        grown: bool(mobile['grown']),
        build: mobile['build'] === undefined || mobile['build'] === null ? null : int(mobile['build']),
        inside: bool(mobile['inside']),
        job: mobile['job'] === null ? null : parseJob(mobile['job']),
        searchTicks: int(mobile['searchTicks']),
        ...wandering(mobile, base),
      };
    case 'lumberjack': {
      const state = mobile['state'];
      const tree = mobile['tree'];

      if (!LUMBERJACK_STATES.includes(state as LumberjackState)) throw new SaveError(`bûcheron inconnu : ${String(state)}`);
      return {
        ...base,
        kind: 'lumberjack',
        age: age(mobile['age']),
        homeId: int(mobile['homeId']),
        inside: bool(mobile['inside']),
        state: state as LumberjackState,
        tree: tree === null ? null : { tx: int(record(tree)['tx']), ty: int(record(tree)['ty']) },
        chopTicks: int(mobile['chopTicks']),
        load: int(mobile['load']),
        searchTicks: int(mobile['searchTicks']),
        ...wandering(mobile, base),
      };
    }
    case 'pickup':
      // Une sauvegarde d'avant les tas : un butin, c'était un exemplaire.
      return {
        ...base,
        kind: 'pickup',
        item: oneOf(mobile['item'], ITEMS) as ItemId,
        amount: mobile['amount'] === undefined ? 1 : int(mobile['amount']),
        waitForLeave: mobile['waitForLeave'] === undefined ? false : bool(mobile['waitForLeave']),
        ttl: int(mobile['ttl']),
      };
    case 'patient': {
      const state = mobile['state'];

      if (!PATIENT_STATES.includes(state as PatientState)) throw new SaveError(`patient inconnu : ${String(state)}`);
      return { ...base, kind: 'patient', state: state as PatientState, clinicId: int(mobile['clinicId']), ticks: int(mobile['ticks']) };
    }
    case 'caravan': {
      const state = mobile['state'];

      if (!CARAVAN_STATES.includes(state as CaravanState)) throw new SaveError(`caravane : ${String(state)}`);
      return {
        ...base,
        kind: 'caravan',
        state: state as CaravanState,
        day: int(mobile['day']),
        parkX: finite(mobile['parkX']),
        parkY: finite(mobile['parkY']),
        fromX: finite(mobile['fromX']),
        fromY: finite(mobile['fromY']),
        leaveTick: int(mobile['leaveTick']),
        offers: array(mobile['offers']).map(parseTrade),
        met: bool(mobile['met']),
      };
    }
    default:
      throw new SaveError(`mobile inconnu : ${String(mobile['kind'])}`);
  }
}

/** La flânerie d'un ouvrier. Absente des sauvegardes d'avant elle : il repart de là où il est. */
function wandering(raw: Json, at: { x: number; y: number }): Wandering {
  if (raw['wanderX'] === undefined) return { wanderX: at.x, wanderY: at.y, wanderTicks: 0 };
  return { wanderX: finite(raw['wanderX']), wanderY: finite(raw['wanderY']), wanderTicks: int(raw['wanderTicks']) };
}

/** Un échange de la caravane : ce qu'il coûte, ce qu'il rapporte, et s'il est fait. */
function parseTrade(raw: unknown): TradeOffer {
  const trade = record(raw);
  const kind = trade['kind'];

  if (!TRADE_KINDS.includes(kind as TradeOffer['kind'])) throw new SaveError(`échange inconnu : ${String(kind)}`);

  return {
    kind: kind as TradeOffer['kind'],
    cost: stock(trade['cost']),
    items: stock(trade['items']),
    bag: int(trade['bag']),
    rare: trade['rare'] === null ? null : (oneOf(trade['rare'], RARE_OFFERS) as RareOfferId),
    done: bool(trade['done']),
  };
}

function parseRareTrades(raw: unknown): Partial<Record<RareOfferId, number>> {
  const result: Partial<Record<RareOfferId, number>> = {};

  for (const [id, count] of Object.entries(record(raw))) {
    const taken = int(count);

    if (taken < 0) throw new SaveError(`offre rare négative : ${id}`);
    result[oneOf(id, RARE_OFFERS) as RareOfferId] = taken;
  }
  return result;
}

function parseDen(raw: unknown): SavedDen {
  const den = record(raw);

  return { id: int(den['id']), members: int(den['members']), readyTick: int(den['readyTick']) };
}

/** Un transport en cours : ses réservations se rejouent au chargement, il doit donc être exact. */
function parseJob(raw: unknown): Job {
  const job = record(raw);
  const amount = int(job['amount']);
  const priority = int(job['priority']);

  if (amount <= 0) throw new SaveError('job vide');
  if (!Object.values(JOB_PRIORITY).includes(priority as JobPriority)) throw new SaveError(`priorité inconnue : ${priority}`);

  return {
    from: int(job['from']),
    to: int(job['to']),
    item: oneOf(job['item'], ITEMS) as ItemId,
    amount,
    priority: priority as JobPriority,
    carried: bool(job['carried']),
  };
}

function parseScheduler(raw: unknown): SchedulerSnapshot {
  const scheduler = record(raw);
  const buckets = (value: unknown): [number, number[]][] =>
    array(value).map((bucket) => {
      const [tick, ids] = array(bucket);

      return [int(tick), array(ids).map(int)];
    });

  return { near: buckets(scheduler['near']), far: buckets(scheduler['far']) };
}

/** Position interpolable et regard, communs au joueur et aux mobiles. */
function moving(raw: Json): { x: number; y: number; prevX: number; prevY: number; facing: Facing; moving: boolean } {
  const facing = raw['facing'];

  if (!FACINGS.includes(facing as Facing)) throw new SaveError(`regard inconnu : ${String(facing)}`);

  return {
    x: finite(raw['x']),
    y: finite(raw['y']),
    prevX: finite(raw['prevX']),
    prevY: finite(raw['prevY']),
    facing: facing as Facing,
    moving: bool(raw['moving']),
  };
}

function stock(raw: unknown): Partial<Record<ItemId, number>> {
  const result: Partial<Record<ItemId, number>> = {};

  for (const [item, amount] of Object.entries(record(raw))) {
    const count = int(amount);

    if (count < 0) throw new SaveError(`stock négatif : ${item}`);
    result[oneOf(item, ITEMS) as ItemId] = count;
  }
  return result;
}

/** Deux entités sous le même id, et l'une écraserait l'autre en silence. */
function unique<T extends { id: number }>(list: T[]): T[] {
  if (new Set(list.map(({ id }) => id)).size !== list.length) throw new SaveError('id en double');
  return list;
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Json {
  if (!isRecord(value)) throw new SaveError('objet attendu');
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SaveError('liste attendue');
  return value;
}

function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SaveError('nombre attendu');
  return value;
}

function int(value: unknown): number {
  const number = finite(value);

  if (!Number.isInteger(number)) throw new SaveError('entier attendu');
  return number;
}

/** Un âge, en années : un entier positif. */
function age(value: unknown): number {
  const years = int(value);

  if (years < 0) throw new SaveError(`âge négatif : ${years}`);
  return years;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new SaveError('booléen attendu');
  return value;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new SaveError('texte attendu');
  return value;
}

function oneOf(value: unknown, table: object): string {
  if (typeof value !== 'string' || !Object.hasOwn(table, value)) throw new SaveError(`id inconnu : ${String(value)}`);
  return value;
}
