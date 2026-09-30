/**
 * Le panneau Recherche : ce que montre la fenêtre du labo.
 *
 * En haut, la recherche choisie : son coût déposé objet par objet (ce qui
 * manque en rouge), puis, une fois payée, sa barre de progression et le
 * temps qui reste. Dessous, toutes les recherches, groupées par thème
 * (Combat, Récolte, Ville), dans une liste qui défile : leur effet chiffré
 * (« Dégâts de l'arc : 1 → 1,5 »), leur coût en icônes — rouge ce qui
 * manque, sac et ville comptés ensemble —, leur état : terminée, en cours,
 * verrouillée par un prérequis (nommé), ou disponible, avec « Lancer ».
 *
 * Comme toute l'interface, il ne modifie rien : « Lancer », « Transférer »,
 * « Abandonner » et « Prendre le reste » poussent une commande
 * (`startResearch`, `transferToLab`, `cancelResearch`, `takeFromBuilding`)
 * que le tick consomme. Il lit le monde à chaque frame ; la liste n'est
 * reconstruite que si ce qu'elle affiche a changé.
 */

import type { ItemId } from '../data/items.ts';
import { RESEARCH, RESEARCH_IDS, RESEARCH_THEMES, type ResearchId, type ResearchTheme } from '../data/research.ts';
import { labNeeds, researchCost, researchStatus, type ResearchStatus } from '../sim/research.ts';
import type { Lab } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { itemAmount } from './icons.ts';
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
  private readonly list: HTMLElement;
  private labId: number | null = null;
  private lastCurrent = '';
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

    this.transferButton = button('Transférer', () => this.push('transferToLab'));
    this.cancelButton = button('Abandonner', () => this.push('cancelResearch'));
    this.takeButton = button('Prendre le reste', () => this.push('takeFromBuilding'));
    actions.append(this.transferButton, this.cancelButton, this.takeButton);
    this.current.append(this.currentTitle, this.currentStatus, this.bar, this.currentCost, actions);

    this.list = element('div', 'research-list');
    this.root.append(this.current, this.list);
  }

  /** À chaque frame, fenêtre du labo ouverte. */
  public update(lab: Lab): void {
    if (lab.id !== this.labId) {
      this.labId = lab.id;
      this.lastCurrent = '';
      this.lastList = '';
    }
    this.updateCurrent(lab);
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
      this.currentTitle.textContent = 'Aucune recherche en cours';
      this.setText(this.currentStatus, 'Choisissez-en une ci-dessous, puis apportez son coût.');
      this.bar.hidden = true;
      this.transferButton.hidden = true;
      this.cancelButton.hidden = true;
      this.setCost([], 'idle');
      return;
    }

    const research = RESEARCH[lab.research];

    this.currentTitle.textContent = research.label;
    this.bar.hidden = false;

    if (lab.endTick > 0) {
      const left = lab.endTick - world.tickCount;

      this.current.dataset['state'] = 'running';
      this.setText(this.currentStatus, `${statusLine(lab.research, 'running', world.researchDone, left)} · ${effectLine(lab.research, world.researchDone, world.perks)}`);
      this.bar.dataset['kind'] = 'research';
      this.barFill.style.width = `${Math.round((1 - left / research.duration) * 100)}%`;
      this.transferButton.hidden = true;
      this.cancelButton.hidden = true;
      this.setCost([], 'running');
      return;
    }

    // Le coût se dépose : ce qui est au coffre, sur ce qu'il faut. Le manque est en rouge.
    const cost = researchCost(lab.research);
    const total = cost.reduce((sum, [, amount]) => sum + amount, 0);
    const missing = cost.reduce((sum, [item]) => sum + labNeeds(lab, item), 0);
    const fromTown = world.labInTownRange(lab);

    this.current.dataset['state'] = 'collecting';
    this.setText(
      this.currentStatus,
      !inReach
        ? 'Rapprochez-vous pour déposer — ou laissez faire les porteurs.'
        : fromTown
          ? 'Transférez le sac et la ville, heurtez le labo, ou laissez faire les porteurs.'
          : 'Transférez le sac, heurtez le labo, ou laissez faire les porteurs.',
    );
    this.bar.dataset['kind'] = 'progress';
    this.barFill.style.width = `${Math.round((1 - missing / total) * 100)}%`;
    this.transferButton.hidden = false;
    this.transferButton.disabled = !inReach || !world.canTransferToLab(lab);
    this.cancelButton.hidden = false;

    const delivered = cost.map(([item, amount]): [ItemId, number, number] => [item, amount, amount - labNeeds(lab, item)]);

    this.setCost(
      delivered.map(([item, amount, have]) => itemAmount(item, amount, have)),
      `collecting:${lab.research}:${delivered.map(([item, , have]) => `${item}=${have}`).join(',')}`,
    );
  }

  private setCost(children: HTMLElement[], key: string): void {
    if (key === this.lastCurrent) return;
    this.lastCurrent = key;
    this.currentCost.replaceChildren(...children);
    this.currentCost.hidden = children.length === 0;
  }

  /** Toutes les recherches, par thème. Reconstruite seulement quand un état, un coût ou un stock change. */
  private updateList(lab: Lab): void {
    const { world } = this;
    const { researchDone: done } = world;
    const statuses = RESEARCH_IDS.map((id): [ResearchId, ResearchStatus] => [id, researchStatus(id, done, lab)]);
    const key = [
      statuses.map(([, status]) => status).join(','),
      lab.endTick > 0,
      world.perks.join(','),
      ...this.relevantItems().map((item) => `${item}=${this.owned(item)}`),
    ].join('|');

    if (key === this.lastList) return;
    this.lastList = key;

    const groups = (Object.keys(RESEARCH_THEMES) as ResearchTheme[]).map((theme) => {
      const section = element('section', 'research-group');
      const title = element('h3', 'research-group-title');

      title.textContent = RESEARCH_THEMES[theme];
      section.append(title);
      for (const [id, status] of statuses) {
        if (RESEARCH[id].theme === theme) section.append(this.row(id, status, lab));
      }
      return section;
    });

    this.list.replaceChildren(...groups);
  }

  /** Une recherche : nom, effet chiffré, coût, état, et « Lancer » si on peut. */
  private row(id: ResearchId, status: ResearchStatus, lab: Lab): HTMLElement {
    const { world } = this;
    const research = RESEARCH[id];
    const row = element('article', 'research-row');
    const head = element('div', 'research-row-head');
    const name = element('h4', 'research-name');
    const effect = element('p', 'research-effect');
    const state = element('p', 'research-status');

    row.dataset['status'] = status;
    name.textContent = research.label;
    effect.textContent = effectLine(id, world.researchDone, world.perks);
    state.textContent = status === 'running' ? 'En cours' : statusLine(id, status, world.researchDone);
    head.append(name);

    if (status === 'available') {
      const launch = element('button', 'inventory-action research-launch') as HTMLButtonElement;

      launch.type = 'button';
      launch.dataset['tone'] = 'deposit';
      launch.textContent = 'Lancer';
      // Une seule à la fois : tant qu'une recherche tourne, on attend.
      launch.disabled = lab.endTick > 0;
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

function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');

  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}
