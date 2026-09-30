/**
 * La faune sauvage : crabes sur les plages, loups en forêt.
 *
 * Deux moitiés, comme la carte :
 * - les **tanières** ne sont jamais stockées. Chaque chunk en tire quelques
 *   points depuis la seed (`densOfChunk`) ; un point qui tombe sur l'habitat
 *   de l'espèce, et pas sous un arbre ou un rocher, est une tanière. Même
 *   seed, mêmes tanières, d'une partie à l'autre ;
 * - les **bêtes** sont des mobiles, comme les mutants. Le monde peuple une
 *   tanière quand Adam passe à quelques chunks, hors de sa vue, et la vide
 *   quand il s'éloigne — cf. `World.stepWildlife`.
 *
 * Une bête n'a qu'une idée à la fois (`BeastState`) : flâner autour de chez
 * elle, charger Adam, ou rentrer. Pas de pathfinding : un loup qui charge
 * droit dans un arbre glisse le long, et c'est très bien comme ça.
 */

import { CHUNK_TILES, TILE_SIZE } from '../core/grid.ts';
import { hash3, type Rng } from '../core/rng.ts';
import { WILDLIFE, WILDLIFE_IDS, type WildlifeId } from '../data/enemies.ts';
import { facingOf, moveBox, type SolidTest } from './motion.ts';
import { PLAYER_HALF_W } from './player.ts';
import { habitatAt, resourceAt } from './terrain.ts';
import type { Beast } from './types.ts';

export interface Den {
  /** Id déterministe, calculé sur (seed, espèce, chunk, tirage). */
  id: number;
  species: WildlifeId;
  tx: number;
  ty: number;
}

/** Deux tanières du même chunk ne se touchent pas : écart minimal, en tuiles. */
const DEN_SPACING = 4;

/**
 * Les tanières d'un chunk, telles que la seed les dessine. Pur : le monde
 * les met en cache, mais pourrait les recalculer à chaque fois.
 */
export function densOfChunk(seed: number, cx: number, cy: number): Den[] {
  const dens: Den[] = [];

  for (const [index, species] of WILDLIFE_IDS.entries()) {
    const proto = WILDLIFE[species];

    for (let draw = 0; draw < proto.densPerChunk; draw += 1) {
      const id = hash3(hash3(seed ^ 0x6a09e667, index, draw), cx, cy);
      const tx = cx * CHUNK_TILES + (id % CHUNK_TILES);
      const ty = cy * CHUNK_TILES + ((id >>> 8) % CHUNK_TILES);

      if (habitatAt(seed, tx, ty) !== proto.habitat) continue;
      if (resourceAt(seed, tx, ty) !== null) continue;
      if (dens.some((den) => Math.abs(den.tx - tx) < DEN_SPACING && Math.abs(den.ty - ty) < DEN_SPACING)) continue;

      dens.push({ id, species, tx, ty });
    }
  }
  return dens;
}

/** Effectif d'une tanière, entre `groupMin` et `groupMax`, tiré de son id. */
export function denSize(den: Den): number {
  const { groupMin, groupMax } = WILDLIFE[den.species];

  return groupMin + (hash3(den.id, 3, 0) % (groupMax - groupMin + 1));
}

/** Ce qu'une bête a fait ce tick. */
export interface BeastStep {
  /** Vrai si un coup part sur Adam. */
  strikes: boolean;
}

/**
 * Un tick de bête.
 *
 * `isSolid` est le monde (eau, ressources, bâtiments) ; l'habitat s'y ajoute
 * ici. Un crabe ne quitte jamais le sable, même en chargeant ; un loup ne
 * quitte la forêt que pour charger ou rentrer.
 */
