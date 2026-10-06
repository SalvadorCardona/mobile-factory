/**
 * Menu de construction.
 *
 * Un seul bouton à l'écran — « Bâtir » — qui ouvre un tiroir. Le tiroir
 * liste les bâtiments débloqués en cartes : vignette, nom, ce que fait le
 * bâtiment en une ligne (`effect`), coût et ouvriers en icônes. Choisir une carte ferme le tiroir et arme le placement
 * (`input/placement.ts`) ; une barre remplace alors le bouton, avec le nom
 * du bâtiment choisi, « Poser », « Poser encore » et « Annuler ». « Poser »
 * rend la main au joystick ; « Poser encore » garde le bâtiment armé, pour
 * enchaîner les poses sans rouvrir le tiroir.
 *
 * Une liste de boutons toujours visibles mangeait un tiers de l'écran sur
 * un téléphone ; à six bâtiments, elle aurait recouvert la carte.
 *
 * Les boutons de pose n'apparaissent qu'une fois le fantôme posé et reste grisé
 * tant que l'emplacement est refusé : le joueur voit pourquoi ça ne marche
 * pas avant d'appuyer, pas après. Le motif s'écrit sous le nom
 * (`placementReason.ts`), avec le remède quand Adam peut dégager la place.
 *
 * Une carte ne se grise pas quand le sac est vide : poser un chantier ne
 * coûte rien, c'est le remplir qui coûte. Le coût se colore d'après ce qui
 * peut le payer — le sac d'Adam et le stock de la ville : vert ce qu'il y a
 * déjà, orange ce qui manque.
 *
 * Le menu ne montre que ce qui se bâtit : ni carte grisée, ni cadenas
 * (`World.inMenu`). Tant que la mairie est en chantier, le bouton « Bâtir »
 * lui-même reste caché : un débutant ne dépense pas son premier bois
 * ailleurs. Ensuite, un bâtiment n'y entre qu'une fois débloqué — sa
 * recherche finie au labo (forge, four, clinique), son plan donné par Ève,
 * son objectif atteint (l'antenne) — et un bâtiment unique déjà posé en sort.
 * Ce qui reste à découvrir se lit au labo, pas ici.
 *
 * Un bâtiment qui vient d'entrer porte « Nouveau » jusqu'à ce qu'on choisisse
 * sa carte (commande `seeBuilding`) ou qu'on le pose ; le bouton « Bâtir »
 * a une pastille tant qu'il en reste un. L'annonce, elle, est un toast du HUD
 * (`buildingsUnlocked`).
 *
 * Les cartes se rangent à l'ouverture du tiroir, par utilité du moment
 * (`buildOrder.ts`) : la tour de guet en tête au crépuscule et la nuit, puis
 * ce qu'on peut payer tout de suite. L'ordre ne bouge plus tant que le tiroir
 * reste ouvert.
 *
 * Sur téléphone, les cartes se compactent en deux colonnes — vignette, nom,
 * coût et ouvriers en puces — pour tenir toutes, ou presque, sans défiler. L'effet quitte la
 * carte pour une ligne au pied du tiroir, qu'un appui long (ou le focus
 * clavier) remplit ; la ligne est toujours là, la liste ne bouge pas.
 *
 * La dernière carte n'est pas un bâtiment : la **route**, une pierre par
 * tuile. Choisie, elle arme le tracé (`Placement.selectRoad`) ; la barre dit
 * combien de tuiles et de pierres, « Poser » pave, et « Retirer » change
 * l'outil pour le marteau, qui retire les dalles et rend leur pierre.
 *
 * Au clavier (`handleKey`) : Espace ouvre le tiroir sur la première carte
 * (ou sur le bâtiment déjà armé), les flèches ou ZQSD/WASD passent d'une
 * carte à l'autre dans la grille, Entrée choisit, Espace ou Échap referment.
 * La sélection est le vrai focus du navigateur : un lecteur d'écran suit, et
 * Tab continue de marcher. Tant que le tiroir est ouvert, ces touches sont au
 * menu — `main.ts` ne les passe ni au déplacement ni à la pause. Tiroir
 * fermé, Échap annule un placement armé au lieu de mettre en pause.
 */

