/**
 * Onglets d'une fenêtre.
 *
 * Une rangée de capsules sous le titre — la choisie pleine, comme le
 * sélecteur 1 / 10 / Tout — et, dessous, une page par onglet. Les pages
 * sont empilées dans la même case de grille : la fenêtre prend la hauteur
 * de la plus haute et ne saute pas d'un onglet à l'autre ; celle qu'on ne
 * montre pas reste là, invisible et inerte.
 *
 * Elle ne sait rien de ce qu'elle montre : la fenêtre d'un bâtiment y range
 * « Bâtiment » et « Inventaire », celle d'un habitant ou d'un ennemi y
 * rangera les siens. Un onglet qui n'a rien à montrer s'efface
 * (`setAvailable`) ; s'il n'en reste qu'un, la rangée aussi. Un balayage
 * horizontal sur la page, ou les flèches du clavier sur la rangée, passe à
 * l'onglet voisin.
 */

/** Un onglet : son id et sa petite icône. Son libellé se pose avec `setLabel`, il suit la langue. */
export interface TabSpec<Id extends string> {
  id: Id;
  icon: HTMLElement;
}

/** Distance horizontale (px) à partir de laquelle un glissé change d'onglet. */
const SWIPE_PX = 48;

let nextUid = 0;

interface Tab {
  button: HTMLButtonElement;
  label: Text;
  page: HTMLElement;
  available: boolean;
}

export class PanelTabs<Id extends string> {
  /** La rangée d'onglets. */
  public readonly bar: HTMLElement;
  /** Les pages, empilées. */
  public readonly pages: HTMLElement;

  private readonly tabs = new Map<Id, Tab>();
  private readonly order: Id[];
  private current: Id;
  private readonly onChange: (id: Id) => void;

  public constructor(specs: readonly [TabSpec<Id>, ...TabSpec<Id>[]], onChange: (id: Id) => void = () => {}) {
    const uid = nextUid++;

    this.onChange = onChange;
    this.bar = document.createElement('div');
    this.bar.className = 'panel-tabs';
    this.bar.setAttribute('role', 'tablist');
    this.pages = document.createElement('div');
    this.pages.className = 'panel-tab-pages';
    this.order = specs.map(({ id }) => id);
    this.current = specs[0].id;

    for (const { id, icon } of specs) {
      const button = document.createElement('button');
      const page = document.createElement('div');
      const label = document.createTextNode('');
      const buttonId = `panel-tab-${uid}-${id}`;

      button.type = 'button';
      button.id = buttonId;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `${buttonId}-page`);
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon, label);
      button.addEventListener('click', () => this.select(id));
      page.id = `${buttonId}-page`;
      page.className = 'panel-tab-page';
      page.setAttribute('role', 'tabpanel');
      page.setAttribute('aria-labelledby', buttonId);
      this.bar.append(button);
      this.pages.append(page);
      this.tabs.set(id, { button, label, page, available: true });
    }

    this.bar.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      this.step(event.key === 'ArrowRight' ? 1 : -1);
      this.tab(this.current).button.focus();
    });
    this.listenSwipe();
    this.render();
  }

  /** L'onglet ouvert. */
  public get selected(): Id {
    return this.current;
  }

  /** La page d'un onglet, à remplir. */
  public page(id: Id): HTMLElement {
    return this.tab(id).page;
  }

  public setLabel(id: Id, text: string): void {
    this.tab(id).label.data = text;
  }

  public setIcon(id: Id, icon: HTMLElement): void {
    const { button } = this.tab(id);

    icon.setAttribute('aria-hidden', 'true');
    button.firstElementChild?.replaceWith(icon);
  }

  /** Ouvre un onglet ; un onglet effacé ne s'ouvre pas. */
  public select(id: Id): void {
    if (!this.tab(id).available || id === this.current) return;
    this.current = id;
    this.render();
    this.onChange(id);
  }

  /** Montre ou efface un onglet. Si c'était l'onglet ouvert, on revient au premier. */
  public setAvailable(id: Id, available: boolean): void {
    const tab = this.tab(id);

    if (tab.available === available) return;
    tab.available = available;
    if (!available && id === this.current) this.current = this.order.find((other) => this.tab(other).available) ?? this.order[0]!;
    this.render();
  }

  /** L'onglet voisin, dans l'ordre, sans boucler. */
  private step(delta: number): void {
    const open = this.order.filter((id) => this.tab(id).available);
    const next = open[open.indexOf(this.current) + delta];

    if (next !== undefined) this.select(next);
  }

  private render(): void {
    let shown = 0;

    for (const [id, { button, page, available }] of this.tabs) {
      const active = id === this.current;

      button.hidden = !available;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      page.dataset['active'] = String(active);
      // Un onglet effacé ne compte pas dans la hauteur ; celui qu'on ne montre pas est inerte.
      page.hidden = !available;
      page.inert = !active;
      if (available) shown++;
    }
    this.bar.hidden = shown < 2;
  }

  /**
   * Un glissé horizontal sur les pages change d'onglet. Le tap qui le
   * termine ne doit pas, en plus, déplacer un objet de la zone d'échange.
   */
  private listenSwipe(): void {
    let start: { id: number; x: number; y: number } | null = null;

    this.pages.addEventListener('pointerdown', (event) => {
      start = event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    });
    this.pages.addEventListener('pointercancel', () => {
      start = null;
    });
    this.pages.addEventListener('pointerup', (event) => {
      if (!start || event.pointerId !== start.id || this.bar.hidden) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;

      start = null;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      this.step(dx < 0 ? 1 : -1);
      // Le clic qui suit ce relâché est avalé, une fois.
      const swallow = (click: Event): void => {
        click.stopPropagation();
        click.preventDefault();
      };

      this.pages.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => this.pages.removeEventListener('click', swallow, { capture: true }), 0);
    });
  }

  private tab(id: Id): Tab {
    const tab = this.tabs.get(id);

    if (!tab) throw new Error(`onglet inconnu : ${id}`);
    return tab;
  }
}
