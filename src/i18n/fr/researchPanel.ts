/** Section `researchPanel` du dictionnaire français : le panneau du labo et ses textes (`ui/researchText.ts`). */

export const researchPanel = {
  transfer: 'Transférer',
  abandon: 'Abandonner',
  takeRest: 'Prendre le reste',
  noneTitle: 'Aucune recherche en cours',
  noneHint: 'Choisissez-en une ci-dessous, puis apportez son coût.',
  approach: 'Rapprochez-vous pour déposer — ou laissez faire les porteurs.',
  transferBoth: 'Transférez le sac et la ville, heurtez le labo, ou laissez faire les porteurs.',
  transferBag: 'Transférez le sac, heurtez le labo, ou laissez faire les porteurs.',
  /** L'état d'une ligne de la liste, recherche en cours. */
  running: 'En cours',
  launch: 'Lancer',
  /** Un bonus en pour cent, déjà formaté : « +50 % ». */
  percent: (value: string): string => `+${value} %`,
  zeroPercent: '0 %',
  /** L'effet chiffré : « Dégâts de l’arc : 1 → 1,5 ». */
  effect: (stat: string, before: string, after: string): string => `${stat} : ${before} → ${after}`,
  done: 'Terminée',
  runningLeft: (time: string): string => `En cours — encore ${time}`,
  collecting: 'En attente de son coût',
  duration: (time: string): string => `Durée : ${time}`,
  /** `list` : les prérequis qui manquent, déjà joints. */
  requires: (list: string): string => `Requiert : ${list}`,
  /** « 1 min 05 s » : `seconds` déjà sur deux chiffres. */
  minutes: (minutes: number, seconds: string): string => `${minutes} min ${seconds} s`,
  seconds: (seconds: number): string => `${seconds} s`,
};
