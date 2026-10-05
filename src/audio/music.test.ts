import { describe, expect, it } from 'vitest';

import { playableState } from './music.ts';
import type { MusicState } from './nightMood.ts';

const readyOnly =
  (...states: MusicState[]) =>
  (state: MusicState): boolean =>
    states.includes(state);

describe('morceau joué', () => {
  it('joue le morceau demandé dès qu’il est décodé', () => {
    for (const state of ['day', 'night', 'combat'] as const) {
      expect(playableState(state, readyOnly('day', 'night', 'combat'))).toBe(state);
    }
  });

  it('le combat attend sur la nuit, la nuit sur le jour derrière le mur', () => {
    expect(playableState('combat', readyOnly('day', 'night'))).toBe('night');
    expect(playableState('combat', readyOnly('day'))).toBe('day');
    expect(playableState('night', readyOnly('day', 'combat'))).toBe('day');
  });

  it('le jour ne retombe jamais sur la nuit, et rien de prêt ne joue rien', () => {
    expect(playableState('day', readyOnly('night', 'combat'))).toBeNull();
    expect(playableState('combat', readyOnly())).toBeNull();
  });
});
