/**
 * Commandes.
 *
 * L'UI ne modifie jamais l'état. Elle pousse une commande, que le tick
 * consomme. Trois bénéfices, tous acquis dès maintenant :
 * - une partie = une seed + une liste de commandes horodatées (rejouabilité) ;
 * - l'undo devient trivial ;
 * - le canal vers un Web Worker est déjà défini, il ne restera qu'à le brancher.
 */

import type { BuildingId } from '../data/buildings.ts';

export type Command =
  /** Axe analogique du joystick, dans [-1, 1]. Remplace la valeur précédente. */
  | { type: 'setMoveAxis'; x: number; y: number }
  /** Confirmation de construction, après l'aperçu fantôme. */
  | { type: 'placeBuilding'; building: BuildingId; tx: number; ty: number };

/** Motif de refus d'un placement — remonté à l'UI par un événement. */
export type PlacementRejection = 'occupied' | 'terrain' | 'outOfReach';

export interface CommandLogEntry {
  tick: number;
  command: Command;
}