export function stepBeast(
  beast: Beast,
  player: { x: number; y: number },
  isSolid: SolidTest,
  seed: number,
  rng: Rng,
  stepSeconds: number,
): BeastStep {
  const proto = WILDLIFE[beast.proto];

  if (beast.attackCooldown > 0) beast.attackCooldown -= 1;

  const toPlayerX = player.x - beast.x;
  const toPlayerY = player.y - beast.y;
  const playerSq = toPlayerX * toPlayerX + toPlayerY * toPlayerY;
  const toHomeX = beast.homeX - beast.x;
  const toHomeY = beast.homeY - beast.y;
  const homeSq = toHomeX * toHomeX + toHomeY * toHomeY;
  const aggro = proto.aggroRadius * TILE_SIZE;
  const giveUp = proto.giveUpRadius * TILE_SIZE;
  const leash = proto.leashRadius * TILE_SIZE;

  switch (beast.state) {
    case 'roam':
      if (playerSq <= aggro * aggro) beast.state = 'chase';
      break;

    case 'chase':
      if (playerSq > giveUp * giveUp || homeSq > leash * leash) beast.state = 'return';
      break;

    case 'return':
      if (homeSq <= TILE_SIZE * TILE_SIZE) {
        beast.state = 'roam';
        beast.wanderTicks = 0;
      }
      break;
  }

  const confined = beast.state === 'roam' || proto.habitat === 'shore';
  const solid: SolidTest = confined ? (tx, ty) => isSolid(tx, ty) || habitatAt(seed, tx, ty) !== proto.habitat : isSolid;
  let dirX = 0;
  let dirY = 0;
  let speed: number = proto.speed;
  let strikes = false;

  if (beast.state === 'chase') {
    const distance = Math.sqrt(playerSq);
    const reach = proto.halfW + PLAYER_HALF_W + 4;

    if (distance > reach) {
      dirX = toPlayerX / distance;
      dirY = toPlayerY / distance;
      speed = proto.chargeSpeed;
    } else if (beast.attackCooldown === 0) {
      beast.attackCooldown = proto.attackTicks;
      strikes = true;
    }
    // Au contact, elle regarde Adam, même immobile.
    if (distance > 0) beast.facing = facingOf(toPlayerX, toPlayerY);
  } else if (beast.state === 'return') {
    const distance = Math.sqrt(homeSq);

    dirX = toHomeX / distance;
    dirY = toHomeY / distance;
  } else {
    wander(beast, rng, homeSq, leash);
    dirX = beast.dirX;
    dirY = beast.dirY;
  }

  const step = speed * TILE_SIZE * stepSeconds;
  const contact = moveBox(beast, proto, dirX * step, dirY * step, solid);

  beast.moving = beast.x !== beast.prevX || beast.y !== beast.prevY;

  if ((dirX !== 0 || dirY !== 0) && beast.state !== 'chase') beast.facing = facingOf(dirX, dirY);

  // Bloquée en flânant : elle change d'idée au tick suivant plutôt que de pousser.
  if (contact && beast.state === 'roam') beast.wanderTicks = 0;

  return { strikes };
}

/**
 * La flânerie : un temps immobile, un temps en marche, et le retour vers la
 * tanière quand elle s'en est trop écartée. Un crabe file de côté : sa
 * marche est surtout horizontale, le long de la rive.
 */
function wander(beast: Beast, rng: Rng, homeSq: number, leash: number): void {
  if (beast.wanderTicks <= 0) {
    if (rng() < 0.4) {
      beast.dirX = 0;
      beast.dirY = 0;
    } else {
      const angle = rng() * Math.PI * 2;
      const sideways = beast.proto === 'crab' ? 0.35 : 1;
      const x = Math.cos(angle);
      const y = Math.sin(angle) * sideways;
      const length = Math.hypot(x, y) || 1;

      beast.dirX = x / length;
      beast.dirY = y / length;
    }
    beast.wanderTicks = 20 + Math.floor(rng() * 40);
  }
  beast.wanderTicks -= 1;

  const range = leash * 0.6;

  if (homeSq > range * range) {
    const distance = Math.sqrt(homeSq);

    beast.dirX = (beast.homeX - beast.x) / distance;
    beast.dirY = (beast.homeY - beast.y) / distance;
  }
}
