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

import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ENEMIES, WILDLIFE, type EnemyId, type WildlifeId } from '../data/enemies.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { JOB_PRIORITY, type JobPriority } from '../data/workers.ts';
import { PERKS, type PerkId } from '../data/perks.ts';
import type { SchedulerSnapshot } from './scheduler.ts';
import type { Store, StoreSnapshot } from './store.ts';
import type { BeastState, Entity, EntityId, EveState, Facing, Job, Mobile, Player } from './types.ts';
import { World } from './world.ts';

/**
 * Version du format. À incrémenter à chaque changement incompatible de
 * `WorldState` ; une migration de l'ancienne version se branche alors dans
 * `decodeSave`, sinon l'ancienne sauvegarde est ignorée.
 */
export const SAVE_VERSION = 4;

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
  wave: number;
  nextWaveTick: number;
  /** Direction, en radians, d'où viendra la prochaine vague. */
  nextWaveHeading: number;
  kills: number;
  defeated: boolean;
  defeatTick: number;
  /** Quêtes d'Ève déjà finies. Absent des sauvegardes d'avant Ève : 0. */
  questsDone: number;
  /** Bonus du jardin avec lesquels la colonie est partie. */
  perks: PerkId[];
  /** Chantiers offerts par ces bonus, pas encore ouverts. */
  giftedSites: BuildingId[];
  player: SavedPlayer;
  /** Tuiles entamées : `"tx,ty"` → unités déjà prises. */
  resources: Record<string, number>;
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
  if (file['version'] !== SAVE_VERSION) return { ok: false, reason: 'version' };

  try {
    return { ok: true, world: deserialize(file['state']), savedAt: finite(file['savedAt']) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

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
    wave: int(state['wave']),
    nextWaveTick: int(state['nextWaveTick']),
    nextWaveHeading: finite(state['nextWaveHeading']),
    kills: int(state['kills']),
    defeated: bool(state['defeated']),
    defeatTick: int(state['defeatTick']),
    questsDone: state['questsDone'] === undefined ? 0 : int(state['questsDone']),
    // Absents d'une sauvegarde d'avant le jardin : une colonie partie sans bonus.
    perks: array(state['perks'] ?? []).map((id) => oneOf(id, PERKS) as PerkId),
    giftedSites: array(state['giftedSites'] ?? []).map((id) => oneOf(id, BUILDINGS) as BuildingId),
    player: parsePlayer(state['player']),
    resources: parseResources(state['resources']),
    entities: unique(array(state['entities']).map(parseEntity)),
    mobiles: unique(array(state['mobiles']).map(parseMobile)),
    dens: unique(array(state['dens']).map(parseDen)),
    scheduler: parseScheduler(state['scheduler']),
  };
}

function parsePlayer(raw: unknown): SavedPlayer {
  const player = record(raw);

  return {
    ...moving(player),
    harvesting: bool(player['harvesting']),
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

  if (entity['kind'] === 'site') return { ...placed, kind: 'site', delivered: stock(entity['delivered']) };

  const kind = BUILDINGS[proto].kind;

  if (entity['kind'] !== kind) throw new SaveError(`${proto} n'est pas un ${String(entity['kind'])}`);

  const built = { ...placed, store: stock(entity['store']), hp: int(entity['hp']) };

  if (built.hp <= 0) throw new SaveError(`${proto} sans points de vie`);

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
    case 'forge':
      return { ...built, kind, blocked: bool(entity['blocked']) };
    case 'townHall':
    case 'house':
      return { ...built, kind };
  }
}

function parseMobile(raw: unknown): Mobile {
  const mobile = record(raw);
  const base = { id: int(mobile['id']), ...moving(mobile) };

  switch (mobile['kind']) {
    case 'mutant':
      return {
        ...base,
        kind: 'mutant',
        proto: oneOf(mobile['proto'], ENEMIES) as EnemyId,
        hp: finite(mobile['hp']),
        attackCooldown: int(mobile['attackCooldown']),
        emerge: int(mobile['emerge']),
      };
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
        homeId: int(mobile['homeId']),
        inside: bool(mobile['inside']),
        job: mobile['job'] === null ? null : parseJob(mobile['job']),
        searchTicks: int(mobile['searchTicks']),
      };
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
    default:
      throw new SaveError(`mobile inconnu : ${String(mobile['kind'])}`);
  }
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
