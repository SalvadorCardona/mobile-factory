/**
 * L'éditeur de personnage : la garde-robe d'Adam.
 *
 * Il s'ouvre au bouton posé sur le sac — le visage d'Adam tel qu'il est
 * habillé, une pastille quand une pièce vient d'être trouvée — ou au
 * « Essayer » du toast d'une trouvaille. Plein écran, il arrête l'horloge
 * comme les réglages (`main.ts` lit `open`).
 *
 * Au milieu, Adam en pied qui marche sur place (un corps, deux pieds : les
 * mêmes calques qu'en jeu, `art/adamLook.ts`), qu'on fait tourner. Dessous,
 * un onglet par emplacement, sur deux rangées — pas de défilement de côté —,
 * puis les pièces de l'onglet en grosses cartes : Adam qui la porte, cadré
 * sur elle, son bord à la couleur de sa rareté. Une pièce pas encore trouvée
 * est une silhouette au cadenas ; un tap dit où la chercher. Une pièce
 * trouvée porte « Nouveau » — et son onglet une pastille — jusqu'à ce qu'on
 * ouvre son onglet (`seePieces`, `Player.unseenPieces` : la marque survit à
 * un rechargement). Un emplacement coloré a son nuancier.
 *
 * Rien ne change avant « Valider » : l'éditeur tient un brouillon, et pousse
 * la commande `dressAdam` ; « Annuler », la croix, Échap ou un tap sur le
 * voile le jettent.
 */

import { ADAM_STRIDE, adamFace, adamLookParts, pieceThumbnail } from '../art/adamLook.ts';
import type { Tone } from '../data/artDirection.ts';
import { LOOK_COLORS, LOOK_SLOTS, PIECES, PIECE_IDS, copyLook, piecesOf, sameLook, type ColorSlot, type Look, type LookSlot, type PieceId } from '../data/wardrobe.ts';
import { onLocale, t } from '../i18n/locale.ts';
import { owns } from '../sim/wardrobe.ts';
import type { World } from '../sim/world.ts';
import { uiIcon } from './icons.ts';

/** L'emplacement dont le nuancier sert à un onglet : la barbe prend la couleur des cheveux. */
const COLOR_OF: Partial<Record<LookSlot, ColorSlot>> = { eyes: 'eyes', hair: 'hair', beard: 'hair', top: 'top' };

/** Les vues de l'aperçu, dans l'ordre du bouton « Tourner » : face, profil droit, dos, profil gauche. */
const TURNS = ['down', 'side', 'up', 'left'] as const;

type Turn = (typeof TURNS)[number];

/** Taille d'affichage d'un pixel du sprite dans l'aperçu, et côté d'une vignette. */
const PREVIEW_SCALE = 4;
const THUMB_SIZE = 64;

export interface WardrobeActions {
  /** Ouvert ou fermé : l'horloge s'arrête, le son de fenêtre joue. */
  onToggle(open: boolean): void;
}

export class WardrobePanel {
  public readonly root: HTMLElement;
  /** Le bouton posé au-dessus du sac : le visage d'Adam. */
  public readonly button: HTMLButtonElement;

  private readonly world: World;
  private readonly actions: WardrobeActions;
  private readonly title: HTMLElement;
  private readonly count: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly figure: HTMLElement;
  private readonly body: HTMLImageElement;
  private readonly feet: [HTMLImageElement, HTMLImageElement];
  private readonly turnButton: HTMLButtonElement;
  private readonly tabs = new Map<LookSlot, HTMLButtonElement>();
  private readonly colorTitle: HTMLElement;
  private readonly swatches: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly validateButton: HTMLButtonElement;
  private readonly face: HTMLImageElement;

  private draft: Look;
  private slot: LookSlot = LOOK_SLOTS[0];
  private turn: Turn = 'down';
  /**
   * Les pièces dont l'éditeur a déjà dit qu'elles étaient vues (`seePieces`) :
   * la commande attend le tick, l'éditeur n'attend pas.
   */
  private readonly sent = new Set<PieceId>();
  /** Celles qu'on regarde depuis l'ouverture : elles gardent leur « Nouveau » jusqu'à la fermeture. */
  private readonly shown = new Set<PieceId>();

