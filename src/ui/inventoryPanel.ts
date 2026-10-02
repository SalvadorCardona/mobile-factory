/**
 * Le panneau du sac.
 *
 * Il s'ouvre au tap sur le sac du HUD, ou à la touche I sur PC, et montre le
 * détail que le HUD, compact, ne montre pas : chaque objet porté avec sa
 * quantité, la place qui reste, et le stock de la ville.
 *
 * La ville y est un petit tableau de bord (`sim/flows.ts`) : à côté de chaque
 * objet, son débit net sur les deux dernières minutes (« +28/min » en menthe,
 * « −4/min » en corail, rien s'il ne bouge pas), et au-dessus, au plus deux
 * alertes — ce qu'une recette attend et que la ville n'a pas, ce qui
 * s'empile sans que personne ne l'utilise. Taper une alerte ferme le
 * panneau et fait pointer un repère de bord vers le bâtiment en cause.
 *
 * Il sert à vider le sac. Près de la mairie, chaque ligne a « Déposer » et
 * le bas du panneau « Déposer en ville » : le sac passe dans le stock de la
 * ville. Ailleurs, « Jeter » et « Tout jeter » : ce qu'Adam porte tombe à
 * ses pieds, en tas qu'il reprend en repassant dessus — rien n'est détruit,
 * il n'y a donc rien à confirmer.
 *
 * Comme la fenêtre d'un bâtiment, il ne met pas le jeu en pause et ne
 * modifie rien lui-même : chaque bouton pousse une commande (`depositToTown`,
 * `dropItem`) que le tick consomme.
 */

import type { ItemId } from '../data/items.ts';
import { locale, onLocale, t } from '../i18n/locale.ts';
import { formatRate, type FlowAlert } from '../sim/flows.ts';
import type { World } from '../sim/world.ts';
import { itemAmount, itemIcon, uiIcon } from './icons.ts';

export class InventoryPanel {
  public readonly root: HTMLElement;

  private readonly capacity: HTMLElement;
  private readonly barFill: HTMLElement;
  private readonly where: HTMLElement;
  private readonly list: HTMLElement;
  private readonly town: HTMLElement;
  private readonly townItems: HTMLElement;
  private readonly townAlerts: HTMLElement;
  private readonly allButton: HTMLButtonElement;
  private last = '';
  private shown = false;

  private readonly world: World;
  private readonly onOpen: () => void;
  private readonly onAlert: (alert: FlowAlert) => void;

  public constructor(world: World, onOpen: () => void = () => {}, onAlert: (alert: FlowAlert) => void = () => {}) {
    this.world = world;
    this.onOpen = onOpen;
    this.onAlert = onAlert;

    this.root = element('section', 'panel building-panel inventory-panel');
    this.root.hidden = true;

    const header = element('header', '');
    const title = element('h2', '');
    const titleText = document.createTextNode('');

    title.append(uiIcon('bag', 28), titleText);

    const close = element('button', 'building-panel-close');

    close.type = 'button';
    close.append(uiIcon('close'));
    close.addEventListener('click', () => this.close());
    header.append(title, close);

    const bar = element('div', 'building-panel-bar');

    this.barFill = element('div', '');
    bar.append(this.barFill);

    this.capacity = element('p', 'inventory-capacity');
    this.where = element('p', 'building-panel-description');
    this.list = element('ul', 'inventory-list');

    this.town = element('div', 'inventory-town');

    const townTitle = element('div', 'inventory-town-title');

    const townText = document.createTextNode('');

    townTitle.append(uiIcon('town', 20), townText);
    this.townAlerts = element('ul', 'inventory-alerts');
    this.townItems = element('div', 'building-panel-items');
    this.town.append(townTitle, this.townAlerts, this.townItems);

    const actions = element('div', 'building-panel-actions');

    this.allButton = element('button', '');
    this.allButton.type = 'button';
    this.allButton.addEventListener('click', () => this.empty());
    actions.append(this.allButton);

    this.root.append(header, bar, this.capacity, this.where, this.list, actions, this.town);

    // Les libellés fixes suivent la langue ; le reste se réécrit au prochain `update()`, dont la clé porte la langue.
    onLocale(() => {
      const text = t();

      this.root.setAttribute('aria-label', text.inventory.title);
      titleText.data = text.inventory.title;
      close.setAttribute('aria-label', text.common.close);
      townText.data = text.inventory.town;
      this.update();
    });
  }

  public get open(): boolean {
    return this.shown;
  }

  public show(): void {
    this.shown = true;
    this.root.hidden = false;
    this.last = '';
    this.update();
    this.onOpen();
  }

  public close(): void {
    this.shown = false;
    this.root.hidden = true;
  }

  public toggle(): void {
    if (this.shown) this.close();
    else this.show();
  }

