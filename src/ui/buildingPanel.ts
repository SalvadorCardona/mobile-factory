/**
 * Fenêtre d'un bâtiment.
 *
 * Elle s'ouvre au tap sur un chantier ou un bâtiment et dit ce qu'il est, ce
 * qu'il contient, et ce qu'il est en train de faire : l'avancement d'un
 * chantier, le compte à rebours de la nurserie, la veille d'une tour, les
 * points de vie de la mairie et sa population, les ouvriers, les places de
 * la clinique.
 *
 * Sur un chantier, un bouton : « Transférer » vide dans le chantier tout ce
 * qu'il attend et qu'Adam porte, puis le complète avec le stock de la ville —
 * le dernier objet livré achève le chantier, la fenêtre montre alors le
 * bâtiment. La ville ne sert que les chantiers dans le rayon de la mairie
 * (`logisticRadius`) : ailleurs, on livre à la main ou par les porteurs. La
 * mairie montre le stock de la ville, et « Déposer le sac » l'y vide. Sur une
 * foreuse, une ferme ou une forge, « Prendre » vide son coffre dans le sac,
 * dans la limite de la place. Sur une nurserie ou une forge, « Transférer le
 * sac » y verse ce que sa recette consomme. Sur un bâtiment abîmé,
 * « Réparer » y pose le bois qu'il faut (`REPAIR`), le sac puis la ville, et
 * une ligne dit qu'on peut aussi le heurter. La fenêtre ne modifie rien
 * elle-même : chaque bouton pousse une commande (`transferToSite`,
 * `takeFromBuilding`, `supplyBuilding`, `depositToTown`, `repairBuilding`)
 * que le tick consomme.
 *
 * Sur le labo de recherche, la fenêtre devient le panneau Recherche
 * (`researchPanel.ts`) : la recherche en cours et la liste des recherches.
 *
 * Un bâtiment qui a des niveaux (`BUILDINGS[proto].upgrades`) montre en plus
 * le suivant : ce qu'il apporte, son coût — ce qui manque en rouge — et son
 * bouton (« Renforcer » pour la tour de guet), qui pousse `upgradeBuilding`.
 * Au dernier niveau, le bouton reste, grisé : « Niveau max ».
 *
 * Un producteur (foreuse, ferme, forge, nurserie, cabane de bûcheron) a un
 * bouton « Pause » / « Reprendre » (`pauseBuilding`). Un bâtiment qui emploie
 * a un sélecteur − / nombre / + (`setWorkers`) : un pictogramme d'ouvrier par
 * poste, plein s'il est occupé, vide sinon, marqué s'il est demandé mais
 * qu'aucun ouvrier libre ne vient le prendre.
 *
 * Elle **lit** le monde à chaque frame tant qu'elle est ouverte, et se ferme
 * seule si l'entité disparaît — rasée par un mutant, par exemple.
 */

import { BUILDINGS, REPAIR, buildingLevel, nextUpgrade, type BuildingLevel } from '../data/buildings.ts';
import { CLINIC } from '../data/clinic.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { RECIPES, type RecipeProto } from '../data/recipes.ts';
import { WEAPONS } from '../data/weapons.ts';
import { BUILDERS, LOGISTICIANS, LUMBERJACKS } from '../data/workers.ts';
import { canPause } from '../sim/staffing.ts';
import type { Building, Entity, EntityId, Forge, Nursery } from '../sim/types.ts';
import { TICKS_PER_SECOND, repairCost, siteMissing, type SiteCoverage, type World } from '../sim/world.ts';
import { itemAmount, uiIcon } from './icons.ts';
import { ResearchPanel } from './researchPanel.ts';

/** L'état d'une foreuse ou d'une ferme qui attend qu'on la vide. */
const BLOCKED = 'Bloquée : coffre plein — heurtez-la ou appuyez sur Prendre.';

