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
 * (`logisticRadius`) : ailleurs, on livre à la main ou par les porteurs. Un
 * bâtiment qui a un coffre — la mairie, dont le coffre est le stock de la
 * ville, une foreuse, une ferme, une forge, une nurserie… — montre la zone
 * d'échange (`transferPanel.ts`) : son coffre et le sac en deux bandes, un
 * tap fait passer un objet de l'autre côté, « Tout prendre » et « Tout
 * déposer » le reste. Sur une nurserie ou une forge, « Transférer » y verse
 * ce que sa recette consomme, le sac puis la ville. Sur un bâtiment abîmé,
 * « Réparer » y pose le bois qu'il faut (`REPAIR`), le sac puis la ville, et
 * une ligne dit qu'on peut aussi le heurter. La fenêtre ne modifie rien
 * elle-même : chaque bouton pousse une commande (`transferToSite`,
 * `transferItems`, `supplyBuilding`, `repairBuilding`)
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
 * Sur un téléphone, elle doit laisser voir le jeu autour : ce qui se compte
 * se dit en puces « pictogramme + nombre » (habitants, nuits, rayon,
 * coffre…) plutôt qu'en phrases. Chaque puce porte son libellé
 * (`aria-label`), qu'un tap affiche dans une bulle ; la phrase d'ambiance
 * se déplie sous le bouton (i). Les points de vie tiennent sur une ligne :
 * cœur, barre, nombre. Le coffre — le stock de la ville pour la mairie —
 * coiffe ses objets d'un pictogramme de coffre.
 *
 * Elle **lit** le monde à chaque frame tant qu'elle est ouverte, et se ferme
 * seule si l'entité disparaît — rasée par un mutant, par exemple.
 */

import { BUILDINGS, REPAIR, buildingLevel, maxLevel, nextUpgrade, type BuildingLevel } from '../data/buildings.ts';
import { CLINIC } from '../data/clinic.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { RECIPES, type RecipeProto } from '../data/recipes.ts';
import { WEAPONS } from '../data/weapons.ts';
import { BUILDERS, LOGISTICIANS, LUMBERJACKS } from '../data/workers.ts';
import { floorCost } from '../sim/antenna.ts';
import { forgeRecipe } from '../sim/consumers.ts';
import { canPause } from '../sim/staffing.ts';
import type { SiteLine } from '../sim/siteLedger.ts';
import type { Building, Entity, EntityId, Forge, Nursery } from '../sim/types.ts';
import { TICKS_PER_SECOND, repairCost, siteMissing, type SiteCoverage, type World } from '../sim/world.ts';
import type { UiIcon } from '../art/ui.ts';
import { buildingIcon, buildingIconUrl, itemAmount, uiIcon } from './icons.ts';
import { ResearchPanel } from './researchPanel.ts';
import { TransferPanel } from './transferPanel.ts';

/** L'état d'une foreuse ou d'une ferme qui attend qu'on la vide. */
const BLOCKED = 'Bloquée : coffre plein — heurtez-la ou appuyez sur Tout prendre.';

/** Combien de temps la bulle d'une puce reste affichée. */
const TIP_MS = 2200;

/** Une puce : un pictogramme, un nombre, et ce qu'il compte. */
interface Stat {
  icon: UiIcon;
  value: string;
  label: string;
}

/** L'état d'un producteur mis en pause. */
const PAUSED = 'En pause : plus rien ne sort ni n’entre en production — appuyez sur Reprendre.';

export class BuildingPanel {
  public readonly root: HTMLElement;

  private readonly title: HTMLElement;
  private readonly thumb: HTMLImageElement;
  private readonly infoButton: HTMLButtonElement;
  private readonly description: HTMLElement;
  private readonly lines: HTMLElement;
  /** Cœur (ou rien pour un chantier), barre, nombre : une seule ligne. */
  private readonly meter: HTMLElement;
  private readonly meterIcon: HTMLElement;
  private readonly meterValue: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly barFill: HTMLElement;
  private readonly stats: HTMLElement;
  /** La bulle qui dit ce que compte une puce. */
  private readonly tip: HTMLElement;
  private tipTimer: number | undefined;
  /** Le pictogramme du coffre, au-dessus de ce qu'il contient. */
  private readonly stock: HTMLElement;
  private readonly stockCount: HTMLElement;
  private readonly items: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly transferButton: HTMLButtonElement;
  /** La zone d'échange sac ⇄ coffre, pour les bâtiments qui ont un coffre. */
  private readonly exchange: TransferPanel;
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
  /** `null` : rien d'affiché encore — une liste vide est une clé comme une autre. */
  private lastStats: string | null = null;
  private lastItems = '';
  private lastUpgrade = '';

