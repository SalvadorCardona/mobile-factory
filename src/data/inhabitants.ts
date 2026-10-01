/**
 * Les habitants — contenu pur : leur âge et leurs prénoms.
 *
 * Chaque habitant a un âge : Adam, Ève, les ouvriers, les enfants. Il avance
 * d'un an à chaque aube — un cycle jour/nuit vaut une année. Un enfant sort
 * de la nurserie à 10 ans et joue jusqu'à 14 ; il devient alors ouvrier, tout
 * seul. Personne ne vieillit au-delà : ni vieillesse ni mort par l'âge.
 */

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

/** Les prénoms des habitants, tirés de la seed et de leur id : jamais sauvegardés. */
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
