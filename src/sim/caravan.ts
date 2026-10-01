/**
 * La caravane de troc dans la simulation : son calendrier, ses tirages, sa route.
 *
 * Tout ici est pur. `World` décide quand elle part (`isCaravanDay`), lui
 * passe le stock de la ville pour tirer ses offres (`drawOffers`) et la fait
 * rouler (`rideTo`) ; il garde la caravane dans ses mobiles, offres
 * comprises, et ce que les offres rares ont déjà donné sur la partie.
 *
 * Les tirages ne touchent pas au PRNG du monde : ils viennent d'un PRNG
 * semé par la seed et le numéro du jour. Même seed, même jour, même ville :
 * mêmes offres, et même bord de clairière.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { hash3, mulberry32, type Rng } from '../core/rng.ts';
import { CARAVAN, LOOT_TRADES, RARE_OFFERS, RARE_OFFER_IDS, SURPLUS_TRADE, type RareOfferId } from '../data/caravan.ts';
import type { ItemId } from '../data/items.ts';
import { facingOf } from './motion.ts';
import type { Caravan, MobileId, TradeOffer } from './types.ts';

/** Sel du PRNG de la caravane : ses tirages ne croisent ceux d'aucun autre système. */
const CARAVAN_SALT = 0xca7a;

/** La caravane passe-t-elle ce jour-là ? À partir de `firstDay`, un jour sur `everyDays`. */
export function isCaravanDay(day: number): boolean {
  return day >= CARAVAN.firstDay && (day - CARAVAN.firstDay) % CARAVAN.everyDays === 0;
}

/** Le PRNG d'un passage : la seed et le jour, rien d'autre. */
export function caravanRng(seed: number, day: number): Rng {
  return mulberry32(hash3(seed, day, CARAVAN_SALT));
}

/**
 * L'échange surplus → manque : ce dont la ville a le plus, s'il y en a au
 * moins `SURPLUS_TRADE.min`, contre ce dont elle a le moins, au taux
 * `rate` pour 1. À égalité, le premier de `SURPLUS_TRADE.goods`. `null` si
 * la ville n'a pas de surplus.
 */
export function surplusOffer(stock: (item: ItemId) => number): TradeOffer | null {
  const goods: readonly ItemId[] = SURPLUS_TRADE.goods;
  let most: ItemId | null = null;
  let least: ItemId | null = null;

  for (const item of goods) {
    if (stock(item) >= SURPLUS_TRADE.min && (most === null || stock(item) > stock(most))) most = item;
  }
  if (most === null) return null;

  for (const item of goods) {
    if (item !== most && (least === null || stock(item) < stock(least))) least = item;
  }
  if (least === null) return null;

  return offer('surplus', { [most]: SURPLUS_TRADE.give }, { [least]: SURPLUS_TRADE.give / SURPLUS_TRADE.rate }, 0, null);
}

/**
 * Les trois échanges d'un passage, dans l'ordre de la fenêtre : surplus →
 * manque (si la ville a un surplus), butin, offre rare (si l'une n'a pas
 * atteint son plafond sur la partie). `rareTaken` : combien de fois chaque
 * offre rare a déjà été prise.
 */
export function drawOffers(
  seed: number,
  day: number,
  stock: (item: ItemId) => number,
  rareTaken: Partial<Record<RareOfferId, number>>,
): TradeOffer[] {
  const rng = caravanRng(seed, day);
  const offers: TradeOffer[] = [];
  const surplus = surplusOffer(stock);

  if (surplus) offers.push(surplus);

  const loot = pick(rng, LOOT_TRADES);

  offers.push(offer('loot', loot.cost, loot.items, 0, null));

  const rares = RARE_OFFER_IDS.filter((id) => (rareTaken[id] ?? 0) < RARE_OFFERS[id].limit);

  if (rares.length > 0) {
    const id = pick(rng, rares);
    const rare: { cost: Partial<Record<ItemId, number>>; items?: Partial<Record<ItemId, number>>; bag?: number } = RARE_OFFERS[id];

    offers.push(offer('rare', rare.cost, rare.items ?? {}, rare.bag ?? 0, id));
  }
  return offers;
}

