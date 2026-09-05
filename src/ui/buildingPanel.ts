/**
 * Fenêtre d'un bâtiment.
 *
 * Elle s'ouvre au tap sur un chantier ou un bâtiment et dit ce qu'il est, ce
 * qu'il contient, et ce qu'il est en train de faire : l'avancement d'un
 * chantier, le compte à rebours de la nurserie, la veille d'une tour, les
 * points de vie de la mairie et sa population.
 *
 * Elle **lit** le monde à chaque frame tant qu'elle est ouverte, et se ferme
 * seule si l'entité disparaît — rasée par un mutant, par exemple. Elle ne
 * modifie jamais rien.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { Entity, EntityId } from '../sim/types.ts';
import { TICKS_PER_SECOND, siteMissing, type World } from '../sim/world.ts';

export class BuildingPanel {
  public readonly root: HTMLElement;

  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly lines: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly barFill: HTMLElement;
  private lastText = '';

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

    this.root.append(header, this.description, this.bar, this.lines);
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

    if (entity.kind === 'site') {
      const total = Object.values(proto.cost).reduce((sum, amount) => sum + amount, 0);

      ratio = total === 0 ? 1 : 1 - siteMissing(entity) / total;
      barClass = 'progress';
      lines.push('Chantier en cours — heurtez-le avec le sac plein.');

      for (const [item, needed] of Object.entries(proto.cost) as [ItemId, number][]) {
        lines.push(`${ITEMS[item].label} ${entity.delivered[item] ?? 0}/${needed}`);
      }
    } else {
      ratio = entity.hp / proto.hp;
      barClass = 'hp';
      lines.push(`Points de vie ${entity.hp}/${proto.hp}`);

      switch (entity.kind) {
        case 'townHall': {
          const { adults, children } = this.world.population();

          lines.push(`Population : ${adults} adulte${adults > 1 ? 's' : ''}, ${children} enfant${children > 1 ? 's' : ''}`);
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
      }

      if (proto.storage > 0) {
        const contents = entity.store
          .entries()
          .map(([item, amount]) => `${ITEMS[item].label} ${amount}`)
          .join(', ');
        const capacity = Number.isFinite(proto.storage) ? `/${proto.storage}` : '';

        lines.push(`Coffre ${entity.store.total()}${capacity} : ${contents || 'vide'}`);
      }
    }

    const text = lines.filter(Boolean).join('\n');

    if (text === this.lastText) return;
    this.lastText = text;
    this.lines.textContent = text;
    this.bar.dataset['kind'] = barClass;
    this.barFill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
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
