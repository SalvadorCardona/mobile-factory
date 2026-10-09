import { describe, expect, it } from 'vitest';
import { auditSvg } from '../data/artDirection.ts';
import { CURSORS, CURSOR_IDS, CURSOR_SIZE } from '../data/cursors.ts';
import { CURSOR_SVGS } from './cursors.ts';

describe('curseurs', () => {
  it.each(CURSOR_IDS)('%s respecte la direction artistique', (id) => {
    expect(auditSvg(CURSOR_SVGS[id])).toEqual([]);
  });

  it.each(CURSOR_IDS)('%s tient dans son cadre, point chaud compris', (id) => {
    const { hotspot } = CURSORS[id];

    expect(CURSOR_SVGS[id]).toContain(`width="${CURSOR_SIZE}" height="${CURSOR_SIZE}"`);
    expect(hotspot.x).toBeGreaterThanOrEqual(0);
    expect(hotspot.x).toBeLessThan(CURSOR_SIZE);
    expect(hotspot.y).toBeGreaterThanOrEqual(0);
    expect(hotspot.y).toBeLessThan(CURSOR_SIZE);
  });
});
