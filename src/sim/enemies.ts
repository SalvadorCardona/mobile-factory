/**
 * Les mutants : une intelligence artificielle en une phrase.
 *
 * Un mutant marche droit sur la cible de sa vague — la mairie, ou un
 * bâtiment de l'usine. Il traverse l'eau, les arbres et les rochers — c'est
 * un mutant, il ne contourne rien — et seul le bâti l'arrête. Ce qui le
 * bloque, il le casse : un mur de foreuses ralentit une vague, il ne la
 * détourne pas. Quand il atteint sa cible, il la casse aussi.
 *
 * Pas de pathfinding : un mutant qui devrait chercher un chemin pour
 * contourner un bâtiment est un mutant qu'on peut piéger. Celui-ci ne se
 * piège pas, et c'est ce qui donne aux tours de guet un sens.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { ENEMIES, QUEEN } from '../data/enemies.ts';
import { facingOf, moveBox } from './motion.ts';
import type { EntityId, Mutant } from './types.ts';

/** Ce qu'un mutant a heurté ce tick : le bâtiment à casser. */
export interface MutantStep {
  blockedBy: EntityId | null;
  /** Vrai si le délai d'attaque est écoulé et qu'un coup part. */
  strikes: boolean;
}

/**
 * Un tick de mutant, qui marche vers `target`. `occupantAt` dit quel bâtiment occupe une tuile, s'il y
 * en a un : c'est la seule chose qui bloque un mutant.
 *
 * Par coup de vent, `downwind` est son bonus de vitesse quand il marche dans
 * le sens du vent (`windX`, `windY`, unitaire) ; face au vent, rien ne change.
 * `pace` multiplie sa vitesse : la Reine charge en phase 2 (`QUEEN.chargePace`).
 */
export function stepMutant(
  mutant: Mutant,
  target: { x: number; y: number },
  occupantAt: (tx: number, ty: number) => EntityId | undefined,
  stepSeconds: number,
  wind: { windX: number; windY: number; downwind: number } | null = null,
  pace = 1,
): MutantStep {
  const proto = ENEMIES[mutant.proto];

  // Il sort encore de sa flaque : il ne bouge ni ne frappe.
  if (mutant.emerge > 0) {
    mutant.emerge -= 1;
    mutant.prevX = mutant.x;
    mutant.prevY = mutant.y;
    mutant.moving = false;
    return { blockedBy: null, strikes: false };
  }

  // Le délai court même en marchant : un mutant qui revient frappe tout de suite.
  if (mutant.attackCooldown > 0) mutant.attackCooldown -= 1;

  const dx = target.x - mutant.x;
  const dy = target.y - mutant.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 1) {
    mutant.prevX = mutant.x;
    mutant.prevY = mutant.y;
    mutant.moving = false;
    return { blockedBy: null, strikes: false };
  }

  const tailwind = wind ? wind.downwind * Math.max(0, (dx * wind.windX + dy * wind.windY) / distance) : 0;
  const speed = proto.speed * pace * (1 + tailwind) * TILE_SIZE * stepSeconds;
  const wantX = (dx / distance) * speed;
  const wantY = (dy / distance) * speed;
  const box = { halfW: proto.halfW, halfH: proto.halfH };
  const contact = moveBox(mutant, box, wantX, wantY, (tx, ty) => occupantAt(tx, ty) !== undefined);

  mutant.moving = mutant.x !== mutant.prevX || mutant.y !== mutant.prevY;
  mutant.facing = facingOf(wantX, wantY);

  const blockedBy = contact ? (occupantAt(contact.tx, contact.ty) ?? null) : null;

  if (blockedBy === null) return { blockedBy: null, strikes: false };

  // Le premier coup part tout de suite ; les suivants attendent la cadence.
  if (mutant.attackCooldown > 0) return { blockedBy, strikes: false };

  mutant.attackCooldown = proto.attackTicks;
  return { blockedBy, strikes: true };
}

