/**
 * Les habitants — contenu pur : leur âge et leurs prénoms.
 *
 * Chaque habitant a un âge : Adam, Ève, les ouvriers, les enfants. Il avance
 * d'un an à chaque aube — un cycle jour/nuit vaut une année. Un enfant sort
 * de la nurserie à 10 ans et joue jusqu'à 14 ; il devient alors ouvrier, tout
 * seul. Personne ne vieillit au-delà : ni vieillesse ni mort par l'âge.
 *
 * Les ouvriers ne viennent que de là : la colonie part avec
 * `COLONY.startingWorkers` adultes, et chaque enfant devenu grand en ajoute
 * un. Un bâtiment n'en crée aucun — il les emploie. Le rythme des naissances
 * est la durée de la recette `raiseChild` (`data/recipes.ts`), la durée de
 * l'enfance `AGES.work - AGES.nursery` aubes.
 */

import type { ItemId } from './items.ts';

/** La colonie au départ. */
export const COLONY = {
  /** Les ouvriers adultes d'une nouvelle partie, à répartir entre les bâtiments qui emploient. */
  startingWorkers: 10,
  /**
   * Ce qui tombe en ville quand la mairie est bâtie : de quoi faire tenir les
   * dix premiers ouvriers le temps de poser un puits et de lancer une ferme —
   * trois repas chacun, quatre gorgées (`data/needs.ts`).
   */
  startingStock: { food: 30, water: 40 },
} as const satisfies { startingWorkers: number; startingStock: Partial<Record<ItemId, number>> };

/** La nurserie. */
export const NURSERY_CARE = {
  /** Enfants qu'une nurserie élève à la fois : pleine, elle attend qu'un grand parte travailler. */
  capacity: 4,
} as const;

export const AGES = {
  /** Années ajoutées à chaque aube : un cycle jour/nuit, une année. */
  yearsPerCycle: 1,
  /** Âge d'un enfant à sa sortie de la nurserie. */
  nursery: 10,
  /** Âge où un enfant devient ouvrier : avant, il n'est affecté à rien. */
  work: 14,
  /** Un adulte arrivé tout fait — Adam, un ouvrier logé, un ex-mutant — a un âge tiré entre ces bornes. */
  adultMin: 20,
  adultMax: 35,
} as const;

/**
 * Le sexe d'une personne : une femme ou un homme. Il se voit sur la carte
 * (la queue de cheval d'une femme, la barbe courte d'un homme), s'entend au
 * tap (« Hé ! », « Hé ho ! ») et se lit dans sa fiche.
 */
export const SEXES = ['female', 'male'] as const;

export type Sex = (typeof SEXES)[number];

/** Les deux héros ont le leur par l'histoire (`data/lore.ts`) : il n'est pas tiré. */
export const STORY_SEXES = { adam: 'male', eve: 'female' } as const satisfies Record<string, Sex>;

/**
 * Les prénoms des habitants, tirés de la seed et de leur id : jamais sauvegardés.
 * Ils alternent, au rang de `SEXES` : un rang pair est un prénom de femme, un
 * rang impair un prénom d'homme (Sacha et Lou vont aux deux).
 */
export const NAMES = [
  'Lina',
  'Malo',
  'Rosa',
  'Tom',
  'Inès',
  'Noé',
  'Jade',
  'Hugo',
  'Mila',
  'Sacha',
  'Lou',
  'Yanis',
  'Zoé',
  'Gabin',
  'Nora',
  'Elio',
  'Romy',
  'Basile',
  'Alma',
  'Timéo',
  'Capucine',
  'Ilan',
  'Suzon',
  'Marius',
] as const;
