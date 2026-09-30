import { describe, expect, it } from 'vitest';
import {
  COLORS,
  GROUND,
  PALETTE,
  STROKE,
  auditSvg,
  cushion,
  flag,
  flower,
  groundShadow,
  ladder,
  railing,
  shadedBlock,
  shadedCircle,
  shadedPill,
  svg,
  vine,
  windowPane,
} from './artDirection.ts';

/** Luminance relative approchée : suffit à reconnaître un gris ou un noir. */
function channels(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);

  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe('direction artistique', () => {
  it('n’a ni gris ni noir dans la palette', () => {
    for (const color of COLORS) {
      const [r, g, b] = channels(color);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);

      // Le blanc du HUD est la seule couleur neutre admise.
      if (color === PALETTE.paper.base) continue;
      expect(spread, `${color} est un gris`).toBeGreaterThan(24);
    }
  });

  it('garde chaque ombre saturée et plus sombre que sa base — jamais un gris', () => {
    for (const [name, tone] of Object.entries(PALETTE)) {
      const [br, bg, bb] = channels(tone.base);
      const [sr, sg, sb] = channels(tone.shade);

      expect(sr + sg + sb, `${name} : l’ombre doit être plus sombre`).toBeLessThan(br + bg + bb);
      if (tone.base === PALETTE.paper.base) continue;
      // Une ombre grise écrase l'écart entre canaux ; une ombre de même teinte le garde.
      expect(Math.max(sr, sg, sb) - Math.min(sr, sg, sb), `${name} : l’ombre s’affadit`).toBeGreaterThan(
        (Math.max(br, bg, bb) - Math.min(br, bg, bb)) * 0.6,
      );
    }
    for (const [name, ground] of Object.entries(GROUND)) {
      const [br, bg, bb] = channels(ground.base);
      const [sr, sg, sb] = channels(ground.shade);

      expect(sr + sg + sb, `${name} : l’ombre portée doit être plus sombre que le sol`).toBeLessThan(br + bg + bb);
    }
  });

  it('les helpers ne produisent que du SVG conforme', () => {
    const sample = svg(
      64,
      64,
      shadedBlock(4, 4, 40, 30, 8, 'violet'),
      shadedPill(4, 40, 30, 16, 5, 'coral'),
      shadedCircle(50, 50, 8, 'cyan'),
      cushion(32, 20, 30, 12),
      groundShadow(32, 60, 30, 6, 'sand'),
      ladder(50, 4, 30),
      railing(4, 4, 30, 6, 4),
      flag(20, 2, 14, 'cyan'),
      flower(10, 50, 'coral'),
      vine([2, 2, 4, 10, 2, 18, 4, 26]),
      windowPane(10, 10, 6, 8, 'yellow'),
    );

    expect(auditSvg(sample)).toEqual([]);
  });

  it('attrape ce que la direction interdit', () => {
    const problems = auditSvg(
      '<svg><rect fill="#808080"/><circle fill="#ff4d6d" stroke="#2b2d8f"/>' +
        `<line stroke="#2b2d8f" stroke-width="${STROKE.width + 1}"/><rect fill="#ffd23f" opacity="0.5"/></svg>`,
    );

    expect(problems).toContain('remplissage hors palette : #808080');
    expect(problems.some((problem) => problem.startsWith('contour autour'))).toBe(true);
    expect(problems.some((problem) => problem.startsWith('trait d’épaisseur') || problem.startsWith("trait d'épaisseur"))).toBe(true);
    expect(problems).toContain('transparence');
  });
});
