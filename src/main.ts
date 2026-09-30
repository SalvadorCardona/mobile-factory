/**
 * Câblage, et rien d'autre.
 *
 * Aucune règle de jeu ici : ce fichier crée le monde, le renderer, les
 * entrées, l'UI, l'audio, et les branche ensemble. Si une décision de
 * gameplay finit dans ce fichier, elle est au mauvais endroit.
 */

// Police arrondie embarquée dans le build, pas chargée d'un CDN : le jeu est
// une PWA, il doit avoir sa typo hors ligne. Fredoka plutôt qu'une autre :
// ses formes rondes répondent aux capsules de la direction artistique, et ses
// chiffres ne se confondent pas — un HUD de ressources, c'est d'abord des chiffres.
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { AudioEngine } from './audio/engine.ts';
import { assertPrototypes } from './data/validate.ts';
import { PALETTE, hex } from './data/artDirection.ts';
import { MENU_BUILDING_IDS } from './data/buildings.ts';
import type { WildlifeId } from './data/enemies.ts';
import type { ItemId } from './data/items.ts';
import { IndicatorTap } from './input/indicatorTap.ts';
import { seedsFor, type PerkId } from './data/perks.ts';
import { Inspect } from './input/inspect.ts';
import { Joystick } from './input/joystick.ts';
import { Keyboard, isTyping, type KeyboardState } from './input/keyboard.ts';
import { Placement } from './input/placement.ts';
import { PointerRouter } from './input/pointer.ts';
import { GameRenderer } from './render/renderer.ts';
import { isUnlocked } from './sim/eve.ts';
import { activePerks, harvestSeeds, plant, type Garden } from './sim/garden.ts';
import { STEP_MS, World } from './sim/world.ts';
import { LocalGarden } from './storage/localGarden.ts';
import { LocalSave, type LoadResult } from './storage/localSave.ts';
import { TILE_SIZE } from './core/grid.ts';
import { BuildingPanel } from './ui/buildingPanel.ts';
import { InventoryPanel } from './ui/inventoryPanel.ts';
import { BuildMenu } from './ui/buildMenu.ts';
import { Hud } from './ui/hud.ts';
import { PauseScreen, TitleScreen } from './ui/screens.ts';
import { formatSeed, parseSeed } from './ui/seed.ts';

/**
 * Clamp anti-spirale de la mort.
 *
 * Critique sur mobile : revenir sur l'onglet après deux minutes en arrière-plan
 * demanderait 2 400 ticks en une frame, ce qui gèle l'application — et comme le
 * gel rallonge le retard, elle ne s'en remet jamais. Au-delà de 250 ms, on
 * saute le temps perdu au lieu de le rattraper.
 */
const MAX_FRAME_MS = 250;

/** Hauteur du bouton « Bâtir » et de sa marge, en pixels écran : le minimum réservé en bas. */
const HUD_BOTTOM_INSET = 84;

/** Seuil sous lequel un mouvement d'axe ne vaut pas une commande. */
const AXIS_EPSILON = 0.01;

/** L'axe d'un clavier au repos : ce que lit le déplacement quand le menu de construction a le clavier. */
const STILL: KeyboardState = { active: false, axisX: 0, axisY: 0 };

/** Couleurs des éclats projetés quand Adam entame une ressource. */
/** Distance, en tuiles, à laquelle Adam entend la hache d'un bûcheron. */
const CHOP_HEARING_TILES = 9;

const HARVEST_COLORS: Record<ItemId, readonly number[]> = {
  wood: [PALETTE.mint.base, PALETTE.mint.light, PALETTE.orange.light, PALETTE.ink.light].map(hex),
  stone: [PALETTE.coral.base, PALETTE.coral.light, PALETTE.coral.shade].map(hex),
  ironOre: [PALETTE.cyan.base, PALETTE.cyan.light, PALETTE.cyan.shade].map(hex),
  coal: [PALETTE.ink.base, PALETTE.ink.light, PALETTE.yellow.light].map(hex),
  food: [PALETTE.yellow.base, PALETTE.mint.base, PALETTE.mint.light].map(hex),
  ironPlate: [PALETTE.cyan.base, PALETTE.cyan.light, PALETTE.ink.base].map(hex),
  mutantGoo: [PALETTE.toxic.base, PALETTE.toxic.light, PALETTE.toxic.shade].map(hex),
  wolfFang: [PALETTE.paper.base, PALETTE.paper.shade, PALETTE.ink.light].map(hex),
  crabClaw: [PALETTE.orange.base, PALETTE.orange.light, PALETTE.orange.shade].map(hex),
};