  private entityId: EntityId | null = null;

  private readonly world: World;
  private readonly onOpen: () => void;

  public constructor(world: World, onOpen: () => void = () => {}) {
    this.world = world;
    this.onOpen = onOpen;

    this.root = document.createElement('section');
    this.root.className = 'panel building-panel building-window';
    this.root.hidden = true;

    const header = document.createElement('header');

    this.thumb = buildingIcon('townHall', 36);
    this.thumb.alt = '';
    this.thumb.setAttribute('aria-hidden', 'true');
    this.title = document.createElement('h2');

    this.description = document.createElement('p');
    this.description.className = 'building-panel-description';
    this.description.id = 'building-panel-description';
    this.description.hidden = true;

    // La phrase d'ambiance ne prend de place que si on la demande.
    this.infoButton = document.createElement('button');
    this.infoButton.type = 'button';
    this.infoButton.className = 'building-panel-info';
    this.infoButton.setAttribute('aria-label', 'À propos');
    this.infoButton.setAttribute('aria-controls', this.description.id);
    this.infoButton.setAttribute('aria-expanded', 'false');
    this.infoButton.append(uiIcon('info', 26));
    this.infoButton.addEventListener('click', () => this.toggleDescription());

    const close = document.createElement('button');

    close.type = 'button';
    close.className = 'building-panel-close';
    close.setAttribute('aria-label', 'Fermer');
    close.append(uiIcon('close'));
    close.addEventListener('click', () => this.close());

    header.append(this.thumb, this.title, this.infoButton, close);

    this.meter = document.createElement('div');
    this.meter.className = 'building-panel-meter';
    this.meterIcon = document.createElement('span');
    this.meterIcon.className = 'building-panel-meter-icon';
    this.meterIcon.append(uiIcon('heart', 22));
    this.meterValue = document.createElement('span');
    this.meterValue.className = 'building-panel-meter-value';
    this.bar = document.createElement('div');
    this.bar.className = 'building-panel-bar';
    this.barFill = document.createElement('div');
    this.bar.append(this.barFill);
    this.meter.append(this.meterIcon, this.bar, this.meterValue);

    this.stats = document.createElement('div');
    this.stats.className = 'building-panel-stats';
    this.stats.addEventListener('click', (event) => {
      const chip = (event.target as HTMLElement).closest<HTMLElement>('.building-panel-stat');

      if (chip) this.showTip(chip);
    });

    this.tip = document.createElement('div');
    this.tip.className = 'building-panel-tip';
    this.tip.setAttribute('role', 'status');
    this.tip.hidden = true;

    this.stock = document.createElement('div');
    this.stock.className = 'building-panel-stock';
    this.stock.setAttribute('role', 'img');
    this.stockCount = document.createElement('span');
    this.stock.append(uiIcon('chest', 20), this.stockCount);

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

    this.exchange = new TransferPanel(
      () => this.world.player.inventory,
      (command) => this.world.push(command),
    );
    this.exchange.root.hidden = true;

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
      this.meter,
      this.stats,
      this.stock,
      this.items,
      this.lines,
      this.crew,
      this.exchange.root,
      this.actions,
      this.upgrade,
      this.research.root,
      this.tip,
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
    this.lastStats = null;
    this.lastItems = '';
    this.lastUpgrade = '';
    this.lastCrew = '';
    this.cancelArmed = false;
    this.setDescription(false);
    this.hideTip();
    this.refresh(entity);
    this.onOpen();
  }

