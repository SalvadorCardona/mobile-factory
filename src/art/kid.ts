/**
 * Un enfant de la colonie, né à la nurserie.
 *
 * Le corps d'Adam réduit autour des pieds — même tunique orange, même
 * écharpe — sans sac ni arc, avec une casquette jaune : on le reconnaît
 * comme un des nôtres, et comme plus petit. Une fille a la queue de cheval
 * des femmes (`woman.*`) ; un garçon n'a pas encore de barbe.
 */

import { svg } from '../data/artDirection.ts';
import type { Sex } from '../data/inhabitants.ts';
import type { SpriteProto } from '../data/sprites.ts';
import { foot, humanBody, scaledAround, womanParts, type Facing } from './people.ts';

const W = 32;
const H = 32;
/** Sol dans le cadre : l'ancre (0.5, 0.875). */
const GROUND = 28;

/** Le corps d'adulte a ses pieds en (16, 38.4) ; on le réduit et on le pose en (16, 28). */
function body(facing: Facing, sex: Sex): string {
  return svg(
    W,
    H,
    `<g transform="translate(0 ${GROUND - 38.4})">` +
      scaledAround(16, 38.4, 0.68, humanBody(facing, { pack: false, scarf: true, cap: true, ponytail: sex === 'female' })) +
      '</g>',
  );
}

function bodies(sex: Sex): Record<Facing, string> {
  return { down: body('down', sex), up: body('up', sex), side: body('side', sex) };
}

export const KID = {
  width: W,
  height: H,
  anchorX: 0.5,
  anchorY: 0.875,
  parts: {
    ...bodies('male'),
    ...womanParts(bodies('female')),
    foot: svg(W, H, foot(GROUND, 'ink', 0.7)),
  },
} satisfies SpriteProto;
