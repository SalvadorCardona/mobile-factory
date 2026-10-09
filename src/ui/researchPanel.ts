/**
 * Le panneau Recherche : ce que montre la fenêtre du labo.
 *
 * En haut, la recherche choisie : son coût déposé objet par objet, comme le
 * relevé d'un chantier (livré / demandé, en route, en ville), puis, une fois payée, sa barre de progression et le
 * temps qui reste. Dessous, un onglet par ère atteinte (`data/eras.ts`) —
 * chaque ère ouvre le sien —, puis ses recherches, groupées par thème
 * (Bâtiments, Combat, Récolte, Ville), dans une liste qui défile : leur effet
 * chiffré (« Dégâts de l'arc : 1 → 1,5 ») ou les bâtiments qu'elles font
 * entrer au menu de construction, vignette et nom — c'est ici qu'on découvre
 * ce qui arrive ensuite —, leur coût en icônes — rouge ce qui
 * manque, sac et ville comptés ensemble —, leur état : terminée, en cours,
 * verrouillée par un prérequis (nommé), ou disponible, avec « Lancer ».
 *
 * Comme toute l'interface, il ne modifie rien : « Lancer », « Transférer »,
 * « Abandonner » et « Prendre le reste » poussent une commande
 * (`startResearch`, `transferToLab`, `cancelResearch`, `takeFromBuilding`)
 * que le tick consomme. Il lit le monde à chaque frame ; la liste n'est
 * reconstruite que si ce qu'elle affiche a changé.
 */

