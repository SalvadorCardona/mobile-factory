/** Section `researchPanel` du dictionnaire anglais. */

import type { Messages } from '../messages.ts';

export const researchPanel: Messages['researchPanel'] = {
  transfer: 'Transfer',
  abandon: 'Abandon',
  takeRest: 'Take the rest',
  noneTitle: 'No research underway',
  noneHint: 'Pick one below, then bring its cost.',
  approach: 'Come closer to drop off — or let the porters do it.',
  transferBoth: 'Transfer from the bag and the town, bump the lab, or let the porters do it.',
  transferBag: 'Transfer from the bag, bump the lab, or let the porters do it.',
  running: 'Underway',
  launch: 'Start',
  unlocks: 'Unlocks:',
  percent: (value) => `+${value}%`,
  zeroPercent: '0%',
  effect: (stat, before, after) => `${stat}: ${before} → ${after}`,
  done: 'Done',
  runningLeft: (time) => `Underway — ${time} left`,
  collecting: 'Waiting for its cost',
  duration: (time) => `Duration: ${time}`,
  requires: (list) => `Requires: ${list}`,
  minutes: (minutes, seconds) => `${minutes} min ${seconds} s`,
  seconds: (seconds) => `${seconds} s`,
};
