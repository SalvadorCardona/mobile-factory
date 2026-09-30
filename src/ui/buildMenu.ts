/**
 * Menu de construction.
 *
 * Un seul bouton à l'écran — « Construire » — qui ouvre un tiroir. Le tiroir
 * liste les bâtiments débloqués en cartes : vignette, nom, coût en icônes,
 * ouvriers. Choisir une carte ferme le tiroir et arme le placement
 * (`input/placement.ts`) ; une barre remplace alors le bouton, avec le nom
 * du bâtiment choisi, « Poser » et « Annuler ».
 *
 * Une liste de boutons toujours visibles mangeait un tiers de l'écran sur
 * un téléphone ; à six bâtiments, elle aurait recouvert la carte.
 *
 * Le bouton « Poser » n'apparaît qu'une fois le fantôme posé et reste grisé
 * tant que l'emplacement est refusé : le joueur voit pourquoi ça ne marche
 * pas avant d'appuyer, pas après.
 *
 * Une carte ne se grise pas quand le sac est vide : poser un chantier ne
 * coûte rien, c'est le remplir qui coûte.
 *
 * `unlocked` est pour l'instant la liste complète des bâtiments du menu.
 * Quand la recherche existera, elle viendra de `unlockedBuildings` — le menu
 * filtrera sur une donnée, sans une ligne de logique en plus.
 *
 * Au clavier (`handleKey`) : Espace ouvre le tiroir sur la première carte
 * (ou sur le bâtiment déjà armé), les flèches ou ZQSD/WASD passent d'une
 * carte à l'autre dans la grille, Entrée choisit, Espace ou Échap referment.
 * La sélection est le vrai focus du navigateur : un lecteur d'écran suit, et
 * Tab continue de marcher. Tant que le tiroir est ouvert, ces touches sont au
 * menu — `main.ts` ne les passe ni au déplacement ni à la pause.
 */

import { gridStep, type GridMove } from '../core/gridNav.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { Placement } from '../input/placement.ts';
import { buildingIcon, itemAmount, uiIcon } from './icons.ts';

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

export class BuildMenu {
  public readonly root: HTMLElement;

  private readonly toggleButton: HTMLButtonElement;
  private readonly drawer: HTMLElement;
  private readonly armedBar: HTMLElement;
  private readonly armedLabel: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly cards = new Map<BuildingId, HTMLButtonElement>();
  private opened = false;

  private readonly placement: Placement;
  private readonly onOpen: () => void;

  public constructor(placement: Placement, unlocked: readonly BuildingId[], onOpen: () => void = () => {}) {
    this.placement = placement;
    this.onOpen = onOpen;
    this.root = document.createElement('div');
    this.root.className = 'build-menu';

    this.toggleButton = button('Construire', () => this.toggle());
    this.toggleButton.className = 'build-toggle';
    this.toggleButton.prepend(uiIcon('hammer', 28));
    this.toggleButton.append(keyHint('Espace'));
    this.toggleButton.setAttribute('aria-keyshortcuts', 'Space');

    this.drawer = document.createElement('div');
    this.drawer.className = 'panel build-drawer';
    this.drawer.hidden = true;

    const title = document.createElement('div');

    title.className = 'build-drawer-title';
    title.textContent = 'Bâtiments';

    const close = button('', () => this.close());

    close.className = 'build-drawer-close';
    close.append(uiIcon('close'));
    close.setAttribute('aria-label', 'Fermer');

    const keys = document.createElement('span');

    keys.className = 'build-drawer-keys';
    keys.append(keyHint('Flèches'), keyHint('Entrée'), keyHint('Échap'));

    const header = document.createElement('header');

    header.append(title, keys, close);

    const list = document.createElement('div');

    list.className = 'build-drawer-list';

    for (const id of unlocked) {
      const card = this.card(id);

      this.cards.set(id, card);
      list.append(card);
    }
    this.drawer.append(header, list);

    this.armedBar = document.createElement('div');
    this.armedBar.className = 'panel build-armed';
    this.armedBar.hidden = true;

    this.armedLabel = document.createElement('span');
    this.armedLabel.className = 'build-armed-label';

    this.confirmButton = button('Poser', () => this.placement.confirm());
    this.confirmButton.dataset['confirm'] = 'true';
    this.cancelButton = button('Annuler', () => this.placement.cancel());
    this.armedBar.append(this.armedLabel, this.cancelButton, this.confirmButton);

    this.root.append(this.drawer, this.armedBar, this.toggleButton);
    this.refresh();
  }

  /** Une carte : vignette, nom, coût, ouvriers. */
  private card(id: BuildingId): HTMLButtonElement {
    const proto = BUILDINGS[id];
    const card = button('', () => {
      this.close();
      this.placement.select(id);
    });

    card.className = 'build-card';
    card.append(buildingIcon(id));

    const body = document.createElement('div');

    body.className = 'build-card-body';

    const name = document.createElement('div');

    name.className = 'build-card-name';
    name.textContent = proto.label;
    body.append(name);

    const cost = document.createElement('div');

    cost.className = 'build-card-cost';

    const entries = Object.entries(proto.cost) as [ItemId, number][];

    if (entries.length === 0) cost.textContent = 'gratuit';
    for (const [item, amount] of entries) cost.append(itemAmount(item, amount));
    body.append(cost);

    const meta = document.createElement('div');

    meta.className = 'build-card-meta';
    meta.textContent = `${proto.width}×${proto.height}` + (proto.workers > 0 ? ` · ${proto.workers} ouvriers` : '');
    body.append(meta);

    card.append(body);
    return card;
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
    this.drawer.hidden = false;
    this.onOpen();
    this.refresh();

    if (focusCard) {
      const armed = this.placement.armedBuilding();

      this.focus((armed && this.cards.get(armed)) || this.firstCard());
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
      if (code !== 'Space' || !canOpen || this.placement.mode !== 'idle') return false;
      if (!repeat) this.open(true);
      return true;
    }

    const move = MOVES[code];

    if (move) {
      const cards = [...this.cards.values()];
      const index = cards.indexOf(document.activeElement as HTMLButtonElement);

      this.focus(cards[gridStep(index, cards.length, this.columns(cards), move)]);
      return true;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      if (!repeat) {
        const focused = document.activeElement;
        const card = [...this.cards.values()].find((c) => c === focused) ?? this.firstCard();

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
    return this.cards.values().next().value;
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

  /** Recalcule l'état visible. Appelé à chaque changement de placement et à chaque frame. */
  public refresh(): void {
    const armed = this.placement.armedBuilding();

    for (const [id, card] of this.cards) {
      card.dataset['active'] = String(armed === id);
    }

    const idle = this.placement.mode === 'idle';
    const placing = this.placement.mode === 'placing';

    this.toggleButton.hidden = !idle || this.opened;
    this.armedBar.hidden = idle;

    if (armed) {
      const label = placing ? `Poser : ${BUILDINGS[armed].label}` : `Tapez la carte pour placer ${BUILDINGS[armed].label}`;

      if (this.armedLabel.textContent !== label) this.armedLabel.textContent = label;
    }
    this.confirmButton.hidden = !placing;
    this.confirmButton.disabled = !this.placement.isConfirmable();
  }

  public destroy(): void {
    this.root.remove();
  }
}

/** Le nom d'une touche, en petite capsule. Masqué en CSS sur les écrans sans clavier. */
function keyHint(label: string): HTMLElement {
  const key = document.createElement('kbd');

  key.className = 'key-hint';
  key.textContent = label;
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
