/**
 * Les besoins des habitants — contenu pur : la faim et la soif.
 *
 * Chaque ouvrier, bûcheron et enfant porte une jauge par besoin, de 1
 * (comblé) à 0 (à bout). Elle baisse avec le temps de jeu, plus vite au
 * travail qu'au repos. Sous `seekBelow`, il interrompt sa tâche et va
 * consommer `item` au stock de la ville — à la mairie —, puis la reprend.
 * Sans rien à consommer, il passe sous `weakBelow` et travaille au ralenti ;
 * à zéro, il s'arrête (`stopsWork`). Un enfant qui manque ne grandit pas
 * (`blocksGrowth`). Personne n'en meurt : la famine arrête le travail, rien
 * de plus — on la rend mortelle en ajoutant ici un délai, pas en touchant aux
 * humains.
 *
 * La soif est la faim en plus pressé : l'eau du puits, une jauge qui baisse
 * deux fois plus vite. Un besoin de plus est une entrée de plus dans
 * `NEEDS` : la jauge, le trajet, l'allure, la bulle et l'infobulle suivent.
 */

import type { ItemId } from './items.ts';

export interface NeedProto {
  /** Ce qui le comble, pris au stock de la ville. */
  item: ItemId;
  /** Unités consommées à chaque passage à la mairie : la jauge remonte à 1. */
  meal: number;
  /** Ticks pour vider une jauge pleine, au repos — un enfant, un ouvrier qui flâne ou dort. */
  restTicks: number;
  /** Ticks pour vider une jauge pleine, au travail. */
  workTicks: number;
  /** Sous ce niveau, il « a faim » : il va consommer s'il y a de quoi. */
  seekBelow: number;
  /** Sous ce niveau, il est « affamé » : il travaille au ralenti. */
  weakBelow: number;
  /** Allure d'un affamé, en part de son allure normale — et celle qui le traîne jusqu'à la mairie. */
  weakPace: number;
  /** Vrai : à zéro, il s'arrête — ni travail ni flânerie, jusqu'à ce qu'il ait de quoi. */
  stopsWork: boolean;
  /** Vrai : un enfant qui manque ne prend pas d'année à l'aube. */
  blocksGrowth: boolean;
}

export const NEEDS = {
  hunger: {
    item: 'food',
    meal: 1,
    // Dix minutes au repos, cinq au travail : un repas toutes les trois minutes pour un porteur.
    restTicks: 20 * 60 * 10,
    workTicks: 20 * 60 * 5,
    seekBelow: 0.4,
    weakBelow: 0.15,
    weakPace: 0.5,
    stopsWork: true,
    blocksGrowth: true,
  },
  thirst: {
    item: 'water',
    meal: 1,
    // Cinq minutes au repos, deux et demie au travail : un porteur boit toutes les minutes et demie.
    restTicks: 20 * 60 * 5,
    workTicks: 20 * 60 * 2.5,
    seekBelow: 0.4,
    weakBelow: 0.15,
    weakPace: 0.5,
    stopsWork: true,
    blocksGrowth: true,
  },
} as const satisfies Record<string, NeedProto>;

export type NeedId = keyof typeof NEEDS;

export const NEED_IDS = Object.keys(NEEDS) as NeedId[];

/**
 * L'alerte du HUD : la ville « va manquer » d'un objet qu'un besoin
 * consomme quand, au rythme des habitants, son stock ne tient pas
 * `runwayTicks` — ou dès que quelqu'un a faim (ou soif) sans rien en ville.
 */
export const NEED_ALERT = {
  runwayTicks: 20 * 60 * 2,
} as const;
