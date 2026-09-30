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
import type { ItemId } from '../data/items.ts';
import type { PerkId } from '../data/perks.ts';
import type { ResearchId } from '../data/research.ts';
import type { EntityId } from './types.ts';

export type Command =
  /** Axe analogique du joystick, dans [-1, 1]. Remplace la valeur précédente. */
  | { type: 'setMoveAxis'; x: number; y: number }
  /** Confirmation de construction, après l'aperçu fantôme. Ouvre un chantier. */
  | { type: 'placeBuilding'; building: BuildingId; tx: number; ty: number }
  /**
   * Livre un chantier d'un coup : tout ce qu'il attend et qu'Adam porte,
   * puis, s'il manque encore quelque chose, ce que le stock de la ville a de
   * disponible. Le bouton « Transférer » de la fenêtre du bâtiment. Si
   * c'était tout ce qui manquait, le chantier s'achève.
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
  | { type: 'supplyBuilding'; id: EntityId }
  /**
   * Vide le sac dans le stock de la ville — le coffre de la mairie. Adam doit
   * être à portée de la mairie. Sans `item`, tout le sac ; avec, cet objet seulement.
   */
  | { type: 'depositToTown'; item?: ItemId }
  /**
   * Jette à ses pieds, en tas ramassable, ce qu'Adam porte. Sans `item`, tout
   * le sac ; avec, cet objet seulement.
   */
  | { type: 'dropItem'; item?: ItemId }
  /**
   * Choisit la recherche que mène le labo. Ses prérequis doivent être finis,
   * et aucune recherche ne doit déjà tourner ; une recherche qui attendait
   * encore son coût est remplacée — ce qui était déposé reste au coffre.
   * Le bouton « Lancer » du panneau Recherche, qu'on soit loin ou non.
   */
  | { type: 'startResearch'; lab: EntityId; research: ResearchId }
  /**
   * Abandonne la recherche choisie tant que son coût n'est pas réuni. Ce qui
   * était déposé reste au coffre : les porteurs le rapportent à la mairie,
   * « Prendre » le remet dans le sac.
   */
  | { type: 'cancelResearch'; lab: EntityId }
  /**
   * Dépose au labo ce que sa recherche attend : le sac d'abord, puis le
   * stock de la ville si le labo est dans le rayon de la mairie. Le bouton
   * « Transférer » du panneau. Le dernier objet déposé lance le compte à rebours.
   */
  | { type: 'transferToLab'; id: EntityId }
  /**
   * Passe un bâtiment fini au niveau suivant (`BUILDINGS[proto].upgrades`),
   * tout de suite : le coût est payé comme un « Transférer », le sac d'abord,
   * puis la ville si le bâtiment est dans son rayon. Tout ou rien — il faut
   * le coût entier. Le bouton « Renforcer » de la fenêtre d'une tour.
   */
  | { type: 'upgradeBuilding'; id: EntityId }
  /**
   * Met en pause un bâtiment producteur (`paused: true`), ou le relance. En
   * pause, il ne produit ni ne consomme ; ses ouvriers finissent leur geste
   * puis flânent, et les porteurs vident toujours son coffre. Le bouton
   * « Pause » / « Reprendre » de sa fenêtre.
   */
  | { type: 'pauseBuilding'; id: EntityId; paused: boolean }
  /**
   * L'effectif voulu d'un bâtiment qui emploie, ramené entre son minimum et
   * son maximum. Les postes se prennent dans la population libre de la
   * ville ; un ouvrier retiré finit son geste puis redevient libre. Le
   * sélecteur − / + de sa fenêtre.
   */
  | { type: 'setWorkers'; id: EntityId; count: number }
  /**
   * Les bonus plantés au jardin des souvenirs, au départ d'une nouvelle
   * colonie. Poussée avant le premier tick ; ignorée ensuite.
   */
  | { type: 'applyPerks'; perks: readonly PerkId[] };

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

/** Motif de refus d'une commande sur le labo de recherche. */
export type ResearchRejection =
  /** Le labo n'existe plus, ou n'est pas encore bâti. */
  | 'missing'
  /** Une recherche tourne déjà : une seule à la fois. */
  | 'busy'
  /** Il manque un prérequis, ou la recherche est déjà finie. */
  | 'locked'
  /** Pas de recherche en attente de son coût : rien à abandonner ni à livrer. */
  | 'idle'
  /** Adam est trop loin du labo pour y déposer. */
  | 'outOfReach'
  /** Ni le sac ni la ville à portée n'ont ce que la recherche attend. */
  | 'nothingToGive';

/** Motif de refus d'un « Déposer en ville ». */
export type DepositRejection =
  /** La mairie n'est pas encore bâtie, ou elle est tombée : pas de ville où déposer. */
  | 'noTown'
  /** Adam est trop loin de la mairie. */
  | 'outOfReach'
  /** Rien à déposer : le sac est vide, ou ne contient pas cet objet. */
  | 'empty';

/** Motif de refus d'une amélioration. */
export type UpgradeRejection =
  /** Le bâtiment n'existe plus, ou n'est encore qu'un chantier. */
  | 'missing'
  /** Adam est trop loin de l'emprise. */
  | 'outOfReach'
  /** Le bâtiment est déjà à son niveau maximal. */
  | 'maxLevel'
  /** Ni le sac, ni la ville à portée n'ont tout le coût. */
  | 'missingItems';

/** Motif de refus d'un placement — remonté à l'UI par un événement. */
export type PlacementRejection =
  | 'occupied'
  | 'terrain'
  | 'outOfReach'
  /** Un arbre ou un rocher encombre l'emprise : il faut le récolter d'abord. */
  | 'resource'
  /** Le joueur est dans l'emprise : un bâtiment est solide, il y resterait coincé. */
  | 'onPlayer'
  /** Une foreuse sans filon sous son emprise ne produirait jamais rien. */
  | 'noOre'
  /**
   * Pas encore débloqué : il faut d'abord le plan, qu'Ève donne en récompense
   * d'une quête, ou voir tomber d'autres nuits (`unlockNight`).
   */
  | 'locked'
  /** Un seul par colonie, et il y en a déjà un — chantier compris. */
  | 'unique';

export interface CommandLogEntry {
  tick: number;
  command: Command;
}
