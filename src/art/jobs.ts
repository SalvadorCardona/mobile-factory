/**
 * Les médaillons de métier des bâtiments, pour la carte : un morceau par
 * bâtiment, le dessin de `data/jobIcons.ts` tel quel, du cadre des icônes
 * (que `JOB_ICONS` garantit complet).
 * La pancarte (`render/signboard.ts`) le pose au bout de son panneau.
 */

import { ICON_SIZE } from '../data/icons.ts';
import { JOB_DRAWINGS } from '../data/jobIcons.ts';
import type { SpriteProto } from '../data/sprites.ts';

export const JOBS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  anchorX: 0.5,
  anchorY: 0.5,
  parts: JOB_DRAWINGS,
} satisfies SpriteProto;
