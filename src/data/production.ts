/**
 * La production à durée — contenu pur.
 *
 * Un bâtiment producteur mène **une** production à la fois, à la manière
 * d'Age of Empires : un compte à rebours (`endTick`), et, derrière, une file
 * d'attente où l'on empile ce qui suivra. Pour produire en parallèle, on bâtit
 * un second bâtiment.
 *
 * Les durées ne sont pas ici : elles restent là où la production se décrit,
 * pour être réglées à un seul endroit par production —
 * `RECIPES.raiseChild.duration` (la naissance d'un enfant, à la nurserie) et
 * `RESEARCH[id].duration` (chaque recherche du labo). Un futur producteur
 * déclare la sienne de la même façon et lit cette file.
 */

export const PRODUCTION = {
  /** Productions en attente derrière celle qui tourne, par bâtiment. */
  queueSize: 3,
} as const;
