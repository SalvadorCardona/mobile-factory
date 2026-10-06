/**
 * Le relevé d'un chantier dans sa fenêtre, une ligne par objet : icône et
 * « livré/requis », puis ce qui est en route et ce que la ville en a. La
 * fenêtre du labo montre le même pour le coût de sa recherche.
 */

import type { UiIcon } from '../art/ui.ts';
import { t } from '../i18n/locale.ts';
import type { SiteLine } from '../sim/siteLedger.ts';
import { itemAmount, uiIcon } from './icons.ts';

/**
 * La ligne d'un objet du chantier : son icône et « livré/requis », puis, s'il
 * en manque, deux puces — en route (porteurs, bâtisseurs) et en ville. Un
 * objet que la ville n'a plus et que personne n'apporte est marqué à sec.
 */
export function siteNeedRow(line: SiteLine): HTMLElement {
  const row = document.createElement('div');

  row.className = 'site-need';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', siteNeedLabel(line));
  row.title = siteNeedLabel(line);
  row.dataset['dry'] = String(line.dry);
  row.append(itemAmount(line.item, line.needed, line.delivered));
  if (line.done) return row;

  row.append(siteNeedChip('worker', line.incoming, 'coming'));
  if (line.inTown !== null) row.append(siteNeedChip('town', line.inTown, 'town'));
  return row;
}

function siteNeedChip(icon: UiIcon, value: number, kind: string): HTMLElement {
  const chip = document.createElement('span');

  chip.className = 'site-need-chip';
  chip.dataset['kind'] = kind;
  chip.dataset['empty'] = String(value === 0);
  chip.append(uiIcon(icon, 16), String(value));
  return chip;
}

/** « Pierre : 0/8 livrés, 2 en route, aucune en ville » — le libellé d'une ligne. */
export function siteNeedLabel(line: SiteLine): string {
  const label = t().items[line.item];
  const text = t().panel.site;

  if (line.done) return text.needDone(label, line.delivered, line.needed);

  const parts = [text.needDelivered(label, line.delivered, line.needed), text.needIncoming(line.incoming)];

  if (line.inTown !== null) parts.push(line.inTown === 0 ? text.needTownEmpty : text.needInTown(line.inTown));
  return parts.join(', ');
}
