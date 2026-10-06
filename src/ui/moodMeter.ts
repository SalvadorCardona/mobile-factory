/**
 * Le bonheur d'un habitant en une ligne : le visage, sa jauge, son moral —
 * en menthe content, en corail malheureux. La fenêtre d'un habitant la
 * montre sous ses besoins.
 */

import { HAPPINESS } from '../data/housing.ts';
import { t } from '../i18n/locale.ts';
import { moodOf } from '../sim/housing.ts';
import { uiIcon } from './icons.ts';
import { setTip } from './tooltip.ts';

export function moodMeter(happiness: number): HTMLElement {
  const row = document.createElement('div');
  const track = document.createElement('div');
  const fill = document.createElement('div');
  const label = document.createElement('span');
  const mood = moodOf(happiness);
  const icon = uiIcon('mood', 18);

  row.className = 'hud-meter hud-person-need';
  row.dataset['done'] = String(mood === 'content');
  row.dataset['blocked'] = String(mood === 'unhappy');
  track.className = 'hud-bar';
  fill.className = 'hud-bar-fill';
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, happiness / HAPPINESS.max)) * 100)}%`;
  track.append(fill);
  label.className = 'hud-meter-value';
  label.textContent = t().hud.person.mood[mood];
  setTip(icon, t().hud.person.moodLabel(Math.round(happiness)));
  row.append(icon, track, label);
  return row;
}
