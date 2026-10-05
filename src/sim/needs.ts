/**
 * Les jauges des habitants : ce qui baisse, ce qui ralentit, ce qui arrête.
 *
 * Pur : ni monde ni PRNG. `World` décide quand un habitant part consommer
 * (`urgentNeed`) et le fait marcher ; ce module dit seulement où en est une
 * jauge et ce qu'elle coûte à son allure. Tout se lit dans `NEEDS` : un
 * besoin de plus n'y change rien.
 */

import { NEED_IDS, NEEDS, type NeedId } from '../data/needs.ts';

/** Une jauge par besoin, de 0 (à bout) à 1 (comblé). */
export type Needs = Record<NeedId, number>;

/**
 * Où en est un besoin :
 * - `sated` : comblé ;
 * - `wanting` : sous `seekBelow` — il a faim, il va manger s'il y a de quoi ;
 * - `deprived` : sous `weakBelow` — il est affamé, il ralentit, puis s'arrête.
 */
export type NeedState = 'sated' | 'wanting' | 'deprived';

/** Des jauges pleines : un habitant tout juste arrivé, ou d'une sauvegarde d'avant les besoins. */
export function fullNeeds(): Needs {
  return Object.fromEntries(NEED_IDS.map((id) => [id, 1])) as Needs;
}

/** Un tick de temps qui passe : chaque jauge baisse, plus vite au travail. */
export function drainNeeds(needs: Needs, working: boolean): void {
  for (const id of NEED_IDS) {
    const need = NEEDS[id];

    needs[id] = Math.max(0, needs[id] - 1 / (working ? need.workTicks : need.restTicks));
  }
}

export function needState(id: NeedId, value: number): NeedState {
  const need = NEEDS[id];

  if (value < need.weakBelow) return 'deprived';
  if (value < need.seekBelow) return 'wanting';
  return 'sated';
}

/** Affamé d'au moins un besoin : la bulle au-dessus de sa tête. */
export function isDeprived(needs: Needs): boolean {
  return NEED_IDS.some((id) => needState(id, needs[id]) === 'deprived');
}

/** Le besoin le plus bas sous son seuil, celui qu'il va combler d'abord ; `null` s'il ne manque de rien. */
export function urgentNeed(needs: Needs): NeedId | null {
  let urgent: NeedId | null = null;

  for (const id of NEED_IDS) {
    if (needs[id] >= NEEDS[id].seekBelow) continue;
    if (urgent === null || needs[id] < needs[urgent]) urgent = id;
  }
  return urgent;
}

/**
 * Son allure, en part de la normale : 1 comblé, `weakPace` affamé, 0 à bout
 * d'un besoin qui arrête le travail. Le plus bas l'emporte.
 */
export function needsPace(needs: Needs): number {
  let pace = 1;

  for (const id of NEED_IDS) {
    const need = NEEDS[id];

    if (needs[id] <= 0 && need.stopsWork) return 0;
    if (needs[id] < need.weakBelow) pace = Math.min(pace, need.weakPace);
  }
  return pace;
}

/** Un enfant grandit-il cette aube ? Pas s'il manque d'un besoin qui bloque la croissance. */
export function canGrow(needs: Needs): boolean {
  return NEED_IDS.every((id) => !NEEDS[id].blocksGrowth || needState(id, needs[id]) === 'sated');
}

/**
 * Ce tick compte-t-il, à cette allure ? Un affamé ne frappe qu'un tick sur
 * deux à `weakPace` 0,5 : un hachage du tick, sans état ni PRNG.
 */
export function pacedTick(tick: number, pace: number): boolean {
  if (pace >= 1) return true;
  return Math.floor((tick + 1) * pace) > Math.floor(tick * pace);
}

/** Ce qu'un habitant tout juste arrivé porte de ses besoins : rassasié, sans repas en route. */
export function freshNeeds(): { needs: Needs; meal: null } {
  return { needs: fullNeeds(), meal: null };
}
