/**
 * Sprites — le registre.
 *
 * Un sprite est un **module de `src/art/`** qui construit son SVG avec les
 * helpers de `data/artDirection.ts`. Il n'y a plus de planche d'images : un
 * sprite se découpe en **morceaux** (`parts`), chacun un SVG complet du même
 * cadre, que le rendu superpose et anime par transformation — rotation,
 * rebond, écrasement. Un personnage a un corps par direction et un pied ; un
 * bâtiment, son chantier, sa version finie et sa version endommagée ; une
 * foreuse, en plus, la roue qui tourne.
 *
 * `render/spriteLibrary.ts` rastérise chaque morceau **une fois**, au
 * chargement, à la résolution de l'écran, dans un atlas partagé. Le reste du
 * rendu ne manipule que des textures.
 *
 * Toutes les tailles sont en **pixels monde** : une tuile fait 32 px.
 */

import { ADAM } from '../art/adam.ts';
import { ARROW } from '../art/arrow.ts';
import { BUILDER_HOUSE } from '../art/builderHouse.ts';
import { CRAB } from '../art/crab.ts';
import { DECOR_ART } from '../art/decor.ts';
import { DRILL } from '../art/drill.ts';
import { FARM } from '../art/farm.ts';
import { KID } from '../art/kid.ts';
import { MUTANT } from '../art/mutant.ts';
import { NURSERY } from '../art/nursery.ts';
import { ROCK_COAL, ROCK_IRON, ROCK_STONE } from '../art/rocks.ts';
import { STORE_FULL } from '../art/storeFull.ts';
import { TARGET } from '../art/target.ts';
import { TOWN_HALL } from '../art/townHall.ts';
import { TREE, TREE_DEAD, TREE_PINE } from '../art/trees.ts';
import { WATCHTOWER } from '../art/watchtower.ts';
import { WOLF } from '../art/wolf.ts';

export interface SpriteProto {
  /** Cadre commun à tous les morceaux, en pixels monde. */
  width: number;
  height: number;
  /** Ancre dans [0, 1] : (0.5, 0.8) = les pieds d'un personnage au point de position. */
  anchorX: number;
  anchorY: number;
  /** Un SVG complet par morceau, tous du cadre `width × height`. */
  parts: Record<string, string>;
  /**
   * Point autour duquel un morceau tourne ou s'écrase, en pixels du cadre.
   * Absent : l'ancre du sprite.
   */
  pivots?: Record<string, readonly [number, number]>;
}

export const SPRITES = {
  adam: ADAM,
  mutant: MUTANT,
  kid: KID,
  crab: CRAB,
  wolf: WOLF,
  arrow: ARROW,
  target: TARGET,
  /** Bulle « coffre plein » au-dessus d'une foreuse ou d'une ferme arrêtée. */
  storeFull: STORE_FULL,

  tree: TREE,
  treePine: TREE_PINE,
  treeDead: TREE_DEAD,
  rockIron: ROCK_IRON,
  rockCoal: ROCK_COAL,
  rockStone: ROCK_STONE,

  townHall: TOWN_HALL,
  drill: DRILL,
  nursery: NURSERY,
  builderHouse: BUILDER_HOUSE,
  farm: FARM,
  watchtower: WATCHTOWER,

  /** Décor de surface : un morceau par élément, cf. `data/decor.ts`. */
  decor: DECOR_ART,
} satisfies Record<string, SpriteProto>;

export type SpriteId = keyof typeof SPRITES;

export const SPRITE_IDS = Object.keys(SPRITES) as SpriteId[];

/** Noms de morceaux valides pour un sprite donné. */
export type PartOf<S extends SpriteId> = keyof (typeof SPRITES)[S]['parts'] & string;

/** Les morceaux qu'un marcheur (Adam, mutant, enfant) doit fournir. */
export const WALKER_PARTS = ['down', 'up', 'side', 'foot'] as const;

/** Les morceaux qu'un bâtiment doit fournir. */
export const BUILDING_PARTS = ['site', 'built', 'damaged'] as const;

/** Les morceaux qu'une ressource de surface doit fournir. */
export const RESOURCE_PARTS = ['full', 'damaged'] as const;
