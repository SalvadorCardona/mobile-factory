/**
 * Ressources de surface — contenu pur.
 *
 * Une ressource est un obstacle : un arbre, un rocher. On ne la traverse pas,
 * on la **heurte**, et chaque contact prolongé en arrache une unité qui va
 * dans le sac du joueur. Du bois pour un arbre, du minerai pour un rocher.
 *
 * `amount` est ce qu'une tuile contient avant de disparaître ; `harvestTicks`
 * le temps de contact entre deux unités (20 ticks = 1 s).
 */

import type { ItemId } from './items.ts';
import type { SpriteId } from './sprites.ts';

export interface ResourceProto {
  /** Objet obtenu à chaque unité récoltée. */
  item: ItemId;
  /** Unités par tuile. */
  amount: number;
  /** Ticks de contact entre deux unités. */
  harvestTicks: number;
  sprite: SpriteId;
  /** Verbe affiché au joueur : « Couper du bois », « Extraire du fer ». */
  verb: string;
}

export const RESOURCES = {
  tree: { item: 'wood', amount: 5, harvestTicks: 8, sprite: 'tree', verb: 'Couper' },
  ironRock: { item: 'ironOre', amount: 6, harvestTicks: 10, sprite: 'rockIron', verb: 'Extraire' },
  coalRock: { item: 'coal', amount: 6, harvestTicks: 10, sprite: 'rockCoal', verb: 'Extraire' },
  stoneRock: { item: 'stone', amount: 8, harvestTicks: 8, sprite: 'rockStone', verb: 'Casser' },
} as const satisfies Record<string, ResourceProto>;

export type ResourceId = keyof typeof RESOURCES;

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** Ressource de surface posée sur un filon d'un objet donné. */
export const ROCK_OF_ORE: Partial<Record<ItemId, ResourceId>> = {
  ironOre: 'ironRock',
  coal: 'coalRock',
  stone: 'stoneRock',
};
