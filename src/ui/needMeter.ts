/**
 * Un besoin d'un habitant en une ligne : l'icône de ce qui le comble (l'épi,
 * la goutte), sa jauge, son état — en menthe rassasié, en corail affamé.
 * L'infobulle du HUD et la fenêtre d'un habitant en montrent une par besoin.
 */

import { NEEDS, type NeedId } from '../data/needs.ts';
import { t } from '../i18n/locale.ts';
import { needState } from '../sim/needs.ts';
import { itemIcon } from './icons.ts';
import { needText } from './personText.ts';
import { setTip } from './tooltip.ts';

export function needMeter(need: NeedId, value: number): HTMLElement {
  const row = document.createElement('div');
  const track = document.createElement('div');
  const fill = document.createElement('div');
  const label = document.createElement('span');
  const state = needState(need, value);

  row.className = 'hud-meter hud-person-need';
  row.dataset['done'] = String(state === 'sated');
  row.dataset['blocked'] = String(state === 'deprived');
  track.className = 'hud-bar';
  fill.className = 'hud-bar-fill';
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  track.append(fill);
  label.className = 'hud-meter-value';
  label.textContent = needText(need, state);
  const icon = itemIcon(NEEDS[need].item, 18);

  // Au survol, ce que boit ou mange l'habitant : « Eau », « Nourriture ».
  setTip(icon, t().items[NEEDS[need].item]);
  row.append(icon, track, label);
  return row;
}