/**
 * Le bord de clairière où se garer, et le point d'où arriver : sur un cap
 * tiré du passage, à `CARAVAN.distance` tuiles de `center`. `isBlocked`
 * écarte l'eau, le bâti et les rochers ; après huit essais, on prend le
 * dernier cap, quitte à se garer sous un arbre.
 */
export function caravanRoute(
  seed: number,
  day: number,
  center: { x: number; y: number },
  isBlocked: (tx: number, ty: number) => boolean,
): { parkX: number; parkY: number; fromX: number; fromY: number } {
  const rng = caravanRng(seed ^ 0x5eed, day);
  let heading = 0;
  let tx = 0;
  let ty = 0;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    heading = rng() * Math.PI * 2;
    tx = Math.floor((center.x + Math.cos(heading) * CARAVAN.distance * TILE_SIZE) / TILE_SIZE);
    ty = Math.floor((center.y + Math.sin(heading) * CARAVAN.distance * TILE_SIZE) / TILE_SIZE);
    if (!isBlocked(tx, ty)) break;
  }

  // Au centre de la tuile : la charrette s'y pose d'aplomb.
  const parkX = (tx + 0.5) * TILE_SIZE;
  const parkY = (ty + 0.5) * TILE_SIZE;
  const far = (CARAVAN.distance + CARAVAN.approach) * TILE_SIZE;

  return { parkX, parkY, fromX: center.x + Math.cos(heading) * far, fromY: center.y + Math.sin(heading) * far };
}

/** La caravane au départ de sa route, offres tirées. */
export function createCaravan(
  id: MobileId,
  day: number,
  route: { parkX: number; parkY: number; fromX: number; fromY: number },
  offers: TradeOffer[],
): Caravan {
  return {
    kind: 'caravan',
    id,
    x: route.fromX,
    y: route.fromY,
    prevX: route.fromX,
    prevY: route.fromY,
    facing: facingOf(route.parkX - route.fromX, route.parkY - route.fromY),
    moving: true,
    state: 'arriving',
    day,
    ...route,
    leaveTick: 0,
    offers,
    met: false,
  };
}

/** Un tick de charrette en ligne droite vers (x, y) — elle passe sur tout, comme le vélo d'Ève. `true` à l'arrivée. */
export function rideTo(caravan: Caravan, x: number, y: number, stepSeconds: number): boolean {
  const speed = CARAVAN.speed * TILE_SIZE * stepSeconds;
  const dx = x - caravan.x;
  const dy = y - caravan.y;
  const distance = Math.hypot(dx, dy);

  caravan.prevX = caravan.x;
  caravan.prevY = caravan.y;

  if (distance <= speed) {
    caravan.x = x;
    caravan.y = y;
    caravan.moving = false;
    return true;
  }

  caravan.x += (dx / distance) * speed;
  caravan.y += (dy / distance) * speed;
  caravan.moving = true;
  caravan.facing = facingOf(dx, dy);
  return false;
}

/** Ce qu'un échange coûte, objet par objet. */
export function tradeCost(trade: TradeOffer): [ItemId, number][] {
  return Object.entries(trade.cost) as [ItemId, number][];
}

/** Ce qu'un échange rapporte en objets, objet par objet. */
export function tradeItems(trade: TradeOffer): [ItemId, number][] {
  return Object.entries(trade.items) as [ItemId, number][];
}

function offer(
  kind: TradeOffer['kind'],
  cost: Partial<Record<ItemId, number>>,
  items: Partial<Record<ItemId, number>>,
  bag: number,
  rare: RareOfferId | null,
): TradeOffer {
  return { kind, cost: { ...cost }, items: { ...items }, bag, rare, done: false };
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

/** Les places de sac que les offres rares ont déjà données sur la partie. */
export function caravanBagBonus(rareTaken: Partial<Record<RareOfferId, number>>): number {
  return RARE_OFFER_IDS.reduce((total, id) => {
    const rare: { bag?: number } = RARE_OFFERS[id];

    return total + (rareTaken[id] ?? 0) * (rare.bag ?? 0);
  }, 0);
}