import { gridStep, type GridMove } from '../core/gridNav.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { ROADS } from '../data/roads.ts';
import type { Placement } from '../input/placement.ts';
import type { World } from '../sim/world.ts';
import { onLocale, t } from '../i18n/locale.ts';
import { buildOrder } from './buildOrder.ts';
import { buildingIcon, itemAmount, jobIcon, roadIcon, uiIcon } from './icons.ts';
import { placementOutput, placementReason, roadReason } from './placementReason.ts';

/** Position physique → mouvement dans la grille : flèches, et ZQSD/WASD comme pour marcher. */
const MOVES: Readonly<Record<string, GridMove>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

/** Un doigt posé plus longtemps que ça sur une carte lit son effet au lieu de la choisir. */
const LONG_PRESS_MS = 450;

/** La carte de la route : ce qu'elle fait, en une ligne, dans la langue du moment. */
function roadEffect(): string {
  return t().menu.roadEffect(t().common.number(ROADS.speed));
}

export class BuildMenu {
  public readonly root: HTMLElement;

  private readonly toggleButton: HTMLButtonElement;
  private readonly drawer: HTMLElement;
  private readonly list: HTMLElement;
  private readonly effectLine: HTMLElement;
  private readonly armedBar: HTMLElement;
  private readonly armedLabel: HTMLElement;
  private readonly reasonText: HTMLElement;
  private readonly reasonRemedy: HTMLElement;
  private readonly reason: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly repeatButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  /** Paver ou retirer : l'outil de la route, en mode route seulement. */
  private readonly toolButton: HTMLButtonElement;
  private readonly cards = new Map<BuildingId, HTMLButtonElement>();
  private readonly roadCard: HTMLButtonElement;
  private readonly badges = new Map<BuildingId, HTMLElement>();
  private readonly costs: { item: ItemId; amount: number; element: HTMLElement }[] = [];
  /** Les libellés fixes des cartes, réécrits à chaque changement de langue. */
  private readonly relabels: (() => void)[] = [];
  private opened = false;
  /** L'appui long vient de montrer un effet : le `click` qui suit le relâchement ne choisit pas la carte. */
  private swallowClick = false;

  private readonly world: World;
  private readonly placement: Placement;
  private readonly onOpen: () => void;

  /** `buildings` : tous les bâtiments du menu ; chacun ne se montre qu'une fois débloqué. */
  public constructor(world: World, placement: Placement, buildings: readonly BuildingId[], onOpen: () => void = () => {}) {
    this.world = world;
    this.placement = placement;
    this.onOpen = onOpen;
    this.root = document.createElement('div');
    this.root.className = 'build-menu';

    const toggleLabel = document.createTextNode('');
    const spaceKey = keyHint();

    this.toggleButton = button('', () => this.toggle());
    this.toggleButton.className = 'build-toggle';
    this.toggleButton.append(uiIcon('hammer', 28), toggleLabel, spaceKey);
    this.toggleButton.setAttribute('aria-keyshortcuts', 'Space');

    this.drawer = document.createElement('div');
    this.drawer.className = 'panel build-drawer';
    this.drawer.hidden = true;

    const title = document.createElement('div');

    title.className = 'build-drawer-title';

    const close = button('', () => this.close());

    close.className = 'build-drawer-close';
    close.append(uiIcon('close'));

    const keys = document.createElement('span');
    const arrowsKey = keyHint();
    const enterKey = keyHint();
    const escapeKey = keyHint();

    keys.className = 'build-drawer-keys';
    keys.append(arrowsKey, enterKey, escapeKey);

    const header = document.createElement('header');

    header.append(title, keys, close);

    this.list = document.createElement('div');
    this.list.className = 'build-drawer-list';

    for (const id of buildings) {
      const card = this.card(id);

      this.cards.set(id, card);
      this.list.append(card);
    }

    this.roadCard = this.road();
    this.list.append(this.roadCard);

    // Masquée sur grand écran, où chaque carte porte son effet.
    this.effectLine = document.createElement('div');
    this.effectLine.className = 'build-drawer-effect';
    this.effectLine.setAttribute('role', 'status');

    this.drawer.append(header, this.list, this.effectLine);

    this.armedBar = document.createElement('div');
    this.armedBar.className = 'panel build-armed';
    this.armedBar.hidden = true;

    this.armedLabel = document.createElement('span');
    this.armedLabel.className = 'build-armed-label';

    // Pourquoi « Poser » est grisé : une ligne, lue à voix haute par un lecteur d'écran.
    this.reason = document.createElement('span');
    this.reason.className = 'build-armed-reason';
    this.reason.setAttribute('role', 'status');
    this.reason.hidden = true;
    this.reasonText = document.createElement('strong');
    this.reasonRemedy = document.createElement('span');
    this.reason.append(this.reasonText, this.reasonRemedy);

    this.confirmButton = button('', () => this.placement.confirm());
    this.confirmButton.dataset['confirm'] = 'true';
    this.repeatButton = button('', () => this.placement.confirm(true));
    this.cancelButton = button('', () => this.placement.cancel());
    this.toolButton = button('', () => {
      this.placement.selectRoad(this.placement.roadTool() === 'remove' ? 'pave' : 'remove');
    });
    this.toolButton.hidden = true;
    this.armedBar.append(
      this.armedLabel,
      this.reason,
      this.cancelButton,
      this.toolButton,
      this.repeatButton,
      this.confirmButton,
    );

    this.root.append(this.drawer, this.armedBar, this.toggleButton);

    // Le menu vit toute la partie : ses libellés fixes suivent la langue.
    // Ceux qui changent avec l'état (barre de pose, verrous) se relisent à chaque `refresh()`.
    onLocale(() => {
      const text = t();

      toggleLabel.data = text.menu.build;
      spaceKey.textContent = text.menu.keys.space;
      title.textContent = text.menu.drawerTitle;
      close.setAttribute('aria-label', text.common.close);
      arrowsKey.textContent = text.menu.keys.arrows;
      enterKey.textContent = text.menu.keys.enter;
      escapeKey.textContent = text.menu.keys.escape;
      this.effectLine.textContent = text.menu.effectPrompt;
      this.repeatButton.textContent = text.menu.placeAgain;
      this.cancelButton.textContent = text.common.cancel;
      for (const relabel of this.relabels) relabel();
      // Les icônes des coûts portent le nom de l'objet (`itemIcon`), posé à leur création.
      for (const { item, element } of this.costs) {
        const image = element.querySelector('img');

        if (image) {
          image.alt = text.items[item];
          image.title = text.items[item];
        }
      }
      this.refresh();
    });
  }