/**
 * Sauvegarde automatique toutes les cinq secondes de jeu. Sérialiser le monde
 * coûte quelques millisecondes : jamais à chaque frame, et jamais pendant un
 * tick — seulement entre deux.
 */
const AUTOSAVE_MS = 5000;

/** Ce que l'écran titre dit, discrètement, d'une sauvegarde qu'il n'a pas pu reprendre. */
const LOAD_NOTICES: Partial<Record<LoadResult['status'], string>> = {
  version: 'Ancienne sauvegarde d’une autre version : nouvelle partie.',
  corrupt: 'Sauvegarde illisible : nouvelle partie.',
};

/** Le compte à rebours d'une vague commence à tant de secondes : c'est là qu'elle s'annonce. */
const WAVE_ANNOUNCE_SECONDS = 3;

/**
 * Le recul de la caméra à l'annonce d'une vague : léger, et tenu le temps de
 * l'annonce et de la sortie des flaques — assez pour voir d'où elle vient,
 * pas assez pour gêner la récolte.
 */
const WAVE_ZOOM = 0.82;
const WAVE_ZOOM_MS = 5200;

/** Les gestes qui comptent comme une activation utilisateur pour l'audio. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const;

/** Umami expose cet objet globalement une fois `nx.js` chargé (voir index.html). */
declare global {
  interface Window {
    umami?: { track: (eventName: string) => void };
  }
}

const MUTANT_COLORS = [PALETTE.toxic.base, PALETTE.toxic.light, PALETTE.toxic.shade].map(hex);
const BEAST_COLORS: Record<WildlifeId, readonly number[]> = {
  crab: [PALETTE.coral.base, PALETTE.orange.base, PALETTE.coral.light].map(hex),
  wolf: [PALETTE.violet.base, PALETTE.violet.light, PALETTE.ink.light].map(hex),
};
const STAR_COLORS = [PALETTE.yellow.base, PALETTE.yellow.light, PALETTE.paper.base].map(hex);
const RUBBLE_COLORS = [PALETTE.yellow.base, PALETTE.yellow.shade, PALETTE.orange.base, PALETTE.violet.light].map(hex);
const CELEBRATION_COLORS = [PALETTE.yellow.base, PALETTE.coral.base, PALETTE.cyan.base, PALETTE.mint.base, PALETTE.violet.base].map(hex);

