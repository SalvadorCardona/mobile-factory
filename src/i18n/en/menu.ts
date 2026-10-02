/** Section `menu` du dictionnaire anglais. */

import type { Messages } from '../messages.ts';

/** "1 stone", "3 stones". */
const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export const menu: Messages['menu'] = {
  build: 'Build',
  keys: {
    space: 'Space',
    arrows: 'Arrows',
    enter: 'Enter',
    escape: 'Esc',
  },
  drawerTitle: 'Buildings',
  effectPrompt: 'Long-press a card: what is it for?',
  cardEffect: (name, effect) => `${name}: ${effect}`,
  free: 'free',
  employs: (n) => `Employs ${n} worker${n === 1 ? '' : 's'}`,
  road: 'Road',
  roadEffect: (speed) => `Adam and the workers go ${speed}x faster on it. Swipe from tile to tile`,
  roadMeta: 'per tile · no site',
  newBadge: 'New',
  place: 'Place',
  placeAgain: 'Place again',
  remove: 'Remove',
  pave: 'Pave',
  placing: (name) => `Place: ${name}`,
  tapToPlace: (name) => `Tap the map to place: ${name}`,
  removeCount: (slabs) => `Remove ${count(slabs, 'slab')} — gives back ${count(slabs, 'stone')}`,
  removeHint: 'Remove: swipe over the slabs',
  roadCount: (tiles) => `Road: ${count(tiles, 'tile')} — ${count(tiles, 'stone')}`,
  roadHint: 'Road: swipe from tile to tile',
};
