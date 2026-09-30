/**
 * Les textes du panneau Recherche : l'effet chiffré d'une recherche, son
 * état, et le temps qui reste.
 *
 * Fonctions pures, sans DOM : `researchPanel.ts` les affiche, les tests les
 * lisent. Les chiffres viennent des données (`STAT_BASE`, `RESEARCH`) et des
 * recherches déjà finies : « Dégâts de l'arc : 1 → 1,5 » dit ce que la
 * recherche change **maintenant**, pas dans l'absolu.
 */

import { bagBonus, type PerkId } from '../data/perks.ts';
import { RESEARCH, RESEARCH_STATS, type ResearchId, type ResearchStat } from '../data/research.ts';
import { STAT_BASE, missingRequirements, researchBonus, type ResearchStatus } from '../sim/research.ts';
import { TICKS_PER_SECOND } from '../sim/world.ts';

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Une valeur de statistique, dans son unité : « 1,5 », « 0,5 s », « +50 % », « 5,4 cases/s ». */
export function formatStat(stat: ResearchStat, value: number): string {
  const { unit, ticks, percent } = RESEARCH_STATS[stat];

  if (percent) return value === 0 ? '0 %' : `+${NUMBER.format(Math.round(value * 100))} %`;
  return `${NUMBER.format(ticks ? value / TICKS_PER_SECOND : value)}${unit}`;
}

/**
 * La valeur de la statistique avec ces recherches finies. Le sac compte
 * aussi les places offertes par le jardin : c'est celui qu'Adam porte.
 */
export function statValue(stat: ResearchStat, done: readonly ResearchId[], perks: readonly PerkId[] = []): number {
  const garden = stat === 'bagCapacity' ? bagBonus(perks) : 0;

  return STAT_BASE[stat] + garden + researchBonus(done, stat);
}

/**
 * L'effet chiffré d'une recherche : la statistique sans elle, puis avec —
 * « Dégâts de l'arc : 1 → 1,5 ». Une recherche finie se lit pareil : ce
 * qu'elle a changé.
 */
export function effectLine(id: ResearchId, done: readonly ResearchId[], perks: readonly PerkId[] = []): string {
  const { stat, amount } = RESEARCH[id].effect;
  const others = done.filter((other) => other !== id);
  const before = statValue(stat, others, perks);

  return `${RESEARCH_STATS[stat].label} : ${formatStat(stat, before)} → ${formatStat(stat, before + amount)}`;
}

/** L'état d'une recherche en une ligne, sous son effet. */
export function statusLine(id: ResearchId, status: ResearchStatus, done: readonly ResearchId[], ticksLeft = 0): string {
  switch (status) {
    case 'done':
      return 'Terminée';
    case 'running':
      return `En cours — encore ${clock(ticksLeft)}`;
    case 'collecting':
      return 'En attente de son coût';
    case 'available':
      return `Durée : ${clock(RESEARCH[id].duration)}`;
    case 'locked':
      return `Requiert : ${missingRequirements(id, done)
        .map((required) => RESEARCH[required].label)
        .join(', ')}`;
  }
}

/** « 1 min 05 s » ou « 42 s » à partir d'un nombre de ticks. */
export function clock(ticks: number): string {
  const seconds = Math.ceil(Math.max(0, ticks) / TICKS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return minutes > 0 ? `${minutes} min ${rest.toString().padStart(2, '0')} s` : `${rest} s`;
}
