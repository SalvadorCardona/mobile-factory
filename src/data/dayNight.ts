/**
 * Le cycle jour / nuit — contenu pur.
 *
 * On bâtit le jour, les mutants sortent la nuit. Le cycle démarre quand le
 * toit de la mairie est posé, par une journée : rien n'attaque, on récolte,
 * on explore, on bâtit. Au crépuscule la carte vire à l'indigo et les
 * lampions de la colonie s'allument ; la nuit, les vagues arrivent (cf.
 * `WAVES`, `data/enemies.ts`) ; à l'aube, les mutants qui restent fuient le
 * jour et la colonie ramasse le butin de la nuit survécue.
 *
 * Les durées sont en ticks (20 par seconde). L'horloge vit dans
 * `sim/dayNight.ts` ; le rendu ne fait qu'appliquer la teinte.
 */

import { PALETTE } from './artDirection.ts';
import type { ItemId } from './items.ts';

/** Les quatre phases, dans l'ordre où elles se suivent. */
export const DAY_CYCLE = {
  /** Journée : pas de mutant, le ciel est normal. */
  day: 20 * 180,
  /** Crépuscule : la teinte monte, les lampions s'allument, « La nuit tombe — rentrez ». */
  dusk: 20 * 15,
  /** Nuit : les vagues arrivent. */
  night: 20 * 60,
  /** Aube : la teinte redescend, les mutants fuient, le butin tombe. */
  dawn: 20 * 10,
} as const;

/**
 * Les couleurs de la nuit, toutes tirées de la palette : la carte est
 * **multipliée** par ces teintes, jamais assombrie vers le noir. Les ombres
 * glissent vers le violet, comme le veut la direction artistique.
 *
 * - `sky` : la teinte de la carte hors des lumières, à la nuit noire ;
 * - `vision` : la teinte autour d'Adam, plus claire — il voit à `visionRadius` ;
 * - `lamp` : la lueur des fenêtres et des lampions de la colonie ;
 * - `halo` : le halo des mutants, vert fluo — famille réservée.
 */
export const NIGHT_TINT = {
  sky: PALETTE.violet.light,
  vision: PALETTE.paper.shade,
  lamp: PALETTE.yellow.light,
  halo: PALETTE.toxic.base,
  /** Rayon de la vision d'Adam, en tuiles. */
  visionRadius: 5,
  /** Rayon de la lueur d'un bâtiment, en tuiles, au-delà de son emprise. */
  lampRadius: 2,
  /** Rayon du halo d'un mutant, en tuiles. */
  haloRadius: 1.2,
  /**
   * Intensité des lueurs ajoutées par-dessus la teinte (0 à 1). Fortes :
   * la nuit doit rester lisible sur un téléphone en plein soleil.
   */
  lampStrength: 0.45,
  haloStrength: 0.6,
} as const;

/** Le butin de l'aube quand la mairie a tenu la nuit : en ville, sinon dans le sac, le surplus au sol. */
export const DAWN_REWARD = {
  wood: 5,
  stone: 5,
  food: 3,
} as const satisfies Partial<Record<ItemId, number>>;
