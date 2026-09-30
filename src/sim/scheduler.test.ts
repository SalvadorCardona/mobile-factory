import { describe, expect, it } from 'vitest';
import { Scheduler } from './scheduler.ts';

describe('Scheduler', () => {
  it('rend un réveil au tick demandé, et pas avant', () => {
    const scheduler = new Scheduler();

    scheduler.schedule(7, 5, 0);

    for (let tick = 1; tick < 5; tick += 1) {
      expect(scheduler.due(tick)).toEqual([]);
    }
    expect(scheduler.due(5)).toEqual([7]);
    expect(scheduler.due(5)).toEqual([]);
  });

  it('refuse un réveil dans le passé', () => {
    const scheduler = new Scheduler();

    expect(() => scheduler.schedule(1, 10, 10)).toThrow();
    expect(() => scheduler.schedule(1, 9, 10)).toThrow();
  });

  /*
   * Le cas qui casse une roue naïve : 256 slots, donc un délai de 300 ticks
   * retomberait sur le slot d'un délai de 44. Les délais longs vont dans la
   * map, et les deux réveils doivent sortir chacun à leur tick.
   */
  it('ne confond pas un délai long avec un délai court du même slot', () => {
    const scheduler = new Scheduler();

    scheduler.schedule(1, 300, 0);
    scheduler.schedule(2, 44, 0);

    expect(scheduler.due(44)).toEqual([2]);
    expect(scheduler.due(300)).toEqual([1]);
  });

  it('rend ensemble les réveils courts et longs qui tombent au même tick', () => {
    const scheduler = new Scheduler();

    scheduler.schedule(1, 400, 0);
    scheduler.schedule(2, 400, 200);

    expect(scheduler.due(400).sort()).toEqual([1, 2]);
    expect(scheduler.size()).toBe(0);
  });

  it('compte les réveils en attente', () => {
    const scheduler = new Scheduler();

    scheduler.schedule(1, 10, 0);
    scheduler.schedule(2, 1000, 0);
    expect(scheduler.size()).toBe(2);

    scheduler.due(10);
    expect(scheduler.size()).toBe(1);
  });

  it('rend les mêmes réveils, dans le même ordre, une fois restauré', () => {
    const original = new Scheduler();

    original.schedule(1, 60, 30);
    original.schedule(2, 60, 30);
    original.schedule(3, 290, 30);
    original.schedule(4, 700, 30);
    // Une échéance partagée entre roue et map : la roue passe d'abord.
    original.schedule(5, 300, 45);
    original.schedule(6, 300, 30);

    const copy = new Scheduler();

    copy.restore(JSON.parse(JSON.stringify(original.toJSON(50))) as ReturnType<Scheduler['toJSON']>);
    expect(copy.size()).toBe(original.size());

    for (let tick = 51; tick <= 800; tick += 1) {
      expect(copy.due(tick)).toEqual(original.due(tick));
    }
  });
});
