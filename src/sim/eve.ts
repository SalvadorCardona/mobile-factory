/**
 * Ève dans la simulation : son arrivée, ses réparations, ses quêtes.
 *
 * Elle arrive sur son vélo-cargo en ligne droite — le vélo passe sur les
 * gravats, les arbres ne l'arrêtent pas — puis vit devant la mairie. Entre
 * deux vagues, elle va réparer le bâtiment le plus abîmé ; dès qu'un mutant
 * paraît, elle rentre. Elle ne se bat pas, et personne ne s'en prend à elle.
 *
 * Les quêtes sont de la donnée (`data/quests.ts`) ; ici, seulement ce qui
 * les lit : la progression d'un objectif, et ce que les quêtes finies ont
 * débloqué. Le monde ne retient qu'un nombre : les quêtes déjà finies.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, buildingLevel, type BuildingId } from '../data/buildings.ts';
import { EVE } from '../data/eve.ts';
import { QUESTS, QUEST_IDS, TOOLS, type QuestId } from '../data/quests.ts';
import type { ResourceId } from '../data/resources.ts';
import { facingOf, moveBox, type SolidTest } from './motion.ts';
import type { Building, Entity, Eve, MobileId } from './types.ts';

/** Ève, au départ de son vélo-cargo : à `EVE.arrivalDistance` tuiles à l'est de chez elle. */
export function createEve(id: MobileId, homeX: number, homeY: number): Eve {
  const x = homeX + EVE.arrivalDistance * TILE_SIZE;

  return {
    kind: 'eve',
    id,
    x,
    y: homeY,
    prevX: x,
    prevY: homeY,
    facing: 'left',
    moving: true,
    state: 'arriving',
    homeX,
    homeY,
    targetId: null,
    working: false,
    repairCooldown: 0,
    dirX: 0,
    dirY: 0,
    wanderTicks: 0,
  };
}

/** Un tick de vélo vers la mairie. Renvoie `true` à l'arrivée. */
export function rideHome(eve: Eve, stepSeconds: number): boolean {
  const speed = EVE.rideSpeed * TILE_SIZE * stepSeconds;
  const dx = eve.homeX - eve.x;
  const dy = eve.homeY - eve.y;
  const distance = Math.hypot(dx, dy);

  eve.prevX = eve.x;
  eve.prevY = eve.y;

  if (distance <= speed) {
    eve.x = eve.homeX;
    eve.y = eve.homeY;
    eve.moving = false;
    eve.facing = 'down';
    return true;
  }

  eve.x += (dx / distance) * speed;
  eve.y += (dy / distance) * speed;
  eve.moving = true;
  eve.facing = facingOf(dx, dy);
  return false;
}

/**
 * Un pas vers le bâtiment à réparer. Renvoie `true` quand Ève est contre
 * lui : le point visé est le plus proche de l'emprise, et le bâti l'arrête.
 */
export function walkTo(eve: Eve, building: Building, isSolid: SolidTest, stepSeconds: number): boolean {
  const left = building.tx * TILE_SIZE;
  const top = building.ty * TILE_SIZE;
  const right = left + building.width * TILE_SIZE;
  const bottom = top + building.height * TILE_SIZE;
  const dx = Math.min(Math.max(eve.x, left), right) - eve.x;
  const dy = Math.min(Math.max(eve.y, top), bottom) - eve.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= EVE.repairReach) {
    eve.prevX = eve.x;
    eve.prevY = eve.y;
    eve.moving = false;
    if (distance > 0) eve.facing = facingOf(dx, dy);
    return true;
  }

  const speed = EVE.walkSpeed * TILE_SIZE * stepSeconds;

  moveBox(eve, EVE, (dx / distance) * speed, (dy / distance) * speed, isSolid);
  eve.moving = eve.x !== eve.prevX || eve.y !== eve.prevY;
  eve.facing = facingOf(dx, dy);
  return false;
}

/** Le bâtiment fini le plus abîmé, en proportion de ses points de vie ; `null` si tout est intact. */
export function mostDamaged(entities: Iterable<Entity>): Building | null {
  let worst: Building | null = null;
  let worstRatio = 1;

  for (const entity of entities) {
    if (entity.kind === 'site') continue;

    const ratio = entity.hp / buildingLevel(entity.proto, entity.level).hp;

    if (ratio < worstRatio) {
      worst = entity;
      worstRatio = ratio;
    }
  }
  return worst;
}

/* ----------------------------------------------------------------- quêtes */

/** La quête en cours, d'après le nombre de quêtes finies ; `null` quand tout est fait. */
export function currentQuest(done: number): QuestId | null {
  return QUEST_IDS[done] ?? null;
}

/** Où en est l'objectif d'une quête. */
export function questProgress(quest: QuestId, entities: Iterable<Entity>): { have: number; need: number } {
  const { goal } = QUESTS[quest];
  let have = 0;

  for (const entity of entities) {
    if (entity.kind !== 'site' && entity.proto === goal.building) have += 1;
  }
  return { have: Math.min(have, goal.count), need: goal.count };
}

/** Le bâtiment peut-il être bâti ? Sans plan, toujours ; avec, une fois le plan donné. */
export function isUnlocked(building: BuildingId, done: number): boolean {
  if (!BUILDINGS[building].plan) return true;
  return QUEST_IDS.slice(0, done).some((id) => {
    const { reward } = QUESTS[id];

    return reward.type === 'plan' && reward.building === building;
  });
}

/** Unités qu'un nœud donne à chaque passage de récolte, avec les outils déjà reçus. */
export function harvestYieldWithTools(resource: ResourceId, done: number): number {
  let units = 1;

  for (const id of QUEST_IDS.slice(0, done)) {
    const { reward } = QUESTS[id];

    if (reward.type !== 'tool') continue;

    const tool = TOOLS[reward.tool];

    if ((tool.resources as readonly ResourceId[]).includes(resource)) units *= tool.harvestSpeed;
  }
  return units;
}
