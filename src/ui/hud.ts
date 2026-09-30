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
 *   casser, livrer, construire, se défendre) et se tait quand il a compris —
 *   c'est Ève qui le dit, son portrait devant ; au bout de cinq secondes, il
 *   se replie en ampoule à côté du titre ;
 * - la **quête d'Ève** en cours, une fois qu'elle est arrivée ;
 * - la **bulle** d'Ève au-dessus de sa tête : son arrivée, ses quêtes, ce
 *   qu'elle répond quand on la tape. Courte, jamais bloquante ;
 * - les boutons pause et son, et le **sac** d'Adam, à droite de la quête ;
 * - des **bulles** empilées pour les événements, et des gains qui flottent
 *   au-dessus de la tête d'Adam ;
 * - le **bandeau** des vagues : « Vague 4 — 2 mutants arrivent par l'est ! »
 *   trois secondes avant, avec une flèche tournée vers leur point
 *   d'apparition, puis « Vague 4 repoussée ! » quand le dernier tombe ;
 * - l'écran de **défaite**, avec le bilan de la partie ;
 * - les statistiques de debug, seulement avec `?debug` (ou la touche `²`/`` ` ``).
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { EVE_LINES } from '../data/eve.ts';
import { LORE } from '../data/lore.ts';
import { QUESTS, TOOLS, type QuestReward } from '../data/quests.ts';
import type { AtlasStats } from '../render/spriteLibrary.ts';
import type { WaterStats } from '../render/waterLayer.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import type { Compass } from '../sim/enemies.ts';
import type { EntityId } from '../sim/types.ts';
import { currentQuest, questProgress } from '../sim/eve.ts';
import { TICKS_PER_SECOND, siteMissing, type World } from '../sim/world.ts';
import { tutorialAdvice, type Advice } from './hint.ts';
import { itemAmount, itemIcon, uiIcon } from './icons.ts';
import { mapUrl, seedLine } from './seed.ts';

const REJECTION_LABELS: Record<PlacementRejection, string> = {
  occupied: 'Emplacement déjà occupé',
  terrain: 'Terrain non constructible',
  outOfReach: 'Trop loin — rapprochez-vous',
  resource: 'Dégagez d’abord les arbres et rochers',
  onPlayer: 'Vous êtes sur l’emplacement',
  locked: 'Pas encore débloqué — il faut son plan, ou tenir encore quelques vagues',
};

/** Durée de vie d'un gain flottant, en ms (cf. `hud-float-up` dans le CSS). */
const FLOAT_MS = 1000;

/** Durée d'affichage d'une bulle, et combien peuvent s'empiler. */
const TOAST_MS = 2600;
const MAX_TOASTS = 3;

/** Durée d'une réplique d'Ève : un socle, plus le temps de lire. */
const SPEECH_BASE_MS = 1600;
const SPEECH_PER_CHAR_MS = 45;

/**
 * Un conseil inchangé se replie au bout de ce délai, compté en ticks : il ne
 * se replie ni derrière l'écran titre ni pendant la pause.
 */
const HINT_FOLD_TICKS = 5 * TICKS_PER_SECOND;

/** Sous ce seuil, le compte à rebours de la vague passe au rouge. */
const WAVE_WARNING_SECONDS = 10;

/** D'où vient une vague, dit comme on le dirait. */
const FROM_LABELS: Record<Compass, string> = {
  north: 'par le nord',
  northEast: 'par le nord-est',
  east: 'par l’est',
  southEast: 'par le sud-est',
  south: 'par le sud',
  southWest: 'par le sud-ouest',
  west: 'par l’ouest',
  northWest: 'par le nord-ouest',
};

/** Le bandeau d'une vague reste le temps de l'annonce, et s'efface quand les flaques bouillonnent ; celui de la victoire, un peu moins. */
const BANNER_WAVE_MS = 4200;
const BANNER_CLEARED_MS = 3200;

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
  private readonly hintBulb: HTMLButtonElement;
  private readonly bag: HTMLElement;
  private readonly buttons: HTMLElement;
  private readonly floats: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerArrow: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerText: HTMLElement;
  /** Le point monde que la flèche du bandeau montre ; `null` sans flèche. */
  private bannerTarget: { x: number; y: number } | null = null;
  private bannerTimer = 0;
  /** Numéro de la vague déjà annoncée : le bandeau ne repart pas à chaque seconde du compte à rebours. */
  private announced = 0;
  private readonly defeat: HTMLElement;
  private readonly defeatStats: HTMLElement;
  private readonly speech: HTMLElement;
  public readonly audioButton: HTMLButtonElement;
  public readonly pauseButton: HTMLButtonElement;
  private lastBag = '';
  private lastQuest = '';
  private lastHint = '';
  /** Tick où le conseil a été montré (ou déplié) : il se replie `HINT_FOLD_TICKS` plus tard. */
  private hintSince = 0;
  private wanted: ItemId | null = null;

  /** Les répliques d'Ève en attente, et l'heure où la réplique affichée s'en va. */
  private readonly speechQueue: string[] = [];
  private speechUntil = 0;
  /** Ce qu'elle a déjà dit quand on la tape : elle ne radote pas. */
  private chatterIndex = 0;
  private talks = 0;
  /** Bas de la quête, relu à chaque réplique seulement : lire la mise en page force un reflow. */
  private speechFloor = 0;
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

    // Replié, le conseil n'est plus qu'une ampoule à côté du titre : un tap le déplie.
    this.hintBulb = element('button', 'hud-hint-bulb');
    this.hintBulb.type = 'button';
    this.hintBulb.setAttribute('aria-label', 'Afficher le conseil');
    this.hintBulb.append(uiIcon('hint', 20));
    this.hintBulb.addEventListener('click', () => this.unfoldHint());

    const head = element('div', 'hud-quest-head');

    head.append(this.questTitle, this.hintBulb);
    this.quest.append(head, this.questBody);
    this.quest.dataset['hint'] = 'none';

    // Le conseil s'ouvre et se referme en douceur dans son pli : la quête
    // grandit sans à-coup, et rien n'est posé dessous qui puisse sauter.
    const fold = element('div', 'hud-hint-fold');

    this.hint = element('div', 'hud-hint');
    this.hintText = element('span', 'hud-hint-text');
    this.hint.append(uiIcon('eve', 22), this.hintText);
    const clip = element('div', 'hud-hint-clip');

    clip.append(this.hint);
    fold.append(clip);

    this.bag = element('div', 'panel hud-bag');
    this.floats = element('div', 'hud-floats');
    this.stats = element('div', 'panel hud-stats');
    this.stats.hidden = !debug;
    this.toasts = element('div', 'hud-toasts');
    this.toasts.setAttribute('aria-live', 'polite');
    this.countdown = element('div', 'hud-countdown');
    this.speech = element('div', 'hud-speech');
    this.speech.hidden = true;
    this.speech.setAttribute('aria-live', 'polite');

    this.banner = element('div', 'hud-banner');
    this.banner.hidden = true;
    this.banner.setAttribute('role', 'status');
    this.bannerArrow = element('div', 'hud-banner-arrow');
    this.bannerArrow.append(uiIcon('direction', 26));

    const bannerBody = element('div', 'hud-banner-body');

    this.bannerTitle = element('div', 'hud-banner-title');
    this.bannerText = element('div', 'hud-banner-text');
    bannerBody.append(this.bannerTitle, this.bannerText);
    this.banner.append(this.bannerArrow, bannerBody);

    const buttons = element('div', 'hud-buttons');

    this.buttons = buttons;

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
    const replay = element('button', 'button-primary');
    const fresh = element('button', 'button-secondary');

    this.defeatStats = element('dl', 'overlay-stats');
    defeatTitle.textContent = `La ${LORE.buildings.townHall.name.toLowerCase()} est tombée`;
    defeatText.textContent = 'Les mutants ont eu raison du premier toit de la colonie.';
    // La sauvegarde est déjà effacée : l'adresse seule décide de la carte.
    replay.type = 'button';
    replay.textContent = 'Rejouer cette carte';
    replay.addEventListener('click', () => window.location.assign(mapUrl(window.location.href, world.seed)));
    fresh.type = 'button';
    fresh.textContent = 'Nouvelle carte';
    fresh.addEventListener('click', () => window.location.assign(mapUrl(window.location.href, null)));
    defeatPanel.append(defeatTitle, defeatText, this.defeatStats, replay, fresh, seedLine(world.seed));
    this.defeat.append(defeatPanel);

    // Le haut de l'écran se met en page tout seul : la quête et son conseil,
    // et à côté une colonne avec les boutons sur une ligne, le sac dessous.
    // Rien ne se chevauche, et rien ne bouge quand le conseil change.
    this.top = element('div', 'hud-top');

    const side = element('div', 'hud-side');

    this.quest.append(fold);
    side.append(buttons, this.bag);
    this.top.append(this.quest, side);

    this.root.append(
      this.top,
      this.countdown,
      this.speech,
      this.banner,
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
    world.events.on('buildingSupplied', ({ item, amount }) => this.float(item, -amount));
    world.events.on('supplyRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'nothingToGive') this.notify('Rien dans le sac que ce bâtiment attende', 'bad');
    });
    world.events.on('nurseryHungry', () => this.notify('La nurserie attend de la nourriture pour le prochain enfant', 'bad'));
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
    world.events.on('waveCountdown', ({ seconds, wave, count, from, x, y }) => {
      this.showCountdown(String(seconds));
      this.announce(wave, count, from, { x, y });
    });
    // Une vague qui n'a pas eu son compte à rebours (partie reprise pile avant) s'annonce quand même.
    world.events.on('waveStarted', ({ wave, count, from, x, y }) => this.announce(wave, count, from, { x, y }));
    world.events.on('waveCleared', ({ wave }) =>
      this.showBanner('cleared', `Vague ${wave} repoussée !`, 'Ramassez ce que les mutants ont lâché', null, BANNER_CLEARED_MS),
    );
    world.events.on('lootPicked', ({ item }) => this.float(item, 1));
    world.events.on('buildingDestroyed', ({ proto }) => this.notify(`${BUILDINGS[proto].label} détruite`, 'bad'));
    world.events.on('childBorn', () => this.notify('Un enfant est né à la nurserie !', 'good'));
    world.events.on('townHallDestroyed', () => this.showDefeat());
    world.events.on('beastDied', ({ loot }) => {
      if (loot) this.float(loot, 1);
    });
    world.events.on('playerKnockedOut', () => this.notify('Adam s’est évanoui — il se réveille à la mairie', 'bad'));
    world.events.on('eveArriving', () => this.notify('Quelqu’un arrive à vélo…', 'good'));
    world.events.on('eveArrived', () => {
      this.notify('Ève a rejoint la colonie !', 'good');
      this.say(EVE_LINES.arrival);
    });
    world.events.on('questStarted', ({ quest }) => this.say([QUESTS[quest].give]));
    world.events.on('questCompleted', ({ quest }) => {
      this.say([QUESTS[quest].done]);
      this.notify(rewardLabel(QUESTS[quest].reward), 'good');
    });
  }

  /* -------------------------------------------------------------------- Ève */

  /** Des répliques à la suite dans la bulle d'Ève. */
  private say(lines: readonly string[]): void {
    this.speechQueue.push(...lines);
  }

  /**
   * Ève tapée : elle répond sur-le-champ, à la place de ce qu'elle disait.
   * Pendant une attaque, elle a mieux à faire ; sinon, une fois sur deux elle
   * rappelle la quête, l'autre elle dit ce qui lui passe par la tête.
   */
  public talkToEve(): void {
    const quest = currentQuest(this.world.questsDone);
    let line: string;

    if (this.mutantCount() > 0) {
      line = EVE_LINES.busy;
    } else if (this.talks++ % 2 === 0) {
      line = quest ? QUESTS[quest].give : EVE_LINES.allDone;
    } else {
      line = EVE_LINES.chatter[this.chatterIndex++ % EVE_LINES.chatter.length]!;
    }

    this.speechQueue.length = 0;
    this.speechQueue.push(line);
    this.speechUntil = 0;
  }

  /** La bulle suit Ève à l'écran ; elle passe à la réplique suivante quand le temps de lecture est écoulé. */
  private updateSpeech(): void {
    const eve = this.world.eve();
    const now = performance.now();

    if (!eve) {
      this.speech.hidden = true;
      return;
    }

    if (now >= this.speechUntil) {
      const line = this.speechQueue.shift();

      if (line === undefined) {
        this.speech.hidden = true;
        return;
      }
      this.speech.textContent = line;
      this.speech.hidden = false;
      this.speechUntil = now + SPEECH_BASE_MS + line.length * SPEECH_PER_CHAR_MS;
      this.speechFloor = this.topInset() + 60;

      // Relance l'animation d'entrée à chaque réplique.
      this.speech.style.animation = 'none';
      void this.speech.offsetWidth;
      this.speech.style.animation = '';
    }

    // Au-dessus de la tête — plus haut en selle —, sans sortir de l'écran.
    const head = eve.state === 'arriving' ? 62 : 50;
    const { x, y } = this.project(eve.x, eve.y - head);
    const margin = Math.min(130, window.innerWidth / 2);

    this.speech.style.left = `${Math.round(Math.min(Math.max(x, margin), window.innerWidth - margin))}px`;
    this.speech.style.top = `${Math.round(Math.max(y, this.speechFloor))}px`;
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

  /** Les boutons et le sac, posés à droite de la quête : les repères de bord les contournent. */
  public obstacles(): DOMRect[] {
    return [this.buttons.getBoundingClientRect(), this.bag.getBoundingClientRect()];
  }

  /** La ressource que le conseil envoie chercher, ou `null` : le renderer y pointe un repère. */
  public wantedItem(): ItemId | null {
    return this.wanted;
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

  /** Le bandeau d'une vague, une seule fois par vague. */
  private announce(wave: number, count: number, from: Compass, origin: { x: number; y: number }): void {
    if (wave === this.announced) return;
    this.announced = wave;

    const plural = count > 1;

    this.showBanner(
      'wave',
      `Vague ${wave}`,
      `${count} mutant${plural ? 's' : ''} arrive${plural ? 'nt' : ''} ${FROM_LABELS[from]} !`,
      origin,
      BANNER_WAVE_MS,
    );
  }

  /** Le bandeau, au-dessus du compte à rebours ; sa flèche suit `target` tant qu'il est là. */
  private showBanner(tone: 'wave' | 'cleared', title: string, body: string, target: { x: number; y: number } | null, ms: number): void {
    this.banner.dataset['tone'] = tone;
    this.bannerTitle.textContent = title;
    this.bannerText.textContent = body;
    this.bannerTarget = target;
    this.bannerArrow.hidden = target === null;
    this.banner.hidden = false;
    this.aimBanner();

    // Relance l'animation d'entrée.
    this.banner.style.animation = 'none';
    void this.banner.offsetWidth;
    this.banner.style.animation = '';

    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.banner.hidden = true;
      this.bannerTarget = null;
    }, ms);
  }

  /** Tourne la flèche du bandeau d'Adam vers le point d'apparition, à l'écran. */
  private aimBanner(): void {
    if (!this.bannerTarget) return;

    const { player } = this.world;
    const from = this.project(player.x, player.y);
    const to = this.project(this.bannerTarget.x, this.bannerTarget.y);

    this.bannerArrow.style.transform = `rotate(${Math.atan2(to.y - from.y, to.x - from.x).toFixed(3)}rad)`;
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

  /** `fps`, `chunks`, `atlas` et `water` viennent du renderer : le monde ne les connaît pas. */
  public update(fps: number, chunks: number, atlas: AtlasStats, water: WaterStats): void {
    this.updateQuest();
    this.updateHint();
    this.updateBag();
    this.updateSpeech();
    this.root.dataset['danger'] = String(this.mutantCount() > 0 && !this.world.defeated);
    if (!this.banner.hidden) this.aimBanner();

    if (this.debug) this.updateStats(fps, chunks, atlas, water);
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
    const { adults, children, workers } = world.population();
    const people = adults + children;
    const status =
      mutants > 0
        ? `Vague ${world.wave} · ${mutants} mutant${mutants > 1 ? 's' : ''}`
        : `Vague ${world.wave + 1} dans ${clock(seconds)}`;

    const quest = world.eve()?.state === 'idle' || world.eve()?.state === 'repair' ? currentQuest(world.questsDone) : null;
    const progress = quest ? questProgress(quest, world.entities.values()) : null;

    key = `hall:${hall.hp}:${status}:${people}:${workers}:${world.kills}:${quest}:${progress?.have}`;
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

    if (quest && progress) {
      const row = element('div', 'hud-quest-eve');

      row.append(uiIcon('eve', 18), text('hud-quest-eve-label', QUESTS[quest].label), text('hud-meter-value', `${progress.have}/${progress.need}`));
      this.questBody.append(row);
    }
  }

  /* --------------------------------------------------------------- conseil */

  /** Le conseil sous la quête, cf. `hint.ts`. */
  private currentAdvice(): Advice | null {
    const { world } = this;
    const towers = [...world.entities.values()].some((entity) => entity.kind === 'tower');

    return tutorialAdvice(
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
    const advice = this.currentAdvice();
    const hint = advice?.text ?? '';

    this.wanted = advice?.wants ?? null;

    if (hint !== this.lastHint) {
      this.lastHint = hint;
      this.hintSince = this.world.tickCount;
      // Le texte reste en place quand le conseil se tait : il part en se repliant.
      if (hint !== '') this.hintText.textContent = hint;

      // Relance l'animation d'entrée à chaque nouveau conseil.
      this.hint.style.animation = 'none';
      void this.hint.offsetWidth;
      this.hint.style.animation = '';
    }

    const folded = this.world.tickCount - this.hintSince >= HINT_FOLD_TICKS;
    const state = hint === '' ? 'none' : folded ? 'folded' : 'open';

    if (this.quest.dataset['hint'] !== state) this.quest.dataset['hint'] = state;
  }

  /** Le tap sur l'ampoule : le conseil revient pour cinq secondes. */
  private unfoldHint(): void {
    this.hintSince = this.world.tickCount;
    this.quest.dataset['hint'] = this.lastHint === '' ? 'none' : 'open';
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

  private updateStats(fps: number, chunks: number, atlas: AtlasStats, water: WaterStats): void {
    const { cx, cy } = this.world.playerChunk();
    const lines = [
      `tick ${this.world.tickCount}   ${fps.toFixed(0)} fps   seed ${this.world.seed}`,
      `chunk ${cx},${cy}   ${chunks} blocs de sol   ${this.world.resources.size()} tuiles entamées`,
      `eau ${water.sprites} sprite(s) à l'écran, ${water.animated} animé(s)`,
      `atlas ${atlas.images} images → ${atlas.pages} texture(s), ${atlas.megapixels.toFixed(1)} Mpx @${atlas.resolution}x, ${atlas.ms} ms`,
      `${this.world.entities.size} bâtiment(s)   ${this.world.mobiles.size} mobile(s)   ${this.world.pendingWakes()} réveil(s)`,
    ];

    for (const entity of this.world.entities.values()) {
      if (entity.kind === 'site') continue;

      const contents = entity.store
        .entries()
        .map(([item, amount]) => `${ITEMS[item].label} ${amount}`)
        .join(', ');
      const stopped = (entity.kind === 'drill' || entity.kind === 'forge') && entity.blocked ? ' — arrêtée' : '';

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

/** La récompense d'une quête, dite par le jeu. */
function rewardLabel(reward: QuestReward): string {
  return reward.type === 'plan'
    ? `Plan reçu : ${BUILDINGS[reward.building].label}`
    : `Outil reçu : ${TOOLS[reward.tool].label}`;
}

/** « 1:05 » ou « 0:09 » à partir d'un nombre de secondes. */
export function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