/** Ce que la Reine fait ce tick, en plus de marcher et de frapper : le monde pond et choisit où elle ressort. */
export interface QueenStep extends MutantStep {
  /** Elle pond : `QUEEN.brood` larves sortent de terre à ses pieds. */
  lays: boolean;
  /** Elle plonge : le monde la fait ressortir près de la tour la plus proche, s'il en reste une. */
  dives: boolean;
}

/** La phase qu'appellent ses points de vie : la 2 sous `QUEEN.enrageRatio`, la 1 au-dessus. */
export function queenPhase(queen: Mutant): 1 | 2 {
  return queen.hp < ENEMIES[queen.proto].hp * QUEEN.enrageRatio ? 2 : 1;
}

/**
 * Un tick de Reine. En phase 1, elle marche sur `target` — la mairie — et
 * pond à sa cadence ; quand ses points de vie passent sous la moitié, elle
 * plonge. En phase 2, `target` est la tour qu'elle chasse ; la tour tombée
 * (`preyStanding` faux), elle replonge vers la suivante.
 *
 * Sous terre (`emerge`), elle ne fait rien d'autre qu'attendre de ressortir.
 */
export function stepQueen(
  queen: Mutant,
  target: { x: number; y: number },
  preyStanding: boolean,
  occupantAt: (tx: number, ty: number) => EntityId | undefined,
  stepSeconds: number,
  wind: { windX: number; windY: number; downwind: number } | null = null,
): QueenStep {
  const state = queen.queen;
  const still = { blockedBy: null, strikes: false, lays: false, dives: false };

  if (!state || queen.emerge > 0) return { ...stepMutant(queen, target, occupantAt, stepSeconds, wind), lays: false, dives: false };

  if (state.phase === 1 && queenPhase(queen) === 2) {
    state.phase = 2;
    state.prey = null;
    return { ...still, dives: true };
  }
  if (state.phase === 2 && state.prey !== null && !preyStanding) {
    state.prey = null;
    return { ...still, dives: true };
  }

  let lays = false;

  if (state.phase === 1) {
    state.layTicks -= 1;
    if (state.layTicks <= 0) {
      state.layTicks = QUEEN.layTicks;
      lays = true;
    }
  }

  return { ...stepMutant(queen, target, occupantAt, stepSeconds, wind, state.phase === 2 ? QUEEN.chargePace : 1), lays, dives: false };
}

/**
 * Où ressort la Reine : à `QUEEN.surfaceDistance` tuiles du centre de la
 * tour, du côté d'où elle vient, en tournant autour de la tour jusqu'à
 * trouver une tuile que rien n'occupe. `null` si la tour est cernée.
 */
export function surfacePoint(
  tower: { x: number; y: number },
  from: { x: number; y: number },
  isFree: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  const heading = Math.atan2(from.y - tower.y, from.x - tower.x);
  const distance = QUEEN.surfaceDistance * TILE_SIZE;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    // 0, +1, −1, +2, −2… huitièmes de tour : le plus près possible de son côté.
    const step = Math.ceil(attempt / 2) * (attempt % 2 === 0 ? -1 : 1);
    const angle = heading + (step * Math.PI) / 8;
    const x = tower.x + Math.cos(angle) * distance;
    const y = tower.y + Math.sin(angle) * distance;

    if (isFree(x, y)) return { x, y };
  }
  return null;
}

/** Les huit directions d'où une vague peut venir, dans le repère de l'écran (y vers le bas = sud). */
export type Compass = 'east' | 'southEast' | 'south' | 'southWest' | 'west' | 'northWest' | 'north' | 'northEast';

const COMPASS: readonly Compass[] = ['east', 'southEast', 'south', 'southWest', 'west', 'northWest', 'north', 'northEast'];

/** La direction, parmi huit, d'un angle en radians (0 = est, sens horaire à l'écran). */
export function compassOf(angle: number): Compass {
  const sector = Math.round(angle / (Math.PI / 4));

  return COMPASS[((sector % 8) + 8) % 8]!;
}
