/**
 * Échanges sac ⇄ coffre.
 *
 * La fenêtre d'un bâtiment qui a un coffre (la mairie, une foreuse, une
 * ferme, une forge…) montre deux bandes, le coffre et le sac : un tap fait
 * passer un objet de l'autre côté, par 1, par 10 ou en entier. Ce module
 * dit combien passe, sans rien déplacer : la fenêtre grise sur ses
 * réponses, la commande `transferItems` déplace sur les mêmes.
 *
 * Chaque coffre a ses règles (`TransferRules`) : ce qu'on peut en prendre —
 * jamais ce que des porteurs ou des bâtisseurs ont déjà réservé pour un
 * chantier, jamais les entrées d'une forge — et ce qu'il accepte : la
 * mairie tout, une forge ses entrées, une foreuse rien. Le sac, lui, ne
 * reçoit que ce qui y rentre.
 */

import type { ItemId } from '../data/items.ts';
import type { Store } from './store.ts';

/** Prendre : du coffre au sac. Déposer : du sac au coffre. */
export type TransferDirection = 'take' | 'deposit';

/** Le sélecteur de quantité : un, dix, ou tout ce qui peut passer. */
export type TransferQuantity = 1 | 10 | 'all';

export const TRANSFER_QUANTITIES: readonly TransferQuantity[] = [1, 10, 'all'];

/** Les règles d'un coffre, vues du sac. */
export interface TransferRules {
  /** Ce qu'Adam peut prendre de cet objet : la part libre, sans ce qui est réservé ni ce qui doit rester. */
  takeable(item: ItemId): number;
  /** Ce que le coffre accepte encore de cet objet — zéro : refusé, grisé côté dépôt. */
  accepts(item: ItemId): number;
}

/** Une puce du coffre : ce qu'il contient, ce qui en est réservé, ce qu'un tap ferait passer au sac. */
export interface ChestLine {
  item: ItemId;
  count: number;
  /** Promis à un job (un chantier, une forge) : affiché, jamais pris. */
  reserved: number;
  /** Ce qu'un tap prendrait avec la quantité choisie ; zéro : grisé. */
  movable: number;
}

/** Une puce du sac : ce qu'Adam porte, ce qu'un tap déposerait. */
export interface BagLine {
  item: ItemId;
  count: number;
  /** Ce qu'un tap déposerait avec la quantité choisie ; zéro : grisé (refusé, ou coffre plein). */
  movable: number;
}

/** Ce que montrent les deux bandes. */
export interface TransferView {
  chest: ChestLine[];
  bag: BagLine[];
  /** Ce que « Tout prendre » et « Tout déposer » feraient passer. */
  takeAll: number;
  depositAll: number;
}

/** Combien d'unités passent d'un côté à l'autre, d'un tap : la quantité voulue, bornée par les règles et la place. */
export function transferAmount(
  direction: TransferDirection,
  item: ItemId,
  quantity: TransferQuantity,
  rules: TransferRules,
  bag: Store,
): number {
  const wanted = quantity === 'all' ? Infinity : quantity;
  const amount =
    direction === 'take'
      ? Math.min(wanted, rules.takeable(item), bag.freeSpace())
      : Math.min(wanted, bag.available(item), rules.accepts(item));

  return Math.max(0, amount);
}

/**
 * Ce que « Tout prendre » ou « Tout déposer » ferait passer, objet par objet,
 * dans l'ordre du coffre ou du sac : la place prise par le premier n'est plus
 * là pour le suivant. Une prise partielle s'arrête quand le sac est plein.
 */
export function transferAllPlan(direction: TransferDirection, chest: Store, rules: TransferRules, bag: Store): [ItemId, number][] {
  const plan: [ItemId, number][] = [];

  if (direction === 'take') {
    let room = bag.freeSpace();

    for (const [item] of chest.entries()) {
      const amount = Math.min(rules.takeable(item), room);

      if (amount <= 0) continue;
      plan.push([item, amount]);
      room -= amount;
    }
    return plan;
  }

  for (const [item] of bag.entries()) {
    const amount = transferAmount('deposit', item, 'all', rules, bag);

    if (amount > 0) plan.push([item, amount]);
  }
  return plan;
}

/** Les deux bandes, pour la quantité choisie. */
export function transferView(chest: Store, rules: TransferRules, bag: Store, quantity: TransferQuantity): TransferView {
  const total = (plan: [ItemId, number][]): number => plan.reduce((sum, [, amount]) => sum + amount, 0);

  return {
    chest: chest.entries().map(([item, count]) => ({
      item,
      count,
      reserved: count - chest.available(item),
      movable: transferAmount('take', item, quantity, rules, bag),
    })),
    bag: bag.entries().map(([item, count]) => ({
      item,
      count,
      movable: transferAmount('deposit', item, quantity, rules, bag),
    })),
    takeAll: total(transferAllPlan('take', chest, rules, bag)),
    depositAll: total(transferAllPlan('deposit', chest, rules, bag)),
  };
}
