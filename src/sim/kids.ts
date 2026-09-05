/**
 * Les enfants de la colonie.
 *
 * Ils ne produisent rien et ne se battent pas : ils sont la preuve visible
 * que la nurserie fonctionne, et que la colonie vit. Un enfant flâne au
 * hasard autour de sa nurserie, s'arrête, repart, et revient s'il s'éloigne
 * trop. Il respecte les obstacles — il ne traverse ni un arbre ni un mur.
 */

import { TILE_SIZE } from '../core/grid.ts';
import type { Rng } from '../core/rng.ts';
import { facingOf, moveBox, type SolidTest } from './motion.ts';
import type { Kid } from './types.ts';

/** Vitesse d'un enfant, en tuiles par seconde. */
const KID_SPEED_TILES = 1.6;

/** Rayon de flânerie autour de la nurserie, en tuiles. */
const KID_RANGE_TILES = 4;

const KID_BOX = { halfW: 6, halfH: 5 };

export function stepKid(kid: Kid, home: { x: number; y: number }, isSolid: SolidTest, rng: Rng, stepSeconds: number): void {
  if (kid.wanderTicks <= 0) {
    if (rng() < 0.4) {
      kid.dirX = 0;
      kid.dirY = 0;
    } else {
      const angle = rng() * Math.PI * 2;

      kid.dirX = Math.cos(angle);
      kid.dirY = Math.sin(angle);
    }
    kid.wanderTicks = 20 + Math.floor(rng() * 50);
  }
  kid.wanderTicks -= 1;

  // Trop loin de la maison : on y retourne, quelle que soit l'idée du moment.
  const dx = home.x - kid.x;
  const dy = home.y - kid.y;
  const distance = Math.hypot(dx, dy);

  if (distance > KID_RANGE_TILES * TILE_SIZE) {
    kid.dirX = dx / distance;
    kid.dirY = dy / distance;
  }

  const speed = KID_SPEED_TILES * TILE_SIZE * stepSeconds;
  const contact = moveBox(kid, KID_BOX, kid.dirX * speed, kid.dirY * speed, isSolid);

  kid.moving = kid.x !== kid.prevX || kid.y !== kid.prevY;

  if (kid.dirX !== 0 || kid.dirY !== 0) kid.facing = facingOf(kid.dirX, kid.dirY);

  // Bloqué : on change d'idée au tick suivant plutôt que de pousser un mur.
  if (contact) kid.wanderTicks = 0;
}
