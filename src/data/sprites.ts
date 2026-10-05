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
import { ANTENNA, ANTENNA_2, ANTENNA_3 } from '../art/antenna.ts';
import { ARROW } from '../art/arrow.ts';
import { BUILDER } from '../art/builder.ts';
import { BUILDER_HOUSE } from '../art/builderHouse.ts';
import { CARAVAN_SPRITE } from '../art/caravan.ts';
import { CARGO_BIKE } from '../art/cargoBike.ts';
import { CLINIC_SPRITE } from '../art/clinic.ts';
import { CONSTRUCTION_POST } from '../art/constructionPost.ts';
import { CRAB } from '../art/crab.ts';
import { CRACK } from '../art/crack.ts';
import { DECOR_ART } from '../art/decor.ts';
import { DRILL } from '../art/drill.ts';
import { ENEMY_BASE_SPRITE } from '../art/enemyBase.ts';
import { EX_MUTANT_SPRITE } from '../art/exMutant.ts';
import { EVE_SPRITE } from '../art/eve.ts';
import { FARM } from '../art/farm.ts';
import { CHARCOAL_KILN } from '../art/charcoalKiln.ts';
import { FORGE } from '../art/forge.ts';
import { KID } from '../art/kid.ts';
import { LAB } from '../art/lab.ts';
import { LOGISTICIAN } from '../art/logistician.ts';
import { LOGISTICS_POST } from '../art/logisticsPost.ts';
import { LOOT } from '../art/loot.ts';
import { LUMBER_CAMP } from '../art/lumberCamp.ts';
import { LUMBERJACK } from '../art/lumberjack.ts';
import { MUTANT } from '../art/mutant.ts';
import { NURSERY } from '../art/nursery.ts';
import { PATIENT } from '../art/patient.ts';
import { DUST_RING, PARTICLE_FX } from '../art/particles.ts';
import { PAUSED } from '../art/paused.ts';
import { QUARRY } from '../art/quarry.ts';
import { QUEEN_SPRITE } from '../art/queen.ts';
import { PUDDLE } from '../art/puddle.ts';
import { ROCK_COAL, ROCK_IRON, ROCK_STONE } from '../art/rocks.ts';
import { STORE_FULL } from '../art/storeFull.ts';
import { TARGET } from '../art/target.ts';
import { TOWN_HALL } from '../art/townHall.ts';
import { TREE, TREE_DEAD, TREE_PINE } from '../art/trees.ts';
import { REINFORCED_TOWER, WATCHTOWER } from '../art/watchtower.ts';
import { RAINBOW, WEATHER_FX } from '../art/weather.ts';
import { WOLF } from '../art/wolf.ts';
import { WORKER } from '../art/worker.ts';

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
  eve: EVE_SPRITE,
  cargoBike: CARGO_BIKE,
  /** La caravane de troc : la charrette, son marchand, et la roue qui tourne. */
  caravan: CARAVAN_SPRITE,
  mutant: MUTANT,
  /** La Reine des flaques : trois tuiles sur trois, couronne de bulles. */
  queen: QUEEN_SPRITE,
  kid: KID,
  worker: WORKER,
  /** Un bûcheron : chemise à carreaux, barbe, et sa hache, qui s'abat à chaque coup. */
  lumberjack: LUMBERJACK,
  /** Un logisticien : caisse sur le dos, casquette cyan ; la charge dépasse de la caisse. */
  logistician: LOGISTICIAN,
  /** Un bâtisseur : casque jaune, ceinture à outils, et son marteau, qui s'abat à chaque coup. */
  builder: BUILDER,
  /** Un mutant assommé, puis qui suit Adam jusqu'à la clinique. */
  patient: PATIENT,
  /** Un mutant guéri : un habitant, porteur, avec sa touffe fluo. */
  exMutant: EX_MUTANT_SPRITE,
  crab: CRAB,
  wolf: WOLF,
  arrow: ARROW,
  target: TARGET,
  /** Bulle « coffre plein » au-dessus d'une foreuse ou d'une ferme arrêtée. */
  storeFull: STORE_FULL,
  /** Bulle « en pause » au-dessus d'un producteur que le joueur a arrêté. */
  paused: PAUSED,
  /** La fissure d'un bâtiment sous la moitié de ses points de vie. */
  crack: CRACK,
  /** La flaque d'où sortent les mutants d'une vague. */
  puddle: PUDDLE,
  /** Le butin qu'ils lâchent : un morceau par objet. */
  loot: LOOT,
  /** La base mutante, et la pancarte de son niveau (`sign1` à `sign3`). */
  enemyBase: ENEMY_BASE_SPRITE,

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
  forge: FORGE,
  charcoalKiln: CHARCOAL_KILN,
  reinforcedTower: REINFORCED_TOWER,
  clinic: CLINIC_SPRITE,
  lab: LAB,
  lumberCamp: LUMBER_CAMP,
  quarry: QUARRY,
  logisticsPost: LOGISTICS_POST,
  constructionPost: CONSTRUCTION_POST,
  /** L'Antenne, étage par étage ; l'émetteur a aussi sa version allumée (`lit`), après le Signal. */
  antenna: ANTENNA,
  antenna2: ANTENNA_2,
  antenna3: ANTENNA_3,

  /** Décor de surface : un morceau par élément, cf. `data/decor.ts`. */
  decor: DECOR_ART,

  /** Météo : gouttes, vent, brouillard, fleurs, et l'arc-en-ciel — cf. `data/weather.ts`. */
  weather: WEATHER_FX,
  rainbow: RAINBOW,

  /** Particules : une silhouette blanche par forme, teintée au rendu — cf. `PARTICLES` de `data/artDirection.ts`. */
  particles: PARTICLE_FX,
  /** L'anneau de poussière d'un bâtiment qui s'achève. */
  dustRing: DUST_RING,
} satisfies Record<string, SpriteProto>;

export type SpriteId = keyof typeof SPRITES;

export const SPRITE_IDS = Object.keys(SPRITES) as SpriteId[];

/** Noms de morceaux valides pour un sprite donné. */
export type PartOf<S extends SpriteId> = keyof (typeof SPRITES)[S]['parts'] & string;

/** Les morceaux qu'un marcheur (Adam, Ève, mutant, enfant, ouvrier, logisticien, bâtisseur, bûcheron, patient, ex-mutant) doit fournir. */
export const WALKER_PARTS = ['down', 'up', 'side', 'foot'] as const;

/** Les morceaux qu'un bâtiment doit fournir. */
export const BUILDING_PARTS = ['site', 'built', 'damaged'] as const;

/** Ceux d'un niveau d'amélioration : il n'a pas de chantier, le bâtiment change sur place. */
export const UPGRADE_PARTS = ['built', 'damaged'] as const;

/** Les morceaux qu'une ressource de surface doit fournir. */
export const RESOURCE_PARTS = ['full', 'damaged'] as const;