async function main(): Promise<void> {
  // Le contrôle d'intégrité des prototypes ne tourne qu'en dev : en production
  // les données sont figées au build, et TypeScript a déjà tout vérifié.
  if (import.meta.env.DEV) assertPrototypes();

  const mount = document.querySelector<HTMLDivElement>('#app');

  if (!mount) throw new Error('#app introuvable');

  // Une partie sauvegardée reprend là où elle s'était arrêtée ; sinon, une carte neuve.
  const saves = LocalSave.browser();
  const loaded = saves.load();
  const world = loaded.status === 'ok' ? loaded.world : new World(readSeed());

  // Le joystick repart au repos : un doigt posé au moment où l'onglet s'est fermé ne fait plus marcher Adam.
  if (loaded.status === 'ok') world.push({ type: 'setMoveAxis', x: 0, y: 0 });

  const renderer = await GameRenderer.create(world, mount);
  const audio = new AudioEngine();

  // En dev seulement : le monde sous la main dans la console du navigateur,
  // pour provoquer une vague ou une naissance sans attendre dix minutes.
  if (import.meta.env.DEV) Object.assign(window, { mobileFactory: { world } });

  const joystick = new Joystick(() => renderer.app.screen.width);
  const keyboard = new Keyboard();
  const placement = new Placement(
    world,
    (x, y) => renderer.screenToWorld(x, y),
    () => buildMenu.refresh(),
    () => {
      audio.play('deny');
      renderer.refuseGhost();
    },
  );

  const debug = import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug');
  const hud = new Hud(world, debug);
  const buildMenu = new BuildMenu(
    world,
    placement,
    MENU_BUILDING_IDS,
    () => audio.play('open'),
    (id) => isUnlocked(id, world.questsDone),
  );
  // La fenêtre d'un bâtiment et le sac occupent la même place : l'un ferme l'autre.
  const panel = new BuildingPanel(world, () => {
    inventory.close();
    audio.play('open');
  });
  const inventory = new InventoryPanel(world, () => {
    panel.close();
    audio.play('open');
  });
  const inspect = new Inspect(
    world,
    (x, y) => renderer.screenToWorld(x, y),
    () => placement.mode === 'idle',
    (id) => panel.show(id),
    () => {
      hud.talkToEve();
      audio.play('open');
    },
  );

  hud.root.append(buildMenu.root, panel.root, inventory.root);
  hud.bag.addEventListener('click', () => inventory.toggle());
  hud.setProjector((x, y) => renderer.worldToScreen(x, y));

  /*
   * L'horloge : la simulation n'avance que si la partie a commencé et n'est
   * pas en pause. Le rendu, lui, tourne toujours — la carte se dessine
   * derrière l'écran titre et derrière la pause.
   */
  let started = false;
  let paused = false;

  const autosave = wireSave(world, saves, () => started);
  const garden = wireGarden(world, LocalGarden.browser());

  const pause = new PauseScreen(world.seed, () => setPaused(false), () => autosave.restart());
  const title = new TitleScreen({
    resume: loaded.status === 'ok',
    notice: LOAD_NOTICES[loaded.status] ?? linkNotice(world),
    garden: garden.current(),
    gardenActions: garden,
    onPlay: () => {
      // Une nouvelle colonie part avec les bonus du jardin ; une colonie reprise garde les siens.
      if (loaded.status !== 'ok') world.push({ type: 'applyPerks', perks: activePerks(garden.current()) });
      started = true;
      hud.root.dataset['started'] = 'true';
      window.umami?.track(loaded.status === 'ok' ? 'partie-reprise' : 'partie-demarree');
    },
    onRestart: () => autosave.restart(),
  });

  function setPaused(value: boolean): void {
    if (!started || world.defeated) return;
    paused = value;
    pause.visible = value;
    accumulator = 0;
  }

  hud.pauseButton.addEventListener('click', () => setPaused(!paused));
  hud.root.append(pause.root, title.root);
  mount.append(hud.root);

  /*
   * Le menu de construction au clavier : Espace, flèches, Entrée, Échap.
   * Écouté en phase de capture, donc avant les autres écouteurs de `window` :
   * une touche que le menu prend ne fait ni marcher Adam ni basculer la pause.
   */
  window.addEventListener(
    'keydown',
    (event) => {
      if (isTyping(event.target)) return;

      const canOpen = started && !paused && !world.defeated;

      if (buildMenu.handleKey(event.code, event.repeat, canOpen)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );

  // Onglet caché, appel entrant, écran verrouillé : la partie s'arrête d'elle-même,
  // et elle est écrite tout de suite — sur mobile, un onglet caché peut être tué sans prévenir.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    setPaused(true);
    autosave.now();
  });
  window.addEventListener('pagehide', () => autosave.now());
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' || event.code === 'KeyP') setPaused(!paused);
    // Le sac, comme dans la plupart des jeux sur PC : I, lu par position comme ZQSD.
    if (event.code === 'KeyI' && !isTyping(event.target) && started && !paused) inventory.toggle();
    if (event.code === 'Backquote' && import.meta.env.DEV) hud.toggleDebug();
  });

  // Taper le repère de la mairie : sa fenêtre si Adam est à portée de
  // transfert, sinon un coup d'œil d'une seconde vers elle.
  const homeTap = new IndicatorTap(
    (x, y) => renderer.homeIndicatorAt(x, y),
    () => {
      const hall = world.entities.get(world.townHallId);

      if (!hall) return;
      if (world.inReach(hall)) panel.show(hall.id);
      else renderer.peek((hall.tx + hall.width / 2) * TILE_SIZE, (hall.ty + hall.height / 2) * TILE_SIZE);
    },
  );

  // Ordre d'interrogation des doigts : le repère de la mairie d'abord (il ne
  // revendique qu'un doigt posé dessus), l'inspection ensuite (elle ne
  // revendique qu'un tap sur un bâtiment), le placement ensuite (il ne
  // revendique rien tant qu'aucun bâtiment n'est armé — mais armé, il doit
  // passer avant le joystick, sinon on ne peut pas construire sur la moitié
  // gauche de l'écran), le joystick en dernier. Un glissé qui ne part pas du
  // fantôme, le placement le lâche : il revient au joystick, et Adam marche
  // pendant qu'on vise.
  //
  // À la souris, le survol seul fait suivre le fantôme au curseur : le mode
  // PC se décide à l'événement (`pointerType`), le tactile n'en voit rien.
  const pointers = new PointerRouter(renderer.canvas, (sample) => placement.hover(sample));

  pointers.add(homeTap);
  pointers.add(inspect);
  pointers.add(placement);
  pointers.add(joystick);

  wireAudio(world, audio, hud);
  wireParticles(world, renderer);
  wireShake(world, renderer);

  let accumulator = 0;
  let frame = 0;
  let lastAxisX = 0;
  let lastAxisY = 0;

  renderer.app.ticker.add((ticker) => {
    if (started && !paused) accumulator += Math.min(ticker.deltaMS, MAX_FRAME_MS);

    while (accumulator >= STEP_MS) {
      pushAxisIfChanged();
      world.tick();
      accumulator -= STEP_MS;
    }
    if (started && !paused) autosave.update(ticker.deltaMS);

    renderer.draw(accumulator / STEP_MS, placement.mode !== 'idle', placement.ghost, joystick.state);
    hud.update(ticker.FPS, renderer.bakedChunks, renderer.atlasStats, renderer.waterStats);

    // Lire la mise en page force un reflow : une fois tous les dix cadres suffit.
    if (++frame % 10 === 0) renderer.setHudInsets(hud.topInset(), bottomInset(), hud.obstacles());
    renderer.setObjective(hud.wantedItem());
    renderer.setSelected(panel.shown);
    buildMenu.refresh();
    panel.update();
    inventory.update();
  });

  /**
   * Ce que le bas de l'écran occupe : le bouton « Bâtir », ou plus quand
   * le tiroir, la barre de placement ou la fenêtre d'un bâtiment sont ouverts.
   */
  function bottomInset(): number {
    const height = renderer.app.screen.height;
    let top = height - HUD_BOTTOM_INSET;

    for (const node of [...buildMenu.root.children, panel.root, inventory.root]) {
      const rect = node.getBoundingClientRect();

      if (rect.height > 0) top = Math.min(top, rect.top);
    }
    return height - top;
  }

  /**
   * L'axe est lu en continu mais ne devient une commande que lorsqu'il bouge
   * vraiment. Sans ce filtre, le journal de commandes — la base de la
   * rejouabilité — grossirait de 20 entrées par seconde sans rien apprendre.
   *
   * Le pouce a la priorité sur le clavier : sur un PC tactile, un joystick
   * posé pendant qu'une touche est tenue ne doit pas se battre avec elle.
   * Menu de construction ouvert, le clavier sert à choisir un bâtiment :
   * une flèche tenue au moment de l'ouvrir n'emmène pas Adam avec elle.
   */
  function pushAxisIfChanged(): void {
    const keys = buildMenu.isOpen ? STILL : keyboard.state;
    const { axisX, axisY } = joystick.state.active ? joystick.state : keys;

    if (
      Math.abs(axisX - lastAxisX) < AXIS_EPSILON &&
      Math.abs(axisY - lastAxisY) < AXIS_EPSILON
    ) {
      return;
    }
    lastAxisX = axisX;
    lastAxisY = axisY;
    world.push({ type: 'setMoveAxis', x: axisX, y: axisY });
  }
}

