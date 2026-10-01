/**
 * Objectifs : où en est chaque condition de `data/objectives.ts`.
 *
 * Fonctions pures qui lisent le monde sans le toucher. `World` s'en sert au
 * tick pour savoir si l'objectif courant est réussi ; le HUD, pour dessiner
 * une jauge par condition. Un seul juge, donc : la jauge pleine et
 * l'objectif réussi ne peuvent pas diverger.
 */

import { OBJECTIVES, type Goal, type ObjectiveProto } from '../data/objectives.ts';
import type { WorldStats } from './types.ts';
import type { World } from './world.ts';

export interface GoalProgress {
  have: number;
  need: number;
}

/** Où en est une condition. `have` est plafonné à `need` : une jauge ne déborde pas. */
export function goalProgress(world: World, goal: Goal): GoalProgress {
  return { have: Math.min(goal.count, count(world, goal)), need: goal.count };
}

function count(world: World, goal: Goal): number {
  switch (goal.type) {
    case 'build': {
      let built = 0;

      for (const entity of world.entities.values()) {
        if (entity.kind !== 'site' && entity.proto === goal.building) built += 1;
      }
      return built;
    }

    case 'nights':
      return world.stats.nightsSurvived - world.objectiveBase.nightsSurvived;

    case 'produce':
      return world.stats.produced[goal.item] ?? 0;

    case 'births':
      return world.stats.births;

    case 'quests':
      return world.questsDone;
  }
}

/** Toutes les conditions tiennent-elles en même temps ? */
export function objectiveDone(world: World, objective: ObjectiveProto): boolean {
  return objective.goals.every((goal) => count(world, goal) >= goal.count);
}

/** L'objectif en cours, ou `null` une fois la chaîne bouclée — le mode infini. */
export function currentObjective(world: World): ObjectiveProto | null {
  return OBJECTIVES[world.objective] ?? null;
}

/** Une copie des compteurs : le point de départ d'un objectif. */
export function copyStats(stats: WorldStats): WorldStats {
  return { ...stats, produced: { ...stats.produced } };
}

export function emptyStats(): WorldStats {
  return { nightsSurvived: 0, births: 0, produced: {} };
}