  public close(): void {
    this.entityId = null;
    this.hideTip();
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
    const stats: Stat[] = [];
    let ratio: number;
    let barClass: string;
    let meterValue = '';
    let meterLabel = '';

    const inReach = this.world.inReach(entity);

    // Le chantier devient le bâtiment sous le même id, le bâtiment change de niveau : le texte suit.
    this.title.textContent = entity.kind === 'site' ? proto.label : buildingLevel(entity.proto, entity.level).label;
    this.description.textContent = panelDescription(entity);

    const thumb = buildingIconUrl(entity.proto);

    if (this.thumb.src !== thumb) this.thumb.src = thumb;

    // Le labo fini : sa fenêtre devient le panneau Recherche, qui a besoin de toute la place.
    const lab = entity.kind === 'lab';

    this.root.dataset['kind'] = entity.kind;
    this.infoButton.hidden = lab;
    if (lab) this.setDescription(false);
    this.research.root.hidden = !lab;
    if (entity.kind === 'lab') this.research.update(entity);

    delete this.items.dataset['layout'];
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
      if (proto.workers > 0) stats.push({ icon: 'worker', value: String(proto.workers), label: `Ouvriers qu’il emploiera : ${proto.workers}` });

      // Objet par objet : livré / requis, puis ce qui est en route et ce que la ville en a.
      const ledger = this.world.siteLedger(entity);

      this.setItems(ledger.map(siteNeedRow), `site:${entity.id}:${JSON.stringify(ledger)}`);
      this.items.dataset['layout'] = 'ledger';
      this.transferButton.hidden = building;
      this.transferButton.textContent = this.world.townStock() ? 'Transférer' : 'Transférer le sac';
      this.transferButton.disabled = !inReach || !canGive;
      // Le chantier de la mairie ne s'annule pas.
      this.cancelButton.hidden = entity.id === this.world.townHallId;
      this.cancelButton.textContent = this.cancelArmed ? 'Vraiment annuler ?' : 'Annuler le chantier';
      this.exchange.show(null);
      this.repairButton.hidden = true;
      this.pauseButton.hidden = true;
      this.crew.hidden = true;
      this.upgrade.hidden = true;
      this.stock.hidden = true;
    } else {
      const level = buildingLevel(entity.proto, entity.level);

      ratio = entity.hp / level.hp;
      barClass = 'hp';
      meterValue = `${entity.hp}/${level.hp}`;
      meterLabel = `Points de vie : ${meterValue}`;

      const pausable = canPause(entity.proto);
      const stopped = this.world.stopped(entity);

      // Une nurserie ou une forge consomme : Adam vient la remplir. L'antenne attend son étage suivant.
      const consumer = entity.kind === 'nursery' || entity.kind === 'forge';
      const floor = entity.kind === 'antenna' && nextUpgrade(entity.proto, entity.level) !== null;

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

      this.pauseButton.hidden = !pausable;
      this.pauseButton.textContent = entity.paused ? 'Reprendre' : 'Pause';
      this.pauseButton.dataset['tone'] = entity.paused ? 'resume' : 'pause';
      this.refreshCrew(entity);
      this.cancelButton.hidden = true;
      this.transferButton.hidden = !consumer && !floor;
      this.transferButton.textContent = this.world.inTownRange(entity) ? 'Transférer' : 'Transférer le sac';
      this.transferButton.disabled = !inReach || !this.world.canSupply(entity);

      // Un coffre où échanger : la mairie, un producteur, une forge, une nurserie.
      const rules = this.world.transferRules(entity);

      this.exchange.show(
        rules && {
          id: entity.id,
          store: entity.store,
          rules,
          title: entity.kind === 'townHall' ? 'Coffre de la ville' : 'Coffre',
          icon: entity.kind === 'townHall' ? 'town' : 'chest',
          reachable: inReach,
        },
      );

      switch (entity.kind) {
        case 'townHall': {
          const { adults, children, workers } = this.world.population();

          stats.push(
            { icon: 'people', value: String(adults), label: `Adultes : ${adults}` },
            { icon: 'child', value: String(children), label: `Enfants : ${children}` },
            { icon: 'worker', value: String(workers), label: `Ouvriers : ${workers}` },
            { icon: 'moon', value: String(this.world.night), label: `Nuits affrontées : ${this.world.night}` },
            {
              icon: 'range',
              value: String(proto.logisticRadius),
              label: `Rayon d’approvisionnement : les chantiers à ${proto.logisticRadius} cases puisent dans son coffre`,
            },
          );
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
          stats.push({ icon: 'child', value: String(entity.born), label: `Enfants nés ici : ${entity.born}` });
          break;
        }

        case 'forge': {
          // La forge fond des plaques, le four à charbon cuit le bois : chacun sa recette.
          const recipe = forgeRecipe(entity);

          lines.push(`${recipeLine(recipe.inputs)} → ${recipeLine(recipe.outputs)}`);
          lines.push(
            entity.paused
              ? PAUSED
              : stopped
                ? 'À l’arrêt : personne au four — ajoutez un ouvrier.'
                : entity.blocked
                ? this.world.supplyStatus(entity)
                  ? `À l’arrêt. ${starvedLine(this.world, entity)}`
                  : BLOCKED
                : 'Le four chauffe.',
          );
          break;
        }

        case 'tower': {
          const weapon = level.weapon ? WEAPONS[level.weapon] : null;

          if (weapon) stats.push({ icon: 'range', value: String(weapon.range), label: `${weapon.label} — portée : ${weapon.range} cases` });
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
          stats.push({
            icon: 'range',
            value: String(LUMBERJACKS.radius),
            label: `Rayon : les bûcherons coupent les arbres à ${LUMBERJACKS.radius} cases`,
          });
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

          stats.push({
            icon: 'range',
            value: String(LOGISTICIANS.radius),
            label: `Rayon : les logisticiens vident les producteurs à ${LOGISTICIANS.radius} cases`,
          });
          lines.push(
            served === 0
              ? 'Aucun producteur à portée : ils flânent.'
              : `${served} producteur${served > 1 ? 's' : ''} à portée : leur production part à la mairie.`,
          );
          break;
        }

        case 'yard': {
          const served = this.world.yardSites(entity);

          stats.push({
            icon: 'range',
            value: String(BUILDERS.radius),
            label: `Rayon : les bâtisseurs livrent et bâtissent les chantiers à ${BUILDERS.radius} cases`,
          });
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

        case 'antenna': {
          const max = maxLevel(entity.proto);
          const lure = this.world.lureNight;
          const clock = this.world.clock();

          lines.push(`Étage ${entity.level}/${max}`);
          lines.push(
            floor
              ? 'L’étage suivant se livre comme un chantier : transférez, heurtez-la, ou laissez faire les porteurs.'
              : 'Le Signal est lancé : des survivants arrivent à chaque aube.',
          );
          if (lure > this.world.night) lines.push(`La nuit ${lure}, toutes les vagues marcheront sur elle.`);
          else if (lure === this.world.night && clock?.phase === 'night') lines.push('Cette nuit, toutes les vagues marchent sur elle.');
          break;
        }

        case 'clinic': {
          const used = this.world.clinicBedsUsed(entity.id);

          stats.push({ icon: 'people', value: `${used}/${CLINIC.beds}`, label: `Places occupées : ${used}/${CLINIC.beds}` });
          lines.push(
            used >= CLINIC.beds
              ? 'Complète : les mutants vaincus ne tombent plus assommés pour elle.'
              : 'Un mutant vaincu peut tomber assommé — touchez-le, il vous suivra jusqu’ici.',
          );
          break;
        }
      }

      // Le coffre de la mairie est le stock de la ville. Un coffre où échanger se lit dans la zone d'échange,
      // celui du labo dans le panneau Recherche, celui de l'antenne en jauges de son étage suivant, comme un chantier.
      if (rules) {
        this.stock.hidden = true;
        this.setItems([], 'exchange');
      } else if (entity.kind === 'antenna') {
        const cost = floorCost(entity);

        this.stock.hidden = true;
        this.setItems(
          cost.map(([item, needed]) => itemAmount(item, needed, entity.store.count(item))),
          `floor:${entity.id}:${entity.level}:${cost.map(([item]) => `${item}=${entity.store.count(item)}`).join(',')}`,
        );
      } else if (proto.storage > 0 && !lab) {
        const capacity = Number.isFinite(proto.storage) ? `/${proto.storage}` : '';
        const entries = entity.store.entries();
        const label = `Coffre ${entity.store.total()}${capacity}`;
        // Sans plafond, un coffre ne dit son compte que vide.
        const count = entries.length === 0 ? 'vide' : capacity ? `${entity.store.total()}${capacity}` : '';

        this.stock.hidden = false;
        this.stock.setAttribute('aria-label', `${label}${entries.length ? '' : ' : vide'}`);
        this.stock.title = label;
        if (this.stockCount.textContent !== count) this.stockCount.textContent = count;
        this.setItems(
          entries.map(([item, amount]) => itemAmount(item, amount)),
          `store:${entity.id}:${entries.map(([item, amount]) => `${item}=${amount}`).join(',')}`,
        );
      } else {
        this.stock.hidden = true;
        this.setItems([], 'none');
      }
      this.refreshUpgrade(entity, inReach);
    }

    this.setStats(stats);

    // Plus aucun bouton à montrer : la rangée disparaît.
    this.actions.hidden = [...this.actions.children].every((button) => (button as HTMLElement).hidden);

    const text = lines.filter(Boolean).join('\n');
    const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;

    this.lines.hidden = text === '';
    if (this.lines.textContent !== text) this.lines.textContent = text;
    if (`${barClass}:${width}:${meterValue}` === this.lastText) return;
    this.lastText = `${barClass}:${width}:${meterValue}`;
    this.bar.dataset['kind'] = barClass;
    this.barFill.style.width = width;
    // Un chantier n'a que sa barre ; un bâtiment, son cœur et ses points de vie.
    this.meterIcon.hidden = meterValue === '';
    this.meterValue.textContent = meterValue;
    if (meterLabel) {
      this.meter.setAttribute('role', 'img');
      this.meter.setAttribute('aria-label', meterLabel);
    } else {
      this.meter.removeAttribute('role');
      this.meter.removeAttribute('aria-label');
    }
  }