/**
 * Un son par événement de simulation. Le moteur ne connaît pas le monde,
 * le monde ne connaît pas le moteur : la table est ici, et nulle part ailleurs.
 */
function wireAudio(world: World, audio: AudioEngine, hud: Hud): void {
  // Les navigateurs mobiles exigent un geste avant le moindre son : le
  // premier doigt posé n'importe où déverrouille tout, musique comprise.
  // On réessaie à chaque geste tant que le contexte n'a pas démarré — iOS
  // n'accepte pas toujours le premier `pointerdown` comme un vrai geste.
  const unlock = (): void => {
    audio.unlock();

    if (!audio.ready) return;
    for (const type of GESTURES) window.removeEventListener(type, unlock);
  };

  for (const type of GESTURES) window.addEventListener(type, unlock);

  hud.setMuted(audio.muted);
  hud.audioButton.addEventListener('click', () => hud.setMuted(audio.toggleMuted()));

  world.events.on('resourceHarvested', ({ item }) => audio.play(item === 'wood' ? 'chop' : 'rock'));
  // Une hache de bûcheron ne s'entend qu'à côté d'Adam : dix cabanes au loin ne font pas un vacarme.
  world.events.on('treeChopped', ({ tx, ty }) => {
    const dx = (tx + 0.5) * TILE_SIZE - world.player.x;
    const dy = (ty + 0.5) * TILE_SIZE - world.player.y;

    if (dx * dx + dy * dy <= (CHOP_HEARING_TILES * TILE_SIZE) ** 2) audio.play('chop');
  });
  world.events.on('siteDelivered', () => audio.play('deliver'));
  world.events.on('storeTaken', () => audio.play('deliver'));
  world.events.on('buildingSupplied', () => audio.play('deliver'));
  world.events.on('labSupplied', () => audio.play('deliver'));
  world.events.on('researchCompleted', () => audio.play('eureka'));
  world.events.on('townDeposited', () => audio.play('deliver'));
  world.events.on('itemDropped', () => audio.play('pickup'));
  world.events.on('buildingCompleted', () => audio.play('build'));
  world.events.on('buildingUpgraded', () => audio.play('upgrade'));
  world.events.on('arrowShot', () => audio.play('arrow'));
  world.events.on('mutantHit', () => audio.play('hit'));
  world.events.on('mutantDied', () => audio.play('die'));
  world.events.on('mutantStunned', () => audio.play('dizzy'));
  world.events.on('patientFollowing', () => audio.play('pickup'));
  world.events.on('patientAdmitted', () => audio.play('open'));
  world.events.on('mutantHealed', () => audio.play('baby'));
  world.events.on('beastHit', () => audio.play('hit'));
  world.events.on('beastDied', () => audio.play('die'));
  world.events.on('playerHurt', ({ hp }) => {
    if (hp > 0) audio.play('bite');
  });
  world.events.on('playerKnockedOut', () => audio.play('faint'));
  world.events.on('buildingDamaged', ({ hp }) => {
    if (hp > 0) audio.play('thud');
  });
  world.events.on('buildingDestroyed', () => audio.play('collapse'));
  world.events.on('waveCountdown', ({ seconds }) => {
    if (seconds === WAVE_ANNOUNCE_SECONDS) audio.play('horn');
    audio.play('countdown');
  });
  world.events.on('waveStarted', () => {
    audio.play('alarm');
    audio.play('gloop');
  });
  world.events.on('waveCleared', () => audio.play('victory'));
  world.events.on('lootPicked', () => audio.play('pickup'));
  world.events.on('childBorn', () => audio.play('baby'));
  world.events.on('eveArrived', () => audio.play('build'));
  world.events.on('questCompleted', () => audio.play('build'));
  world.events.on('townHallDestroyed', () => audio.play('defeat'));
}