  /** À chaque frame tant qu'il est ouvert : le DOM n'est reconstruit que si ce qu'il montre change. */
  public update(): void {
    if (!this.shown) return;

    const { world } = this;
    const { inventory } = world.player;
    const entries = inventory.entries();
    const town = world.townStock();
    const near = world.nearTown();
    const rates = town ? town.entries().map(([item]) => Math.round(world.flows.netRate(item))) : [];
    const alerts = town ? world.flows.alerts(world) : [];
    const key = [
      locale(),
      near,
      inventory.capacity,
      entries.map(([item, amount]) => `${item}:${amount}`).join(','),
      town ? town.entries().map(([item, amount]) => `${item}:${amount}`).join(',') : 'none',
      rates.join(','),
      alerts.map((alert) => `${alertText(alert)}@${alert.target}`).join(','),
    ].join('|');

    if (key === this.last) return;
    this.last = key;

    const total = inventory.total();
    const free = inventory.freeSpace();
    const text = t().inventory;

    this.barFill.style.width = `${Math.round((total / inventory.capacity) * 100)}%`;
    this.capacity.textContent = text.capacity(total, inventory.capacity, free);
    this.capacity.dataset['full'] = String(free <= 0);
    this.where.textContent = near ? text.whereNear : town ? text.whereFar : text.whereNoTown;

    this.list.replaceChildren(
      ...(entries.length === 0 ? [element('li', 'inventory-empty', text.empty)] : entries.map(([item, amount]) => this.row(item, amount, near))),
    );

    this.allButton.textContent = near ? text.depositAll : text.dropAll;
    this.allButton.dataset['tone'] = near ? 'deposit' : 'drop';
    this.allButton.disabled = entries.length === 0;

    this.town.hidden = !town;
    if (town) {
      const stock = town.entries();

      this.townItems.replaceChildren(
        ...(stock.length === 0
          ? [element('span', 'inventory-empty', text.townEmpty)]
          : stock.map(([item, amount], index) => this.stockEntry(item, amount, rates[index]!))),
      );
      this.townItems.hidden = false;
      this.townAlerts.replaceChildren(...alerts.map((alert) => this.alertRow(alert)));
      this.townAlerts.hidden = alerts.length === 0;
    }
  }

  /** Une ligne : l'objet, sa quantité, et le bouton qui le vide. */
  private row(item: ItemId, amount: number, near: boolean): HTMLElement {
    const row = element('li', 'inventory-row');
    const text = t().inventory;
    const label = t().items[item];
    const name = element('span', 'inventory-name', label);
    const count = element('span', 'inventory-count', String(amount));
    const button = element('button', 'inventory-action', near ? text.deposit : text.drop);

    button.type = 'button';
    button.dataset['tone'] = near ? 'deposit' : 'drop';
    button.setAttribute('aria-label', near ? text.depositItem(label) : text.dropItem(label));
    button.addEventListener('click', () =>
      this.world.push(this.world.nearTown() ? { type: 'depositToTown', item } : { type: 'dropItem', item }),
    );
    row.append(itemIcon(item, 28), name, count, button);
    return row;
  }

  /** Un objet de la ville : sa quantité, et son débit net s'il bouge. */
  private stockEntry(item: ItemId, amount: number, rate: number): HTMLElement {
    const entry = element('span', 'inventory-stock');

    entry.append(itemAmount(item, amount));
    if (rate !== 0) {
      const trend = element('span', 'inventory-rate', t().inventory.perMinute(formatRate(rate)));

      trend.dataset['trend'] = rate > 0 ? 'up' : 'down';
      entry.append(trend);
    }
    return entry;
  }

  /** Une alerte de la ville : la taper ferme le panneau et montre le bâtiment en cause. */
  private alertRow(alert: FlowAlert): HTMLElement {
    const row = element('li', '');
    const button = element('button', 'inventory-alert');

    button.type = 'button';
    button.dataset['kind'] = alert.kind;
    button.append(itemIcon(alert.item, 22), element('span', '', alertText(alert)));
    button.addEventListener('click', () => {
      this.close();
      this.onAlert(alert);
    });
    row.append(button);
    return row;
  }

  /** Le bouton du bas : tout le sac en ville, ou tout au sol. */
  private empty(): void {
    this.world.push(this.world.nearTown() ? { type: 'depositToTown' } : { type: 'dropItem' });
  }

  public destroy(): void {
    this.root.remove();
  }
}

/** La phrase d'une alerte de la ville, dans la langue du moment. */
function alertText(alert: FlowAlert): string {
  const text = t().inventory;
  const item = t().items[alert.item];

  if (alert.kind === 'shortage') return text.shortage[alert.waiting](item, alert.stock);
  return alert.rate > 0 ? text.surplusRate(item, formatRate(alert.rate)) : text.surplusStock(item, alert.stock);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
