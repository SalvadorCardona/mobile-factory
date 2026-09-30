/**
 * Ressources de surface — contenu pur.
 *
 * Une ressource se récolte **de proximité** : Adam passe à côté, et chaque
 * passage de récolte en arrache une unité qui va dans son sac. Du bois pour
 * un arbre, du minerai pour un rocher.
 *
 * `amount` est ce qu'une tuile contient avant de disparaître ; `hitbox` ce
 * qui arrête Adam : toute la tuile pour un rocher, le seul tronc pour un
 * arbre — il passe sous le feuillage, une forêt n'est jamais un mur.
 */

import type { ItemId } from './items.ts';
import type { SpriteId } from './sprites.ts';

export interface ResourceProto {
  /** Objet obtenu à chaque unité récoltée. */
  item: ItemId;
  /** Unités par tuile. */
  amount: number;
  /** Ce qui arrête Adam : la tuile entière, ou seulement le tronc. */
  hitbox: 'tile' | 'trunk';
  /**
   * Sprites possibles, tirés par tuile depuis la seed : une forêt mêle les
   * essences. Répéter un sprite le rend plus fréquent.
   */
  sprites: readonly SpriteId[];
  /** Verbe affiché au joueur : « Couper du bois », « Extraire du fer ». */
  verb: string;
}

export const RESOURCES = {
  tree: {
    item: 'wood',
    amount: 5,
    hitbox: 'trunk',
    sprites: ['tree', 'tree', 'tree', 'treePine', 'treePine', 'treeDead'],
    verb: 'Couper',
  },
  ironRock: { item: 'ironOre', amount: 6, hitbox: 'tile', sprites: ['rockIron'], verb: 'Extraire' },
  coalRock: { item: 'coal', amount: 6, hitbox: 'tile', sprites: ['rockCoal'], verb: 'Extraire' },
  stoneRock: { item: 'stone', amount: 8, hitbox: 'tile', sprites: ['rockStone'], verb: 'Casser' },
} as const satisfies Record<string, ResourceProto>;

export type ResourceId = keyof typeof RESOURCES;

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** Ressource de surface posée sur un filon d'un objet donné. */
export const ROCK_OF_ORE: Partial<Record<ItemId, ResourceId>> = {
  ironOre: 'ironRock',
  coal: 'coalRock',
  stone: 'stoneRock',
};
