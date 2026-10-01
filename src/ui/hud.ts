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
 * - la **quête** en haut : l'objectif en cours (`data/objectives.ts`) — le
 *   chantier de la mairie avec une barre par ressource, puis une jauge par
 *   condition — sous lequel restent la santé de la mairie, la nuit et son
 *   compte à rebours ;
 * - la **météo** dessous, en capsule : ce qui arrive et dans combien de
 *   temps, puis ce qui tombe et pour combien de temps encore ;
 * - un **conseil** sous la quête, qui suit ce que fait le joueur (couper,
 *   casser, livrer, construire, se défendre) et se tait quand il a compris —
 *   c'est Ève qui le dit, son portrait devant ; au bout de cinq secondes, il
 *   se replie en ampoule à côté du titre ;
 * - sur un téléphone, la quête se **replie** en une ligne : l'icône et le
 *   titre de l'objectif, sa progression, une mini-barre des PV de la mairie
 *   et l'horloge de la nuit. Un tap sur la ligne la déplie six secondes ;
 *   elle se déplie d'elle-même quatre secondes quand un objectif est
 *   atteint, quand une vague commence ou quand la mairie passe sous la
 *   moitié de ses PV. Le conseil s'ouvre sous la ligne, l'ampoule y reste ;
 * - dans la ligne de la mairie, le **compteur d'ouvriers** : un tap déplie
 *   leur détail par bâtiment, et ce que font les porteurs ; il se replie
 *   seul au bout de cinq secondes, ou dès qu'on touche ailleurs ;
 * - la **quête d'Ève** en cours, une fois qu'elle est arrivée ;
 * - la **bulle** d'Ève au-dessus de sa tête : son arrivée, ses quêtes, ce
 *   qu'elle répond quand on la tape. Courte, jamais bloquante ;
 * - les boutons pause et son à droite de la quête, et dessous les deux
 *   stocks, en version compacte : la **ville** (le coffre de la mairie) et
 *   le **sac** d'Adam avec son remplissage — un tap sur le sac ouvre le
 *   panneau inventaire (`inventoryPanel.ts`). Sur un téléphone, les deux
 *   cartes n'en font plus qu'une, repliée en pastille : la jauge du sac, ce
 *   que compte la ville, et la ressource que réclame le conseil — le
 *   détail est dans le panneau ;
 * - des **bulles** empilées pour les événements, des gains qui flottent
 *   au-dessus de la tête d'Adam, et le nom d'un bâtiment achevé qui monte
 *   de son toit (« Mairie bâtie ! ») ;
 * - le **bandeau** des vagues : « Nuit 4 — 2 mutants arrivent par l'est ! »
 *   (« Renforts » pour les vagues suivantes de la nuit) trois secondes avant,
 *   avec une flèche tournée vers leur point d'apparition, puis « Nuit 4 —
 *   vague repoussée ! » quand le dernier tombe ; un gros mutant s'annonce à part ;
 * - l'**alarme** quand la mairie est frappée hors de l'écran : bord rouge
 *   qui clignote, et vibration du téléphone s'il en a une ;
 * - la **célébration** d'un objectif réussi : un bandeau, une pluie de feuilles ;
 * - l'écran de **victoire**, avec le bilan de la partie, et celui de
 *   **défaite**, avec en plus les graines qu'elle laisse au jardin des souvenirs ;
 * - les statistiques de debug, seulement avec `?debug` (ou la touche `²`/`` ` ``).
 */

import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, buildingLevel } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { EVE_LINES } from '../data/eve.ts';
import { LORE } from '../data/lore.ts';
import { OBJECTIVES, type Goal } from '../data/objectives.ts';
import { seedsFor } from '../data/perks.ts';
import { QUESTS, TOOLS, type QuestReward } from '../data/quests.ts';
import { RESEARCH } from '../data/research.ts';
import { WEATHER, WEATHER_CALENDAR } from '../data/weather.ts';
import type { UiIcon } from '../art/ui.ts';
import type { AtlasStats } from '../render/spriteLibrary.ts';
import type { WaterStats } from '../render/waterLayer.ts';
import type { PlacementRejection, RepairRejection, RoadRejection } from '../sim/commands.ts';
import type { Compass } from '../sim/enemies.ts';
import type { Entity } from '../sim/types.ts';
import { ticksToNight } from '../sim/dayNight.ts';
import { currentQuest, questProgress } from '../sim/eve.ts';
import { currentObjective, goalProgress, goalWait, type GoalWait } from '../sim/objectives.ts';
import { TICKS_PER_SECOND, type Workforce, type World } from '../sim/world.ts';
import { carriesWanted, harvestRefusedText, tutorialAdvice, type Advice } from './hint.ts';
import { buildingIcon, itemAmount, itemIcon, uiIcon } from './icons.ts';
import { effectLine } from './researchText.ts';
import { mapUrl, seedLine } from './seed.ts';

const REJECTION_LABELS: Record<PlacementRejection, string> = {
  occupied: 'Emplacement déjà occupé',
  road: 'Une route passe ici — retirez-la d’abord',
  terrain: 'Terrain non constructible',
  outOfReach: 'Trop loin — rapprochez-vous',
  resource: 'Dégagez d’abord les arbres et rochers',
  onPlayer: 'Vous êtes sur l’emplacement',
  noOre: 'Aucun filon ici — une foreuse se pose sur un filon',
  locked: 'Pas encore débloqué — il faut son plan, ou tenir encore une nuit',
  unique: 'Un seul par colonie — il y en a déjà un',
};

/** Ce que dit la bulle quand un tracé de route n'a pas été pavé en entier ; `paved` tuiles l'ont été. */
const ROAD_LABELS: Record<RoadRejection, (paved: number) => string> = {
  noStone: (paved) => (paved > 0 ? `Plus de pierre : route arrêtée après ${paved} tuile${paved > 1 ? 's' : ''}` : 'Pas de pierre pour paver — ni dans le sac, ni en ville à portée'),
  terrain: () => 'Pas de route sur l’eau',
  occupied: () => 'Une route ne passe pas sous un bâtiment',
  resource: () => 'Arbres et rochers sautés : dégagez-les pour paver',
};

const REPAIR_LABELS: Record<RepairRejection, string | null> = {
  missing: null,
  outOfReach: 'Trop loin — rapprochez-vous',
  intact: 'Rien à réparer',
  noMaterial: 'Il faut du bois pour réparer — ni dans le sac, ni en ville',
};

/** Durée de l'alarme après le dernier coup reçu par la mairie hors de l'écran, en ms. */
const ALARM_MS = 2500;

/** Motif de vibration de l'alarme, et le délai minimal entre deux vibrations, en ms. */
const ALARM_VIBRATION = [140, 80, 140];
const ALARM_VIBRATION_EVERY_MS = 4000;

/** Durée de vie d'un gain flottant, en ms (cf. `hud-float-up` dans le CSS). */
const FLOAT_MS = 1000;

/** Durée de vie du « Mairie bâtie ! » qui monte d'un bâtiment achevé, en ms (cf. `hud-built-up` dans le CSS). */
const BUILT_MS = 1800;

/** Durée d'affichage d'une bulle, et combien peuvent s'empiler. */
const TOAST_MS = 2600;
const MAX_TOASTS = 3;

/** Durée d'une réplique d'Ève : un socle, plus le temps de lire. */
const SPEECH_BASE_MS = 1600;
const SPEECH_PER_CHAR_MS = 45;
/** Sous la quête, la bulle garde ce jeu (ses 10 px de flottement compris). */
const SPEECH_GAP = 14;

/**
 * Un conseil inchangé se replie au bout de ce délai, compté en ticks : il ne
 * se replie ni derrière l'écran titre ni pendant la pause.
 */
const HINT_FOLD_TICKS = 5 * TICKS_PER_SECOND;

/** Le détail des ouvriers se replie seul au bout de ce délai, compté en ticks comme le conseil. */
const CREW_FOLD_TICKS = 5 * TICKS_PER_SECOND;

/**
 * Sur un téléphone, la quête dépliée d'un tap se replie au bout de ce délai
 * sans qu'on la touche ; dépliée d'elle-même (objectif, vague, mairie
 * abîmée), au bout du second. Comptés en ticks comme le conseil.
 */
const QUEST_TAP_TICKS = 6 * TICKS_PER_SECOND;
const QUEST_ALERT_TICKS = 4 * TICKS_PER_SECOND;

/** Sous cette part de ses PV, la mairie déplie la quête repliée. */
const QUEST_ALERT_HP = 0.5;

/** Durée du bandeau d'objectif réussi, en ms (cf. `celebration-in` dans le CSS). */
const CELEBRATION_MS = 4200;
/** Rangé sous la quête quand une fenêtre est ouverte, le bandeau en garde ce jeu. */
const CELEBRATION_GAP = 8;

/** Feuilles de la pluie de confettis, et combien il en tombe. */
const CONFETTI: readonly UiIcon[] = ['leafMint', 'leafMint', 'leafYellow', 'petal'];
const CONFETTI_COUNT = 36;
const CONFETTI_MS = 3200;

/** Sous ce seuil, le compte à rebours de la nuit passe au rouge — le crépuscule y est déjà. */
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
  /** La quête repliée en une ligne, sur un téléphone : icône, titre, progression, PV de la mairie, horloge. */
  private readonly questStrip: HTMLElement;
  /** Tick jusqu'auquel la quête reste dépliée sur un téléphone ; repliée au-delà. */
  private questOpenUntil = 0;
  /** La mairie est déjà sous `QUEST_ALERT_HP` : elle ne déplie la quête qu'en y passant. */
  private hallLow = false;
  private readonly hint: HTMLElement;
  private readonly hintText: HTMLElement;
  private readonly hintBulb: HTMLButtonElement;
  /** Le sac, compact : un bouton qui ouvre le panneau inventaire. */
  public readonly bag: HTMLButtonElement;
  /** Le stock de la ville, compact. */
  private readonly town: HTMLElement;
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
  /** La vague déjà annoncée (nuit et rang) : le bandeau ne repart pas à chaque seconde du compte à rebours. */
  private announced = '';
  private readonly weather: HTMLElement;
  private readonly defeat: HTMLElement;
  private readonly defeatStats: HTMLElement;
  private readonly victory: HTMLElement;
  private readonly victoryStats: HTMLElement;
  private readonly celebration: HTMLElement;
  private readonly confetti: HTMLElement;
  private celebrationTimer = 0;
  private onContinue: () => void = () => {};
  private readonly speech: HTMLElement;
  private readonly defeatSeeds: HTMLElement;
  public readonly audioButton: HTMLButtonElement;
  public readonly pauseButton: HTMLButtonElement;
  private lastBag = '';
  private lastTown = '';
  private lastQuest = '';
  /** Le détail des ouvriers, déplié d'un tap sur leur compteur. */
  private crewOpen = false;
  /** Tick où le détail des ouvriers a été déplié. */
  private crewSince = 0;
  /** Un toucher hors du compteur replie le détail des ouvriers. */
  private readonly foldCrewOnTouch = (event: PointerEvent): void => {
    if (!this.crewOpen) return;
    if (event.target instanceof Element && event.target.closest('.hud-quest-crew')) return;
    this.crewOpen = false;
  };
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
  /** Hauteur de la bulle, lue une fois par réplique : son texte ne change pas entre-temps. */
  private speechHeight = 0;
  private lastWeather = '';
  private debug: boolean;

  /** Ce que le joueur a déjà fait : un conseil compris ne revient pas. */
  private harvestedWood = false;
  private harvestedStone = false;
  private delivered = false;
  private repaired = false;

  /** Fin de l'alarme en cours, et dernière vibration, en ms (`performance.now()`). */
  private alarmUntil = 0;
  private lastVibration = -Infinity;

  private project: Projector = (x, y) => ({ x, y });

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

    this.questStrip = element('div', 'hud-quest-strip');

    // Sur un téléphone, la tête de la quête se tape : elle déplie la carte, ou la replie.
    const head = element('div', 'hud-quest-head');

    head.append(this.questTitle, this.questStrip, this.hintBulb);
    head.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.hud-hint-bulb')) return;
      this.questOpenUntil = this.quest.dataset['folded'] === 'false' ? 0 : this.world.tickCount + QUEST_TAP_TICKS;
      this.updateFold();
    });
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

    this.bag = element('button', 'panel hud-stock hud-bag');
    this.bag.type = 'button';
    this.town = element('div', 'panel hud-stock hud-town');
    this.floats = element('div', 'hud-floats');
    this.stats = element('div', 'panel hud-stats');
    this.stats.hidden = !debug;
    this.toasts = element('div', 'hud-toasts');
    this.toasts.setAttribute('aria-live', 'polite');
    this.countdown = element('div', 'hud-countdown');
    this.speech = element('div', 'hud-speech');
    this.speech.hidden = true;
    this.speech.setAttribute('aria-live', 'polite');
    this.weather = element('div', 'hud-weather');
    this.weather.hidden = true;

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
    this.defeatSeeds = element('div', 'overlay-seeds');
    defeatTitle.textContent = `La ${LORE.buildings.townHall.name.toLowerCase()} est tombée`;
    defeatText.textContent = 'Les mutants ont eu raison du premier toit de la colonie.';
    // La sauvegarde est déjà effacée : l'adresse seule décide de la carte.
    replay.type = 'button';
    replay.textContent = 'Rejouer cette carte';
    replay.addEventListener('click', () => window.location.assign(mapUrl(window.location.href, world.seed)));
    fresh.type = 'button';
    fresh.textContent = 'Nouvelle carte';
    fresh.addEventListener('click', () => window.location.assign(mapUrl(window.location.href, null)));
    defeatPanel.append(defeatTitle, defeatText, this.defeatStats, this.defeatSeeds, replay, fresh, seedLine(world.seed));
    this.defeat.append(defeatPanel);

    this.victory = element('div', 'overlay hud-victory');
    this.victory.hidden = true;

    const victoryPanel = element('div', 'panel overlay-panel');
    const victoryTitle = element('h2', 'overlay-title');
    const victoryText = element('p', 'overlay-text');
    const endless = element('button', 'button-primary');

    this.victoryStats = element('dl', 'overlay-stats');
    victoryTitle.textContent = 'La colonie vivra';
    victoryText.textContent = 'Les mutants n’ont pas eu raison de la colonie : la vie a repris ses droits.';
    endless.type = 'button';
    endless.textContent = 'Continuer en mode infini';
    endless.addEventListener('click', () => {
      this.victory.hidden = true;
      this.onContinue();
    });
    victoryPanel.append(uiIcon('goal', 56), victoryTitle, victoryText, this.victoryStats, endless);
    this.victory.append(victoryPanel);

    this.celebration = element('div', 'hud-celebration');
    this.celebration.hidden = true;
    this.celebration.setAttribute('role', 'status');
    this.confetti = element('div', 'hud-confetti');

    // Le haut de l'écran se met en page tout seul : la quête et son conseil,
    // et à côté une colonne avec les boutons sur une ligne, le sac dessous.
    // Rien ne se chevauche, et rien ne bouge quand le conseil change.
    this.top = element('div', 'hud-top');

    const side = element('div', 'hud-side');

    this.quest.append(fold);
    side.append(buttons, this.town, this.bag);
    this.top.append(this.quest, side, this.weather);

    this.root.append(
      // Les confettis d'abord : ils tombent derrière les cartes du HUD et les fenêtres.
      this.confetti,
      this.top,
      this.countdown,
      this.speech,
      this.banner,
      this.toasts,
      this.floats,
      this.stats,
      this.celebration,
      this.victory,
      this.defeat,
    );

    document.addEventListener('pointerdown', this.foldCrewOnTouch, { capture: true });

    world.events.on('placementRejected', ({ reason }) => this.notify(REJECTION_LABELS[reason], 'bad'));
    world.events.on('roadPaved', ({ fromBag }) => {
      if (fromBag > 0) this.float('stone', -fromBag);
    });
    world.events.on('roadRemoved', ({ toBag }) => {
      if (toBag > 0) this.float('stone', toBag);
    });
    world.events.on('roadRejected', ({ reason, paved }) => this.notify(ROAD_LABELS[reason](paved), 'bad'));
    world.events.on('resourceHarvested', ({ item, amount }) => {
      if (item === 'wood') this.harvestedWood = true;
      if (item === 'stone') this.harvestedStone = true;
      this.float(item, amount);
    });
    world.events.on('siteDelivered', ({ item, amount, source }) => {
      this.delivered = true;
      // Ce que la ville donne ne sort pas du sac : rien ne tombe de la tête d'Adam.
      if (source === 'bag') this.float(item, -amount);
    });
    world.events.on('townDeposited', ({ item, amount }) => this.float(item, -amount));
    world.events.on('itemDropped', ({ item, amount }) => this.float(item, -amount));
    world.events.on('depositRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify('Trop loin de la mairie — rapprochez-vous pour déposer', 'bad');
      if (reason === 'noTown') this.notify('Pas encore de ville : bâtissez d’abord la mairie', 'bad');
    });
    world.events.on('siteRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'nothingToGive') this.notify('Rien dans le sac que ce chantier attende', 'bad');
    });
    world.events.on('storeTaken', ({ item, amount }) => this.float(item, amount));
    world.events.on('buildingSupplied', ({ item, amount, source }) => {
      if (source === 'bag') this.float(item, -amount);
    });
    world.events.on('supplyRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'nothingToGive') this.notify('Rien dans le sac ni en ville que ce bâtiment attende', 'bad');
    });
    world.events.on('nurseryHungry', () => this.notify('La nurserie attend de la nourriture pour le prochain enfant', 'bad'));
    world.events.on('takeRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'empty') this.notify('Le coffre est vide', 'bad');
      if (reason === 'bagFull') this.notify('Sac plein — rien à prendre de plus', 'bad');
    });
    world.events.on('inventoryFull', () => this.notify(this.bagFullMessage(), 'bad'));
    world.events.on('harvestRefused', ({ item, wanted, plenty }) => {
      this.refused(item);
      this.notify(harvestRefusedText(item, wanted, plenty), 'info');
    });
    world.events.on('buildingCompleted', ({ id }) => {
      const entity = world.entities.get(id);

      if (entity) this.celebrate(entity, `${BUILDINGS[entity.proto].label} bâtie !`);
    });
    world.events.on('buildingUpgraded', ({ id, level, fromBag }) => {
      const entity = world.entities.get(id);

      for (const [item, amount] of fromBag) this.float(item, -amount);
      if (entity) this.celebrate(entity, `${buildingLevel(entity.proto, level).label} !`);
    });
    world.events.on('upgradeRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'missingItems') this.notify('Il manque de quoi payer — ni dans le sac, ni en ville', 'bad');
    });
    world.events.on('playerRepaired', ({ item, amount, fromBag }) => {
      this.repaired = true;
      if (fromBag > 0) this.float(item, -fromBag);
      if (amount > fromBag) this.notify(`Réparé avec ${amount - fromBag} ${ITEMS[item].label.toLowerCase()} de la ville`, 'good');
    });
    world.events.on('repairRejected', ({ reason }) => {
      const label = REPAIR_LABELS[reason];

      if (label) this.notify(label, 'bad');
    });
    world.events.on('waveCountdown', ({ seconds, night, wave, count, boss, from, x, y }) => {
      this.showCountdown(String(seconds));
      this.announce(night, wave, count, boss, from, { x, y });
    });
    world.events.on('duskFell', () => this.notify('La nuit tombe — rentrez !', 'bad'));
    // Une vague qui n'a pas eu son compte à rebours (partie reprise pile avant) s'annonce quand même.
    world.events.on('waveStarted', ({ night, wave, count, boss, from, x, y }) => {
      this.announce(night, wave, count, boss, from, { x, y });
      this.unfoldQuest(QUEST_ALERT_TICKS);
    });
    world.events.on('buildingDamaged', ({ id, hp }) => {
      const hall = world.entities.get(id);

      if (id !== world.townHallId || !hall) return;

      const low = hp / BUILDINGS[hall.proto].hp < QUEST_ALERT_HP;

      if (low && !this.hallLow) this.unfoldQuest(QUEST_ALERT_TICKS);
      this.hallLow = low;
    });
    world.events.on('waveCleared', ({ night }) =>
      this.showBanner('cleared', `Nuit ${night} — vague repoussée !`, 'Ramassez ce que les mutants ont lâché', null, BANNER_CLEARED_MS),
    );
    world.events.on('lootPicked', ({ item, amount }) => this.float(item, amount));
    world.events.on('dawnBroke', ({ night, reward }) => {
      this.notify(`L’aube ! Nuit ${night} survécue`, 'good');
      for (const [item, amount] of reward) this.float(item, amount);
    });
    world.events.on('buildingDestroyed', ({ proto }) => this.notify(`${BUILDINGS[proto].label} détruite`, 'bad'));
    world.events.on('siteCancelled', ({ proto, toTown }) =>
      this.notify(`Chantier annulé : ${BUILDINGS[proto].label} — ${toTown ? 'le livré retourne en ville' : 'le livré reste au sol'}`, 'info'),
    );
    world.events.on('childBorn', () => this.notify('Un enfant est né à la nurserie !', 'good'));
    world.events.on('mutantStunned', () => this.notify('Un mutant assommé ! Touchez-le pour l’emmener à la clinique', 'good'));
    world.events.on('patientFollowing', () => this.notify('Il vous suit en boitillant — direction la clinique', 'good'));
    world.events.on('patientAdmitted', () => this.notify('Admis à la clinique : une nuit de soins', 'good'));
    world.events.on('mutantHealed', () => this.notify('Un ex-mutant sort de la clinique : un porteur de plus !', 'good'));
    world.events.on('townHallDestroyed', () => this.showDefeat());
    world.events.on('weatherAnnounced', ({ id, seconds }) => {
      const proto = WEATHER[id];

      this.notify(`${proto.label} dans ${seconds} s — ${proto.advice}`, proto.harsh ? 'bad' : 'info');
    });
    world.events.on('weatherEnded', ({ id }) => this.notify(`Fin : ${WEATHER[id].label.toLowerCase()}`, 'good'));
    world.events.on('playerKnockedOut', () => this.notify('Adam s’est évanoui — il se réveille à la mairie', 'bad'));
    world.events.on('eveArriving', () => this.notify('Quelqu’un arrive à vélo…', 'good'));
    world.events.on('caravanArriving', () => {
      this.notify('Une caravane de troc arrive au bord de la clairière', 'good');
      this.say([EVE_LINES.caravan]);
    });
    world.events.on('caravanLeaving', () => this.notify('La caravane repart', 'info'));
    world.events.on('traded', ({ fromBag, stored }) => {
      for (const [item, amount] of fromBag) this.float(item, -amount);
      for (const [item, amount] of Object.entries(stored) as [ItemId, number][]) {
        if (amount > 0) this.notify(`Sac plein : ${amount} ${ITEMS[item].label.toLowerCase()} attend à la mairie`, 'info');
      }
    });
    world.events.on('tradeRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify('Approchez-vous de la charrette', 'bad');
      if (reason === 'missingItems') this.notify('Il manque de quoi payer cet échange', 'bad');
      if (reason === 'done') this.notify('Cet échange est déjà fait', 'bad');
      if (reason === 'missing') this.notify('La caravane est repartie', 'bad');
    });
    world.events.on('eveArrived', () => {
      this.notify('Ève a rejoint la colonie !', 'good');
      this.say(EVE_LINES.arrival);
    });
    world.events.on('questStarted', ({ quest }) => this.say([QUESTS[quest].give]));
    world.events.on('questCompleted', ({ quest }) => {
      this.say([QUESTS[quest].done]);
      this.notify(rewardLabel(QUESTS[quest].reward), 'good');
    });
    world.events.on('labSupplied', ({ item, amount, source }) => {
      if (source === 'bag') this.float(item, -amount);
    });
    world.events.on('researchStarted', ({ research }) => this.notify(`${RESEARCH[research].label} : la recherche commence`, 'info'));
    world.events.on('researchCompleted', ({ research }) =>
      this.notify(`Recherche terminée — ${effectLine(research, world.researchDone, world.perks)}`, 'good'),
    );
    world.events.on('researchRejected', ({ reason }) => {
      if (reason === 'busy') this.notify('Une recherche tourne déjà — une seule à la fois', 'bad');
      if (reason === 'locked') this.notify('Il manque une recherche avant celle-ci', 'bad');
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach, 'bad');
      if (reason === 'nothingToGive') this.notify('Rien dans le sac ni en ville que cette recherche attende', 'bad');
    });
    world.events.on('objectiveCompleted', ({ index, stored }) => {
      // Le dernier objectif, c'est l'écran de victoire qui le fête.
      if (index < OBJECTIVES.length - 1) this.celebrateObjective(index);
      this.unfoldQuest(QUEST_ALERT_TICKS);

      const kept = (Object.entries(stored) as [ItemId, number][]).filter(([, amount]) => amount > 0);

      if (kept.length > 0) {
        this.notify(`Sac plein : ${kept.map(([item, amount]) => `${amount} ${ITEMS[item].label.toLowerCase()}`).join(', ')} attend à la mairie`, 'info');
      }
    });
    world.events.on('victory', () => this.showVictory());
  }

  /** Ce que fait « Continuer en mode infini » : `main.ts` relance l'horloge. */
  public setOnContinue(onContinue: () => void): void {
    this.onContinue = onContinue;
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

      // Relance l'animation d'entrée à chaque réplique ; le reflow qu'il faut
      // pour ça donne aussi la hauteur de la bulle.
      this.speech.style.animation = 'none';
      this.speechHeight = this.speech.offsetHeight;
      this.speech.style.animation = '';
    }

    // La quête grandit pendant qu'Ève parle (une quête commence, un conseil
    // s'ouvre) : son bas se relit à chaque frame où la bulle est là.
    const questBottom = this.topInset();
    // Au-dessus de la tête — plus haut en selle —, sans sortir de l'écran.
    const head = eve.state === 'arriving' ? 62 : 50;
    const { x, y } = this.project(eve.x, eve.y - head);
    const margin = Math.min(130, window.innerWidth / 2);

    this.speech.style.left = `${Math.round(Math.min(Math.max(x, margin), window.innerWidth - margin))}px`;
    // `top` est le bas de la bulle, qui flotte 10 px au-dessus : tout entière sous la quête.
    this.speech.style.top = `${Math.round(Math.max(y, questBottom + this.speechHeight + SPEECH_GAP))}px`;
  }

  /** Le renderer sait où est Adam à l'écran ; le HUD non. `main.ts` fait le lien. */
  public setProjector(project: Projector): void {
    this.project = project;
  }

  /** Bas de la quête — de sa ligne, repliée sur un téléphone —, en pixels écran : les repères de bord du renderer restent dessous. */
  public topInset(): number {
    return this.quest.getBoundingClientRect().bottom;
  }

  /** Les boutons et le sac, posés à droite de la quête : les repères de bord les contournent. */
  public obstacles(): DOMRect[] {
    return [this.buttons.getBoundingClientRect(), this.town.getBoundingClientRect(), this.bag.getBoundingClientRect()];
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

  /** Le bandeau d'une vague, une seule fois par vague ; `boss` : un gros mutant mène la charge. */
  private announce(night: number, wave: number, count: number, boss: boolean, from: Compass, origin: { x: number; y: number }): void {
    const key = `${night}:${wave}`;

    if (key === this.announced) return;
    this.announced = key;

    const plural = count > 1;

    this.showBanner(
      'wave',
      wave === 1 ? `Nuit ${night}` : 'Renforts',
      boss
        ? `Un gros mutant mène la charge ${FROM_LABELS[from]} !`
        : `${count} mutant${plural ? 's' : ''} arrive${plural ? 'nt' : ''} ${FROM_LABELS[from]} !`,
      origin,
      BANNER_WAVE_MS,
    );
  }

  /**
   * La mairie vient d'être frappée hors de l'écran : bord rouge qui clignote
   * tant que les coups continuent, et une vibration de temps en temps — pas
   * à chaque coup, un téléphone qui vibre sans arrêt se pose sur la table.
   */
  public alarm(): void {
    const now = performance.now();

    this.alarmUntil = now + ALARM_MS;
    this.root.dataset['alarm'] = 'true';

    if (now - this.lastVibration < ALARM_VIBRATION_EVERY_MS) return;
    this.lastVibration = now;

    // Absente sur iOS et sur ordinateur : l'alarme visuelle suffit alors.
    try {
      navigator.vibrate?.(ALARM_VIBRATION);
    } catch {
      // Refusée par le navigateur : rien à faire.
    }
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

  /** L'icône de l'objet refusé, qui tressaute au-dessus d'Adam : il n'en prend plus. */
  private refused(item: ItemId): void {
    const { player } = this.world;
    const { x, y } = this.project(player.x, player.y - 44);
    const floater = element('span', 'hud-float');

    floater.dataset['refused'] = 'true';
    floater.style.left = `${Math.round(x)}px`;
    floater.style.top = `${Math.round(y)}px`;
    floater.append(itemIcon(item, 18), 'assez');
    this.floats.append(floater);
    window.setTimeout(() => floater.remove(), FLOAT_MS);
  }

  /** « Sac plein » dit où vider : la ville, le chantier qui attend ce qu'Adam porte, ou le sol. */
  private bagFullMessage(): string {
    if (this.world.townStock()) return 'Sac plein — allez déposer en ville';
    return carriesWanted(this.world) ? 'Sac plein — allez livrer le chantier' : 'Sac plein — tapez le sac, puis « Jeter »';
  }

  /** « Mairie bâtie ! » qui monte du toit d'un bâtiment achevé et s'efface. */
  private celebrate(entity: Entity, message: string): void {
    const { x, y } = this.project((entity.tx + entity.width / 2) * TILE_SIZE, (entity.ty - 1) * TILE_SIZE);
    const floater = element('span', 'hud-built');

    floater.style.left = `${Math.round(x)}px`;
    floater.style.top = `${Math.round(y)}px`;
    floater.textContent = message;
    this.floats.append(floater);
    window.setTimeout(() => floater.remove(), BUILT_MS);
  }

  /** `fps`, `chunks`, `atlas` et `water` viennent du renderer : le monde ne les connaît pas. */
  public update(fps: number, chunks: number, atlas: AtlasStats, water: WaterStats, weatherParticles = 0): void {
    this.updateQuest();
    this.updateFold();
    this.updateHint();
    this.updateBag();
    this.updateTown();
    this.updateSpeech();
    this.updateWeather();
    this.placeCelebration();
    this.root.dataset['danger'] = String(this.mutantCount() > 0 && !this.world.defeated);
    if (!this.banner.hidden) this.aimBanner();
    if (this.root.dataset['alarm'] === 'true' && (performance.now() > this.alarmUntil || this.world.defeated)) {
      this.root.dataset['alarm'] = 'false';
    }

    if (this.debug) this.updateStats(fps, chunks, atlas, water, weatherParticles);
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

      this.quest.dataset['mode'] = 'build';
      this.questTitle.textContent = objectiveLabel(world.objective);
      this.questBody.replaceChildren(
        text('hud-quest-goal', `Bâtir la ${name}`),
        ...cost.map(([item, needed]) => meter(item, hall.delivered[item] ?? 0, needed)),
      );

      const have = cost.reduce((sum, [item, needed]) => sum + Math.min(hall.delivered[item] ?? 0, needed), 0);
      const need = cost.reduce((sum, [, needed]) => sum + needed, 0);

      this.questStrip.replaceChildren(buildingIcon(hall.proto, 22), text('hud-strip-title', `Bâtir la ${name}`), text('hud-strip-value', `${have}/${need}`));
      return;
    }

    if (!hall) {
      key = 'fallen';
      if (key === this.lastQuest) return;
      this.lastQuest = key;
      this.quest.dataset['mode'] = 'fallen';
      this.questTitle.textContent = 'Défaite';
      this.questBody.replaceChildren(text('hud-quest-goal', `La ${name.toLowerCase()} est tombée.`));
      this.questStrip.replaceChildren(uiIcon('heart', 18), text('hud-strip-title', `La ${name.toLowerCase()} est tombée.`));
      return;
    }

    const max = BUILDINGS[hall.proto].hp;

    this.hallLow = hall.hp / max < QUEST_ALERT_HP;

    const mutants = this.mutantCount();
    const time = world.clock();
    const dark = time?.phase === 'night';
    const { adults, children, workers } = world.population();
    const people = adults + children;
    const crew = world.workforce();
    // Pendant la nuit, le temps qu'il reste avant l'aube ; sinon, avant la prochaine nuit.
    const seconds = time ? Math.ceil((dark ? time.left : ticksToNight(time)) / TICKS_PER_SECOND) : 0;
    const next = time ? time.cycle + (time.phase === 'dawn' ? 1 : 0) : 1;
    if (this.crewOpen && world.tickCount - this.crewSince >= CREW_FOLD_TICKS) this.crewOpen = false;

    const status =
      mutants > 0
        ? `Nuit ${world.night} · ${mutants} mutant${mutants > 1 ? 's' : ''}`
        : dark
          ? `Nuit ${world.night} · aube dans ${clock(seconds)}`
          : `Nuit ${next} dans ${clock(seconds)}`;

    const quest = world.eve()?.state === 'idle' || world.eve()?.state === 'repair' ? currentQuest(world.questsDone) : null;
    const progress = quest ? questProgress(quest, world.entities.values()) : null;

    const objective = currentObjective(world);
    const goals = objective?.goals ?? [];
    const reached = goals.map((goal) => goalProgress(world, goal));
    const waits = goals.map((goal) => goalWait(world, goal));
    const waiting = goals.map((goal, i) => waitLabel(goal, waits[i]!));

    key = `hall:${world.objective}:${reached.map(({ have }) => have).join(',')}:${waiting.join(',')}:${hall.hp}:${status}:${people}:${workers}:${world.kills}:${quest}:${progress?.have}:${this.crewOpen && JSON.stringify(crew)}`;
    if (key === this.lastQuest) return;
    this.lastQuest = key;

    // L'objectif reste affiché pendant l'attaque : seul le titre crie.
    this.quest.dataset['mode'] = mutants > 0 ? 'wave' : 'defend';
    this.questTitle.textContent = mutants > 0 ? 'Attaque !' : objectiveLabel(world.objective);

    const goal = text('hud-quest-goal', objective?.title ?? 'Tenir le plus longtemps possible');
    const meters = goals.map((condition, i) => goalMeter(condition, reached[i]!.have, reached[i]!.need, waits[i]!));

    const hp = element('div', 'hud-meter hud-meter-hp');
    const hpLabel = text('hud-meter-label', name);

    hpLabel.prepend(uiIcon('heart', 18));
    const hpBar = bar(hall.hp / max);
    const hpValue = text('hud-meter-value', `${hall.hp}/${max}`);

    hp.dataset['low'] = String(hall.hp / max < 0.35);
    hp.append(hpLabel, hpBar, hpValue);

    const line = element('div', 'hud-quest-line');
    const wave = text('hud-quest-wave', status);

    const urgent = String(mutants > 0 || dark || seconds <= WAVE_WARNING_SECONDS);

    wave.dataset['urgent'] = urgent;
    const chips = element('div', 'hud-quest-chips');

    chips.append(chip('people', people + workers, 'Habitants'), this.crewChip(crew.total), chip('mutant', world.kills, 'Mutants abattus'));
    line.append(wave, chips);
    this.questBody.replaceChildren(goal, ...meters, hp, line);
    if (this.crewOpen) this.questBody.append(crewDetail(crew));

    if (quest && progress) {
      const row = element('div', 'hud-quest-eve');

      row.append(uiIcon('eve', 18), text('hud-quest-eve-label', QUESTS[quest].label), text('hud-meter-value', `${progress.have}/${progress.need}`));
      this.questBody.append(row);
    }

    // La ligne repliée : la première condition qui reste à remplir, l'attaque si elle crie.
    const shown = Math.max(0, reached.findIndex(({ have, need }) => have < need));
    const condition = goals[shown];
    // Une naissance qui se fait attendre prend la place du titre et du « 0/1 » : la ligne n'a pas la place des deux.
    const stripWait = condition?.type === 'births' && mutants === 0 ? stripTitle(condition, waits[shown]!, waiting[shown]!) : null;
    const stripHp = element('div', 'hud-strip-hp');
    const stripClock = text('hud-strip-clock', time ? clock(seconds) : '');

    stripHp.append(bar(hall.hp / max));
    stripHp.title = `${name} ${hall.hp}/${max}`;
    stripHp.dataset['low'] = hp.dataset['low'];
    stripClock.dataset['urgent'] = urgent;
    this.questStrip.dataset['urgent'] = String(mutants > 0);
    this.questStrip.replaceChildren(
      mutants > 0 ? uiIcon('mutant', 20) : condition ? goalIcon(condition) : uiIcon('goal', 20),
      ...(stripWait
        ? [stripWait]
        : [
            text('hud-strip-title', mutants > 0 ? 'Attaque !' : (objective?.title ?? 'Tenir le plus longtemps possible')),
            ...(condition && mutants === 0 ? [text('hud-strip-value', `${reached[shown]!.have}/${reached[shown]!.need}`)] : []),
          ]),
      stripHp,
      stripClock,
    );
  }

  /** Déplie la quête repliée pour `ticks`, sans raccourcir un dépliage plus long. */
  private unfoldQuest(ticks: number): void {
    this.questOpenUntil = Math.max(this.questOpenUntil, this.world.tickCount + ticks);
    this.updateFold();
  }

  /** Repliée ou non : seul un téléphone en tient compte (cf. `style.css`). */
  private updateFold(): void {
    const folded = String(this.world.tickCount >= this.questOpenUntil);

    if (this.quest.dataset['folded'] !== folded) this.quest.dataset['folded'] = folded;
  }

  /** Le compteur d'ouvriers : un tap déplie leur détail sous la ligne, un autre le replie — le temps s'en charge sinon. */
  private crewChip(total: number): HTMLElement {
    const node = text('hud-quest-chip hud-quest-crew', String(total), 'button');

    node.setAttribute('type', 'button');
    node.setAttribute('aria-label', `${total} ouvrier${total > 1 ? 's' : ''} — voir le détail`);
    node.setAttribute('aria-expanded', String(this.crewOpen));
    node.prepend(uiIcon('worker', 18));
    node.addEventListener('click', () => {
      this.crewOpen = !this.crewOpen;
      this.crewSince = this.world.tickCount;
      this.unfoldQuest(QUEST_TAP_TICKS);
      this.updateQuest();
    });
    return node;
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
        repaired: this.repaired,
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

  /* ----------------------------------------------------------------- météo */

  /** La capsule météo : l'annonce et son compte à rebours, puis le temps qu'il reste. */
  private updateWeather(): void {
    const { world } = this;
    const spell = world.weather();
    const next = spell ? null : world.nextWeather();
    const coming = next && next.start - world.tickCount <= WEATHER_CALENDAR.announceTicks ? next : null;
    const shown = spell ?? coming;
    let label = '';

    if (shown) {
      const seconds = Math.ceil(((spell ? shown.end : shown.start) - world.tickCount) / TICKS_PER_SECOND);
      const name = WEATHER[shown.id].label;

      label = spell ? `${name} · ${clock(seconds)}` : `${name} dans ${seconds} s`;
    }

    if (label === this.lastWeather) return;
    this.lastWeather = label;
    this.weather.hidden = !shown;
    if (!shown) return;

    this.weather.dataset['soon'] = String(!spell);
    this.weather.dataset['harsh'] = String(WEATHER[shown.id].harsh);
    this.weather.textContent = label;
  }

  /* ------------------------------------------------------------------- sac */

  /**
   * Le sac : son pictogramme, « 7/60 », la jauge de remplissage, et une
   * pastille « icône + quantité » par objet. Le DOM n'est reconstruit que si
   * le contenu change — comparer une clé texte coûte moins qu'un diff.
   *
   * Sur un téléphone, la carte se replie en pastille (cf. `style.css`) :
   * seuls restent le compte, la jauge, le total de la ville et l'objet que
   * le conseil réclame, tous déjà là, cachés sur grand écran.
   */
  private updateBag(): void {
    const { inventory } = this.world.player;
    const entries = inventory.entries();
    const stock = this.world.townStock();
    const town = stock?.entries().reduce((sum, [, amount]) => sum + amount, 0) ?? null;
    const wanted = this.wanted;
    const key = `${inventory.total()}/${inventory.capacity}|${entries.map(([item, amount]) => `${item}:${amount}`).join(',')}|${town}|${wanted}`;

    if (key === this.lastBag) return;
    this.lastBag = key;

    const title = element('div', 'hud-bag-title');
    const fill = element('div', 'hud-bag-fill');
    const ratio = inventory.total() / inventory.capacity;

    title.append(uiIcon('bag', 20), text('hud-stock-name', 'Sac'), text('hud-bag-count', `${inventory.total()}/${inventory.capacity}`));
    if (town !== null) {
      const summary = text('hud-bag-town', String(town));

      summary.prepend(uiIcon('town', 18));
      title.append(summary);
    }
    if (wanted) {
      const chip = itemAmount(wanted, inventory.count(wanted));

      chip.classList.add('hud-bag-wanted');
      title.append(chip);
    }
    title.dataset['full'] = String(inventory.freeSpace() <= 0);
    this.bag.setAttribute(
      'aria-label',
      `Ouvrir le sac : ${inventory.total()} objets sur ${inventory.capacity}${town === null ? '' : `, ${town} en ville`}`,
    );
    fill.style.setProperty('--fill', `${Math.round(ratio * 100)}%`);
    fill.dataset['full'] = String(inventory.freeSpace() <= 0);

    const items = element('div', 'hud-stock-items');

    items.append(...entries.map(([item, amount]) => itemAmount(item, amount)));
    this.bag.dataset['empty'] = String(entries.length === 0);
    this.bag.replaceChildren(title, fill, items);
  }

  /**
   * La ville : le stock commun, ce que les chantiers et les porteurs
   * consomment. Tant que la mairie est en chantier, il n'y a pas de ville —
   * la carte le dit au lieu de montrer un stock vide.
   */
  private updateTown(): void {
    const stock = this.world.townStock();
    const entries = stock?.entries() ?? [];
    const key = stock ? entries.map(([item, amount]) => `${item}:${amount}`).join(',') : 'none';

    if (key === this.lastTown) return;
    this.lastTown = key;

    const title = element('div', 'hud-bag-title');

    title.append(uiIcon('town', 20), text('hud-stock-name', 'Ville'));
    if (!stock) title.append(text('hud-town-state', 'à bâtir'));

    const items = element('div', 'hud-stock-items');

    items.append(...entries.map(([item, amount]) => itemAmount(item, amount)));
    this.town.dataset['empty'] = String(entries.length === 0);
    this.town.title = 'Stock de la ville : ce qui paie les constructions';
    this.town.replaceChildren(title, items);
  }

  /* ------------------------------------------------------------ célébration */

  /** Un objectif réussi : un bandeau qui dit ce qu'il rapporte, et des feuilles qui pleuvent. */
  private celebrateObjective(index: number): void {
    const objective = OBJECTIVES[index];

    if (!objective) return;

    const title = text('hud-celebration-title', 'Objectif réussi !');

    title.prepend(uiIcon('goal', 28));
    this.celebration.replaceChildren(
      title,
      text('hud-celebration-goal', objective.title),
      text('hud-celebration-text', objective.celebration),
    );
    this.celebration.hidden = false;
    this.celebration.style.animation = 'none';
    void this.celebration.offsetWidth;
    this.celebration.style.animation = '';

    window.clearTimeout(this.celebrationTimer);
    this.celebrationTimer = window.setTimeout(() => {
      this.celebration.hidden = true;
    }, CELEBRATION_MS);

    this.rainLeaves();
  }

  /**
   * Une fenêtre ouverte (bâtiment ou sac) : le bandeau ne se pose pas dessus.
   * Il se range sous la quête, à sa largeur, et la fenêtre se tasse sous lui
   * (`--celebration-bottom`, cf. le CSS) — jamais deux cartes l'une sur l'autre.
   */
  private placeCelebration(): void {
    const docked = !this.celebration.hidden && this.root.querySelector('.building-panel:not([hidden])') !== null;

    if (!docked) {
      if (this.root.dataset['celebration'] !== 'docked') return;
      delete this.root.dataset['celebration'];
      this.celebration.style.removeProperty('top');
      this.celebration.style.removeProperty('left');
      this.celebration.style.removeProperty('width');
      return;
    }

    const quest = this.quest.getBoundingClientRect();
    const above = this.weather.hidden ? quest.bottom : Math.max(quest.bottom, this.weather.getBoundingClientRect().bottom);

    this.root.dataset['celebration'] = 'docked';
    this.celebration.style.top = `${Math.round(above + CELEBRATION_GAP)}px`;
    this.celebration.style.left = `${Math.round(quest.left + quest.width / 2)}px`;
    this.celebration.style.width = `${Math.round(quest.width)}px`;
    // Le bas sans l'animation (qui le fait rebondir) : la fenêtre ne bouge pas avec.
    const bottom = this.celebration.offsetTop + this.celebration.offsetHeight;

    this.root.style.setProperty('--celebration-bottom', `${bottom}px`);
  }

  /** Des feuilles, des pétales : la pluie de confettis, en CSS. Chacune part au bout de sa chute. */
  private rainLeaves(): void {
    for (let i = 0; i < CONFETTI_COUNT; i += 1) {
      const leaf = uiIcon(CONFETTI[i % CONFETTI.length]!, 18 + Math.round(Math.random() * 12));

      leaf.classList.add('hud-leaf');
      leaf.style.left = `${Math.round(Math.random() * 100)}%`;
      leaf.style.setProperty('--delay', `${Math.round(Math.random() * 900)}ms`);
      leaf.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 120)}px`);
      leaf.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 900)}deg`);
      this.confetti.append(leaf);
      window.setTimeout(() => leaf.remove(), CONFETTI_MS + 1000);
    }
  }

  /* ---------------------------------------------------------------- victoire */

  private showVictory(): void {
    const { world } = this;
    const { adults, children, workers } = world.population();
    let buildings = 0;

    for (const entity of world.entities.values()) if (entity.kind !== 'site') buildings += 1;

    const rows: [string, string][] = [
      ['Nuits survécues', String(world.stats.nightsSurvived)],
      ['Mutants abattus', String(world.kills)],
      ['Habitants', String(adults + children + workers)],
      ['Bâtiments', String(buildings)],
      ['Temps de jeu', clock(Math.floor(world.victoryTick / TICKS_PER_SECOND))],
    ];

    this.victoryStats.replaceChildren(
      ...rows.flatMap(([label, value]) => [text('', label, 'dt'), text('', value, 'dd')]),
    );
    this.victory.hidden = false;
    this.rainLeaves();
  }

  /* ---------------------------------------------------------------- défaite */

  private showDefeat(): void {
    const { world } = this;
    const rows = defeatRows(world);

    this.defeatStats.replaceChildren(
      ...rows.flatMap(([label, value]) => [text('', label, 'dt'), text('', value, 'dd')]),
    );

    // Les mêmes graines que `main.ts` verse au jardin : le barème est une fonction pure du bilan.
    const seeds = seedsFor(world.colonyScore());
    const amount = text('overlay-seeds-amount', `+${seeds} graine${seeds > 1 ? 's' : ''}`);

    amount.prepend(uiIcon('seed', 28));
    this.defeatSeeds.replaceChildren(amount, text('overlay-seeds-hint', 'À planter au jardin des souvenirs, sur l’écran titre.'));
    this.defeat.hidden = false;
  }

  /* ------------------------------------------------------------------ debug */

  private updateStats(fps: number, chunks: number, atlas: AtlasStats, water: WaterStats, weatherParticles: number): void {
    const { cx, cy } = this.world.playerChunk();
    const lines = [
      `tick ${this.world.tickCount}   ${fps.toFixed(0)} fps   seed ${this.world.seed}`,
      `chunk ${cx},${cy}   ${chunks} blocs de sol   ${this.world.resources.size()} tuiles entamées`,
      `eau ${water.sprites} sprite(s) à l'écran, ${water.animated} animé(s)`,
      `atlas ${atlas.images} images → ${atlas.pages} texture(s), ${atlas.megapixels.toFixed(1)} Mpx @${atlas.resolution}x, ${atlas.ms} ms`,
      `${this.world.entities.size} bâtiment(s)   ${this.world.mobiles.size} mobile(s)   ${this.world.pendingWakes()} réveil(s)`,
      `météo ${this.world.weather()?.id ?? 'calme'}   ${weatherParticles} particule(s)`,
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
    document.removeEventListener('pointerdown', this.foldCrewOnTouch, { capture: true });
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

