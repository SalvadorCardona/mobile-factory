/**
 * Clinique — contenu pur.
 *
 * Un mutant vaincu ne meurt pas toujours : s'il reste une place à la
 * clinique, il peut tomber **assommé**, des étoiles plein la tête. Adam n'a
 * qu'à le toucher pour qu'il le suive en boitillant jusqu'à la clinique ;
 * après une « nuit » de soins, il en ressort **ex-mutant** — un habitant qui
 * porte comme un ouvrier, plus fort et plus lent (`EX_MUTANT`,
 * `data/workers.ts`).
 *
 * Les places de la clinique comptent ses patients **et** les ex-mutants
 * qu'elle loge : une clinique pleine n'assomme plus personne. Chaque vague
 * reste une menace ; recruter demande une clinique de plus.
 */

export const CLINIC = {
  /** Places d'une clinique : patients en chemin ou en soins, et ex-mutants qu'elle loge. */
  beds: 3,
  /** Chance qu'un mutant vaincu tombe assommé plutôt que de s'évaporer, s'il reste une place. */
  stunChance: 0.5,
  /** Ticks passés assommé : sans Adam, il se réveille et s'évapore dans sa flaque. */
  stunTicks: 20 * 10,
  /** Distance, en tuiles, à laquelle Adam le touche et l'emmène. */
  touchRadius: 0.9,
  /** Vitesse du boitillement, en tuiles par seconde — Adam marche à 4,5. */
  limpSpeed: 3.2,
  /** Il s'arrête à cette distance d'Adam, en tuiles : il suit, il ne pousse pas. */
  followGap: 1,
  /** Distance, en tuiles, à la porte de la clinique à laquelle il entre se faire soigner. */
  admitRadius: 1.5,
  /** La « nuit » de soins, en ticks : le jeu n'a pas de cycle jour-nuit, deux minutes en tiennent lieu. */
  careTicks: 20 * 120,
} as const;
