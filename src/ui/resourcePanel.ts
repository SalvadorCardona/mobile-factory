/**
 * Le panneau des ressources avancées.
 *
 * Il s'ouvre au bouton qui ferme le bandeau de la ville, en haut à gauche, et
 * dit pour chaque objet de la ville ce que le bandeau, compact, ne fait que
 * signaler d'une flèche : son stock, sa tendance, ce qui entre et ce qui sort
 * par minute, le solde, une mini-courbe du stock sur les deux dernières
 * minutes de jeu et, s'il baisse, le temps avant qu'il soit à sec.
 *
 * Tout se lit dans `World.flows` (`sim/flows.ts`) : le panneau ne calcule
 * rien. Il ne se reconstruit qu'à un nouvel échantillon (toutes les 5 s de
 * jeu), à un changement de stock ou de langue — pas à chaque frame. Comme le
 * sac, il ne met pas le jeu en pause ; il se ferme à sa croix, à Échap, ou
 * d'un tap en dehors.
 */

import { sparklineSvg, SPARKLINE } from '../art/ui.ts';
import type { ItemId } from '../data/items.ts';
import { locale, onLocale, t } from '../i18n/locale.ts';
import type { ItemFlow } from '../sim/flows.ts';
import type { World } from '../sim/world.ts';
import { dayDialUrl, itemIcon, uiIcon } from './icons.ts';

export class ResourcePanel {
  public readonly root: HTMLElement;

  private readonly list: HTMLElement;
  private readonly subtitle: HTMLElement;
  private last = '';
  private shown = false;

  private readonly world: World;
  private readonly onOpen: () => void;
  /** Ce qui l'ouvre : un tap dessus n'est pas un tap « en dehors ». */
  private readonly opener: HTMLElement | null;

  public constructor(world: World, onOpen: () => void = () => {}, opener: HTMLElement | null = null) {
    this.world = world;
    this.onOpen = onOpen;
    this.opener = opener;

    this.root = element('section', 'panel building-panel resource-panel');
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');

    const header = element('header', '');
    const title = element('h2', '');
    const titleText = document.createTextNode('');

    title.append(uiIcon('stats', 28), titleText);

    const close = element('button', 'building-panel-close');

    close.type = 'button';
    close.append(uiIcon('close'));
    close.addEventListener('click', () => this.close());
    header.append(title, close);

    this.subtitle = element('p', 'building-panel-description');
    this.list = element('ul', 'resource-list');
    this.root.append(header, this.subtitle, this.list);

    // Un tap en dehors du panneau le ferme ; il atteint quand même ce qu'il vise.
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.shown || !(event.target instanceof Node)) return;
        if (this.root.contains(event.target) || this.opener?.contains(event.target)) return;
        this.close();
      },
      true,
    );

    onLocale(() => {
      const text = t().resourcePanel;

      this.root.setAttribute('aria-label', text.title);
      titleText.data = text.title;
      close.setAttribute('aria-label', t().common.close);
      this.subtitle.textContent = text.window;
      this.last = '';
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

  /** À chaque frame tant qu'il est ouvert : le DOM n'est reconstruit qu'à un nouvel échantillon ou un stock qui bouge. */
  public update(): void {
    if (!this.shown) return;

    const { flows } = this.world;
    const town = this.world.townStock();
    const items = town ? flows.tracked() : [];
    const key = [locale(), flows.revision, items.map((item) => `${item}:${town?.count(item) ?? 0}`).join(',')].join('|');

    if (key === this.last) return;
    this.last = key;

    this.list.replaceChildren(
      ...(items.length === 0
        ? [element('li', 'inventory-empty', t().resourcePanel.empty)]
        : items.map((item) => this.row(flows.stats(item), town?.count(item) ?? 0))),
    );
  }

  /** Une ligne : l'objet, son stock et sa flèche, la mini-courbe, puis entrées, sorties, solde, et le temps avant épuisement. */
  private row(flow: ItemFlow, stock: number): HTMLElement {
    const text = t().resourcePanel;
    const name = t().items[flow.item];
    const row = element('li', 'resource-row');

    row.dataset['trend'] = flow.trend;
    row.setAttribute('aria-label', text.rowLabel(name, stock, text.trend[flow.trend]));

    const head = element('div', 'resource-head');
    const count = element('span', 'resource-count', String(stock));

    head.append(itemIcon(flow.item, 26), element('span', 'resource-name', name), count);
    if (flow.trend !== 'flat') count.append(uiIcon(flow.trend === 'up' ? 'trendUp' : 'trendDown', 14));
    head.append(this.sparkline(flow.item, flow));

    const figures = element('div', 'resource-figures');

    figures.append(
      figure(text.produced, signed(flow.produced), 'in'),
      figure(text.consumed, signed(-flow.consumed), 'out'),
      figure(text.net, signed(flow.net), flow.net > 0 ? 'up' : flow.net < 0 ? 'down' : 'flat'),
    );
    row.append(head, figures);

    if (flow.minutesLeft !== null) {
      row.append(element('p', 'resource-runway', text.runsOut(flow.minutesLeft < 1 ? 0 : Math.round(flow.minutesLeft))));
    }
    return row;
  }

  private sparkline(item: ItemId, flow: ItemFlow): HTMLElement {
    const image = document.createElement('img');
    const history = flow.history.length > 0 ? flow.history : [flow.stock];

    image.className = 'resource-spark';
    image.width = SPARKLINE.width;
    image.height = SPARKLINE.height;
    image.src = dayDialUrl(sparklineSvg(history, flow.trend));
    image.alt = t().resourcePanel.history(t().items[item], history[0]!, history[history.length - 1]!);
    return image;
  }

  public destroy(): void {
    this.root.remove();
  }
}

/** Un chiffre libellé : « Entrées +12/min ». */
function figure(label: string, value: string, tone: string): HTMLElement {
  const node = element('span', 'resource-figure');
  const number = element('strong', '', t().resourcePanel.perMinute(value));

  number.dataset['tone'] = tone;
  node.append(element('span', '', label), number);
  return node;
}

/** Un débit par minute : une décimale sous 10, entier au-delà ; le séparateur de la langue. */
function perMinute(rate: number): string {
  const value = Math.abs(rate);

  return value.toLocaleString(locale(), { maximumFractionDigits: value < 10 ? 1 : 0 });
}

/** Le solde, signé ; 0 sans signe. */
function signed(rate: number): string {
  const text = perMinute(rate);

  if (text === '0') return text;
  return rate > 0 ? `+${text}` : `−${text}`;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
