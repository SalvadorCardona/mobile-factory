/**
 * Fenêtre d'un bâtiment.
 *
 * Elle s'ouvre au tap sur un chantier ou un bâtiment et dit ce qu'il est, ce
 * qu'il contient, et ce qu'il est en train de faire : l'avancement d'un
 * chantier, le compte à rebours de la nurserie, la veille d'une tour, les
 * points de vie de la mairie et sa population, les ouvriers.
 *
 * Sur un chantier, deux boutons : « Transférer le sac » vide dans le chantier
 * tout ce qu'il attend et qu'Adam possède ; « Construire » apparaît quand
 * tout est livré. La fenêtre ne modifie rien elle-même : chaque bouton
 * pousse une commande (`transferToSite`, `buildSite`) que le tick consomme.
 *
 * Elle **lit** le monde à chaque frame tant qu'elle est ouverte, et se ferme
 * seule si l'entité disparaît — rasée par un mutant, par exemple.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { Entity, EntityId } from '../sim/types.ts';
import { TICKS_PER_SECOND, siteMissing, type World } from '../sim/world.ts';
import { itemAmount } from './icons.ts';

export class BuildingPanel {
  public readonly root: HTMLElement;

  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly lines: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly barFill: HTMLElement;
  private readonly items: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly transferButton: HTMLButtonElement;
  private readonly buildButton: HTMLButtonElement;
  private lastText = '';
  private lastItems = '';

  private entityId: EntityId | null = null;

  private readonly world: World;
  private readonly onOpen: () => void;

  public constructor(world: World, onOpen: () => void = () => {}) {
    this.world = world;
    this.onOpen = onOpen;

    this.root = document.createElement('section');
    this.root.className = 'panel building-panel';
    this.root.hidden = true;

    const header = document.createElement('header');

    this.title = document.createElement('h2');

    const close = document.createElement('button');

    close.type = 'button';
    close.className = 'building-panel-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());

    header.append(this.title, close);

    this.description = document.createElement('p');
    this.description.className = 'building-panel-description';

    this.bar = document.createElement('div');
    this.bar.className = 'building-panel-bar';
    this.barFill = document.createElement('div');
    this.bar.append(this.barFill);

    this.lines = document.createElement('pre');
    this.lines.className = 'building-panel-lines';

    this.items = document.createElement('div');
    this.items.className = 'building-panel-items';

    this.actions = document.createElement('div');
    this.actions.className = 'building-panel-actions';

    this.transferButton = document.createElement('button');
    this.transferButton.type = 'button';
    this.transferButton.textContent = 'Transférer le sac';
    this.transferButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'transferToSite', id: this.entityId });
    });

    this.buildButton = document.createElement('button');
    this.buildButton.type = 'button';
    this.buildButton.textContent = 'Construire';
    this.buildButton.dataset['confirm'] = 'true';
    this.buildButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'buildSite', id: this.entityId });
    });

    this.actions.append(this.transferButton, this.buildButton);

    this.root.append(header, this.description, this.bar, this.items, this.lines, this.actions);
  }

  public get open(): boolean {
    return this.entityId !== null;
  }

  public show(id: EntityId): void {
    const entity = this.world.entities.get(id);

    if (!entity) return;

    this.entityId = id;
    this.root.hidden = false;
    this.lastText = '';
    this.lastItems = '';
    this.title.textContent = BUILDINGS[entity.proto].label;
    this.description.textContent = BUILDINGS[entity.proto].description;
    this.refresh(entity);
    this.onOpen();
  }

  public close(): void {
    this.entityId = null;
    this.root.hidden = true;
  }

  /** À chaque frame : le contenu suit l'état, la fenêtre se ferme si l'entité a disparu. */
  public update(): void {
    if (this.entityId === null) return;

    const entity = this.world.entities.get(this.entityId);

    if (!entity) {
      this.close();
      return;
    }
    this.refresh(entity);
  }

  private refresh(entity: Entity): void {
    const proto = BUILDINGS[entity.proto];
    const lines: string[] = [];
    let ratio: number;
    let barClass: string;

    const inReach = this.world.inReach(entity);

    if (entity.kind === 'site') {
      const total = Object.values(proto.cost).reduce((sum, amount) => sum + amount, 0);
      const missing = siteMissing(entity);
      const { inventory } = this.world.player;
      const canGive = (Object.entries(proto.cost) as [ItemId, number][]).some(
        ([item, needed]) => (entity.delivered[item] ?? 0) < needed && inventory.count(item) > 0,
      );

      ratio = total === 0 ? 1 : 1 - missing / total;
      barClass = 'progress';
      lines.push(
        missing === 0
          ? 'Tout est livré : construisez.'
          : inReach
            ? 'Chantier en cours — transférez le sac, ou heurtez-le.'
            : 'Chantier en cours — rapprochez-vous pour livrer.',
      );
      if (proto.workers > 0) lines.push(`Emploiera ${proto.workers} ouvriers.`);

      this.setItems(
        (Object.entries(proto.cost) as [ItemId, number][]).map(([item, needed]) =>
          itemAmount(item, needed, entity.delivered[item] ?? 0),
        ),
        `site:${entity.id}:${JSON.stringify(entity.delivered)}`,
      );
      this.actions.hidden = false;
      this.transferButton.hidden = missing === 0;
      this.transferButton.disabled = !inReach || !canGive;
      this.buildButton.hidden = missing > 0;
      this.buildButton.disabled = !inReach;
    } else {
      ratio = entity.hp / proto.hp;
      barClass = 'hp';
      lines.push(`Points de vie ${entity.hp}/${proto.hp}`);
      if (proto.workers > 0) lines.push(`${proto.workers} ouvriers y travaillent.`);
      this.actions.hidden = true;

      switch (entity.kind) {
        case 'townHall': {
          const { adults, children, workers } = this.world.population();

          lines.push(
            `Population : ${adults} adulte${adults > 1 ? 's' : ''}, ${children} enfant${children > 1 ? 's' : ''}, ${workers} ouvrier${workers > 1 ? 's' : ''}`,
          );
          lines.push(this.world.wave === 0 ? 'Aucune vague pour l’instant.' : `Vague ${this.world.wave} passée.`);
          break;
        }

        case 'drill':
          lines.push(entity.output ? `Extrait : ${ITEMS[entity.output].label}` : 'Posée à sec : aucun gisement dessous.');
          lines.push(entity.blocked && entity.output ? 'Arrêtée — coffre plein.' : entity.output ? 'En marche.' : '');
          break;

        case 'nursery': {
          const remaining = Math.max(0, entity.nextBirthTick - this.world.tickCount);

          lines.push(`Prochain enfant dans ${clock(remaining)}`);
          lines.push(`Enfants nés ici : ${entity.born}`);
          break;
        }

        case 'tower': {
          const weapon = proto.weapon ? WEAPONS[proto.weapon] : null;

          if (weapon) lines.push(`${weapon.label} — portée ${weapon.range} tuiles`);
          lines.push(entity.armed ? 'En alerte : des mutants approchent.' : 'En veille.');
          break;
        }

        case 'farm':
          lines.push(entity.blocked ? 'Arrêtée — coffre plein.' : 'Les sillons poussent.');
          break;

        case 'house':
          lines.push('Les ouvriers dorment ici entre deux journées.');
          break;
      }

      if (proto.storage > 0) {
        const capacity = Number.isFinite(proto.storage) ? `/${proto.storage}` : '';
        const entries = entity.store.entries();

        lines.push(`Coffre ${entity.store.total()}${capacity}${entries.length ? '' : ' : vide'}`);
        this.setItems(
          entries.map(([item, amount]) => itemAmount(item, amount)),
          `store:${entity.id}:${entries.map(([item, amount]) => `${item}=${amount}`).join(',')}`,
        );
      } else {
        this.setItems([], 'none');
      }
    }

    const text = lines.filter(Boolean).join('\n');

    if (text === this.lastText) return;
    this.lastText = text;
    this.lines.textContent = text;
    this.bar.dataset['kind'] = barClass;
    this.barFill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }

  /** Les lignes d'objets ne sont reconstruites que si leur clé change. */
  private setItems(children: HTMLElement[], key: string): void {
    if (key === this.lastItems) return;
    this.lastItems = key;
    this.items.replaceChildren(...children);
    this.items.hidden = children.length === 0;
  }

  public destroy(): void {
    this.root.remove();
  }
}

/** « 9 min 32 s » à partir d'un nombre de ticks. */
function clock(ticks: number): string {
  const seconds = Math.ceil(ticks / TICKS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return minutes > 0 ? `${minutes} min ${rest.toString().padStart(2, '0')} s` : `${rest} s`;
}
