/**
 * Store : stock à double comptabilité.
 *
 * C'est la brique qui rendra les réservations de porteurs correctes par
 * construction. Elle est posée maintenant, avant qu'il y ait des porteurs,
 * parce que la rattraper plus tard veut dire réécrire tous les appelants.
 *
 * Trois compteurs par objet :
 * - `stock`    ce qui est physiquement là ;
 * - `outgoing` ce qui est déjà promis à un job et ne doit plus être vu par un
 *              second job ;
 * - `incoming` la place déjà réservée par un job de livraison.
 *
 * Toute décision se prend sur `available()` et `freeSpace()`, jamais sur le
 * stock brut. La réservation se fait à la création du job, pas à sa prise en
 * charge : un job est une promesse déjà couverte des deux côtés.
 *
 * `capacity` est un plafond sur le **nombre total d'objets**, pas sur des
 * piles — plus lisible sur un écran de téléphone. Un entrepôt se construit
 * avec `new Store(Infinity)` : il participe alors aux réservations comme
 * n'importe quel coffre, au lieu d'avoir sa propre Map en marge du système.
 */

import type { ItemId } from '../data/items.ts';

export type StoreSnapshot = Partial<Record<ItemId, number>>;

export class Store {
  public readonly capacity: number;

  private readonly stock = new Map<ItemId, number>();
  private readonly outgoing = new Map<ItemId, number>();
  private readonly incoming = new Map<ItemId, number>();
  private stockTotal = 0;
  private incomingTotal = 0;

  public constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** Ce qui est physiquement là, réservations comprises. */
  public count(item: ItemId): number {
    return this.stock.get(item) ?? 0;
  }

  public total(): number {
    return this.stockTotal;
  }

  /** Ce qu'un nouveau job peut encore prendre. */
  public available(item: ItemId): number {
    return this.count(item) - (this.outgoing.get(item) ?? 0);
  }

  /** La place qu'un nouveau job peut encore promettre. */
  public freeSpace(): number {
    return this.capacity - this.stockTotal - this.incomingTotal;
  }

  public isEmpty(): boolean {
    return this.stockTotal === 0;
  }

  /**
   * Dépose jusqu'à `amount` objets et renvoie la quantité réellement acceptée.
   * Rien n'est jeté silencieusement : l'appelant doit regarder le retour.
   */
  public add(item: ItemId, amount: number): number {
    if (amount <= 0) return 0;

    const accepted = Math.min(amount, this.capacity - this.stockTotal);

    if (accepted <= 0) return 0;

    this.stock.set(item, this.count(item) + accepted);
    this.stockTotal += accepted;
    return accepted;
  }

  /** Retire jusqu'à `amount` objets et renvoie la quantité réellement retirée. */
  public remove(item: ItemId, amount: number): number {
    if (amount <= 0) return 0;

    const removed = Math.min(amount, this.count(item));

    if (removed <= 0) return 0;

    const left = this.count(item) - removed;

    if (left === 0) this.stock.delete(item);
    else this.stock.set(item, left);

    this.stockTotal -= removed;
    return removed;
  }

  /** Marque `amount` objets comme sortants. Échoue sans rien changer si le disponible ne suffit pas. */
  public reserveOut(item: ItemId, amount: number): boolean {
    if (amount <= 0 || this.available(item) < amount) return false;

    this.outgoing.set(item, (this.outgoing.get(item) ?? 0) + amount);
    return true;
  }

  /** Réserve `amount` places pour une livraison à venir. */
  public reserveIn(item: ItemId, amount: number): boolean {
    if (amount <= 0 || this.freeSpace() < amount) return false;

    this.incoming.set(item, (this.incoming.get(item) ?? 0) + amount);
    this.incomingTotal += amount;
    return true;
  }

  /** Annule une réservation sortante — rollback quand la seconde réservation d'un job échoue. */
  public releaseOut(item: ItemId, amount: number): void {
    const left = (this.outgoing.get(item) ?? 0) - amount;

    if (left <= 0) this.outgoing.delete(item);
    else this.outgoing.set(item, left);
  }

  /** Annule une réservation entrante. */
  public releaseIn(item: ItemId, amount: number): void {
    const current = this.incoming.get(item) ?? 0;
    const released = Math.min(current, amount);
    const left = current - released;

    if (left <= 0) this.incoming.delete(item);
    else this.incoming.set(item, left);

    this.incomingTotal -= released;
  }

  /** Le porteur est arrivé : la promesse sortante devient un retrait réel. */
  public commitOut(item: ItemId, amount: number): number {
    this.releaseOut(item, amount);
    return this.remove(item, amount);
  }

  /** Le porteur est arrivé : la place réservée devient un dépôt réel. */
  public commitIn(item: ItemId, amount: number): number {
    this.releaseIn(item, amount);
    return this.add(item, amount);
  }

  public entries(): [ItemId, number][] {
    return [...this.stock.entries()];
  }

  /** Sérialisation pour la sauvegarde : seul le stock réel est persisté. */
  public toJSON(): StoreSnapshot {
    return Object.fromEntries(this.stock);
  }

  public static fromJSON(capacity: number, snapshot: StoreSnapshot): Store {
    const store = new Store(capacity);

    for (const [item, amount] of Object.entries(snapshot) as [ItemId, number][]) {
      store.add(item, amount);
    }
    return store;
  }
}
