/**
 * Les compagnons d'Adam dans la simulation : ils le suivent, se battent selon
 * leur classe, soignent.
 *
 * Pas d'A* : la ligne droite, glissant contre ce qui l'arrête (`moveBox`).
 * Un compagnon coincé derrière un mur, ou laissé loin, rejoint Adam d'un bond
 * (`COMPANIONS.teleportRange`, `stuckTicks`) — l'escorte ne bloque jamais
 * personne et ne reste jamais en arrière. Adam ne les heurte pas : ils ne
 * sont dans la collision de personne.
 *
 * Ce module ne touche pas au monde : `stepCompanion` fait marcher le
 * compagnon et dit ce qu'il fait (`CompanionAct`) ; le monde l'applique.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import { COMPANIONS, COMPANION_CLASSES, type CompanionClassId } from '../data/companions.ts';
import { isTargetable } from './combat.ts';
import { facingOf, moveBox, type SolidTest } from './motion.ts';
import { PLAYER_MAX_HP } from './player.ts';
import type { Companion, Foe, MobileId, Player } from './types.ts';

/** Demi-boîte d'un compagnon, en pixels : ses pieds. */
export const COMPANION_BOX = { halfW: 6, halfH: 4 };

export function createCompanion(id: MobileId, role: CompanionClassId, x: number, y: number): Companion {
  return {
    kind: 'companion',
    id,
    role,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 'down',
    moving: false,
    hp: COMPANION_CLASSES[role].hp,
    cooldown: 0,
    hurtTicks: 0,
    stuck: 0,
  };
}

/** Ce qu'un compagnon fait ce tick, et que le monde applique. */
export type CompanionAct =
  | { type: 'none' }
  /** Un coup de corps à corps. */
  | { type: 'strike'; foe: Foe; damage: number }
  /** Une flèche. */
  | { type: 'shoot'; foe: Foe; damage: number }
  /** Un soin : Adam (`player`) ou un compagnon. */
  | { type: 'heal'; who: 'player' | Companion; amount: number }
  /** Il vient de rejoindre Adam d'un bond. */
  | { type: 'warp' };

const NONE: CompanionAct = { type: 'none' };

export interface CompanionContext {
  player: Player;
  /** La troupe vivante, dans l'ordre des ids. */
  troop: readonly Companion[];
  /** Les ennemis du monde. */
  foes: Iterable<Foe>;
  isSolid: SolidTest;
  stepSeconds: number;
}

/**
 * Sa place dans la formation : un arc derrière Adam, qui s'ouvre avec la
 * troupe. Le guerrier prend le devant de l'arc, l'archer le milieu, le
 * soigneur le plus à l'abri — la classe, pas l'ordre d'arrivée, fixe le rang.
 */
export function formationSlot(companion: Companion, troop: readonly Companion[], player: Player): { x: number; y: number } {
  const rank = (role: CompanionClassId): number => (role === 'warrior' ? 0 : role === 'archer' ? 1 : 2);
  const ordered = [...troop].sort((a, b) => rank(a.role) - rank(b.role) || a.id - b.id);
  const index = Math.max(0, ordered.indexOf(companion));
  const back = BACK[player.facing];
  const spread = (index - (ordered.length - 1) / 2) * SPREAD;
  const angle = back + spread;
  // Les rangs avancés (le guerrier) se tiennent plus près d'Adam, le soigneur un cran derrière.
  const gap = (COMPANIONS.followGap + rank(companion.role) * 0.35) * TILE_SIZE;

  return { x: player.x + Math.cos(angle) * gap, y: player.y + Math.sin(angle) * gap };
}

/** L'angle, derrière Adam, selon son regard (y vers le bas). */
const BACK = {
  down: -Math.PI / 2,
  up: Math.PI / 2,
  left: 0,
  right: Math.PI,
} as const;

/** Écart entre deux places voisines de l'arc, en radians. */
const SPREAD = 0.62;

/** L'ennemi qu'il engage : le plus proche de lui, parmi ceux qui sont près d'Adam. */
function engaged(companion: Companion, ctx: CompanionContext): Foe | null {
  const limit = COMPANIONS.engageRange * TILE_SIZE;
  let best: Foe | null = null;
  let bestSq = Infinity;

  for (const foe of ctx.foes) {
    if (!isTargetable(foe) || distanceSq(ctx.player.x, ctx.player.y, foe.x, foe.y) > limit * limit) continue;

    const sq = distanceSq(companion.x, companion.y, foe.x, foe.y);

    if (sq < bestSq) {
      bestSq = sq;
      best = foe;
    }
  }
  return best;
}

/** Avance d'un tick vers (x, y), ou s'en éloigne si `away`. Renvoie vrai s'il a bougé. */
function move(companion: Companion, x: number, y: number, away: boolean, ctx: CompanionContext): boolean {
  const dx = (away ? -1 : 1) * (x - companion.x);
  const dy = (away ? -1 : 1) * (y - companion.y);
  const distance = Math.hypot(dx, dy);

  if (distance < 0.01) return false;

  const speed = Math.min(distance, COMPANION_CLASSES[companion.role].speed * TILE_SIZE * ctx.stepSeconds);

  moveBox(companion, COMPANION_BOX, (dx / distance) * speed, (dy / distance) * speed, ctx.isSolid);
  companion.facing = facingOf(dx, dy);
  return companion.x !== companion.prevX || companion.y !== companion.prevY;
}

