/**
 * La caravane de troc — contenu pur : quand elle passe, ce qu'elle échange.
 *
 * Un événement de jour. À partir du jour `firstDay`, un jour sur deux,
 * `arriveAfter` ticks après l'aube, un survivant tire sa charrette jusqu'au
 * bord de la clairière, à `distance` tuiles de la mairie. Il y reste `stay`
 * ticks, puis repart par où il est venu.
 *
 * Au contact, la fenêtre Troc propose trois échanges, chacun une seule fois :
 * - **surplus → manque** : ce dont la ville a le plus (au moins
 *   `SURPLUS_TRADE.min`) contre ce dont elle a le moins, parmi
 *   `SURPLUS_TRADE.goods`, au taux `rate` pour 1 ;
 * - **butin** : un objet qu'on ne récolte nulle part contre une matière
 *   ouvrée (`LOOT_TRADES`) ;
 * - **offre rare** (`RARE_OFFERS`), plafonnée sur la partie.
 *
 * Les tirages viennent de la seed et du numéro du jour (`sim/caravan.ts`).
 * Durées en ticks (20 par seconde), distances en tuiles, vitesses en tuiles
 * par seconde.
 */

import type { ItemId } from './items.ts';

export const CARAVAN = {
  /** Premier jour où elle passe. */
  firstDay: 4,
  /** Puis tous les `everyDays` jours. */
  everyDays: 2,
  /** Elle part `arriveAfter` ticks après le lever du jour. */
  arriveAfter: 20 * 30,
  /** Garée, elle reste `stay` ticks. */
  stay: 20 * 90,
  /** Distance de la mairie (centre) à la charrette garée. */
  distance: 8,
  /** Elle surgit `approach` tuiles plus loin, hors de la vue d'Adam, et y retourne. */
  approach: 10,
  /** Vitesse de la charrette. */
  speed: 2.5,
  /** Distance, en pixels monde, sous laquelle Adam est au contact de la charrette. */
  reach: 40,
} as const;

/** L'échange surplus → manque. */
export const SURPLUS_TRADE = {
  /**
   * Les matières comparées, de la plus rare à la plus commune : à égalité,
   * la première l'emporte — une ville sans charbon ni bois reçoit du charbon.
   */
  goods: ['coal', 'ironOre', 'stone', 'wood'],
  /** La ville doit en avoir au moins autant pour parler de surplus. */
  min: 60,
  /** Ce que la ville cède du surplus… */
  give: 20,
  /** … contre `give / rate` du manque. */
  rate: 5,
} as const satisfies { goods: readonly ItemId[]; min: number; give: number; rate: number };

/** Un échange : ce qu'on donne, ce qu'on reçoit — des objets, ou des places de sac. */
export interface TradeProto {
  cost: Partial<Record<ItemId, number>>;
  items?: Partial<Record<ItemId, number>>;
  bag?: number;
}

/** Les échanges contre du butin : une seule entrée tirée par caravane. */
export const LOOT_TRADES = [
  { cost: { mutantGoo: 3 }, items: { ironPlate: 1 } },
] as const satisfies readonly TradeProto[];

/** Les offres rares : une par caravane, chacune au plus `limit` fois sur la partie. */
export const RARE_OFFERS = {
  /** Un sac rapiécé : dix places de plus. */
  bigBag: { label: 'Sac rapiécé', cost: { wood: 30, stone: 10 }, bag: 10, limit: 3 },
} as const satisfies Record<string, TradeProto & { label: string; limit: number }>;

export type RareOfferId = keyof typeof RARE_OFFERS;

export const RARE_OFFER_IDS = Object.keys(RARE_OFFERS) as RareOfferId[];