  /** Les puces ne sont reconstruites que si l'une change. */
  private setStats(stats: readonly Stat[]): void {
    const key = stats.map(({ icon, value, label }) => `${icon}:${value}:${label}`).join('|');

    if (key === this.lastStats) return;
    this.lastStats = key;
    this.stats.replaceChildren(...stats.map(statChip));
    this.stats.hidden = stats.length === 0;
  }

  /** Un tap sur une puce : son libellé dans une bulle au-dessus d'elle, le temps de le lire. */
  private showTip(chip: HTMLElement): void {
    this.tip.textContent = chip.getAttribute('aria-label') ?? '';
    this.tip.hidden = false;
    // La bulle reste dans la fenêtre : centrée sur la puce, bornée aux bords.
    const width = this.tip.offsetWidth;
    const center = chip.offsetLeft + chip.offsetWidth / 2;
    const left = Math.max(8, Math.min(this.root.clientWidth - width - 8, center - width / 2));

    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${chip.offsetTop - this.tip.offsetHeight - 6}px`;
    window.clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => this.hideTip(), TIP_MS);
  }

  private hideTip(): void {
    window.clearTimeout(this.tipTimer);
    this.tipTimer = undefined;
    this.tip.hidden = true;
  }

  private toggleDescription(): void {
    // La fenêtre grandit : la bulle ne serait plus sur sa puce.
    this.hideTip();
    this.setDescription(this.infoButton.getAttribute('aria-expanded') !== 'true');
  }

  private setDescription(open: boolean): void {
    this.description.hidden = !open;
    this.infoButton.setAttribute('aria-expanded', String(open));
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

    // Les étages de l'antenne se livrent : pas de bouton qui les achète d'un coup.
    this.upgrade.hidden = proto.upgrades.length === 0 || entity.kind === 'antenna';
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

/**
 * La ligne d'un objet du chantier : son icône et « livré/requis », puis, s'il
 * en manque, deux puces — en route (porteurs, bâtisseurs) et en ville. Un
 * objet que la ville n'a plus et que personne n'apporte est marqué à sec.
 */
function siteNeedRow(line: SiteLine): HTMLElement {
  const row = document.createElement('div');

  row.className = 'site-need';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', siteNeedLabel(line));
  row.title = siteNeedLabel(line);
  row.dataset['dry'] = String(line.dry);
  row.append(itemAmount(line.item, line.needed, line.delivered));
  if (line.done) return row;

  row.append(siteNeedChip('worker', line.incoming, 'coming'));
  if (line.inTown !== null) row.append(siteNeedChip('town', line.inTown, 'town'));
  return row;
}

function siteNeedChip(icon: UiIcon, value: number, kind: string): HTMLElement {
  const chip = document.createElement('span');

  chip.className = 'site-need-chip';
  chip.dataset['kind'] = kind;
  chip.dataset['empty'] = String(value === 0);
  chip.append(uiIcon(icon, 16), String(value));
  return chip;
}

/** « Pierre : 0/8 livrés, 2 en route, aucune en ville » — le libellé d'une ligne. */
export function siteNeedLabel(line: SiteLine): string {
  const label = ITEMS[line.item].label;

  if (line.done) return `${label} : ${line.delivered}/${line.needed}, tout est livré`;

  const parts = [`${label} : ${line.delivered}/${line.needed} livrés`, `${line.incoming} en route`];

  if (line.inTown !== null) parts.push(line.inTown === 0 ? 'plus rien en ville' : `${line.inTown} en ville`);
  return parts.join(', ');
}

/**
 * Une puce « pictogramme + nombre ». Un bouton, pour que le tap et le clavier
 * l'atteignent : il ne fait qu'afficher son libellé.
 */
function statChip({ icon, value, label }: Stat): HTMLButtonElement {
  const chip = document.createElement('button');

  chip.type = 'button';
  chip.className = 'building-panel-stat';
  chip.setAttribute('aria-label', label);
  chip.title = label;
  chip.append(uiIcon(icon, 20), value);
  return chip;
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