/** Le détail des ouvriers : une ligne par bâtiment qui emploie, affectés et libres, puis ce que font les porteurs. */
function crewDetail({ byBuilding, porters, assigned, free, missing }: Workforce): HTMLElement {
  const detail = element('div', 'hud-quest-crew-detail');
  const row = (icon: HTMLElement, label: string, count: number): HTMLElement => {
    const node = element('div', 'hud-quest-crew-row');

    node.append(icon, text('hud-quest-crew-label', label), text('hud-quest-crew-count', String(count)));
    return node;
  };

  if (byBuilding.length === 0) detail.append(text('hud-quest-crew-label', 'Aucun ouvrier pour l’instant.', 'div'));
  for (const { proto, count } of byBuilding) detail.append(row(buildingIcon(proto, 22), BUILDINGS[proto].label, count));
  if (byBuilding.length > 0) {
    detail.append(row(uiIcon('worker', 22), 'Affectés', assigned), row(uiIcon('worker', 22), 'Libres', free));
  }
  if (missing > 0) detail.append(row(uiIcon('worker', 22), 'Postes vides', missing));
  if (porters.busy + porters.idle > 0) {
    detail.append(
      row(uiIcon('worker', 22), 'Porteurs occupés', porters.busy),
      row(uiIcon('worker', 22), 'Porteurs en attente', porters.idle),
    );
  }
  return detail;
}

