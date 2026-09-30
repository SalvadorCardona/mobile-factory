/**
 * HUD.
 *
 * Du DOM au-dessus du canvas, pas du texte Pixi : sur mobile le texte système
 * est net à toutes les densités, se met à l'échelle avec les réglages
 * d'accessibilité, et ne coûte pas un atlas de police.
 *
 * Le HUD **lit** le monde et s'abonne à ses événements. Il ne le modifie
 * jamais — c'est le rôle des commandes.
 *
 * Ce qu'il montre :
 * - la **quête** en haut : le chantier de la mairie avec une barre par
 *   ressource, puis la santé de la mairie, la vague et son compte à rebours ;
 * - un **conseil** sous la quête, qui suit ce que fait le joueur (couper,
 *   casser, livrer, construire, se défendre) et se tait quand il a compris ;
 * - le **sac** d'Adam, à droite ;
 * - des **bulles** empilées pour les événements, et des gains qui flottent
 *   au-dessus de la tête d'Adam ;
 * - l'écran de **défaite**, avec le bilan de la partie ;
 * - les statistiques de debug, seulement avec `?debug` (ou la touche `²`/`` ` ``).
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { LORE } from '../data/lore.ts';
import type { AtlasStats } from '../render/spriteLibrary.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import type { EntityId } from '../sim/types.ts';
import { TICKS_PER_SECOND, siteMissing, type World } from '../sim/world.ts';
import { tutorialHint } from './hint.ts';
import { itemAmount, itemIcon, uiIcon } from './icons.ts';

const REJECTION_LABELS: Record<PlacementRejection, string> = {
  occupied: 'Emplacement déjà occupé',
  terrain: 'Terrain non constructible',
  outOfReach: 'Trop loin — rapprochez-vous',
  resource: 'Dégagez d’abord les arbres et rochers',
  onPlayer: 'Vous êtes sur l’emplacement',
};

/** Durée de vie d'un gain flottant, en ms (cf. `hud-float-up` dans le CSS). */
const FLOAT_MS = 1000;

/** Durée d'affichage d'une bulle, et combien peuvent s'empiler. */
const TOAST_MS = 2600;
const MAX_TOASTS = 3;

/** Sous ce seuil, le compte à rebours de la vague passe au rouge. */
const WAVE_WARNING_SECONDS = 10;

type ToastTone = 'info' | 'good' | 'bad';

/** Projette un point monde en pixels écran — fourni par le renderer, via `main.ts`. */
export type Projector = (x: number, y: number) => { x: number; y: number };

export class Hud {
  public readonly root: HTMLElement;

  private readonly top: HTMLElement;
  private readonly quest: HTMLElement;
  private readonly questTitle: HTMLElement;
  private readonly questBody: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly bag: HTMLElement;
  private readonly floats: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly defeat: HTMLElement;
  private readonly defeatStats: HTMLElement;
  public readonly audioButton: HTMLButtonElement;
  public readonly pauseButton: HTMLButtonElement;
  private lastBag = '';
  private lastQuest = '';
  private lastHint = '';
  private debug: boolean;

  /** Ce que le joueur a déjà fait : un conseil compris ne revient pas. */
  private harvestedWood = false;
  private harvestedStone = false;
  private delivered = false;

  private project: Projector = (x, y) => ({ x, y });
  private inspected: () => EntityId | null = () => null;

  private readonly world: World;