function stand(companion: Companion): void {
  companion.prevX = companion.x;
  companion.prevY = companion.y;
}

/** Le plus blessé des alliés à portée de soin — Adam compris —, ou `null` si personne ne l'est. */
function woundedAlly(companion: Companion, ctx: CompanionContext): 'player' | Companion | null {
  const reach = COMPANION_CLASSES[companion.role].healRange * TILE_SIZE;
  let best: 'player' | Companion | null = null;
  let bestRatio = 1;
  const consider = (who: 'player' | Companion, hp: number, max: number, x: number, y: number): void => {
    const ratio = hp / max;

    if (ratio < bestRatio && distanceSq(companion.x, companion.y, x, y) <= reach * reach) {
      bestRatio = ratio;
      best = who;
    }
  };

  consider('player', ctx.player.hp, PLAYER_MAX_HP, ctx.player.x, ctx.player.y);
  for (const ally of ctx.troop) {
    if (ally !== companion) consider(ally, ally.hp, COMPANION_CLASSES[ally.role].hp, ally.x, ally.y);
  }
  return best;
}

/**
 * Un tick de compagnon. Il rejoint Adam d'un bond s'il est trop loin ou
 * coincé ; sinon il se bat selon sa classe contre l'ennemi qu'il engage, ou
 * suit sa place dans la formation.
 */
export function stepCompanion(companion: Companion, ctx: CompanionContext): CompanionAct {
  const proto = COMPANION_CLASSES[companion.role];
  const { player } = ctx;

  if (companion.cooldown > 0) companion.cooldown -= 1;
  if (companion.hurtTicks > 0) companion.hurtTicks -= 1;

  const farSq = distanceSq(player.x, player.y, companion.x, companion.y);
  const teleport = COMPANIONS.teleportRange * TILE_SIZE;

  if (farSq > teleport * teleport || companion.stuck >= COMPANIONS.stuckTicks) {
    companion.x = companion.prevX = player.x;
    companion.y = companion.prevY = player.y;
    companion.stuck = 0;
    companion.moving = false;
    return { type: 'warp' };
  }

  // Le soigneur panse d'abord, puis suit : il ne combat pas.
  if (proto.heal > 0 && companion.cooldown <= 0) {
    const who = woundedAlly(companion, ctx);

    if (who) {
      companion.cooldown = proto.healCooldown;
      follow(companion, ctx);
      return { type: 'heal', who, amount: proto.heal };
    }
  }

  const foe = proto.damage > 0 ? engaged(companion, ctx) : null;

  if (!foe) {
    follow(companion, ctx);
    return NONE;
  }

  const distance = Math.sqrt(distanceSq(companion.x, companion.y, foe.x, foe.y));
  const reach = proto.range * TILE_SIZE;
  let act: CompanionAct = NONE;

  if (proto.keep > 0 && distance < proto.keep * TILE_SIZE) {
    // L'archer recule devant ce qui le serre de trop près, sans cesser de tirer.
    companion.moving = move(companion, foe.x, foe.y, true, ctx);
  } else if (distance > (proto.keep > 0 ? reach * 0.9 : reach)) {
    companion.moving = move(companion, foe.x, foe.y, false, ctx);
  } else {
    stand(companion);
    companion.moving = false;
    companion.facing = facingOf(foe.x - companion.x, foe.y - companion.y);
  }

  if (distance <= reach && companion.cooldown <= 0) {
    companion.cooldown = proto.cooldown;
    act = proto.keep > 0 ? { type: 'shoot', foe, damage: proto.damage } : { type: 'strike', foe, damage: proto.damage };
  }

  companion.stuck = 0;
  return act;
}

/** Retourne à sa place derrière Adam, sans bouger tant qu'il y est — ou assez près si la place est murée. */
function follow(companion: Companion, ctx: CompanionContext): void {
  const { player } = ctx;
  const slot = formationSlot(companion, ctx.troop, player);
  const walled = ctx.isSolid(Math.floor(slot.x / TILE_SIZE), Math.floor(slot.y / TILE_SIZE));
  const target = walled ? { x: player.x, y: player.y } : slot;
  const settle = (walled ? COMPANIONS.followGap : COMPANIONS.settle) * TILE_SIZE;

  if (distanceSq(companion.x, companion.y, target.x, target.y) <= settle * settle) {
    stand(companion);
    companion.moving = false;
    companion.stuck = 0;
    return;
  }

  companion.moving = move(companion, target.x, target.y, false, ctx);

  // Bloqué loin d'Adam : le compteur monte, puis l'escorte le rejoint d'un bond.
  const close = COMPANIONS.followGap * 2 * TILE_SIZE;
  const stuck = !companion.moving && distanceSq(companion.x, companion.y, player.x, player.y) > close * close;

  companion.stuck = stuck ? companion.stuck + 1 : 0;
}