/** « Objectif 3/6 », ou « Mode infini » une fois la chaîne bouclée. */
function objectiveLabel(index: number): string {
  return index < OBJECTIVES.length ? `Objectif ${index + 1}/${OBJECTIVES.length}` : 'Mode infini';
}

/**
 * La jauge d'une condition d'objectif : ce qu'elle compte en icône, barre,
 * « 1/3 ». Une condition qui attend une horloge (`goalWait`) dit sous la
 * barre le temps qu'il reste, et sa barre avance avec l'horloge ; retenue
 * (la nurserie sans nourriture), la ligne passe en corail et dit pourquoi.
 */
function goalMeter(goal: Goal, have: number, need: number, wait: GoalWait | null): HTMLElement {
  const row = element('div', 'hud-meter');
  const running = wait && wait.blockedBy === null ? 1 - wait.remainingTicks / wait.durationTicks : 0;

  row.dataset['done'] = String(have >= need);
  row.dataset['blocked'] = String(wait?.blockedBy != null);
  row.append(goalIcon(goal), bar((have + running) / need), text('hud-meter-value', `${have}/${need}`));
  if (wait) row.append(text('hud-meter-wait', waitLabel(goal, wait)));
  return row;
}

/** L'attente en version courte, pour la ligne repliée : « bébé 2:41 », « 2 nourritures » ; `null` sans attente. */
function stripTitle(goal: Goal, wait: GoalWait | null, label: string): HTMLElement | null {
  if (!wait) return null;

  const short =
    wait.blockedBy === 'paused'
      ? 'en pause'
      : wait.blockedBy
        ? `${wait.missing} ${ITEMS[wait.blockedBy].label.toLowerCase()}${wait.missing > 1 ? 's' : ''}`
        : `${goal.type === 'births' ? 'bébé' : 'nuit'} ${clock(Math.ceil(wait.remainingTicks / TICKS_PER_SECOND))}`;
  const node = text('hud-strip-title', short);

  node.title = label;
  node.dataset['blocked'] = String(wait.blockedBy !== null);
  return node;
}

