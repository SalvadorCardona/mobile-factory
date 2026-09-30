/**
 * Les quêtes d'Ève et leurs récompenses — contenu pur.
 *
 * Une fois arrivée, Ève porte la chaîne d'objectifs : une quête à la fois,
 * dans l'ordre de déclaration. Une quête se termine d'elle-même quand son
 * objectif est atteint — pas de bouton, pas de fenêtre : une bulle d'Ève, la
 * récompense, et la suivante.
 *
 * Deux sortes de récompense :
 * - un **plan** : un bâtiment marqué `plan` dans `BUILDINGS` n'entre dans
 *   le menu de construction qu'une fois son plan donné ;
 * - un **outil** : un effet permanent sur Adam (`TOOLS`).
 *
 * Ce qui est débloqué n'est pas de l'état : c'est la somme des récompenses
 * des quêtes déjà finies, relue dans cette table.
 */

import type { BuildingId } from './buildings.ts';
import type { ResourceId } from './resources.ts';

export interface ToolProto {
  label: string;
  /** Ressources que l'outil récolte plus vite. */
  resources: readonly ResourceId[];
  /** Unités qu'un nœud donne à chaque passage de récolte, au lieu d'une. */
  harvestSpeed: number;
}

export const TOOLS = {
  axe: { label: 'Hache affûtée', resources: ['tree'], harvestSpeed: 2 },
  pickaxe: { label: 'Pioche de récup', resources: ['stoneRock', 'ironRock', 'coalRock'], harvestSpeed: 2 },
} as const satisfies Record<string, ToolProto>;

export type ToolId = keyof typeof TOOLS;

/** Ce que la quête demande. */
export type QuestGoal =
  /** Avoir `count` bâtiments finis de ce type — ceux d'avant la quête comptent. */
  { type: 'build'; building: BuildingId; count: number };

export type QuestReward = { type: 'plan'; building: BuildingId } | { type: 'tool'; tool: ToolId };

export interface QuestProto {
  /** L'objectif, court, pour la quête du HUD. */
  label: string;
  goal: QuestGoal;
  reward: QuestReward;
  /** Ce qu'Ève dit en la donnant. */
  give: string;
  /** Ce qu'Ève dit en donnant la récompense. */
  done: string;
}

export const QUESTS = {
  farm: {
    label: 'Bâtir une ferme',
    goal: { type: 'build', building: 'farm', count: 1 },
    reward: { type: 'plan', building: 'builderHouse' },
    give: 'Une ferme, Adam ! On ne rebâtit rien le ventre vide.',
    done: 'Miam. Tiens, mon plan de la maison des constructeurs !',
  },
  towers: {
    label: 'Deux tours de guet',
    goal: { type: 'build', building: 'watchtower', count: 2 },
    reward: { type: 'tool', tool: 'axe' },
    give: 'Deux tours de guet, et je dors sur mes deux oreilles.',
    done: 'Parfait ! Cadeau : une hache affûtée. Les arbres n’ont qu’à bien se tenir.',
  },
  builders: {
    label: 'Maison des constructeurs',
    goal: { type: 'build', building: 'builderHouse', count: 1 },
    reward: { type: 'tool', tool: 'pickaxe' },
    give: 'Mon plan ne va pas se bâtir tout seul : la maison des constructeurs !',
    done: 'Quatre bras de plus ! Et pour toi, une pioche de récup.',
  },
} as const satisfies Record<string, QuestProto>;

export type QuestId = keyof typeof QUESTS;

/** Les quêtes, dans l'ordre où Ève les donne. */
export const QUEST_IDS = Object.keys(QUESTS) as QuestId[];