  /** Une carte : vignette, nom et badge « Nouveau », effet, coût et ouvriers en puces, emprise. */
  private card(id: BuildingId): HTMLButtonElement {
    const proto = BUILDINGS[id];
    const card = button('', () => {
      if (this.swallowClick) {
        this.swallowClick = false;
        return;
      }
      if (!this.shown(id)) return;
      if (this.world.isNewInMenu(id)) this.world.push({ type: 'seeBuilding', building: id });
      this.close();
      this.placement.select(id);
    });

    card.className = 'build-card';
    this.longPress(card, () => this.showEffect(id));
    card.addEventListener('focus', () => this.showEffect(id));
    // La vignette du bâtiment, et le médaillon de son métier épinglé à son coin.
    const thumb = document.createElement('span');
    const icon = buildingIcon(id);

    thumb.className = 'build-card-thumb';
    thumb.append(icon, jobIcon(id));
    card.append(thumb);

    const body = document.createElement('div');

    body.className = 'build-card-body';

    const name = document.createElement('div');

    name.className = 'build-card-name';
    body.append(name);

    const badge = document.createElement('span');

    badge.className = 'build-card-new';
    badge.textContent = t().menu.newBadge;
    badge.hidden = true;
    this.badges.set(id, badge);
    name.append(badge);

    const effect = document.createElement('div');

    effect.className = 'build-card-effect';
    body.append(effect);

    const cost = document.createElement('div');

    cost.className = 'build-card-cost';

    const entries = Object.entries(proto.cost) as [ItemId, number][];

    // Sans coût, un mot à la place des icônes (un nœud texte : la puce des ouvriers le suit).
    const free = entries.length === 0 ? document.createTextNode('') : null;

    if (free) cost.append(free);
    for (const [item, amount] of entries) {
      const element = itemAmount(item, amount);

      this.costs.push({ item, amount, element });
      cost.append(element);
    }

    // Les ouvriers en puce à la suite du coût : elle reste sur la carte compacte du téléphone.
    let workers: HTMLElement | null = null;

    if (proto.workers > 0) {
      workers = document.createElement('span');
      workers.className = 'build-card-workers';
      workers.setAttribute('role', 'img');
      workers.append(uiIcon('worker', 18), String(proto.workers));
      cost.append(workers);
    }

    this.relabels.push(() => {
      const text = t();

      icon.alt = text.buildings[id].label;
      name.textContent = text.buildings[id].label;
      effect.textContent = text.buildings[id].effect;
      if (free) free.data = text.menu.free;
      if (workers) {
        const label = text.menu.employs(proto.workers);

        workers.setAttribute('aria-label', label);
        workers.title = label;
      }
    });

    const meta = document.createElement('div');

    meta.className = 'build-card-meta';
    meta.textContent = `${proto.width}×${proto.height}`;

    // Coût et emprise sur une ligne : la carte garde la hauteur d'un pouce, effet compris.
    const footer = document.createElement('div');

    footer.className = 'build-card-footer';
    footer.append(cost, meta);
    body.append(footer);

    card.append(body);
    return card;
  }