/** L'état d'un producteur mis en pause. */
const PAUSED = 'En pause : plus rien ne sort ni n’entre en production — appuyez sur Reprendre.';

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
  private readonly depositButton: HTMLButtonElement;
  private readonly repairButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  /** « Annuler le chantier » : un premier tap arme, le second annule. */
  private readonly cancelButton: HTMLButtonElement;
  private cancelArmed = false;
  /** Le sélecteur d'ouvriers : −, les postes, +, et ce qui manque. */
  private readonly crew: HTMLElement;
  private readonly crewLess: HTMLButtonElement;
  private readonly crewMore: HTMLButtonElement;
  private readonly crewSlots: HTMLElement;
  private readonly crewCount: HTMLElement;
  private readonly crewNote: HTMLElement;
  private lastCrew = '';
  /** Le panneau Recherche, que seule la fenêtre du labo montre. */
  private readonly research: ResearchPanel;
  private readonly upgrade: HTMLElement;
  private readonly upgradeEffect: HTMLElement;
  private readonly upgradeCost: HTMLElement;
  private readonly upgradeButton: HTMLButtonElement;
  private lastText = '';
  private lastItems = '';
  private lastUpgrade = '';

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

    this.depositButton = document.createElement('button');
    this.depositButton.type = 'button';
    this.depositButton.textContent = 'Déposer le sac';
    this.depositButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'depositToTown' });
    });

    this.repairButton = document.createElement('button');
    this.repairButton.type = 'button';
    this.repairButton.dataset['tone'] = 'upgrade';
    this.repairButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'repairBuilding', id: this.entityId });
    });

    this.pauseButton = document.createElement('button');
    this.pauseButton.type = 'button';
    this.pauseButton.className = 'building-panel-pause';
    this.pauseButton.addEventListener('click', () => {
      const entity = this.entityId === null ? undefined : this.world.entities.get(this.entityId);

      if (entity && entity.kind !== 'site') this.world.push({ type: 'pauseBuilding', id: entity.id, paused: !entity.paused });
    });

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.dataset['tone'] = 'cancel';
    this.cancelButton.addEventListener('click', () => {
      if (this.entityId === null) return;
      if (!this.cancelArmed) {
        this.cancelArmed = true;
        return;
      }
      this.world.push({ type: 'cancelSite', id: this.entityId });
    });

    this.actions.append(
      this.pauseButton,
      this.repairButton,
      this.transferButton,
      this.takeButton,
      this.depositButton,
      this.cancelButton,
    );

    this.crew = document.createElement('div');
    this.crew.className = 'building-panel-crew';

    const crewRow = document.createElement('div');

    crewRow.className = 'building-panel-crew-row';
    this.crewLess = crewButton('−', 'Un ouvrier de moins', () => this.stepStaff(-1));
    this.crewMore = crewButton('+', 'Un ouvrier de plus', () => this.stepStaff(1));
    this.crewSlots = document.createElement('div');
    this.crewSlots.className = 'building-panel-crew-slots';
    this.crewCount = document.createElement('span');
    this.crewCount.className = 'building-panel-crew-count';
    crewRow.append(this.crewLess, this.crewSlots, this.crewCount, this.crewMore);

    this.crewNote = document.createElement('p');
    this.crewNote.className = 'building-panel-crew-note';
    this.crew.append(crewRow, this.crewNote);

    this.research = new ResearchPanel(world);
    this.research.root.hidden = true;

    this.upgrade = document.createElement('div');
    this.upgrade.className = 'building-panel-upgrade';

    this.upgradeEffect = document.createElement('p');
    this.upgradeEffect.className = 'building-panel-upgrade-effect';

    this.upgradeCost = document.createElement('div');
    this.upgradeCost.className = 'building-panel-items';

    const upgradeActions = document.createElement('div');

    upgradeActions.className = 'building-panel-actions';
    this.upgradeButton = document.createElement('button');
    this.upgradeButton.type = 'button';
    this.upgradeButton.dataset['tone'] = 'upgrade';
    this.upgradeButton.addEventListener('click', () => {
      if (this.entityId !== null) this.world.push({ type: 'upgradeBuilding', id: this.entityId });
    });
    upgradeActions.append(this.upgradeButton);
    this.upgrade.append(this.upgradeEffect, this.upgradeCost, upgradeActions);

    this.root.append(
      header,
      this.description,
      this.bar,
      this.items,
      this.lines,
      this.crew,
      this.actions,
      this.upgrade,
      this.research.root,
    );
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
    this.lastUpgrade = '';
    this.lastCrew = '';
    this.cancelArmed = false;
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

    // Le chantier devient le bâtiment sous le même id, le bâtiment change de niveau : le texte suit.
    this.title.textContent = entity.kind === 'site' ? proto.label : buildingLevel(entity.proto, entity.level).label;
    this.description.textContent = panelDescription(entity);

    // Le labo fini : sa fenêtre devient le panneau Recherche, qui a besoin de toute la place.
    const lab = entity.kind === 'lab';

    this.root.dataset['kind'] = entity.kind;
    this.description.hidden = lab;
    this.research.root.hidden = !lab;
    if (entity.kind === 'lab') this.research.update(entity);

    if (entity.kind === 'site') {
      const total = Object.values(proto.cost).reduce((sum, amount) => sum + amount, 0);
      const missing = siteMissing(entity);
      const canGive = this.world.canTransfer(entity);
      const fromTown = this.world.inTownRange(entity);

      const building = this.world.awaitsBuilders(entity);

      ratio = total === 0 ? 1 : 1 - missing / total;
      barClass = 'progress';

      if (building) {
        // Tout est livré : la barre suit le marteau des bâtisseurs.
        const { done, total: work } = this.world.siteBuild(entity);
        const builders = this.world.siteBuilders(entity.id);

        ratio = work === 0 ? 1 : done / work;
        barClass = 'build';
        lines.push(
          builders === 0
            ? 'Tout est livré : les bâtisseurs arrivent pour le bâtir.'
            : `${builders} bâtisseur${builders > 1 ? 's' : ''} au marteau — ${Math.floor(ratio * 100)} %`,
        );
      } else {
        lines.push(
          this.world.builderYard(entity)
            ? 'Les bâtisseurs du poste de construction le livrent depuis la mairie, puis le bâtiront.'
            : !inReach
              ? 'Chantier en cours — rapprochez-vous pour livrer.'
              : !fromTown
                ? 'Chantier en cours — transférez le sac, ou heurtez-le.'
                : siteCoverageText(this.world.siteCoverage(entity)),
        );
      }
      if (proto.workers > 0) lines.push(`Emploiera ${proto.workers} ouvriers.`);

      this.setItems(
        (Object.entries(proto.cost) as [ItemId, number][]).map(([item, needed]) =>
          itemAmount(item, needed, entity.delivered[item] ?? 0),
        ),
        `site:${entity.id}:${JSON.stringify(entity.delivered)}`,
      );
      this.actions.hidden = false;
      this.transferButton.hidden = building;
      this.transferButton.textContent = this.world.townStock() ? 'Transférer' : 'Transférer le sac';
      this.transferButton.disabled = !inReach || !canGive;
      // Le chantier de la mairie ne s'annule pas.
      this.cancelButton.hidden = entity.id === this.world.townHallId;
      this.cancelButton.textContent = this.cancelArmed ? 'Vraiment annuler ?' : 'Annuler le chantier';
      this.takeButton.hidden = true;
      this.depositButton.hidden = true;
      this.repairButton.hidden = true;
      this.pauseButton.hidden = true;
      this.crew.hidden = true;
      this.upgrade.hidden = true;
    } else {
      const level = buildingLevel(entity.proto, entity.level);

      ratio = entity.hp / level.hp;
      barClass = 'hp';
      lines.push(`Points de vie ${entity.hp}/${level.hp}`);

      const pausable = canPause(entity.proto);
      const stopped = this.world.stopped(entity);

      // Une foreuse, une ferme, une carrière, une forge ou une cabane de bûcheron remplit son coffre : Adam vient le vider.
      const producer =
        entity.kind === 'drill' ||
        entity.kind === 'farm' ||
        entity.kind === 'quarry' ||
        entity.kind === 'forge' ||
        entity.kind === 'lumberCamp';
      // Une nurserie ou une forge consomme : Adam vient la remplir.
      const consumer = entity.kind === 'nursery' || entity.kind === 'forge';

      // Abîmé : le bouton dit ce que coûte la remise à neuf, la ligne dit comment s'en passer.
      const cost = repairCost(entity);
      const stock = this.world.repairStock(entity);
      const material = ITEMS[REPAIR.item].label.toLowerCase();

      if (cost > 0) {
        lines.push(
          stock === 0
            ? `Abîmé — rapportez du ${material} pour le réparer (1 = ${REPAIR.hp} PV).`
            : `Abîmé — réparez-le, ou heurtez-le avec du ${material} dans le sac (1 = ${REPAIR.hp} PV).`,
        );
      }
      this.repairButton.hidden = cost === 0;
      this.repairButton.disabled = !inReach || stock === 0;
      const repairLabel = `Réparer (${stock > 0 ? Math.min(cost, stock) : cost} ${material})`;

      if (this.repairButton.textContent !== repairLabel) this.repairButton.textContent = repairLabel;

      this.actions.hidden = !producer && !consumer && !pausable && cost === 0;
      this.pauseButton.hidden = !pausable;
      this.pauseButton.textContent = entity.paused ? 'Reprendre' : 'Pause';
      this.pauseButton.dataset['tone'] = entity.paused ? 'resume' : 'pause';
      this.refreshCrew(entity);
      this.cancelButton.hidden = true;
      this.transferButton.hidden = !consumer;
      this.transferButton.textContent = this.world.inTownRange(entity) ? 'Transférer' : 'Transférer le sac';
      this.transferButton.disabled = !inReach || !this.world.canSupply(entity);
      this.takeButton.hidden = !producer;
      this.takeButton.disabled =
        !inReach || !producer || this.world.takeable(entity).length === 0 || this.world.player.inventory.freeSpace() <= 0;
      this.depositButton.hidden = true;

      switch (entity.kind) {
        case 'townHall': {
          const { adults, children, workers } = this.world.population();

          lines.push(
            `Population : ${adults} adulte${adults > 1 ? 's' : ''}, ${children} enfant${children > 1 ? 's' : ''}, ${workers} ouvrier${workers > 1 ? 's' : ''}`,
          );
          lines.push(this.world.night === 0 ? 'Aucune nuit pour l’instant.' : `Nuits affrontées : ${this.world.night}.`);
          lines.push(`Les chantiers à ${proto.logisticRadius} cases à la ronde puisent dans son coffre.`);
          this.actions.hidden = false;
          this.depositButton.hidden = false;
          this.depositButton.disabled = !inReach || this.world.player.inventory.isEmpty();
          break;
        }

        case 'drill':
          lines.push(entity.output ? `Extrait : ${ITEMS[entity.output].label}` : 'Posée à sec : aucun gisement dessous.');
          lines.push(entity.paused ? PAUSED : entity.blocked && entity.output ? BLOCKED : entity.output ? 'En marche.' : '');
          break;

        case 'nursery': {
          const remaining = Math.max(0, entity.nextBirthTick - this.world.tickCount);

          lines.push(`Chaque naissance mange ${recipeLine(RECIPES.raiseChild.inputs)}.`);
          lines.push(
            entity.paused
              ? PAUSED
              : entity.hungry
                ? `En attente d’un repas. ${starvedLine(this.world, entity)}`
                : `Prochain enfant dans ${clock(remaining)}`,
          );
          lines.push(`Enfants nés ici : ${entity.born}`);
          break;
        }

        case 'forge':
          lines.push(`${recipeLine(RECIPES.smeltPlate.inputs)} → ${recipeLine(RECIPES.smeltPlate.outputs)}`);
          lines.push(
            entity.paused
              ? PAUSED
              : entity.blocked
                ? this.world.supplyStatus(entity)
                  ? `À l’arrêt. ${starvedLine(this.world, entity)}`
                  : BLOCKED
                : 'Le four chauffe.',
          );
          break;

        case 'tower': {
          const weapon = level.weapon ? WEAPONS[level.weapon] : null;

          if (weapon) lines.push(`${weapon.label} — portée ${weapon.range} tuiles`);
          lines.push(entity.armed ? 'En alerte : des mutants approchent.' : 'En veille.');
          break;
        }

        case 'farm':
          lines.push(
            entity.paused
              ? PAUSED
              : stopped
                ? 'À l’arrêt : personne aux champs — ajoutez un ouvrier.'
                : entity.blocked
                  ? BLOCKED
                  : 'Les sillons poussent.',
          );
          break;

        case 'quarry':
          lines.push(
            entity.paused
              ? PAUSED
              : stopped
                ? 'À l’arrêt : personne à la taille — ajoutez un ouvrier.'
                : entity.blocked
                  ? BLOCKED
                  : 'Les pioches entament la ruine.',
          );
          break;

        case 'house':
          lines.push('Les ouvriers dorment ici entre deux journées.');
          break;

        case 'lab':
          // Tout est dans le panneau Recherche, sous les points de vie.
          break;

        case 'lumberCamp':
          lines.push(`Les bûcherons coupent les arbres à ${LUMBERJACKS.radius} cases à la ronde.`);
          lines.push(
            entity.paused
              ? 'En pause : les bûcherons rapportent leur bois, puis flânent.'
              : stopped
                ? 'À l’arrêt : aucun bûcheron — ajoutez un ouvrier.'
                : this.world.treesLeft(entity) === 0
                  ? 'Plus d’arbres à portée.'
                  : entity.store.total() > entity.store.capacity - LUMBERJACKS.carry
                    ? 'Coffre plein : les bûcherons attendent qu’on le vide.'
                    : 'Les haches résonnent.',
          );
          break;

        case 'depot': {
          const served = this.world.depotProducers(entity);

          lines.push(`Les logisticiens vident les producteurs à ${LOGISTICIANS.radius} cases à la ronde.`);
          lines.push(
            served === 0
              ? 'Aucun producteur à portée : ils flânent.'
              : `${served} producteur${served > 1 ? 's' : ''} à portée : leur production part à la mairie.`,
          );
          break;
        }

        case 'yard': {
          const served = this.world.yardSites(entity);

          lines.push(`Les bâtisseurs livrent et bâtissent les chantiers à ${BUILDERS.radius} cases à la ronde.`);
          lines.push(
            entity.paused
              ? 'En pause : ses chantiers reviennent aux porteurs et à vous.'
              : stopped
                ? 'À l’arrêt : aucun bâtisseur — ajoutez un ouvrier.'
                : served === 0
                  ? 'Aucun chantier à portée : ils flânent.'
                  : `${served} chantier${served > 1 ? 's' : ''} à portée : les bâtisseurs s’en chargent.`,
          );
          break;
        }

        case 'clinic': {
          const used = this.world.clinicBedsUsed(entity.id);

          lines.push(`Places : ${used}/${CLINIC.beds}`);
          lines.push(
            used >= CLINIC.beds
              ? 'Complète : les mutants vaincus ne tombent plus assommés pour elle.'
              : 'Un mutant vaincu peut tomber assommé — touchez-le, il vous suivra jusqu’ici.',
          );
          break;
        }
      }

      // Le coffre de la mairie est le stock de la ville. Celui du labo se lit dans le panneau Recherche.
      if (proto.storage > 0 && !lab) {
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
      this.refreshUpgrade(entity, inReach);
    }

    const text = lines.filter(Boolean).join('\n');

    if (text === this.lastText) return;
    this.lastText = text;
    this.lines.textContent = text;
    this.bar.dataset['kind'] = barClass;
    this.barFill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }

  /** Le sélecteur d'ouvriers : un pictogramme par poste — occupé, libre, ou demandé mais vide. */
  private refreshCrew(building: Building): void {
    const staffing = this.world.staffing(building);

    this.crew.hidden = staffing === null;
    if (!staffing) return;

    const { min, max, wanted, filled } = staffing;
    const key = `${building.id}:${wanted}:${filled}:${max}`;

    this.crewLess.disabled = wanted <= min;
    this.crewMore.disabled = wanted >= max;
    if (key === this.lastCrew) return;
    this.lastCrew = key;

    this.crewSlots.replaceChildren(
      ...Array.from({ length: max }, (_, slot) => {
        const cell = document.createElement('span');

        // Occupé, demandé mais sans ouvrier libre, ou fermé.
        cell.className = 'building-panel-crew-slot';
        cell.dataset['slot'] = slot < filled ? 'filled' : slot < wanted ? 'missing' : 'empty';
        cell.append(uiIcon('worker', 26));
        return cell;
      }),
    );
    this.crewCount.textContent = `${wanted}/${max}`;

    const missing = wanted - filled;

    const plural = (count: number): string => (count > 1 ? 's' : '');

    this.crewNote.textContent =
      missing > 0
        ? `${missing} ouvrier${plural(missing)} manquant${plural(missing)} : le poste se remplira dès qu’un ouvrier sera libre.`
        : wanted === 0
          ? 'Aucun ouvrier : le bâtiment est à l’arrêt.'
          : `${filled} ouvrier${plural(filled)} affecté${plural(filled)}` +
            (max > wanted ? `, ${max - wanted} rendu${plural(max - wanted)} à la ville.` : '.');
    this.crewNote.dataset['missing'] = String(missing > 0);
  }

  /** − ou + : l'effectif voulu, poussé en commande ; la simulation le borne. */
  private stepStaff(delta: number): void {
    const entity = this.entityId === null ? undefined : this.world.entities.get(this.entityId);

    if (!entity || entity.kind === 'site') return;
    this.world.push({ type: 'setWorkers', id: entity.id, count: entity.staff + delta });
  }

  /** Le niveau suivant : ce qu'il apporte, ce qu'il coûte, ce qui manque ; ou « Niveau max ». */
  private refreshUpgrade(entity: Exclude<Entity, { kind: 'site' }>, inReach: boolean): void {
    const proto = BUILDINGS[entity.proto];
    const upgrade = nextUpgrade(entity.proto, entity.level);

    this.upgrade.hidden = proto.upgrades.length === 0;
    if (this.upgrade.hidden) return;

    const missing = this.world.upgradeMissing(entity) ?? {};
    const short = Object.keys(missing).length > 0;

    this.upgradeButton.disabled = !upgrade || !inReach || short;

    const key = `${entity.id}:${entity.level}:${inReach}:${JSON.stringify(missing)}`;

    if (key === this.lastUpgrade) return;
    this.lastUpgrade = key;

    if (!upgrade) {
      this.upgradeEffect.textContent = '';
      this.upgradeEffect.hidden = true;
      this.upgradeCost.replaceChildren();
      this.upgradeCost.hidden = true;
      this.upgradeButton.textContent = 'Niveau max';
      return;
    }

    this.upgradeEffect.hidden = false;
    this.upgradeEffect.textContent = `${upgrade.action} : ${upgradeEffect(buildingLevel(entity.proto, entity.level), upgrade)}${
      inReach ? '' : ' — rapprochez-vous.'
    }`;
    this.upgradeCost.hidden = false;
    this.upgradeCost.replaceChildren(
      ...(Object.entries(upgrade.cost) as [ItemId, number][]).map(([item, needed]) => {
        const row = itemAmount(item, needed);
        const lacking = missing[item] ?? 0;

        if (lacking > 0) {
          const note = document.createElement('span');

          row.dataset['missing'] = 'true';
          note.className = 'item-missing';
          note.textContent = `manque ${lacking}`;
          row.append(note);
        }
        return row;
      }),
    );
    this.upgradeButton.textContent = upgrade.action;
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

/** Un bouton rond du sélecteur d'ouvriers. */
function crewButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'building-panel-crew-step';
  button.textContent = label;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

/** Texte d'inspection : celui du chantier tant qu'il en est un, celui du bâtiment à son niveau ensuite. */
export function panelDescription(entity: Entity): string {
  return entity.kind === 'site' ? BUILDINGS[entity.proto].siteDescription : buildingLevel(entity.proto, entity.level).description;
}

/** Ce que « Transférer » ferait d'un chantier à portée de la ville, en disant d'où vient la matière. */
export function siteCoverageText(coverage: SiteCoverage): string {
  switch (coverage) {
    case 'bag':
      return 'Votre sac suffit : transférez pour l’achever.';
    case 'town':
      return 'Le stock de la ville couvre le reste : transférez pour l’achever.';
    case 'both':
      return 'Sac et ville couvrent le reste : transférez pour l’achever.';
    case 'short':
      return 'Chantier en cours — transférez le sac et la ville, ou heurtez-le.';
  }
}

/** Ce qu'apporte un niveau : « PV 60 → 90, portée 8 → 10, cadence +29 % ». */
export function upgradeEffect(from: BuildingLevel, to: BuildingLevel): string {
  const parts: string[] = [];

  if (to.hp !== from.hp) parts.push(`PV ${from.hp} → ${to.hp}`);

  const before = from.weapon ? WEAPONS[from.weapon] : null;
  const after = to.weapon ? WEAPONS[to.weapon] : null;

  if (after && after.range !== before?.range) parts.push(`portée ${before?.range ?? 0} → ${after.range}`);
  if (before && after && after.cooldown !== before.cooldown) {
    const faster = Math.round((before.cooldown / after.cooldown - 1) * 100);

    parts.push(`cadence ${faster > 0 ? '+' : ''}${faster} %`);
  }
  return parts.join(', ');
}

/** « 2 minerai de fer + 1 charbon » à partir des quantités d'une recette. */
/**
 * D'où vient la famine d'une forge ou d'une nurserie : ce qui manque est-il
 * en route, en ville, dans le sac — ou nulle part ?
 */
function starvedLine(world: World, consumer: Nursery | Forge): string {
  const status = world.supplyStatus(consumer);

  if (!status) return '';

  const label = ITEMS[status.item].label;

  if (status.coming) return `${label} : les porteurs l’apportent.`;
  if (status.inTown > 0) {
    return status.porters
      ? `${label} en ville : ${status.inTown} — les porteurs arrivent.`
      : `${label} en ville : ${status.inTown} — aucun porteur : ${world.inTownRange(consumer) ? 'transférez-le' : 'apportez-le'}.`;
  }
  if (world.player.inventory.count(status.item) > 0) return `${label} dans le sac — heurtez-la ou transférez.`;
  return `Plus de ${label.toLowerCase()} nulle part — récoltez-en.`;
}

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
