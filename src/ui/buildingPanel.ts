/**
 * Fenêtre d'un bâtiment.
 *
 * Elle s'ouvre au tap sur un chantier ou un bâtiment et dit ce qu'il est, ce
 * qu'il contient, et ce qu'il est en train de faire : l'avancement d'un
 * chantier, le compte à rebours de la nurserie, la veille d'une tour, les
 * points de vie de la mairie et sa population, les ouvriers.
 *
 * Sur un chantier, un bouton : « Transférer » vide dans le chantier tout ce
 * qu'il attend et qu'Adam porte, puis le complète avec le stock de la ville —
 * le dernier objet livré achève le chantier, la fenêtre montre alors le
 * bâtiment. La mairie montre le stock de la ville. Sur une foreuse, une ferme
 * ou une forge, « Prendre » vide son coffre dans le sac, dans la limite de la
 * place. Sur une nurserie ou une forge, « Transférer le sac » y verse ce que
 * sa recette consomme. La fenêtre ne modifie rien elle-même : chaque bouton
 * pousse une commande (`transferToSite`, `takeFromBuilding`, `supplyBuilding`)
 * que le tick consomme.
 *
 * Elle **lit** le monde à chaque frame tant qu'elle est ouverte, et se ferme
 * seule si l'entité disparaît — rasée par un mutant, par exemple.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { RECIPES, type RecipeProto } from '../data/recipes.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { Entity, EntityId } from '../sim/types.ts';
import { TICKS_PER_SECOND, siteMissing, type World } from '../sim/world.ts';
import { itemAmount, uiIcon } from './icons.ts';

/** L'état d'une foreuse ou d'une ferme qui attend qu'on la vide. */
const BLOCKED = 'Bloquée : coffre plein — heurtez-la ou appuyez sur Prendre.';

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
  private readonly takeButton: HTMLButtonElement;
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
    close.append(uiIcon('close'));
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
      if (this.entityId === null) return;

      // Le même bouton sert au chantier et aux bâtiments qui consomment.
      const kind = this.world.entities.get(this.entityId)?.kind;

      this.world.push({ type: kind === 'site' ? 'transferToSite' : 'supplyBuilding', id: this.entityId });
    });

    this.takeButton = document.createElement('button');
    this.takeButton.type = 'button';
    this.takeButton.textContent = 'Prendre';
    this.takeButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'takeFromBuilding', id: this.entityId });
    });

    this.actions.append(this.transferButton, this.takeButton);

    this.root.append(header, this.description, this.bar, this.items, this.lines, this.actions);
  }

  public get open(): boolean {
    return this.entityId !== null;
  }

  /** Le bâtiment affiché, ou `null` si la fenêtre est fermée. */
  public get shown(): EntityId | null {
    return this.entityId;
  }

  public show(id: EntityId): void {
    const entity = this.world.entities.get(id);

    if (!entity) return;

    this.entityId = id;
    this.root.hidden = false;
    this.lastText = '';
    this.lastItems = '';
    this.title.textContent = BUILDINGS[entity.proto].label;
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

    // Le chantier devient le bâtiment sous le même id : le texte suit.
    this.description.textContent = panelDescription(entity);

    if (entity.kind === 'site') {
      const total = Object.values(proto.cost).reduce((sum, amount) => sum + amount, 0);
      const missing = siteMissing(entity);
      const canGive = this.world.canTransfer(entity);

      ratio = total === 0 ? 1 : 1 - missing / total;
      barClass = 'progress';
      lines.push(
        inReach
          ? 'Chantier en cours — transférez le sac et la ville, ou heurtez-le.'
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
      this.transferButton.hidden = false;
      this.transferButton.textContent = this.world.townStock() ? 'Transférer' : 'Transférer le sac';
      this.transferButton.disabled = !inReach || !canGive;
      this.takeButton.hidden = true;
    } else {
      ratio = entity.hp / proto.hp;
      barClass = 'hp';
      lines.push(`Points de vie ${entity.hp}/${proto.hp}`);
      if (proto.workers > 0) lines.push(`${proto.workers} ouvriers y travaillent.`);

      // Une foreuse, une ferme ou une forge produit dans son coffre : Adam vient le vider.
      const producer = entity.kind === 'drill' || entity.kind === 'farm' || entity.kind === 'forge';
      // Une nurserie ou une forge consomme : Adam vient la remplir.
      const consumer = entity.kind === 'nursery' || entity.kind === 'forge';

      this.actions.hidden = !producer && !consumer;
      this.transferButton.hidden = !consumer;
      this.transferButton.textContent = 'Transférer le sac';
      this.transferButton.disabled = !inReach || !this.world.canSupply(entity);
      this.takeButton.hidden = !producer;
      this.takeButton.disabled =
        !inReach || !producer || this.world.takeable(entity).length === 0 || this.world.player.inventory.freeSpace() <= 0;

      switch (entity.kind) {
        case 'townHall': {
          const { adults, children, workers } = this.world.population();

          lines.push(
            `Population : ${adults} adulte${adults > 1 ? 's' : ''}, ${children} enfant${children > 1 ? 's' : ''}, ${workers} ouvrier${workers > 1 ? 's' : ''}`,
          );
          lines.push(this.world.night === 0 ? 'Aucune nuit pour l’instant.' : `Nuits affrontées : ${this.world.night}.`);
          break;
        }

        case 'drill':
          lines.push(entity.output ? `Extrait : ${ITEMS[entity.output].label}` : 'Posée à sec : aucun gisement dessous.');
          lines.push(entity.blocked && entity.output ? BLOCKED : entity.output ? 'En marche.' : '');
          break;

        case 'nursery': {
          const remaining = Math.max(0, entity.nextBirthTick - this.world.tickCount);

          lines.push(`Chaque naissance mange ${recipeLine(RECIPES.raiseChild.inputs)}.`);
          lines.push(
            entity.hungry
              ? 'En attente : il manque de quoi nourrir l’enfant — apportez de la nourriture.'
              : `Prochain enfant dans ${clock(remaining)}`,
          );
          lines.push(`Enfants nés ici : ${entity.born}`);
          break;
        }

        case 'forge':
          lines.push(`${recipeLine(RECIPES.smeltPlate.inputs)} → ${recipeLine(RECIPES.smeltPlate.outputs)}`);
          lines.push(
            entity.blocked
              ? 'À l’arrêt : il manque du fer ou du charbon — heurtez-la ou transférez le sac.'
              : 'Le four chauffe.',
          );
          break;

        case 'tower': {
          const weapon = proto.weapon ? WEAPONS[proto.weapon] : null;

          if (weapon) lines.push(`${weapon.label} — portée ${weapon.range} tuiles`);
          lines.push(entity.armed ? 'En alerte : des mutants approchent.' : 'En veille.');
          break;
        }

        case 'farm':
          lines.push(entity.blocked ? BLOCKED : 'Les sillons poussent.');
          break;

        case 'house':
          lines.push('Les ouvriers dorment ici entre deux journées.');
          break;
      }

      // Le coffre de la mairie est le stock de la ville.
      if (proto.storage > 0) {
        const capacity = Number.isFinite(proto.storage) ? `/${proto.storage}` : '';
        const entries = entity.store.entries();
        const label = entity.kind === 'townHall' ? 'Stock de la ville' : `Coffre ${entity.store.total()}${capacity}`;

        lines.push(`${label}${entries.length ? '' : ' : vide'}`);
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

/** Texte d'inspection : celui du chantier tant qu'il en est un, celui du bâtiment ensuite. */
export function panelDescription(entity: Entity): string {
  const proto = BUILDINGS[entity.proto];

  return entity.kind === 'site' ? proto.siteDescription : proto.description;
}

/** « 2 minerai de fer + 1 charbon » à partir des quantités d'une recette. */
function recipeLine(amounts: RecipeProto['inputs']): string {
  return (Object.entries(amounts) as [ItemId, number][])
    .map(([item, amount]) => `${amount} ${ITEMS[item].label.toLowerCase()}`)
    .join(' + ');
}

/** « 9 min 32 s » à partir d'un nombre de ticks. */
function clock(ticks: number): string {
  const seconds = Math.ceil(ticks / TICKS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return minutes > 0 ? `${minutes} min ${rest.toString().padStart(2, '0')} s` : `${rest} s`;
}
