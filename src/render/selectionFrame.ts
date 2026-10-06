/**
 * Ce que le cadre de sélection entoure, frame par frame : l'emprise d'un
 * bâtiment, ou la silhouette d'une créature — habitant ou ennemi — dont la
 * fenêtre est ouverte. Pur, sans Pixi : `selectionLayer.ts` le dessine.
 *
 * Un bâtiment rasé, une créature morte, partie ou rentrée chez elle : plus
 * rien à entourer, le cadre s'efface plutôt que de rester orphelin.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { ENEMIES } from '../data/enemies.ts';
import { SPRITES } from '../data/sprites.ts';
import type { World } from '../sim/world.ts';
import type { Selection } from '../ui/creatureView.ts';
import { puppetOf } from './puppetOf.ts';

/** Le rectangle à entourer, en pixels monde, et sa place dans le tri en profondeur. */
export interface SelectionFrame {
  /** Ce qui est sélectionné : une autre cible, un autre rebond. */
  target: string;
  /** Centre du rectangle. */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * `null` : au sol, sous tout le reste — le tracé à la craie d'un bâtiment.
   * Sinon, le `zIndex` du cadre parmi ce qui est trié en profondeur : juste
   * sous la créature, devant ce qui est derrière elle.
   */
  depth: number | null;
}

/** Un cadre de créature passe juste sous son pantin (`zIndex` y + 6, `mobileLayer.ts`). */
const CREATURE_DEPTH = 5;

/** Le cadre de `selected` à l'interpolation `alpha`, ou `null` s'il n'y a rien à entourer. */
export function selectionFrame(world: World, selected: Selection | null, alpha: number): SelectionFrame | null {
  if (selected === null) return null;

  if (selected.kind === 'building') {
    const entity = world.entities.get(selected.id);

    if (!entity) return null;
    return {
      target: `building:${entity.id}`,
      x: (entity.tx + entity.width / 2) * TILE_SIZE,
      y: (entity.ty + entity.height / 2) * TILE_SIZE,
      width: entity.width * TILE_SIZE,
      height: entity.height * TILE_SIZE,
      depth: null,
    };
  }

  const mobile = world.mobiles.get(selected.id);

  if (!mobile) return null;

  switch (mobile.kind) {
    case 'worker':
    case 'lumberjack':
    case 'forester':
    case 'farmer':
      // Rentré chez lui, on ne le voit plus : le cadre non plus.
      if (mobile.inside) return null;
      break;
    case 'mutant':
      // Encore dans sa flaque : invisible.
      if (mobile.emerge > 0) return null;
      break;
    case 'kid':
    case 'beast':
      break;
    default:
      return null;
  }

  const { width, height, anchorX, anchorY } = SPRITES[puppetOf(mobile).id];
  const scale = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].scale : 1;
  // La position interpolée, celle du pantin : le cadre le suit sans retard.
  const x = mobile.prevX + (mobile.x - mobile.prevX) * alpha;
  const y = mobile.prevY + (mobile.y - mobile.prevY) * alpha;

  return {
    target: `creature:${mobile.id}`,
    x: x + (0.5 - anchorX) * width * scale,
    y: y + (0.5 - anchorY) * height * scale,
    width: width * scale,
    height: height * scale,
    depth: y + CREATURE_DEPTH,
  };
}