  public constructor(world: World, debug = false) {
    this.world = world;
    this.debug = debug;
    this.root = element('div', 'hud');

    this.quest = element('div', 'panel hud-quest');
    this.questTitle = element('div', 'hud-quest-title');
    this.questBody = element('div', 'hud-quest-body');
    this.quest.append(this.questTitle, this.questBody);

    this.hint = element('div', 'hud-hint');
    this.hint.hidden = true;
    this.hintText = element('span', 'hud-hint-text');
    this.hint.append(uiIcon('hint', 22), this.hintText);

    this.bag = element('div', 'panel hud-bag');
    this.floats = element('div', 'hud-floats');
    this.stats = element('div', 'panel hud-stats');
    this.stats.hidden = !debug;
    this.toasts = element('div', 'hud-toasts');
    this.toasts.setAttribute('aria-live', 'polite');
    this.countdown = element('div', 'hud-countdown');

    const buttons = element('div', 'hud-buttons');

    this.pauseButton = element('button', 'hud-button hud-pause');
    this.pauseButton.type = 'button';
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.append(uiIcon('pause'));

    this.audioButton = element('button', 'hud-button hud-audio');
    this.audioButton.type = 'button';
    this.audioButton.setAttribute('aria-label', 'Son');
    buttons.append(this.pauseButton, this.audioButton);

    this.defeat = element('div', 'overlay hud-defeat');
    this.defeat.hidden = true;

    const defeatPanel = element('div', 'panel overlay-panel');
    const defeatTitle = element('h2', 'overlay-title');
    const defeatText = element('p', 'overlay-text');
    const retry = element('button', 'button-primary');

    this.defeatStats = element('dl', 'overlay-stats');
    defeatTitle.textContent = `La ${LORE.buildings.townHall.name.toLowerCase()} est tombée`;
    defeatText.textContent = 'Les mutants ont eu raison du premier toit de la colonie.';
    retry.type = 'button';
    retry.textContent = 'Recommencer';
    retry.addEventListener('click', () => window.location.reload());
    defeatPanel.append(defeatTitle, defeatText, this.defeatStats, retry);
    this.defeat.append(defeatPanel);

    // Le haut de l'écran se met en page tout seul : la quête, son conseil
    // dessous, puis les boutons et le sac. Rien ne se chevauche, quelle que
    // soit la longueur du conseil ou la taille de la police.
    this.top = element('div', 'hud-top');

    const row = element('div', 'hud-top-row');

    this.quest.append(this.hint);
    row.append(buttons, this.bag);
    this.top.append(this.quest, row);

    this.root.append(
      this.top,
      this.countdown,
      this.toasts,
      this.floats,
      this.stats,
      this.defeat,
    );

    world.events.on('placementRejected', ({ reason }) => this.notify(REJECTION_LABELS[reason], 'bad'));
    world.events.on('resourceHarvested', ({ item }) => {
      if (item === 'wood') this.harvestedWood = true;
      if (item === 'stone') this.harvestedStone = true;
      this.float(item, 1);
    });
    world.events.on('siteDelivered', ({ item, amount }) => {
      this.delivered = true;
      this.float(item, -amount);
    });
    world.events.on('siteReady', () => this.notify('Chantier livré — appuyez sur Construire', 'good'));
    world.events.on('siteRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'nothingToGive') this.notify('Rien dans le sac que ce chantier attende', 'bad');
    });
    world.events.on('storeTaken', ({ item, amount }) => this.float(item, amount));
    world.events.on('takeRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'empty') this.notify('Le coffre est vide', 'bad');
      if (reason === 'bagFull') this.notify('Sac plein — rien à prendre de plus', 'bad');
    });
    world.events.on('inventoryFull', () => this.notify('Sac plein — allez livrer le chantier', 'bad'));
    world.events.on('buildingCompleted', ({ id }) => {
      const entity = world.entities.get(id);

      if (entity) this.notify(`${BUILDINGS[entity.proto].label} : construction terminée`, 'good');
    });
    world.events.on('waveCountdown', ({ seconds }) => this.showCountdown(String(seconds)));
    world.events.on('waveStarted', ({ wave, count }) =>
      this.notify(`Vague ${wave} — ${count} mutant${count > 1 ? 's' : ''} en approche !`, 'bad'),
    );
    world.events.on('buildingDestroyed', ({ proto }) => this.notify(`${BUILDINGS[proto].label} détruite`, 'bad'));
    world.events.on('childBorn', () => this.notify('Un enfant est né à la nurserie !', 'good'));
    world.events.on('townHallDestroyed', () => this.showDefeat());
    world.events.on('beastDied', ({ loot }) => {
      if (loot) this.float(loot, 1);
    });
    world.events.on('playerKnockedOut', () => this.notify('Adam s’est évanoui — il se réveille à la mairie', 'bad'));
  }

  /** Le renderer sait où est Adam à l'écran ; le HUD non. `main.ts` fait le lien. */
  public setProjector(project: Projector): void {
    this.project = project;
  }

  /** Le bâtiment dont la fenêtre est ouverte : le conseil qui invite à le taper se tait. */
  public setInspected(inspected: () => EntityId | null): void {
    this.inspected = inspected;
  }

  /** Bas de la quête, en pixels écran : les repères de bord du renderer restent dessous. */
  public topInset(): number {
    return this.quest.getBoundingClientRect().bottom;
  }

  public toggleDebug(): void {
    this.debug = !this.debug;
    this.stats.hidden = !this.debug;
  }

  /** L'icône du bouton son suit l'état du moteur audio. */
  public setMuted(muted: boolean): void {
    this.audioButton.replaceChildren(uiIcon(muted ? 'soundOff' : 'soundOn'));
    this.audioButton.dataset['muted'] = String(muted);
  }

  /** Une bulle empilée ; la plus ancienne part quand il y en a trop. */
  public notify(message: string, tone: ToastTone = 'info'): void {
    // Deux fois le même message d'affilée : on relance la bulle au lieu d'en empiler une deuxième.
    const last = this.toasts.lastElementChild as HTMLElement | null;

    if (last?.textContent === message && last.dataset['leaving'] !== 'true') {
      last.style.animation = 'none';
      void last.offsetWidth;
      last.style.animation = '';
      return;
    }

    const toast = element('div', 'hud-toast');

    toast.textContent = message;
    toast.dataset['tone'] = tone;
    this.toasts.append(toast);

    while (this.toasts.childElementCount > MAX_TOASTS) this.toasts.firstElementChild?.remove();

    window.setTimeout(() => {
      toast.dataset['leaving'] = 'true';
      window.setTimeout(() => toast.remove(), 240);
    }, TOAST_MS);
  }

  /** Un chiffre géant au centre, qui frappe et s'efface — le rythme de l'alarme. */
  private showCountdown(label: string): void {
    this.countdown.textContent = label;
    this.countdown.style.animation = 'none';
    void this.countdown.offsetWidth;
    this.countdown.style.animation = '';
  }

  /** Une icône et un delta qui montent de la tête d'Adam et s'effacent. */
  private float(item: ItemId, delta: number): void {
    const { player } = this.world;
    const { x, y } = this.project(player.x, player.y - 44);
    const floater = element('span', 'hud-float');

    floater.dataset['out'] = String(delta < 0);
    floater.style.left = `${Math.round(x + (Math.random() - 0.5) * 18)}px`;
    floater.style.top = `${Math.round(y)}px`;
    floater.append(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, itemIcon(item, 18));
    this.floats.append(floater);
    window.setTimeout(() => floater.remove(), FLOAT_MS);
  }

  /** `fps`, `chunks` et `atlas` viennent du renderer : le monde ne les connaît pas. */
  public update(fps: number, chunks: number, atlas: AtlasStats): void {
    this.updateQuest();
    this.updateHint();
    this.updateBag();
    this.root.dataset['danger'] = String(this.mutantCount() > 0 && !this.world.defeated);

    if (this.debug) this.updateStats(fps, chunks, atlas);
  }

  private mutantCount(): number {
    let count = 0;

    for (const mobile of this.world.mobiles.values()) {
      if (mobile.kind === 'mutant') count += 1;
    }
    return count;
  }

  /* ----------------------------------------------------------------- quête */

  private updateQuest(): void {
    const { world } = this;
    const hall = world.entities.get(world.townHallId);
    const name = LORE.buildings.townHall.name;
    let key: string;

    if (hall?.kind === 'site') {
      key = `site:${JSON.stringify(hall.delivered)}`;
      if (key === this.lastQuest) return;
      this.lastQuest = key;

      const cost = Object.entries(BUILDINGS[hall.proto].cost) as [ItemId, number][];
      const ready = siteMissing(hall) === 0;

      this.quest.dataset['mode'] = ready ? 'ready' : 'build';
      this.questTitle.textContent = ready ? 'Chantier livré' : 'Objectif';
      this.questBody.replaceChildren(
        text('hud-quest-goal', ready ? `Tapez la ${name.toLowerCase()} → Construire` : `Bâtir la ${name}`),
        ...cost.map(([item, needed]) => meter(item, hall.delivered[item] ?? 0, needed)),
      );
      return;
    }

    if (!hall) {
      key = 'fallen';
      if (key === this.lastQuest) return;
      this.lastQuest = key;
      this.quest.dataset['mode'] = 'fallen';
      this.questTitle.textContent = 'Défaite';
      this.questBody.replaceChildren(text('hud-quest-goal', `La ${name.toLowerCase()} est tombée.`));
      return;
    }

    const max = BUILDINGS[hall.proto].hp;
    const mutants = this.mutantCount();
    const seconds = Math.max(0, Math.ceil((world.nextWaveTick - world.tickCount) / TICKS_PER_SECOND));
    const { children, workers } = world.population();
    const people = 1 + children;
    const status =
      mutants > 0
        ? `Vague ${world.wave} · ${mutants} mutant${mutants > 1 ? 's' : ''}`
        : `Vague ${world.wave + 1} dans ${clock(seconds)}`;

    key = `hall:${hall.hp}:${status}:${people}:${workers}:${world.kills}`;
    if (key === this.lastQuest) return;
    this.lastQuest = key;

    this.quest.dataset['mode'] = mutants > 0 ? 'wave' : 'defend';
    this.questTitle.textContent = mutants > 0 ? 'Attaque !' : 'Défendre la colonie';

    const hp = element('div', 'hud-meter hud-meter-hp');
    const hpLabel = text('hud-meter-label', name);

    hpLabel.prepend(uiIcon('heart', 18));
    const hpBar = bar(hall.hp / max);
    const hpValue = text('hud-meter-value', `${hall.hp}/${max}`);

    hp.dataset['low'] = String(hall.hp / max < 0.35);
    hp.append(hpLabel, hpBar, hpValue);

    const line = element('div', 'hud-quest-line');
    const wave = text('hud-quest-wave', status);

    wave.dataset['urgent'] = String(mutants > 0 || seconds <= WAVE_WARNING_SECONDS);
    line.append(wave, chip('people', people + workers, 'Habitants'), chip('mutant', world.kills, 'Mutants abattus'));
    this.questBody.replaceChildren(hp, line);
  }

  /* --------------------------------------------------------------- conseil */

  /** Le conseil sous la quête, cf. `hint.ts`. */
  private currentHint(): string | null {
    const { world } = this;
    const towers = [...world.entities.values()].some((entity) => entity.kind === 'tower');

    return tutorialHint(
      world,
      {
        harvestedWood: this.harvestedWood,
        harvestedStone: this.harvestedStone,
        delivered: this.delivered,
        inspected: this.inspected(),
      },
      towers,
      this.mutantCount(),
    );
  }

  private updateHint(): void {
    const hint = this.currentHint() ?? '';

    if (hint === this.lastHint) return;
    this.lastHint = hint;
    this.hint.hidden = hint === '';
    this.hintText.textContent = hint;

    // Relance l'animation d'entrée à chaque nouveau conseil.
    this.hint.style.animation = 'none';
    void this.hint.offsetWidth;
    this.hint.style.animation = '';
  }

  /* ------------------------------------------------------------------- sac */

  /**
   * Le sac : une ligne « icône + quantité » par objet. Le DOM n'est reconstruit
   * que si le contenu change — comparer une clé texte coûte moins qu'un diff.
   */
  private updateBag(): void {
    const { inventory } = this.world.player;
    const entries = inventory.entries();
    const key = `${inventory.total()}/${inventory.capacity}|${entries.map(([item, amount]) => `${item}:${amount}`).join(',')}`;

    if (key === this.lastBag) return;
    this.lastBag = key;

    const title = element('div', 'hud-bag-title');
    const fill = element('div', 'hud-bag-fill');
    const ratio = inventory.total() / inventory.capacity;

    title.append(text('', 'Sac'), text('hud-bag-count', `${inventory.total()}/${inventory.capacity}`));
    title.dataset['full'] = String(inventory.freeSpace() <= 0);
    fill.style.setProperty('--fill', `${Math.round(ratio * 100)}%`);
    fill.dataset['full'] = String(inventory.freeSpace() <= 0);

    const items = element('div', 'hud-bag-items');

    items.append(...entries.map(([item, amount]) => itemAmount(item, amount)));
    this.bag.dataset['empty'] = String(entries.length === 0);
    this.bag.replaceChildren(title, fill, items);
  }

  /* ---------------------------------------------------------------- défaite */

  private showDefeat(): void {
    const { world } = this;
    const survived = Math.floor((world.defeatTick || world.tickCount) / TICKS_PER_SECOND);
    const rows: [string, string][] = [
      ['Vagues repoussées', String(Math.max(0, world.wave - 1))],
      ['Mutants abattus', String(world.kills)],
      ['Temps tenu', clock(survived)],
    ];

    this.defeatStats.replaceChildren(
      ...rows.flatMap(([label, value]) => [text('', label, 'dt'), text('', value, 'dd')]),
    );
    this.defeat.hidden = false;
  }

  /* ------------------------------------------------------------------ debug */

  private updateStats(fps: number, chunks: number, atlas: AtlasStats): void {
    const { cx, cy } = this.world.playerChunk();
    const lines = [
      `tick ${this.world.tickCount}   ${fps.toFixed(0)} fps   seed ${this.world.seed}`,
      `chunk ${cx},${cy}   ${chunks} blocs de sol   ${this.world.resources.size()} tuiles entamées`,
      `atlas ${atlas.images} images → ${atlas.pages} texture(s), ${atlas.megapixels.toFixed(1)} Mpx @${atlas.resolution}x, ${atlas.ms} ms`,
      `${this.world.entities.size} bâtiment(s)   ${this.world.mobiles.size} mobile(s)   ${this.world.pendingWakes()} réveil(s)`,
    ];

    for (const entity of this.world.entities.values()) {
      if (entity.kind === 'site') continue;

      const contents = entity.store
        .entries()
        .map(([item, amount]) => `${ITEMS[item].label} ${amount}`)
        .join(', ');
      const stopped = entity.kind === 'drill' && entity.blocked ? ' — arrêtée' : '';

      lines.push(`#${entity.id} ${BUILDINGS[entity.proto].label} : ${contents || 'vide'}${stopped}`);
    }

    this.stats.textContent = lines.join('\n');
  }

  public destroy(): void {
    this.root.remove();
  }
}

/* ------------------------------------------------------------------ outils */

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  return node;
}

function text(className: string, content: string, tag: keyof HTMLElementTagNameMap = 'span'): HTMLElement {
  const node = element(tag, className);

  node.textContent = content;
  return node;
}

function bar(ratio: number): HTMLElement {
  const track = element('div', 'hud-bar');
  const fill = element('div', 'hud-bar-fill');

  fill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  track.append(fill);
  return track;
}

/** Une pastille « pictogramme + nombre » : habitants, mutants abattus. */
function chip(icon: 'people' | 'mutant', value: number, label: string): HTMLElement {
  const node = text('hud-quest-chip', String(value));

  node.title = label;
  node.prepend(uiIcon(icon, 18));
  return node;
}

/** Une ligne de quête : icône, barre, « 7/20 ». */
function meter(item: ItemId, have: number, needed: number): HTMLElement {
  const row = element('div', 'hud-meter');

  row.dataset['done'] = String(have >= needed);
  row.append(itemIcon(item, 18), bar(have / needed), text('hud-meter-value', `${have}/${needed}`));
  return row;
}

/** « 1:05 » ou « 0:09 » à partir d'un nombre de secondes. */
export function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