/** « bébé dans 2:41 », « prochaine dans 1:12 », « la nurserie attend 2 nourritures » — vide sans attente. */
function waitLabel(goal: Goal, wait: GoalWait | null): string {
  if (!wait) return '';

  const nursery = LORE.buildings.nursery.name.toLowerCase();

  if (wait.blockedBy === 'paused') return `la ${nursery} est en pause`;
  if (wait.blockedBy) {
    const label = ITEMS[wait.blockedBy].label.toLowerCase();

    return `la ${nursery} attend ${wait.missing} ${label}${wait.missing > 1 ? 's' : ''}`;
  }

  const left = clock(Math.ceil(wait.remainingTicks / TICKS_PER_SECOND));

  return goal.type === 'births' ? `bébé dans ${left}` : `prochaine dans ${left}`;
}

/** Ce que compte une condition d'objectif, en icône. */
function goalIcon(goal: Goal): HTMLElement {
  return goal.type === 'build'
    ? buildingIcon(goal.building, 22)
    : goal.type === 'produce'
      ? itemIcon(goal.item, 18)
      : uiIcon(goal.type === 'nights' ? 'mutant' : goal.type === 'quests' ? 'eve' : 'people', 18);
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

/**
 * Le bilan de l'écran de défaite. Les nuits survécues sont les aubes
 * atteintes, comme à la victoire : la mairie peut tomber de jour.
 */
export function defeatRows(world: World): [string, string][] {
  const survived = Math.floor((world.defeatTick || world.tickCount) / TICKS_PER_SECOND);

  return [
    ['Nuits survécues', String(world.stats.nightsSurvived)],
    ['Mutants abattus', String(world.kills)],
    ['Temps tenu', clock(survived)],
  ];
}

/** « 1:05 » ou « 0:09 » à partir d'un nombre de secondes. */
export function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
