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
import type { EntityId } from './types.ts';

export type Command =
  /** Axe analogique du joystick, dans [-1, 1]. Remplace la valeur précédente. */
  | { type: 'setMoveAxis'; x: number; y: number }
  /** Confirmation de construction, après l'aperçu fantôme. Ouvre un chantier. */
  | { type: 'placeBuilding'; building: BuildingId; tx: number; ty: number }
  /**
   * Vide le sac dans un chantier : tout ce qu'il attend et qu'Adam possède
   * y passe d'un coup. Le bouton « Transférer » de la fenêtre du bâtiment.
   */
  | { type: 'transferToSite'; id: EntityId }
  /**
   * Achève un chantier entièrement livré. Un chantier ne se termine jamais
   * seul : le joueur voit l'emprise, décide, et appuie sur « Construire ».
   */
  | { type: 'buildSite'; id: EntityId };

/** Motif de refus d'une commande sur un chantier — remonté à l'UI par un événement. */
export type SiteRejection =
  /** Le chantier n'existe plus, ou n'est plus un chantier. */
  | 'missing'
  /** Adam est trop loin de l'emprise. */
  | 'outOfReach'
  /** Il manque encore des ressources : on ne construit pas un mur à moitié livré. */
  | 'incomplete'
  /** Adam n'a rien dans le sac que le chantier attende. */
  | 'nothingToGive';

/** Motif de refus d'un placement — remonté à l'UI par un événement. */
export type PlacementRejection =
  | 'occupied'
  | 'terrain'
  | 'outOfReach'
  /** Un arbre ou un rocher encombre l'emprise : il faut le récolter d'abord. */
  | 'resource'
  /** Le joueur est dans l'emprise : un bâtiment est solide, il y resterait coincé. */
  | 'onPlayer';

export interface CommandLogEntry {
  tick: number;
  command: Command;
}
