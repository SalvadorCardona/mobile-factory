/** Section `resourcePanel` of the English dictionary. */

import type { Messages } from '../messages.ts';

export const resourcePanel: Messages['resourcePanel'] = {
  title: 'Resources',
  open: 'Open resource details',
  window: 'Town, over the last two minutes of play',
  empty: 'Nothing in town yet.',
  trend: { up: 'rising', flat: 'steady', down: 'falling' },
  produced: 'In',
  consumed: 'Out',
  net: 'Net',
  perMinute: (rate) => `${rate}/min`,
  runsOut: (minutes) => (minutes < 1 ? 'runs out in under a minute' : `runs out in ~${minutes} min`),
  history: (item, from, to) => `${item}: from ${from} to ${to} over two minutes`,
  rowLabel: (item, stock, trend) => `${item} — ${stock} in town, ${trend}`,
};
