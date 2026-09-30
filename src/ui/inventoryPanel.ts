/**
 * Le panneau du sac.
 *
 * Il s'ouvre au tap sur le sac du HUD, ou à la touche I sur PC, et montre le
 * détail que le HUD, compact, ne montre pas : chaque objet porté avec sa
 * quantité, la place qui reste, et le stock de la ville.
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

import { ITEMS, type ItemId } from '../data/items.ts';
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
  private readonly allButton: HTMLButtonElement;
  private last = '';
  private shown = false;

  private readonly world: World;
  private readonly onOpen: () => void;

  public constructor(world: World, onOpen: () => void = () => {}) {
    this.world = world;
    this.onOpen = onOpen;

    this.root = element('section', 'panel building-panel inventory-panel');
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Sac');

    const header = element('header', '');
    const title = element('h2', '');

    title.append(uiIcon('bag', 28), 'Sac');

    const close = element('button', 'building-panel-close');

    close.type = 'button';
    close.setAttribute('aria-label', 'Fermer');
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

    townTitle.append(uiIcon('town', 20), 'Ville');
    this.townItems = element('div', 'building-panel-items');
    this.town.append(townTitle, this.townItems);

    const actions = element('div', 'building-panel-actions');

    this.allButton = element('button', '');
    this.allButton.type = 'button';
    this.allButton.addEventListener('click', () => this.empty());
    actions.append(this.allButton);

    this.root.append(header, bar, this.capacity, this.where, this.list, actions, this.town);
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
    const key = [
      near,
      inventory.capacity,
      entries.map(([item, amount]) => `${item}:${amount}`).join(','),
      town ? town.entries().map(([item, amount]) => `${item}:${amount}`).join(',') : 'none',
    ].join('|');

    if (key === this.last) return;
    this.last = key;

    const total = inventory.total();
    const free = inventory.freeSpace();

    this.barFill.style.width = `${Math.round((total / inventory.capacity) * 100)}%`;
    this.capacity.textContent = `${total}/${inventory.capacity} — ${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`;
    this.capacity.dataset['full'] = String(free <= 0);
    this.where.textContent = near
      ? 'Près de la mairie : ce que vous déposez rejoint le stock de la ville.'
      : town
        ? 'Loin de la mairie : ce que vous jetez reste au sol, et se ramasse en repassant dessus.'
        : 'Pas encore de ville : ce que vous jetez reste au sol, et se ramasse en repassant dessus.';

    this.list.replaceChildren(
      ...(entries.length === 0 ? [element('li', 'inventory-empty', 'Le sac est vide.')] : entries.map(([item, amount]) => this.row(item, amount, near))),
    );

    this.allButton.textContent = near ? 'Déposer en ville' : 'Tout jeter';
    this.allButton.dataset['tone'] = near ? 'deposit' : 'drop';
    this.allButton.disabled = entries.length === 0;

    this.town.hidden = !town;
    if (town) {
      const stock = town.entries();

      this.townItems.replaceChildren(
        ...(stock.length === 0 ? [element('span', 'inventory-empty', 'Rien en stock pour l’instant.')] : stock.map(([item, amount]) => itemAmount(item, amount))),
      );
      this.townItems.hidden = false;
    }
  }

  /** Une ligne : l'objet, sa quantité, et le bouton qui le vide. */
  private row(item: ItemId, amount: number, near: boolean): HTMLElement {
    const row = element('li', 'inventory-row');
    const name = element('span', 'inventory-name', ITEMS[item].label);
    const count = element('span', 'inventory-count', String(amount));
    const button = element('button', 'inventory-action', near ? 'Déposer' : 'Jeter');

    button.type = 'button';
    button.dataset['tone'] = near ? 'deposit' : 'drop';
    button.setAttribute('aria-label', `${near ? 'Déposer en ville' : 'Jeter'} : ${ITEMS[item].label}`);
    button.addEventListener('click', () =>
      this.world.push(this.world.nearTown() ? { type: 'depositToTown', item } : { type: 'dropItem', item }),
    );
    row.append(itemIcon(item, 28), name, count, button);
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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
