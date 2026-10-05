import { describe, expect, it } from 'vitest';
import { placeTip } from './tooltip.ts';

const screen = { width: 400, height: 800 };
const size = { width: 120, height: 30 };

describe('placeTip', () => {
  it('pose la bulle sous l’icône, centrée dessus', () => {
    const place = placeTip({ left: 140, top: 20, width: 20, height: 20 }, size, screen);

    expect(place).toEqual({ left: 90, top: 48, below: true });
  });

  it('la passe au-dessus quand elle ne tient pas dessous', () => {
    const place = placeTip({ left: 140, top: 760, width: 20, height: 20 }, size, screen);

    expect(place.below).toBe(false);
    expect(place.top + size.height).toBeLessThanOrEqual(760);
  });

  it('ne sort pas de l’écran par les côtés', () => {
    expect(placeTip({ left: 385, top: 20, width: 10, height: 10 }, size, screen).left).toBe(400 - 8 - 120);
    expect(placeTip({ left: 0, top: 20, width: 10, height: 10 }, size, screen).left).toBe(8);
  });
});
