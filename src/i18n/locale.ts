/**
 * La langue du jeu : laquelle est choisie, et le dictionnaire qui va avec.
 *
 * Deux langues, un dictionnaire chacune (`fr/`, `en/`). Le français fait foi :
 * le type `Messages` se déduit de lui, et l'anglais doit avoir exactement les
 * mêmes clés — une clé oubliée casse le typecheck, et `i18n.test.ts` compare
 * les deux arbres.
 *
 * `sim/` et `data/` n'en savent rien : la simulation émet des identifiants
 * (un id d'objet, un code de refus, un id de quête), l'UI les traduit avec
 * `t()`. Les textes français du contenu restent dans `data/` ; le dictionnaire
 * français les reprend, l'anglais les traduit.
 *
 * Changer de langue ne recharge rien : `setLocale` rappelle chaque abonné
 * d'`onLocale`, qui réécrit ses libellés fixes ; le reste de l'UI relit `t()`
 * à chaque rendu. Le choix est une préférence de l'appareil
 * (`storage/localLocale.ts`), jamais dans la partie.
 */

import { EN } from './en/index.ts';
import { FR } from './fr/index.ts';
import type { Messages } from './messages.ts';

export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];

const DICTIONARIES: Record<Locale, Messages> = { fr: FR, en: EN };

let current: Locale = 'fr';
const listeners = new Set<(locale: Locale) => void>();

export function isLocale(value: unknown): value is Locale {
  return value === 'fr' || value === 'en';
}

/** La langue en cours. */
export function locale(): Locale {
  return current;
}

/** Le dictionnaire de la langue en cours : à relire à chaque rendu, jamais à garder. */
export function t(): Messages {
  return DICTIONARIES[current];
}

/** Le dictionnaire d'une langue donnée — le sélecteur de langue nomme chacune dans la sienne. */
export function messagesOf(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/** Change de langue et prévient les abonnés ; sans effet si c'est déjà la bonne. */
export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener(next);
}

/**
 * Appelle `apply` tout de suite, puis à chaque changement de langue. Pour les
 * libellés fixes d'un élément qui vit toute la partie : un élément recréé à
 * chaque rendu relit `t()` et n'a pas besoin de s'abonner. Renvoie de quoi se
 * désabonner.
 */
export function onLocale(apply: (locale: Locale) => void): () => void {
  apply(current);
  listeners.add(apply);
  return () => listeners.delete(apply);
}

/**
 * La langue d'un premier lancement, d'après celles du navigateur : le
 * français s'il vient en tête (`fr`, `fr-CA`…), l'anglais sinon.
 */
export function detectLocale(languages: readonly string[]): Locale {
  const first = languages[0]?.toLowerCase() ?? '';

  return first === 'fr' || first.startsWith('fr-') ? 'fr' : 'en';
}