  /**
   * La carte de la route : comme celle d'un bâtiment, mais son coût est par
   * tuile, et elle arme le tracé au lieu d'un fantôme.
   */
  private road(): HTMLButtonElement {
    const show = (): void => setText(this.effectLine, t().menu.cardEffect(t().menu.road, roadEffect()));
    const card = button('', () => {
      if (this.swallowClick) {
        this.swallowClick = false;
        return;
      }
      if (!this.unlocked()) return;
      this.close();
      this.placement.selectRoad('pave');
    });

    card.className = 'build-card';
    this.longPress(card, show);
    card.addEventListener('focus', show);
    const icon = roadIcon();

    card.append(icon);

    const body = document.createElement('div');
    const name = document.createElement('div');
    const effect = document.createElement('div');
    const cost = document.createElement('div');
    const meta = document.createElement('div');
    const footer = document.createElement('div');
    const price = itemAmount(ROADS.item, 1);

    body.className = 'build-card-body';
    name.className = 'build-card-name';
    effect.className = 'build-card-effect';
    cost.className = 'build-card-cost';
    cost.append(price);
    this.costs.push({ item: ROADS.item, amount: 1, element: price });
    meta.className = 'build-card-meta';
    footer.className = 'build-card-footer';
    footer.append(cost, meta);
    body.append(name, effect, footer);
    card.append(body);
    this.relabels.push(() => {
      icon.alt = t().screens.road;
      name.textContent = t().menu.road;
      effect.textContent = roadEffect();
      meta.textContent = t().menu.roadMeta;
    });
    return card;
  }