import type { BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { PRODUCTION } from '../data/production.ts';
import { RESEARCH, RESEARCH_IDS, RESEARCH_THEMES, type ResearchId, type ResearchTheme } from '../data/research.ts';
import { locale, onLocale, t } from '../i18n/locale.ts';
import { labNeeds, queueFull, researchCost, researchStatus, type ResearchStatus } from '../sim/research.ts';
import type { Lab } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { buildingIcon, itemAmount } from './icons.ts';
import { siteNeedRow } from './siteNeedRow.ts';
import { effectLine, statusLine } from './researchText.ts';

export class ResearchPanel {
  public readonly root: HTMLElement;

  private readonly current: HTMLElement;
  private readonly currentTitle: HTMLElement;
  private readonly currentStatus: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly barFill: HTMLElement;
  private readonly currentCost: HTMLElement;
  private readonly transferButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly takeButton: HTMLButtonElement;
  private readonly queue: HTMLElement;
  private readonly list: HTMLElement;
  /** Les onglets d'ère, au-dessus de la liste : un par ère atteinte (`data/eras.ts`). */
  private readonly eraTabs: HTMLElement;
  /** L'onglet ouvert, et la dernière ère vue : une ère neuve ouvre son onglet. */
  private eraTab = 0;
  private seenEra = -1;
  private labId: number | null = null;
  private lastCurrent = '';
  private lastQueue = '';
  private lastList = '';

  private readonly world: World;

  public constructor(world: World) {
    this.world = world;

    this.root = element('div', 'research');

    this.current = element('div', 'research-current');
    this.currentTitle = element('h3', 'research-current-title');
    this.currentStatus = element('p', 'research-status');
    this.bar = element('div', 'building-panel-bar');
    this.barFill = element('div', '');
    this.bar.append(this.barFill);
    this.currentCost = element('div', 'research-cost');

    const actions = element('div', 'building-panel-actions');

    this.transferButton = button(() => this.push('transferToLab'));
    this.cancelButton = button(() => this.push('cancelResearch'));
    this.takeButton = button(() => this.push('takeFromBuilding'));
    actions.append(this.transferButton, this.cancelButton, this.takeButton);
    this.current.append(this.currentTitle, this.currentStatus, this.bar, this.currentCost, actions);

    this.queue = element('div', 'research-queue');
    this.queue.hidden = true;
    this.list = element('div', 'research-list');
    this.eraTabs = element('div', 'research-eras');
    this.eraTabs.setAttribute('role', 'tablist');
    this.root.append(this.current, this.queue, this.eraTabs, this.list);

    // Les boutons suivent la langue ; la liste se réécrit au prochain `update()`, dont la clé porte la langue.
    onLocale(() => {
      const text = t().researchPanel;

      this.transferButton.textContent = text.transfer;
      this.cancelButton.textContent = text.abandon;
      this.takeButton.textContent = text.takeRest;
    });
  }

  /** À chaque frame, fenêtre du labo ouverte. */
  public update(lab: Lab): void {
    if (lab.id !== this.labId) {
      this.labId = lab.id;
      this.lastCurrent = '';
      this.lastQueue = '';
      this.lastList = '';
    }
    this.updateCurrent(lab);
    this.updateQueue(lab);
    this.updateList(lab);
  }

  private push(type: 'transferToLab' | 'cancelResearch' | 'takeFromBuilding'): void {
    if (this.labId === null) return;
    if (type === 'cancelResearch') this.world.push({ type, lab: this.labId });
    else this.world.push({ type, id: this.labId });
  }

  /** La recherche choisie : son coût tant qu'il manque quelque chose, sa progression ensuite. */
  private updateCurrent(lab: Lab): void {
    const { world } = this;
    const surplus = world.takeable(lab).length > 0;
    const inReach = world.inReach(lab);

    this.takeButton.hidden = !surplus;
    this.takeButton.disabled = !inReach || world.player.inventory.freeSpace() <= 0;

    if (lab.research === null) {
      this.current.dataset['state'] = 'idle';
      this.currentTitle.textContent = t().researchPanel.noneTitle;
      this.setText(this.currentStatus, t().researchPanel.noneHint);
      this.bar.hidden = true;
      this.transferButton.hidden = true;
      this.cancelButton.hidden = true;
      this.setCost([], 'idle');
      return;
    }

    const research = RESEARCH[lab.research];

    this.currentTitle.textContent = t().research[lab.research].label;
    this.bar.hidden = false;

    if (lab.endTick > 0) {
      const left = lab.endTick - world.tickCount;

      this.current.dataset['state'] = 'running';
      this.setText(
        this.currentStatus,
        `${statusLine(lab.research, 'running', world.researchDone, left)} · ${effectLine(lab.research, world.researchDone, world.perks)}`,
      );
      this.bar.dataset['kind'] = 'research';
      this.barFill.style.width = `${Math.round((1 - left / research.duration) * 100)}%`;
      this.transferButton.hidden = true;
      // Abandonner une recherche qui tourne rend son coût au coffre.
      this.cancelButton.hidden = false;
      this.setCost([], 'running');
      return;
    }

    // Le coût se dépose : ce qui est au coffre, sur ce qu'il faut. Le manque est en rouge.
    const cost = researchCost(lab.research);
    const total = cost.reduce((sum, [, amount]) => sum + amount, 0);
    const missing = cost.reduce((sum, [item]) => sum + labNeeds(lab, item), 0);
    const fromTown = world.labInTownRange(lab);

    this.current.dataset['state'] = 'collecting';
    const text = t().researchPanel;

    this.setText(this.currentStatus, !inReach ? text.approach : fromTown ? text.transferBoth : text.transferBag);
    this.bar.dataset['kind'] = 'progress';
    this.barFill.style.width = `${Math.round((1 - missing / total) * 100)}%`;
    this.transferButton.hidden = false;
    this.transferButton.disabled = !inReach || !world.canTransferToLab(lab);
    this.cancelButton.hidden = false;

    // Objet par objet, comme la fenêtre d'un chantier : livré / demandé, en route, en ville.
    const ledger = world.labLedger(lab);

    this.setCost(ledger.map(siteNeedRow), `collecting:${lab.research}:${JSON.stringify(ledger)}`);
  }

  /** La file du labo : chaque recherche en attente, et de quoi la retirer. Reconstruite seulement si elle change. */
  private updateQueue(lab: Lab): void {
    const key = `${locale()}|${lab.queue.join(',')}`;

    this.queue.hidden = lab.queue.length === 0;
    if (key === this.lastQueue) return;
    this.lastQueue = key;

    const title = element('h3', 'research-group-title');

    title.textContent = t().researchPanel.queueTitle(lab.queue.length, PRODUCTION.queueSize);
    this.queue.replaceChildren(
      title,
      ...lab.queue.map((id) => {
        const row = element('article', 'research-row');
        const head = element('div', 'research-row-head');
        const name = element('h4', 'research-name');
        const remove = element('button', 'inventory-action research-launch') as HTMLButtonElement;

        row.dataset['status'] = 'queued';
        name.textContent = t().research[id].label;
        remove.type = 'button';
        remove.textContent = t().researchPanel.dequeue;
        remove.addEventListener('click', () => this.world.push({ type: 'dequeueResearch', lab: lab.id, research: id }));
        head.append(name, remove);
        row.append(head);
        return row;
      }),
    );
  }

  private setCost(children: HTMLElement[], key: string): void {
    if (key === this.lastCurrent) return;
    this.lastCurrent = key;
    this.currentCost.replaceChildren(...children);
    this.currentCost.hidden = children.length === 0;
    this.currentCost.dataset['layout'] = key.startsWith('collecting:') ? 'ledger' : '';
  }

  /** Toutes les recherches, par thème. Reconstruite seulement quand un état, un coût ou un stock change. */
  private updateList(lab: Lab): void {
    const { world } = this;
    const { researchDone: done } = world;

    // Une ère neuve : son onglet s'ouvre de lui-même, c'est là que sont les nouveautés.
    if (world.era !== this.seenEra) {
      this.seenEra = world.era;
      this.eraTab = world.era;
    }
    this.eraTab = Math.min(this.eraTab, world.era);

    const statuses = RESEARCH_IDS.filter((id) => RESEARCH[id].era === this.eraTab).map((id): [ResearchId, ResearchStatus] => [
      id,
      researchStatus(id, done, lab, world.labs()),
    ]);
    const key = [
      locale(),
      world.era,
      this.eraTab,
      statuses.map(([, status]) => status).join(','),
      lab.endTick > 0,
      queueFull(lab),
      world.perks.join(','),
      ...this.relevantItems().map((item) => `${item}=${this.owned(item)}`),
    ].join('|');

    if (key === this.lastList) return;
    this.lastList = key;

    const groups = (Object.keys(RESEARCH_THEMES) as ResearchTheme[]).map((theme) => {
      const section = element('section', 'research-group');
      const title = element('h3', 'research-group-title');

      title.textContent = t().researchThemes[theme];
      section.append(title);
      for (const [id, status] of statuses) {
        if (RESEARCH[id].theme === theme) section.append(this.row(id, status, lab));
      }
      return section;
    });

    this.list.replaceChildren(...groups.filter((group) => group.childElementCount > 1));
    this.renderEraTabs(lab);
  }

  /** Un onglet par ère atteinte, le premier compris ; seul, le Campement n'en montre pas. */
  private renderEraTabs(lab: Lab): void {
    const tabs = Array.from({ length: this.world.era + 1 }, (_, era) => {
      const tab = element('button', 'research-era') as HTMLButtonElement;

      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(era === this.eraTab));
      tab.textContent = t().eras[era]!.label;
      tab.addEventListener('click', () => {
        if (era === this.eraTab) return;
        this.eraTab = era;
        this.lastList = '';
        this.updateList(lab);
      });
      return tab;
    });

    this.eraTabs.hidden = tabs.length < 2;
    this.eraTabs.replaceChildren(...tabs);
  }

  /** Une recherche : nom, effet chiffré, coût, état, et « Lancer » si on peut. */
  private row(id: ResearchId, status: ResearchStatus, lab: Lab): HTMLElement {
    const { world } = this;
    const row = element('article', 'research-row');
    const head = element('div', 'research-row-head');
    const name = element('h4', 'research-name');
    const effect = element('p', 'research-effect');
    const state = element('p', 'research-status');

    row.dataset['status'] = status;
    name.textContent = t().research[id].label;
    if (RESEARCH[id].effect === null) effect.append(...this.unlocks(id));
    else effect.textContent = effectLine(id, world.researchDone, world.perks);
    state.textContent = status === 'running' ? t().researchPanel.running : statusLine(id, status, world.researchDone);
    head.append(name);

    if (status === 'available') {
      const launch = element('button', 'inventory-action research-launch') as HTMLButtonElement;

      launch.type = 'button';
      launch.dataset['tone'] = 'deposit';
      // Une recherche tourne déjà : celle-ci se met en file, tant qu'il y a de la place.
      launch.textContent = lab.endTick > 0 ? t().researchPanel.enqueue : t().researchPanel.launch;
      launch.disabled = lab.endTick > 0 && queueFull(lab);
      launch.addEventListener('click', () => world.push({ type: 'startResearch', lab: lab.id, research: id }));
      head.append(launch);
    }

    row.append(head, effect);

    // Le coût, tant qu'il reste à payer : sac et ville comptés ensemble, le manque en rouge.
    if (status === 'available' || status === 'locked') {
      const cost = element('div', 'research-cost');

      cost.append(...researchCost(id).map(([item, amount]) => itemAmount(item, amount, Math.min(amount, this.owned(item)))));
      row.append(cost);
    }
    row.append(state);
    return row;
  }

  /** « Débloque : » puis chaque bâtiment, vignette et nom : ce qui entrera au menu de construction. */
  private unlocks(id: ResearchId): (HTMLElement | string)[] {
    const buildings: readonly BuildingId[] = RESEARCH[id].unlocks;

    return [
      t().researchPanel.unlocks,
      ...buildings.map((building) => {
        const chip = element('span', 'research-unlock');

        chip.append(buildingIcon(building, 28), t().buildings[building].label);
        return chip;
      }),
    ];
  }

  /** Ce que la colonie possède d'un objet, à la portée d'Adam : son sac et le stock de la ville. */
  private owned(item: ItemId): number {
    return this.world.player.inventory.count(item) + (this.world.townStock()?.available(item) ?? 0);
  }

  /** Les objets qui entrent dans un coût de recherche : ceux dont le compte change la liste. */
  private relevantItems(): ItemId[] {
    return [...new Set(RESEARCH_IDS.flatMap((id) => researchCost(id).map(([item]) => item)))];
  }

  private setText(target: HTMLElement, text: string): void {
    if (target.textContent !== text) target.textContent = text;
  }
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);

  if (className) node.className = className;
  return node;
}

/** Un bouton : son libellé s'écrit dans `onLocale`. */
function button(onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');

  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}
