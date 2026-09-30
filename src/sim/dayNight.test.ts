import { describe, expect, it } from 'vitest';
import { DAY_CYCLE } from '../data/dayNight.ts';
import { WAVES } from '../data/enemies.ts';
import { CYCLE_TICKS, clockAt, darkness, isWaveTick, ticksToNextWave, ticksToNight } from './dayNight.ts';

const NIGHTFALL = DAY_CYCLE.day + DAY_CYCLE.dusk;

describe('horloge du jour et de la nuit', () => {
  it('enchaîne jour, crépuscule, nuit et aube, puis recommence', () => {
    expect(clockAt(0)).toMatchObject({ phase: 'day', cycle: 1, elapsed: 0, left: DAY_CYCLE.day });
    expect(clockAt(DAY_CYCLE.day - 1).phase).toBe('day');
    expect(clockAt(DAY_CYCLE.day)).toMatchObject({ phase: 'dusk', elapsed: 0 });
    expect(clockAt(NIGHTFALL)).toMatchObject({ phase: 'night', elapsed: 0, cycle: 1 });
    expect(clockAt(NIGHTFALL + DAY_CYCLE.night)).toMatchObject({ phase: 'dawn', elapsed: 0 });
    expect(clockAt(CYCLE_TICKS)).toMatchObject({ phase: 'day', elapsed: 0, cycle: 2 });
  });

  it('assombrit au crépuscule et éclaircit à l’aube, sans saut', () => {
    expect(darkness(clockAt(0))).toBe(0);
    expect(darkness(clockAt(DAY_CYCLE.day))).toBe(0);
    expect(darkness(clockAt(DAY_CYCLE.day + DAY_CYCLE.dusk / 2))).toBeCloseTo(0.5);
    expect(darkness(clockAt(NIGHTFALL))).toBe(1);
    expect(darkness(clockAt(NIGHTFALL + DAY_CYCLE.night))).toBe(1);
    expect(darkness(clockAt(CYCLE_TICKS - 1))).toBeCloseTo(1 / DAY_CYCLE.dawn);
  });

  it('ne lance les vagues que la nuit, et compte juste jusqu’à la prochaine', () => {
    const waveTicks: number[] = [];

    for (let tick = 0; tick < CYCLE_TICKS * 2; tick += 1) {
      if (isWaveTick(clockAt(tick))) waveTicks.push(tick);
    }

    const perCycle = Array.from({ length: WAVES.perNight }, (_, k) => NIGHTFALL + k * WAVES.interval);

    expect(waveTicks).toEqual([...perCycle, ...perCycle.map((tick) => tick + CYCLE_TICKS)]);

    for (const tick of [0, 100, NIGHTFALL - 1, NIGHTFALL + 1, CYCLE_TICKS - 1]) {
      const left = ticksToNextWave(clockAt(tick));

      expect(isWaveTick(clockAt(tick + left))).toBe(true);
      for (let t = tick; t < tick + left; t += 1) expect(isWaveTick(clockAt(t))).toBe(false);
    }

    expect(ticksToNight(clockAt(0))).toBe(NIGHTFALL);
    expect(ticksToNight(clockAt(NIGHTFALL + 1))).toBe(0);
    expect(ticksToNight(clockAt(CYCLE_TICKS - 1))).toBe(NIGHTFALL + 1);
  });
});
