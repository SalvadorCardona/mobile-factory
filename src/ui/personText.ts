/**
 * L'infobulle d'un habitant, en une ligne : prénom, âge, ce qu'il fait.
 *
 * « Lina, 12 ans · enfant, travaille dans 2 jours », « Tom, 27 ans · au
 * travail : Foreuse », « Tom, 27 ans · sans travail » ; dessous, l'état de
 * chaque besoin (« rassasié », « a faim », « affamé »). Pur : testé sans DOM.
 */

import type { NeedId } from '../data/needs.ts';
import { t } from '../i18n/locale.ts';
import type { NeedState } from '../sim/needs.ts';
import type { Occupation } from '../sim/world.ts';

export function personText(name: string, age: number, occupation: Occupation): string {
  return t().hud.person.line(name, age, occupationText(occupation));
}

/** L'état d'un besoin, sous la ligne : « rassasié », « a faim », « affamé ». */
export function needText(need: NeedId, state: NeedState): string {
  return t().hud.person.needs[need][state];
}

function occupationText(occupation: Occupation): string {
  const text = t().hud.person;

  switch (occupation.kind) {
    case 'child':
      return occupation.days > 0 ? text.childDays(occupation.days) : text.child;
    case 'working':
      return occupation.at ? text.workingAt(t().buildings[occupation.at].label) : text.working;
    case 'idle':
      return text.idle;
    case 'home':
      return text.home;
  }
}
