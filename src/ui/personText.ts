/**
 * L'infobulle d'un habitant, en une ligne : prénom, âge, ce qu'il fait.
 *
 * « Lina, 12 ans · enfant, travaille dans 2 jours », « Tom, 27 ans · au
 * travail : Foreuse », « Tom, 27 ans · sans travail ». Pur : testé sans DOM.
 */

import { BUILDINGS } from '../data/buildings.ts';
import type { Occupation } from '../sim/world.ts';

export function personText(name: string, age: number, occupation: Occupation): string {
  return `${name}, ${age} ans · ${occupationText(occupation)}`;
}

function occupationText(occupation: Occupation): string {
  switch (occupation.kind) {
    case 'child':
      return occupation.days > 0 ? `enfant, travaille dans ${occupation.days} jour${occupation.days > 1 ? 's' : ''}` : 'enfant';
    case 'working':
      return occupation.at ? `au travail : ${BUILDINGS[occupation.at].label}` : 'au travail';
    case 'idle':
      return 'sans travail';
    case 'home':
      return 'à la maison';
  }
}
