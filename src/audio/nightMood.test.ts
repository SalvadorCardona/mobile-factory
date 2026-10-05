import { describe, expect, it } from 'vitest';

import {
  CALM_DELAY_S,
  DAY_MOOD,
  DRONE,
  MUSIC_DAY,
  MUSIC_FADE_S,
  MUSIC_NIGHT,
  PULSE_GAIN,
  nightLevels,
  musicState,
  nightMood,
  type MusicState,
  type NightMoment,
  type NightMood,
} from './nightMood.ts';

function play(moments: [NightMoment, number][]): NightMood {
  return moments.reduce((mood, [moment, at]) => nightMood(mood, moment, at), DAY_MOOD);
}

describe('humeur de la nuit', () => {
  it('le jour, la musique est ouverte et la tension muette', () => {
    expect(nightLevels(DAY_MOOD, 0)).toEqual({
      cutoff: MUSIC_DAY.cutoff,
      music: MUSIC_DAY.volume,
      drone: 0,
      pulse: 0,
      stepsPerBeat: 1,
    });
  });

  it('au crépuscule, la musique passe derrière le mur, bourdon et pulsation à la noire', () => {
    expect(nightLevels(play([['dusk', 10]]), 11)).toEqual({
      cutoff: MUSIC_NIGHT.cutoff,
      music: MUSIC_NIGHT.volume,
      drone: DRONE.gain,
      pulse: PULSE_GAIN,
      stepsPerBeat: 1,
    });
  });

  it('pendant une vague, la pulsation passe à la double croche', () => {
    expect(nightLevels(play([['dusk', 10], ['wave', 20]]), 30).stepsPerBeat).toBe(4);
  });

  it('elle redescend deux secondes après le dernier mutant, pas avant', () => {
    const mood = play([['dusk', 10], ['wave', 20], ['cleared', 50]]);

    expect(nightLevels(mood, 50 + CALM_DELAY_S - 0.1).stepsPerBeat).toBe(4);
    expect(nightLevels(mood, 50 + CALM_DELAY_S).stepsPerBeat).toBe(1);
    expect(nightLevels(mood, 50 + CALM_DELAY_S).drone).toBe(DRONE.gain);
  });

  it('une nouvelle vague relance la double croche', () => {
    const mood = play([['dusk', 10], ['wave', 20], ['cleared', 50], ['wave', 80]]);

    expect(nightLevels(mood, 100).stepsPerBeat).toBe(4);
  });

  it('une vague repoussée deux fois ne repousse pas le retour au calme', () => {
    const mood = play([['dusk', 10], ['wave', 20], ['cleared', 50], ['cleared', 51.5]]);

    expect(nightLevels(mood, 50 + CALM_DELAY_S).stepsPerBeat).toBe(1);
  });

  it("à l'aube, tout revient au jour, même en pleine vague", () => {
    const mood = play([['dusk', 10], ['wave', 20], ['dawn', 60]]);

    expect(mood).toEqual(DAY_MOOD);
    expect(nightLevels(mood, 60)).toEqual(nightLevels(DAY_MOOD, 0));
  });
});

describe('morceau de la nuit', () => {
  it('jour → nuit → combat → nuit → jour, au fil des moments', () => {
    const moments: NightMoment[] = ['dusk', 'wave', 'cleared', 'dawn'];
    const states: MusicState[] = [];

    moments.reduce((mood, moment, at) => {
      const next = nightMood(mood, moment, at);

      states.push(musicState(next));
      return next;
    }, DAY_MOOD);

    expect([musicState(DAY_MOOD), ...states]).toEqual(['day', 'night', 'combat', 'night', 'day']);
  });

  it('une seconde vague dans la même nuit relance le combat', () => {
    expect(musicState(play([['dusk', 10], ['wave', 20], ['cleared', 50], ['wave', 80]]))).toBe('combat');
  });

  it("une vague repoussée au jour ou deux fois de suite ne change pas le morceau", () => {
    expect(musicState(play([['cleared', 5]]))).toBe('day');
    expect(musicState(play([['dusk', 10], ['wave', 20], ['cleared', 50], ['cleared', 51]]))).toBe('night');
  });

  it("l'aube coupe le combat, et une partie perdue revient au jour", () => {
    expect(musicState(play([['dusk', 10], ['wave', 20], ['dawn', 60]]))).toBe('day');
  });

  it('le combat entre plus vite que les retours au calme', () => {
    expect(MUSIC_FADE_S.combat).toBeLessThan(MUSIC_FADE_S.night);
    expect(MUSIC_FADE_S.day).toBeGreaterThan(0);
  });
});
