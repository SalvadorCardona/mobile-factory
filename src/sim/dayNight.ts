/**
 * L'horloge du jour et de la nuit.
 *
 * Aucun état ici : l'heure se lit dans le nombre de ticks écoulés depuis que
 * le toit de la mairie est posé, et les durées dans `data/dayNight.ts`. Le
 * monde n'a qu'un tick de départ à garder ; une sauvegarde rechargée retombe
 * sur la même heure, et deux parties identiques sur les mêmes nuits.
 *
 * Le cycle commence par une journée : day → dusk → night → dawn → day…
 */

import { DAY_CYCLE } from '../data/dayNight.ts';
import { WAVES } from '../data/enemies.ts';

export type DayPhase = keyof typeof DAY_CYCLE;

export const DAY_PHASES: readonly DayPhase[] = ['day', 'dusk', 'night', 'dawn'];

/** Un cycle complet, en ticks. */
export const CYCLE_TICKS = DAY_PHASES.reduce((total, phase) => total + DAY_CYCLE[phase], 0);

/** Début de la nuit dans le cycle, en ticks. */
const NIGHT_OFFSET = DAY_CYCLE.day + DAY_CYCLE.dusk;

export interface DayClock {
  phase: DayPhase;
  /** Numéro du cycle, 1 pour le premier : la journée 1 précède la nuit 1. */
  cycle: number;
  /** Ticks écoulés dans la phase ; 0 au premier tick de la phase. */
  elapsed: number;
  /** Ticks restant avant la phase suivante. */
  left: number;
  /** Ticks écoulés depuis le début du cycle. */
  offset: number;
}

/** L'heure qu'il est, `ticks` ticks après le lever du premier jour. */
export function clockAt(ticks: number): DayClock {
  const offset = ((ticks % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;
  const cycle = Math.floor(ticks / CYCLE_TICKS) + 1;
  let start = 0;

  for (const phase of DAY_PHASES) {
    const duration = DAY_CYCLE[phase];

    if (offset < start + duration) {
      return { phase, cycle, elapsed: offset - start, left: start + duration - offset, offset };
    }
    start += duration;
  }
  throw new Error('horloge hors du cycle');
}

/**
 * Part de nuit, de 0 (plein jour) à 1 (nuit noire) : elle monte pendant le
 * crépuscule et redescend pendant l'aube. C'est tout ce que le rendu applique.
 */
export function darkness(clock: DayClock): number {
  switch (clock.phase) {
    case 'day':
      return 0;
    case 'dusk':
      return clock.elapsed / DAY_CYCLE.dusk;
    case 'night':
      return 1;
    case 'dawn':
      return 1 - clock.elapsed / DAY_CYCLE.dawn;
  }
}

/** Vrai si une vague part à ce tick : la nuit, toutes les `WAVES.interval`, `WAVES.perNight` fois. */
export function isWaveTick(clock: DayClock): boolean {
  return (
    clock.phase === 'night' &&
    clock.elapsed % WAVES.interval === 0 &&
    clock.elapsed / WAVES.interval < WAVES.perNight
  );
}

/** Ticks avant la prochaine vague, de cette nuit ou de la suivante ; 0 si elle part à ce tick. */
export function ticksToNextWave(clock: DayClock): number {
  for (let wave = 0; wave < WAVES.perNight; wave += 1) {
    const at = NIGHT_OFFSET + wave * WAVES.interval;

    if (at >= clock.offset) return at - clock.offset;
  }
  return CYCLE_TICKS - clock.offset + NIGHT_OFFSET;
}

/** Ticks avant la tombée de la prochaine nuit ; 0 pendant la nuit. */
export function ticksToNight(clock: DayClock): number {
  if (clock.phase === 'night') return 0;
  if (clock.offset < NIGHT_OFFSET) return NIGHT_OFFSET - clock.offset;
  return CYCLE_TICKS - clock.offset + NIGHT_OFFSET;
}

/** Début de l'aube dans le cycle, en ticks : c'est là qu'une nuit compte pour survécue. */
const DAWN_OFFSET = NIGHT_OFFSET + DAY_CYCLE.night;

/** Ticks avant la prochaine aube ; un cycle entier au premier tick de l'aube, qui vient de passer. */
export function ticksToDawn(clock: DayClock): number {
  if (clock.offset < DAWN_OFFSET) return DAWN_OFFSET - clock.offset;
  return CYCLE_TICKS - clock.offset + DAWN_OFFSET;
}