  public constructor(world: World, actions: WardrobeActions) {
    this.world = world;
    this.actions = actions;
    this.draft = copyLook(world.player.look);

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'hud-button hud-wardrobe';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.face = document.createElement('img');
    this.face.className = 'hud-wardrobe-face';
    this.face.alt = '';
    this.face.setAttribute('aria-hidden', 'true');
    this.button.append(this.face);
    this.button.addEventListener('click', () => this.toggle());

    this.root = document.createElement('div');
    this.root.className = 'overlay wardrobe-screen';
    this.root.hidden = true;
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });

    const panel = document.createElement('div');

    panel.className = 'panel overlay-panel wardrobe-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const head = document.createElement('div');

    head.className = 'settings-head wardrobe-head';
    this.title = document.createElement('h2');
    this.title.className = 'overlay-title';
    this.title.id = 'wardrobe-title';
    panel.setAttribute('aria-labelledby', this.title.id);
    this.count = document.createElement('span');
    this.count.className = 'wardrobe-count';
    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'building-panel-close';
    this.closeButton.append(uiIcon('close'));
    this.closeButton.addEventListener('click', () => this.close());
    head.append(this.title, this.count, this.closeButton);

    // L'aperçu : deux pieds et un corps superposés, que le CSS fait marcher sur place.
    const stage = document.createElement('div');

    stage.className = 'wardrobe-stage';
    this.figure = document.createElement('div');
    this.figure.className = 'wardrobe-figure';
    this.feet = [this.layer('wardrobe-foot wardrobe-foot-left'), this.layer('wardrobe-foot wardrobe-foot-right')];
    this.body = this.layer('wardrobe-body');
    this.figure.append(...this.feet, this.body);
    this.turnButton = document.createElement('button');
    this.turnButton.type = 'button';
    this.turnButton.className = 'button-secondary wardrobe-turn';
    this.turnButton.addEventListener('click', () => {
      this.turn = TURNS[(TURNS.indexOf(this.turn) + 1) % TURNS.length]!;
      this.renderFigure();
    });
    stage.append(this.figure, this.turnButton);

    const controls = document.createElement('div');

    controls.className = 'wardrobe-controls';

    const tabs = document.createElement('div');

    tabs.className = 'wardrobe-tabs';
    tabs.setAttribute('role', 'tablist');
    for (const slot of LOOK_SLOTS) {
      const tab = document.createElement('button');

      tab.type = 'button';
      tab.className = 'wardrobe-tab';
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => {
        this.slot = slot;
        this.renderSlot();
      });
      this.tabs.set(slot, tab);
      tabs.append(tab);
    }

    this.colorTitle = document.createElement('h3');
    this.colorTitle.className = 'settings-label wardrobe-color-title';
    this.swatches = document.createElement('div');
    this.swatches.className = 'wardrobe-swatches';
    this.swatches.setAttribute('role', 'radiogroup');
    this.grid = document.createElement('div');
    this.grid.className = 'wardrobe-grid';
    this.grid.setAttribute('role', 'tabpanel');
    this.hint = document.createElement('p');
    this.hint.className = 'wardrobe-hint';
    this.hint.setAttribute('aria-live', 'polite');
    controls.append(tabs, this.grid, this.colorTitle, this.swatches, this.hint);

    const footer = document.createElement('div');

    footer.className = 'wardrobe-footer';
    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'button-secondary';
    this.cancelButton.addEventListener('click', () => this.close());
    this.validateButton = document.createElement('button');
    this.validateButton.type = 'button';
    this.validateButton.className = 'button-primary';
    this.validateButton.addEventListener('click', () => this.validate());
    footer.append(this.cancelButton, this.validateButton);

    panel.append(head, stage, controls, footer);
    this.root.append(panel);

    world.events.on('pieceFound', () => {
      this.renderBadge();
      if (this.open) this.render();
    });
    world.events.on('lookChanged', () => this.renderFace());

    onLocale(() => {
      const text = t().wardrobe;

      this.title.textContent = text.title;
      this.turnButton.textContent = text.turn;
      this.cancelButton.textContent = text.cancel;
      this.validateButton.textContent = text.validate;
      this.closeButton.setAttribute('aria-label', t().common.close);
      this.button.setAttribute('aria-label', text.open);
      this.button.dataset['tip'] = text.open;
      for (const [slot, tab] of this.tabs) tab.textContent = text.slots[slot];
      this.render();
    });
    this.renderFace();
    this.renderBadge();
  }

  public get open(): boolean {
    return !this.root.hidden;
  }

  /** Ouvre l'éditeur, sur l'onglet `slot` s'il est donné : le brouillon repart de ce qu'Adam porte. */
  public show(slot?: LookSlot): void {
    if (slot) this.slot = slot;
    this.draft = copyLook(this.world.player.look);
    this.turn = 'down';
    this.root.hidden = false;
    this.render();
    this.actions.onToggle(true);
    this.validateButton.focus({ preventScroll: true });
  }

  public close(): void {
    if (!this.open) return;
    this.root.hidden = true;
    // Ce qu'on vient de voir n'est plus nouveau ; les onglets qu'on n'a pas ouverts gardent le leur.
    this.shown.clear();
    this.renderBadge();
    this.actions.onToggle(false);
  }

  public toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  private validate(): void {
    if (!sameLook(this.draft, this.world.player.look)) this.world.push({ type: 'dressAdam', look: copyLook(this.draft) });
    this.close();
  }

  private layer(className: string): HTMLImageElement {
    const image = document.createElement('img');

    image.className = className;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    return image;
  }

  private render(): void {
    if (!this.open) return;

    const owned = PIECE_IDS.filter((piece) => owns(this.world.player.wardrobe, piece)).length;

    this.count.textContent = t().wardrobe.owned(owned, PIECE_IDS.length);
    this.renderFigure();
    this.renderSlot();
  }

  /** L'aperçu : les calques du brouillon, dans la vue choisie. */
  private renderFigure(): void {
    const parts = adamLookParts(this.draft);
    const view = this.turn === 'left' ? 'side' : this.turn;
    const spread = (view === 'side' ? ADAM_STRIDE.side : ADAM_STRIDE.front) * PREVIEW_SCALE;

    this.body.src = dataUrl(parts[view]);
    for (const foot of this.feet) foot.src = dataUrl(parts.foot);
    this.figure.style.setProperty('--spread', `${spread}px`);
    this.figure.dataset['view'] = this.turn;
    this.figure.setAttribute('role', 'img');
    this.figure.setAttribute('aria-label', t().wardrobe.title);
  }

  /** L'onglet courant : ses pièces, son nuancier. */
  private renderSlot(): void {
    const text = t().wardrobe;

    // Les pièces nouvelles de l'onglet ouvert sont vues : elles gardent leur marque jusqu'à la fermeture.
    const seen = piecesOf(this.slot).filter((piece) => this.unseen(piece));

    for (const piece of seen) this.shown.add(piece);
    if (seen.length > 0) {
      for (const piece of seen) this.sent.add(piece);
      this.world.push({ type: 'seePieces', pieces: seen });
    }

    for (const [slot, tab] of this.tabs) {
      tab.setAttribute('aria-selected', String(slot === this.slot));
      tab.dataset['new'] = String(piecesOf(slot).some((piece) => this.unseen(piece)));
    }

    this.grid.replaceChildren(...piecesOf(this.slot).map((piece) => this.card(piece)));
    this.hint.textContent = '';

    const colorSlot = COLOR_OF[this.slot];

    this.colorTitle.hidden = this.swatches.hidden = colorSlot === undefined;
    if (colorSlot === undefined) {
      this.swatches.replaceChildren();
      return;
    }
    this.colorTitle.textContent = text.colorOf[colorSlot];
    this.swatches.replaceChildren(
      ...(LOOK_COLORS[colorSlot] as readonly Tone[]).map((tone) => {
        const swatch = document.createElement('button');

        swatch.type = 'button';
        swatch.className = 'wardrobe-swatch';
        swatch.setAttribute('role', 'radio');
        swatch.setAttribute('aria-checked', String(this.draft.colors[colorSlot] === tone));
        swatch.setAttribute('aria-label', text.tones[tone]);
        swatch.dataset['tip'] = text.tones[tone];
        swatch.style.setProperty('--swatch', `var(--${tone})`);
        swatch.style.setProperty('--swatch-shade', `var(--${tone}-shade)`);
        swatch.addEventListener('click', () => {
          this.draft.colors[colorSlot] = tone;
          this.renderFigure();
          this.renderSlot();
        });
        return swatch;
      }),
    );
  }

  /** La carte d'une pièce : Adam qui la porte ; verrouillée, sa silhouette et un cadenas. */
  private card(piece: PieceId): HTMLButtonElement {
    const text = t().wardrobe;
    const proto = PIECES[piece];
    const unlocked = owns(this.world.player.wardrobe, piece);
    const card = document.createElement('button');
    const thumb = document.createElement(unlocked ? 'img' : 'span');
    const name = document.createElement('span');

    card.type = 'button';
    card.className = 'wardrobe-card';
    card.dataset['rarity'] = proto.rarity;
    card.dataset['locked'] = String(!unlocked);
    card.setAttribute('aria-pressed', String(this.draft.pieces[proto.slot] === piece));
    thumb.className = 'wardrobe-thumb';
    thumb.setAttribute('aria-hidden', 'true');

    const url = dataUrl(pieceThumbnail(this.draft, proto.slot, piece, THUMB_SIZE));

    // Verrouillée, la pièce n'est qu'une silhouette : sa vignette sert de masque à un aplat de la palette.
    if (thumb instanceof HTMLImageElement) {
      thumb.alt = '';
      thumb.src = url;
    } else {
      thumb.style.setProperty('--silhouette', `url("${url}")`);
    }
    name.className = 'wardrobe-name';
    name.textContent = unlocked ? t().pieces[piece] : text.locked;
    card.append(thumb, name);

    if (!unlocked) {
      const lock = uiIcon('lock', 22);

      lock.classList.add('wardrobe-lock');
      card.append(lock);
      card.setAttribute('aria-label', `${text.locked} — ${text.rarities[proto.rarity]}`);
    } else {
      card.setAttribute('aria-label', `${t().pieces[piece]} — ${text.rarities[proto.rarity]}`);
    }
    if (proto.rarity !== 'common') {
      const rarity = document.createElement('span');

      rarity.className = 'wardrobe-rarity';
      rarity.textContent = text.rarities[proto.rarity];
      card.append(rarity);
    }
    if (this.shown.has(piece)) {
      const badge = document.createElement('span');

      badge.className = 'wardrobe-new';
      badge.textContent = text.new;
      card.append(badge);
    }

    card.addEventListener('click', () => {
      if (!unlocked) {
        this.hint.textContent = text.lockedHint;
        return;
      }
      this.draft.pieces[proto.slot] = piece;
      this.renderFigure();
      this.renderSlot();
    });
    return card;
  }

  /** Une pièce trouvée que l'éditeur n'a pas encore montrée. */
  private unseen(piece: PieceId): boolean {
    return this.world.player.unseenPieces.includes(piece) && !this.sent.has(piece);
  }

  /** La pastille du bouton : une pièce trouvée attend d'être regardée. */
  private renderBadge(): void {
    if (this.world.player.unseenPieces.some((piece) => this.unseen(piece))) this.button.dataset['new'] = 'true';
    else delete this.button.dataset['new'];
  }

  /** Le visage d'Adam sur son bouton, tel qu'il est habillé. */
  private renderFace(): void {
    this.face.src = dataUrl(adamFace(this.world.player.look, 46));
  }
}

function dataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}