interface Autosave {
  /** À appeler entre deux ticks : écrit la partie si l'intervalle est écoulé ou si un moment clé l'a demandé. */
  update(deltaMs: number): void;
  /** Écrit la partie sur-le-champ — onglet caché, page quittée. */
  now(): void;
  /** Efface la partie et recharge la page sur une carte neuve (ou la seed de l'URL). */
  restart(): void;
}

/**
 * La sauvegarde automatique. Elle n'écrit qu'une partie commencée — l'écran
 * titre ne doit pas écraser la sauvegarde qu'il propose de continuer — et
 * jamais une partie perdue : à la chute de la mairie, elle est effacée.
 *
 * Les moments clés (un bâtiment terminé, une vague repoussée, l'aube) arrivent en
 * plein tick ; ils ne font que lever un drapeau, et l'écriture attend la fin
 * du tick, quand l'état est cohérent.
 */
function wireSave(world: World, saves: LocalSave, started: () => boolean): Autosave {
  let elapsed = 0;
  let due = false;
  let enabled = true;

  const write = (): void => {
    elapsed = 0;
    due = false;
    if (!enabled || !started() || world.defeated) return;
    saves.save(world);
  };

  world.events.on('buildingCompleted', () => {
    due = true;
  });
  world.events.on('buildingUpgraded', () => {
    due = true;
  });
  const waveOver = (): void => {
    for (const mobile of world.mobiles.values()) if (mobile.kind === 'mutant') return;
    due = true;
  };

  world.events.on('mutantDied', waveOver);
  world.events.on('mutantStunned', waveOver);
  world.events.on('mutantHealed', () => {
    due = true;
  });
  world.events.on('dawnBroke', () => {
    due = true;
  });
  world.events.on('townHallDestroyed', () => saves.clear());

  return {
    update(deltaMs) {
      elapsed += deltaMs;
      if (due || elapsed >= AUTOSAVE_MS) write();
    },
    now: write,
    restart() {
      // Plus rien ne s'écrit : le `pagehide` du rechargement ressusciterait la partie effacée.
      enabled = false;
      saves.clear();
      window.umami?.track('partie-recommencee');
      window.location.reload();
    },
  };
}

