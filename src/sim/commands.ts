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
   * Si c'était tout ce qui manquait, le chantier s'achève.
   */
  | { type: 'transferToSite'; id: EntityId }
  /**
   * Vide le coffre d'une foreuse ou d'une ferme dans le sac, dans la limite
   * de la place. Le bouton « Prendre » de la fenêtre du bâtiment.
   */
  | { type: 'takeFromBuilding'; id: EntityId }
  /**
   * Vide dans le coffre d'une nurserie ou d'une forge ce que sa recette
   * consomme et qu'Adam porte, dans la limite de la place. Le bouton
   * « Transférer le sac » de sa fenêtre.
   */
  | { type: 'supplyBuilding'; id: EntityId };

/** Motif de refus d'une commande sur un chantier — remonté à l'UI par un événement. */
export type SiteRejection =
  /** Le chantier n'existe plus, ou n'est plus un chantier. */
  | 'missing'
  /** Adam est trop loin de l'emprise. */
  | 'outOfReach'
  /** Adam n'a rien dans le sac que le chantier attende. */
  | 'nothingToGive';

/** Motif de refus d'un « Prendre » — remonté à l'UI par un événement. */
export type TakeRejection =
  /** Le bâtiment n'existe plus, ou n'a pas de production à prendre. */
  | 'missing'
  /** Adam est trop loin de l'emprise. */
  | 'outOfReach'
  /** Le coffre est vide. */
  | 'empty'
  /** Le sac est plein : rien n'est pris, rien n'est jeté. */
  | 'bagFull';

/** Motif de refus d'un « Transférer le sac » vers une nurserie ou une forge. */
export type SupplyRejection =
  /** Le bâtiment n'existe plus, ou ne consomme rien. */
  | 'missing'
  /** Adam est trop loin de l'emprise. */
  | 'outOfReach'
  /** Adam n'a rien dans le sac que le bâtiment attende, ou son coffre est plein. */
  | 'nothingToGive';

/** Motif de refus d'un placement — remonté à l'UI par un événement. */
export type PlacementRejection =
  | 'occupied'
  | 'terrain'
  | 'outOfReach'
  /** Un arbre ou un rocher encombre l'emprise : il faut le récolter d'abord. */
  | 'resource'
  /** Le joueur est dans l'emprise : un bâtiment est solide, il y resterait coincé. */
  | 'onPlayer'
  /**
   * Pas encore débloqué : il faut d'abord le plan, qu'Ève donne en récompense
   * d'une quête, ou passer d'autres vagues (`unlockWave`).
   */
  | 'locked';

export interface CommandLogEntry {
  tick: number;
  command: Command;
}