  /** Appui long : l'effet s'écrit au pied du tiroir, la carte n'est pas choisie. */
  private longPress(card: HTMLButtonElement, show: () => void): void {
    let timer: number | undefined;
    const cancel = (): void => {
      window.clearTimeout(timer);
      timer = undefined;
    };

    card.addEventListener('pointerdown', () => {
      cancel();
      this.swallowClick = false;
      timer = window.setTimeout(() => {
        timer = undefined;
        this.swallowClick = true;
        show();
      }, LONG_PRESS_MS);
    });
    card.addEventListener('pointerup', cancel);
    card.addEventListener('pointercancel', cancel);
    card.addEventListener('pointerleave', cancel);
    // Le menu contextuel du navigateur, qu'un appui long ouvre sur Android, cacherait la carte.
    card.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private showEffect(id: BuildingId): void {
    const { label, effect } = t().buildings[id];

    setText(this.effectLine, t().menu.cardEffect(label, effect));
  }

  /** Range les cartes par utilité du moment. Seulement à l'ouverture : rien ne saute sous le doigt. */
  private sortCards(): void {
    const phase = this.world.clock()?.phase;
    const order = buildOrder([...this.cards.keys()], {
      threat: phase === 'dusk' || phase === 'night',
      locked: (id) => !this.shown(id),
      affordable: (id) => this.affordable(id),
    });

    for (const id of order) {
      const card = this.cards.get(id);

      if (card) this.list.append(card);
    }
    // La route ferme la liste : ce n'est pas un bâtiment, elle ne se range pas avec eux.
    this.list.append(this.roadCard);
    this.list.scrollTop = 0;
  }

  /** Le sac et la ville couvrent tout le coût : le chantier se remplira d'un « Transférer ». */
  private affordable(id: BuildingId): boolean {
    const { inventory } = this.world.player;
    const town = this.world.townStock();

    return (Object.entries(BUILDINGS[id].cost) as [ItemId, number][]).every(
      ([item, amount]) => inventory.count(item) + (town?.available(item) ?? 0) >= amount,
    );
  }

  public get isOpen(): boolean {
    return this.opened;
  }

  public toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  /** `focusCard` : ouvert au clavier, le tiroir met tout de suite une carte sous le focus. */
  public open(focusCard = false): void {
    this.opened = true;
    this.sortCards();
    setText(this.effectLine, t().menu.effectPrompt);
    this.drawer.hidden = false;
    this.onOpen();
    this.refresh();

    if (focusCard) {
      const armed = this.placement.armedBuilding();
      const road = this.placement.roadTool() !== null ? this.roadCard : undefined;

      this.focus((armed && this.cards.get(armed)) || road || this.firstCard());
    }
  }

  public close(): void {
    this.opened = false;
    // Une carte cachée qui garde le focus avalerait les touches suivantes :
    // on le rend à la page, et les flèches refont marcher Adam.
    if (document.activeElement instanceof HTMLElement && this.drawer.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    this.drawer.hidden = true;
    this.refresh();
  }

  /**
   * Une touche pour le menu. Renvoie `true` si le menu la prend : l'appelant
   * empêche alors le navigateur et le reste du jeu de la voir.
   *
   * `canOpen` : la partie est lancée, pas en pause ni perdue. Le tiroir ne
   * s'ouvre pas non plus pendant un placement : Espace n'y a rien à faire.
   */
  public handleKey(code: string, repeat: boolean, canOpen: boolean): boolean {
    if (!this.opened) {
      // Échap annule un placement en cours avant de mettre en pause.
      if (code === 'Escape' && this.placement.mode !== 'idle') {
        if (!repeat) this.placement.cancel();
        return true;
      }
      if (code !== 'Space' || !canOpen || this.placement.mode !== 'idle' || !this.unlocked()) return false;
      if (!repeat) this.open(true);
      return true;
    }

    const move = MOVES[code];

    if (move) {
      const cards = this.visibleCards();
      const index = cards.indexOf(document.activeElement as HTMLButtonElement);

      this.focus(cards[gridStep(index, cards.length, this.columns(cards), move)]);
      return true;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      if (!repeat) {
        const focused = document.activeElement;
        const card = this.visibleCards().find((c) => c === focused) ?? this.firstCard();

        card?.click();
      }
      return true;
    }

    if (code === 'Space' || code === 'Escape') {
      if (!repeat) this.close();
      return true;
    }

    return false;
  }

  private firstCard(): HTMLButtonElement | undefined {
    return this.visibleCards()[0];
  }

  /** Dans l'ordre de la liste : la route en dernier. */
  private visibleCards(): HTMLButtonElement[] {
    return [...this.list.children].filter(
      (card): card is HTMLButtonElement => card instanceof HTMLButtonElement && !card.hidden,
    );
  }

  private focus(card: HTMLButtonElement | undefined): void {
    if (!card) return;
    card.focus();
    card.scrollIntoView({ block: 'nearest' });
  }

  /** Colonnes de la grille, lues sur la mise en page : autant de cartes que sur la première ligne. */
  private columns(cards: readonly HTMLButtonElement[]): number {
    const top = cards[0]?.offsetTop;

    return Math.max(1, cards.filter((card) => card.offsetTop === top).length);
  }

  /** Le menu s'ouvre une fois la mairie debout : avant, tout le bois lui revient. */
  private unlocked(): boolean {
    return this.world.entities.get(this.world.townHallId)?.kind === 'townHall';
  }

  /** La carte est-elle au menu ? Débloquée, et pas un bâtiment unique déjà posé. */
  private shown(id: BuildingId): boolean {
    return this.world.inMenu(id) && !this.world.atLimit(id);
  }

  /** Recalcule l'état visible. Appelé à chaque changement de placement et à chaque frame. */
  public refresh(): void {
    const armed = this.placement.armedBuilding();

    let fresh = false;

    for (const [id, card] of this.cards) {
      const shown = this.shown(id);
      const isNew = shown && this.world.isNewInMenu(id);
      const badge = this.badges.get(id);

      card.dataset['active'] = String(armed === id);
      if (card.hidden === shown) card.hidden = !shown;
      if (badge && badge.hidden === isNew) badge.hidden = !isNew;
      fresh ||= isNew;
    }

    const roadTool = this.placement.roadTool();

    this.roadCard.dataset['active'] = String(roadTool !== null);
    if (this.roadCard.hidden === this.unlocked()) this.roadCard.hidden = !this.unlocked();
    this.toggleButton.dataset['new'] = String(fresh);

    // Le sac et la ville ne comptent que tiroir ouvert : fermé, personne ne voit les coûts.
    if (this.opened) {
      const { inventory } = this.world.player;
      const town = this.world.townStock();

      for (const { item, amount, element } of this.costs) {
        const done = String(inventory.count(item) + (town?.available(item) ?? 0) >= amount);

        if (element.dataset['done'] !== done) element.dataset['done'] = done;
      }
    }

    const idle = this.placement.mode === 'idle';
    const placing = this.placement.mode === 'placing';

    this.toggleButton.hidden = !idle || this.opened || !this.unlocked();
    this.armedBar.hidden = idle;
    this.armedBar.dataset['placing'] = String(placing);

    if (armed) {
      const name = t().buildings[armed].label;
      const label = placing ? t().menu.placing(name) : t().menu.tapToPlace(name);

      if (this.armedLabel.textContent !== label) this.armedLabel.textContent = label;
    }
    this.toolButton.hidden = roadTool === null;
    if (roadTool) {
      this.refreshRoad(roadTool, placing);
      return;
    }
    setText(this.confirmButton, t().menu.place);

    const block = this.placement.block();
    const confirmable = this.placement.isConfirmable();
    const ghost = this.placement.ghost;
    // Posable : une foreuse dit ce qu'elle extraira, en vert à la place du motif.
    const output = confirmable && ghost ? placementOutput(ghost.building, ghost.tx, ghost.ty, this.world) : null;
    const reason = block ? placementReason(block, this.world) : output ? { text: output, remedy: null } : null;

    this.reason.hidden = !reason;
    this.reason.dataset['ok'] = String(!block);
    if (reason) {
      setText(this.reasonText, reason.text);
      setText(this.reasonRemedy, reason.remedy ?? '');
      this.reasonRemedy.hidden = !reason.remedy;
    }

    this.confirmButton.hidden = !placing;
    this.confirmButton.disabled = !confirmable;
    this.repeatButton.hidden = !placing;
    this.repeatButton.disabled = !confirmable;
  }

  /** La barre du tracé : combien de tuiles, combien de pierres, et ce qui ne sera pas pavé. */
  private refreshRoad(tool: 'pave' | 'remove', placing: boolean): void {
    const trail = this.placement.roadTrail();
    const tiles = trail?.tiles ?? [];
    const confirmable = this.placement.isConfirmable();
    const { menu } = t();
    let label: string;
    let reason: { text: string; remedy: string | null } | null = null;

    if (tool === 'remove') {
      const slabs = tiles.filter(({ tx, ty }) => this.world.roads.has(tx, ty)).length;

      label = placing ? menu.removeCount(slabs) : menu.removeHint;
    } else {
      const plan = this.world.roadPlan(tiles);
      const paid = plan.filter((step) => step.state === 'pave').length;

      label = placing ? menu.roadCount(paid) : menu.roadHint;
      reason = roadReason(plan);
    }

    setText(this.armedLabel, label);
    setText(this.toolButton, tool === 'pave' ? menu.remove : menu.pave);
    setText(this.confirmButton, tool === 'pave' ? menu.place : menu.remove);

    this.reason.hidden = !placing || !reason;
    this.reason.dataset['ok'] = 'false';
    if (reason) {
      setText(this.reasonText, reason.text);
      setText(this.reasonRemedy, reason.remedy ?? '');
      this.reasonRemedy.hidden = !reason.remedy;
    }

    this.confirmButton.hidden = !placing;
    this.confirmButton.disabled = !confirmable;
    this.repeatButton.hidden = !placing;
    this.repeatButton.disabled = !confirmable;
  }

  public destroy(): void {
    this.root.remove();
  }
}

/** Ne touche au DOM que si le texte change : `refresh()` tourne à chaque frame. */
function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/** Le nom d'une touche, en petite capsule (écrit par `onLocale`). Masqué en CSS sur les écrans sans clavier. */
function keyHint(): HTMLElement {
  const key = document.createElement('kbd');

  key.className = 'key-hint';
  return key;
}

function button(label: string, onTap: () => void): HTMLButtonElement {
  const element = document.createElement('button');

  element.type = 'button';
  element.textContent = label;
  // `click` et non `pointerdown` : un glissement parti d'un bouton ne doit pas
  // déclencher l'action, et `click` gère déjà l'annulation au relâchement hors
  // de la cible.
  element.addEventListener('click', onTap);
  return element;
}