interface GardenWiring {
  current(): Garden;
  plant(perk: PerkId): Garden;
  setPure(pure: boolean): Garden;
}

/**
 * Le jardin des souvenirs : les graines de la colonie tombée y entrent à la
 * chute de la mairie, une seule fois — la partie perdue est effacée juste
 * après, elle ne retombera pas. Chaque changement est écrit tout de suite,
 * sous sa propre clé : « Recommencer » n'y touche pas.
 */
function wireGarden(world: World, gardens: LocalGarden): GardenWiring {
  let garden = gardens.load();

  const keep = (next: Garden): Garden => {
    garden = next;
    gardens.save(next);
    return next;
  };

  world.events.on('townHallDestroyed', () => keep(harvestSeeds(garden, seedsFor(world.colonyScore()))));

  return {
    current: () => garden,
    plant: (perk) => keep(plant(garden, perk)),
    setPure: (pure) => keep({ ...garden, pure }),
  };
}

/** Les éclats : copeaux à la coupe, sang vert à l'impact, gravats à l'effondrement. */
function wireParticles(world: World, renderer: GameRenderer): void {
  const { particles } = renderer;

  world.events.on('resourceHarvested', ({ tx, ty, item }) =>
    particles.burst((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, HARVEST_COLORS[item]),
  );
  // Les petits éclats d'un coup de hache de bûcheron, au pied du tronc.
  world.events.on('treeChopped', ({ tx, ty, remaining }) =>
    particles.burst((tx + 0.4) * TILE_SIZE, (ty + 0.8) * TILE_SIZE, HARVEST_COLORS.wood, remaining > 0 ? 3 : 8, 0.07),
  );
  world.events.on('mutantHit', ({ x, y }) => particles.burst(x, y - 12, MUTANT_COLORS, 4));
  world.events.on('mutantDied', ({ x, y }) => particles.burst(x, y - 12, MUTANT_COLORS, 12, 0.12));
  world.events.on('mutantFled', ({ x, y }) => particles.burst(x, y - 12, MUTANT_COLORS, 6, 0.1));
  world.events.on('beastHit', ({ proto, x, y }) => particles.burst(x, y - 8, BEAST_COLORS[proto], 4));
  world.events.on('beastDied', ({ proto, x, y }) => particles.burst(x, y - 8, BEAST_COLORS[proto], 10, 0.12));
  world.events.on('buildingDamaged', ({ id }) => {
    const entity = world.entities.get(id);

    if (entity) {
      particles.burst((entity.tx + entity.width / 2) * TILE_SIZE, (entity.ty + entity.height) * TILE_SIZE, RUBBLE_COLORS, 3);
    }
  });
  world.events.on('buildingCompleted', ({ id }) => {
    const entity = world.entities.get(id);

    if (!entity) return;

    // Un nuage de poussière et des éclats dorés tout le long du pied du bâtiment : ça y est, il tient debout.
    for (let i = 0; i <= entity.width; i += 1) {
      particles.burst((entity.tx + i) * TILE_SIZE, (entity.ty + entity.height) * TILE_SIZE, RUBBLE_COLORS, 6, 0.05);
      particles.burst((entity.tx + i) * TILE_SIZE, (entity.ty + entity.height) * TILE_SIZE, CELEBRATION_COLORS, 7, 0.16);
    }
  });
  world.events.on('buildingUpgraded', ({ id }) => {
    const entity = world.entities.get(id);

    if (!entity) return;

    // Des éclats de fer et des confettis qui sautent du haut de l'emprise : le blindage est vissé.
    for (let i = 0; i <= entity.width; i += 1) {
      particles.burst((entity.tx + i) * TILE_SIZE, entity.ty * TILE_SIZE, HARVEST_COLORS.ironPlate, 6, 0.14);
      particles.burst((entity.tx + i) * TILE_SIZE, entity.ty * TILE_SIZE, CELEBRATION_COLORS, 5, 0.16);
    }
  });
  world.events.on('buildingDestroyed', ({ tx, ty }) =>
    particles.burst((tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE, RUBBLE_COLORS, 16, 0.14),
  );
  world.events.on('lootDropped', ({ x, y }) => particles.burst(x, y - 6, CELEBRATION_COLORS, 5, 0.08));
  world.events.on('mutantStunned', ({ x, y }) => particles.burst(x, y - 16, STAR_COLORS, 6, 0.1));
  world.events.on('mutantHealed', ({ x, y }) => particles.burst(x, y - 12, CELEBRATION_COLORS, 10, 0.14));
  world.events.on('lootPicked', ({ item, x, y }) => particles.burst(x, y - 6, HARVEST_COLORS[item], 6, 0.1));
  world.events.on('waveCleared', () => {
    const hall = world.entities.get(world.townHallId);

    if (!hall) return;

    // Des confettis sur le toit de la mairie : elle a tenu.
    for (let i = 0; i <= hall.width; i += 1) {
      particles.burst((hall.tx + i) * TILE_SIZE, hall.ty * TILE_SIZE, CELEBRATION_COLORS, 8, 0.16);
    }
  });
}

/**
 * La caméra encaisse les coups : un peu pour un mur, beaucoup pour la mairie.
 * Et elle recule un peu quand une vague s'annonce, le temps qu'elle sorte de
 * terre, pour qu'on la voie arriver — puis elle revient d'elle-même.
 */
function wireShake(world: World, renderer: GameRenderer): void {
  world.events.on('waveCountdown', ({ seconds, x, y }) => {
    if (seconds === WAVE_ANNOUNCE_SECONDS) renderer.zoomOut(WAVE_ZOOM, WAVE_ZOOM_MS, { x, y });
  });
  world.events.on('waveStarted', ({ x, y }) =>
    renderer.zoomOut(WAVE_ZOOM, WAVE_ZOOM_MS - WAVE_ANNOUNCE_SECONDS * 1000, { x, y }),
  );
  world.events.on('buildingDamaged', ({ id }) => renderer.shake(id === world.townHallId ? 0.28 : 0.14));
  world.events.on('buildingDestroyed', () => renderer.shake(0.6));
  world.events.on('waveStarted', () => renderer.shake(0.3));
  world.events.on('buildingCompleted', () => renderer.shake(0.18));
  world.events.on('buildingUpgraded', () => renderer.shake(0.12));
  world.events.on('townHallDestroyed', () => renderer.shake(1));
  world.events.on('playerHurt', () => renderer.shake(0.12));
  world.events.on('playerKnockedOut', () => renderer.shake(0.4));
}

/**
 * Seed depuis `?seed=1234`, sinon aléatoire.
 * Une seed dans l'URL, c'est une carte qu'on peut se repasser telle quelle —
 * indispensable pour reproduire un bug de génération.
 */
function readSeed(): number {
  return parseSeed(window.location.search) ?? (Math.random() * 0xffffffff) >>> 0;
}

/**
 * Un lien partagé mène à une carte, mais une sauvegarde l'emporte : elle
 * reprend sur la sienne. L'écran titre le dit, et « Nouvelle partie » ouvre
 * la carte du lien.
 */
function linkNotice(world: World): string | undefined {
  const linked = parseSeed(window.location.search);

  if (linked === null || linked === world.seed) return undefined;
  return `Le lien mène à la carte n° ${formatSeed(linked)} : « Nouvelle partie » pour la jouer.`;
}

void main();
