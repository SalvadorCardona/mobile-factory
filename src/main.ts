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
import { prefetchMusic } from './audio/music.ts';
import { assertPrototypes } from './data/validate.ts';
import { GROUND, PARTICLES, type ParticleStyle } from './data/artDirection.ts';
import { MENU_BUILDING_IDS } from './data/buildings.ts';
import type { WildlifeId } from './data/enemies.ts';
import type { ItemId } from './data/items.ts';
import { OBJECTIVES, type ObjectiveProto } from './data/objectives.ts';
import { TEST_SCENARIOS } from './data/testScenario.ts';
import { IndicatorTap } from './input/indicatorTap.ts';
import { seedsFor, type PerkId } from './data/perks.ts';
import { Inspect } from './input/inspect.ts';
import { Joystick } from './input/joystick.ts';
import { Keyboard, isTyping, type KeyboardState } from './input/keyboard.ts';
import { Placement } from './input/placement.ts';
import { PointerRouter } from './input/pointer.ts';
import { Pinch, bindWheelZoom } from './input/zoom.ts';
import { GameRenderer } from './render/renderer.ts';
import { isUnlocked } from './sim/eve.ts';
import { activePerks, harvestSeeds, plant, type Garden } from './sim/garden.ts';
import { stageScenario } from './sim/testScenario.ts';
import type { Entity } from './sim/types.ts';
import { STEP_MS, World } from './sim/world.ts';
import { LocalGarden } from './storage/localGarden.ts';
import { LocalRecord } from './storage/localRecord.ts';
import { LocalSave, type LoadResult } from './storage/localSave.ts';
import { LocalZoom } from './storage/localZoom.ts';
import { TILE_SIZE } from './core/grid.ts';
import { BuildingPanel } from './ui/buildingPanel.ts';
import { CaravanPanel } from './ui/caravanPanel.ts';
import { InventoryPanel } from './ui/inventoryPanel.ts';
import { escapeAction } from './ui/escape.ts';
import { JoystickView } from './ui/joystick.ts';
import { BuildMenu } from './ui/buildMenu.ts';
import { Hud } from './ui/hud.ts';
import { PauseScreen, TitleScreen } from './ui/screens.ts';
import { formatSeed, parseSeed } from './ui/seed.ts';
import { testBanner, testScenarioOf } from './ui/testRoute.ts';
import { ZoomControls } from './ui/zoomControls.ts';

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

/** Distance, en tuiles, à laquelle Adam entend la hache d'un bûcheron. */
const CHOP_HEARING_TILES = 9;

/** Ce qui saute d'une ressource entamée, ou d'un butin ramassé : la famille de l'objet. */
const ITEM_PARTICLES: Record<ItemId, ParticleStyle> = {
  wood: PARTICLES.wood,
  stone: PARTICLES.stone,
  ironOre: PARTICLES.iron,
  coal: PARTICLES.coal,
  food: PARTICLES.food,
  ironPlate: PARTICLES.iron,
  mutantGoo: PARTICLES.mutant,
  wolfFang: PARTICLES.bone,
  crabClaw: PARTICLES.claw,
  radCore: PARTICLES.mutant,
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

const BEAST_PARTICLES: Record<WildlifeId, ParticleStyle> = {
  crab: PARTICLES.claw,
  wolf: PARTICLES.fur,
};
/** Les éclats d'un mur frappé : ceux de la pierre, dans l'ombre de la roche. */
const CHIP_PARTICLES: ParticleStyle = { ...PARTICLES.stone, colors: [GROUND.rock.shade] };

async function main(): Promise<void> {
  // Le contrôle d'intégrité des prototypes ne tourne qu'en dev : en production
  // les données sont figées au build, et TypeScript a déjà tout vérifié.
  if (import.meta.env.DEV) assertPrototypes();

  // La musique se télécharge pendant que l'écran titre se monte, sans le retarder.
  prefetchMusic();

  const mount = document.querySelector<HTMLDivElement>('#app');

  if (!mount) throw new Error('#app introuvable');

  /*
   * `…/test` : une base déjà bâtie, rebâtie à chaque chargement. Elle ne lit
   * ni n'écrit aucun stockage — ni la sauvegarde du joueur, ni son jardin,
   * ni son record — et s'ouvre sans écran titre.
   */
  const scenario = testScenarioOf(window.location.pathname, import.meta.env.BASE_URL);

  // Une partie sauvegardée reprend là où elle s'était arrêtée ; sinon, une carte neuve.
  const saves = scenario ? new LocalSave(null) : LocalSave.browser();
  const loaded = saves.load();
  const world = scenario
    ? stageScenario(TEST_SCENARIOS[scenario])
    : loaded.status === 'ok'
      ? loaded.world
      : new World(readSeed());

  // Le joystick repart au repos : un doigt posé au moment où l'onglet s'est fermé ne fait plus marcher Adam.
  if (loaded.status === 'ok') world.push({ type: 'setMoveAxis', x: 0, y: 0 });

  const renderer = await GameRenderer.create(world, mount);
  const audio = new AudioEngine();

  // En dev seulement : le monde sous la main dans la console du navigateur,
  // pour provoquer une vague ou une naissance sans attendre trois minutes.
  if (import.meta.env.DEV) Object.assign(window, { mobileFactory: { world } });

  const joystick = new Joystick();
  const stick = new JoystickView(joystick);
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
  // La fenêtre d'un bâtiment, le sac et le troc occupent la même place : l'un ferme les autres.
  const panel = new BuildingPanel(world, () => {
    inventory.close();
    trade.close();
    audio.play('open');
  });
  const inventory = new InventoryPanel(
    world,
    () => {
      panel.close();
      trade.close();
      audio.play('open');
    },
    (alert) => renderer.pointTo(alert.target, alert.item),
  );
  const trade = new CaravanPanel(world, () => {
    panel.close();
    inventory.close();
    audio.play('open');
  });

  // Adam arrive au contact de la caravane garée : la fenêtre Troc s'ouvre.
  world.events.on('caravanReached', ({ id }) => trade.show(id));
  const inspect = new Inspect(
    world,
    (x, y) => renderer.screenToWorld(x, y),
    // Pendant que la carte glisse d'elle-même, un tap viserait un point qui bouge : il n'ouvre rien.
    () => placement.mode === 'idle' && !renderer.cameraDrifting,
    (id) => panel.show(id),
    () => {
      hud.talkToEve();
      audio.play('open');
    },
    (id) => hud.showPerson(id),
    () => panel.open,
    () => panel.close(),
  );

  // Le zoom de la carte : un niveau choisi par le joueur, mémorisé sur l'appareil.
  const zoomPrefs = LocalZoom.browser();
  const savedZoom = zoomPrefs.load();

  if (savedZoom !== null) renderer.restoreZoom(savedZoom);

  let shownZoom = renderer.zoomLevel;
  const zoom = new ZoomControls({
    zoomIn: () => renderer.stepZoom(1),
    zoomOut: () => renderer.stepZoom(-1),
    recenter: () => renderer.resetZoom(),
  });

  hud.root.append(zoom.root, stick.root, buildMenu.root, panel.root, inventory.root, trade.root);
  stick.avoid([...buildMenu.root.children], hud.root);
  hud.bag.addEventListener('click', () => inventory.toggle());
  hud.setProjector((x, y) => renderer.worldToScreen(x, y));
  hud.setFocus((x, y) => renderer.peek(x, y));

  /*
   * L'horloge : la simulation n'avance que si la partie a commencé et n'est
   * pas en pause. Le rendu, lui, tourne toujours — la carte se dessine
   * derrière l'écran titre et derrière la pause.
   */
  let started = false;
  let paused = false;
  // L'écran de victoire arrête l'horloge jusqu'à « Continuer sans fin ».
  let celebrating = false;

  const autosave = wireSave(world, saves, () => started);
  const garden = wireGarden(world, scenario ? new LocalGarden(null) : LocalGarden.browser());
  const record = wireRecord(world, scenario ? new LocalRecord(null) : LocalRecord.browser());

  const pause = new PauseScreen(world.seed, () => setPaused(false), () => autosave.restart());
  const title = new TitleScreen({
    resume: loaded.status === 'ok',
    notice: LOAD_NOTICES[loaded.status] ?? linkNotice(world),
    garden: garden.current(),
    gardenActions: garden,
    record,
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

  world.events.on('victory', () => {
    celebrating = true;
    window.umami?.track('victoire');
  });
  hud.setOnContinue(() => {
    celebrating = false;
    accumulator = 0;
  });

  hud.pauseButton.addEventListener('click', () => setPaused(!paused));
  hud.root.append(pause.root);

  if (scenario) {
    started = true;
    hud.root.dataset['started'] = 'true';
    hud.root.append(testBanner(scenario));
  } else {
    hud.root.append(title.root);
  }
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
    if (event.code === 'KeyP') setPaused(!paused);
    // Échap ferme d'abord ce qui est au premier plan ; la pause, si rien ne l'est.
    if (event.code === 'Escape') {
      const action = escapeAction({
        paused,
        menuOpen: buildMenu.isOpen,
        panelOpen: panel.open || trade.open,
        inventoryOpen: inventory.open,
      });

      if (action === 'closeMenu') buildMenu.close();
      else if (action === 'closePanel') {
        panel.close();
        trade.close();
      }
      else if (action === 'closeInventory') inventory.close();
      else setPaused(action === 'pause');
    }
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

  // Ordre d'interrogation des doigts du canvas : le repère de la mairie
  // d'abord (il ne revendique qu'un doigt posé dessus), l'inspection ensuite
  // (elle ne revendique qu'un tap sur un bâtiment), le placement en dernier
  // (il ne revendique rien tant qu'aucun bâtiment n'est armé). Le joystick
  // est dans le DOM, au-dessus du canvas, et garde ses doigts pour lui —
  // Adam marche au pouce pendant que l'autre doigt vise. Un pouce qui rate
  // l'anneau, en bas au milieu, passe après les taps : l'anneau
  // saute sous lui, sauf si un bâtiment armé attend d'être posé.
  //
  // À la souris, le survol seul fait suivre le fantôme au curseur : le mode
  // PC se décide à l'événement (`pointerType`), le tactile n'en voit rien.
  const pointers = new PointerRouter(renderer.canvas, (sample) => placement.hover(sample));

  pointers.add(homeTap);
  pointers.add(inspect);
  pointers.add(stick.canvasFinger(renderer.canvas, () => placement.mode === 'idle'));
  pointers.add(placement);
  // Deux doigts sur la carte : le pinch, autour du milieu des deux. Il ne
  // prend que des doigts libres ou de tap — jamais le pouce du joystick ni
  // le doigt qui place un bâtiment.
  pointers.setGesture(new Pinch((factor, x, y) => renderer.zoomBy(factor, { x, y }, true)));
  // La molette zoome sous le curseur ; ni elle ni le pinch d'un pavé tactile ne zooment la page.
  bindWheelZoom(
    renderer.canvas,
    () => started && !paused,
    ({ factor, immediate }, x, y) => renderer.zoomBy(factor, { x, y }, immediate),
  );

  wireAudio(world, audio, hud, pause);
  wireParticles(world, renderer);
  wireAlarm(world, renderer, hud);
  // Le joueur vise ou lit : un bâtiment armé, le menu, une fenêtre ou le sac ouverts.
  wireShake(
    world,
    renderer,
    () => placement.mode !== 'idle' || buildMenu.isOpen || panel.open || inventory.open || trade.open,
  );

  let accumulator = 0;
  let frame = 0;
  let lastAxisX = 0;
  let lastAxisY = 0;

  renderer.app.ticker.add((ticker) => {
    if (started && !paused && !celebrating) accumulator += Math.min(ticker.deltaMS, MAX_FRAME_MS);

    while (accumulator >= STEP_MS && !celebrating) {
      pushAxisIfChanged();
      world.tick();
      accumulator -= STEP_MS;
    }
    if (started && !paused) autosave.update(ticker.deltaMS);

    const roadTool = placement.roadTool();

    renderer.draw(
      accumulator / STEP_MS,
      placement.armedBuilding(),
      placement.ghost,
      roadTool && { tool: roadTool, trail: placement.roadTrail() },
    );
    hud.update(ticker.FPS, renderer.bakedChunks, renderer.atlasStats, renderer.waterStats, renderer.weatherParticles);

    // Lire la mise en page force un reflow : une fois tous les dix cadres suffit.
    if (++frame % 10 === 0) {
      renderer.setHudInsets(hud.topInset(), bottomInset(), [
        ...hud.obstacles(),
        stick.root.getBoundingClientRect(),
        zoom.root.getBoundingClientRect(),
      ]);
      if (renderer.zoomLevel !== shownZoom) {
        shownZoom = renderer.zoomLevel;
        zoomPrefs.save(shownZoom);
      }
    }
    zoom.update(renderer.zoomLimits);
    renderer.setObjective(hud.wantedItem());
    renderer.setSelected(panel.shown);
    buildMenu.refresh();
    panel.update();
    inventory.update();
    trade.update();
    // Un menu, une fenêtre ou la pause par-dessus : le joystick s'efface et
    // lâche son doigt ; il revient à la fermeture.
    stick.setEnabled(started && !paused && !world.defeated && !buildMenu.isOpen && !panel.open && !inventory.open && !trade.open);
    if (hud.root.dataset['stick'] !== String(stick.shown)) hud.root.dataset['stick'] = String(stick.shown);
  });

  /**
   * Ce que le bas de l'écran occupe : le bouton « Bâtir », ou plus quand
   * le tiroir, la barre de placement ou la fenêtre d'un bâtiment sont ouverts.
   */
  function bottomInset(): number {
    const height = renderer.app.screen.height;
    let top = height - HUD_BOTTOM_INSET;

    for (const node of [...buildMenu.root.children, panel.root, inventory.root, trade.root]) {
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
function wireAudio(world: World, audio: AudioEngine, hud: Hud, pause: PauseScreen): void {
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

  // Onglet caché, plus de musique ; au retour, elle reprend. Si le navigateur
  // refuse de reprendre sans geste (iOS), le prochain doigt posé s'en charge.
  document.addEventListener('visibilitychange', () => {
    audio.setHidden(document.hidden);
    if (!document.hidden) for (const type of GESTURES) window.addEventListener(type, unlock);
  });

  hud.setMuted(audio.muted);
  hud.audioButton.addEventListener('click', () => hud.setMuted(audio.toggleMuted()));
  pause.setMusic(audio.musicOn);
  pause.musicButton.addEventListener('click', () => pause.setMusic(audio.toggleMusic()));

  // Une partie rechargée au crépuscule ou en pleine vague : l'oreille le sait aussitôt.
  const phase = world.clock()?.phase;

  if (phase === 'dusk' || phase === 'night') audio.night('dusk');
  if ([...world.mobiles.values()].some((mobile) => mobile.kind === 'mutant')) audio.night('wave');

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
  world.events.on('kidGrewUp', () => audio.play('baby'));
  world.events.on('beastHit', () => audio.play('hit'));
  world.events.on('beastDied', () => audio.play('die'));
  world.events.on('playerHurt', ({ hp }) => {
    if (hp > 0) audio.play('bite');
  });
  world.events.on('playerKnockedOut', () => audio.play('faint'));
  world.events.on('buildingDamaged', ({ hp }) => {
    if (hp > 0) audio.play('thud');
  });
  world.events.on('playerRepaired', () => audio.play('repair'));
  world.events.on('buildingDestroyed', () => audio.play('collapse'));
  world.events.on('siteCancelled', () => audio.play('deliver'));
  world.events.on('roadPaved', () => audio.play('deliver'));
  world.events.on('roadRemoved', () => audio.play('pickup'));
  world.events.on('waveCountdown', ({ seconds }) => {
    if (seconds === WAVE_ANNOUNCE_SECONDS) audio.play('horn');
    audio.play('countdown');
  });
  world.events.on('duskFell', () => audio.night('dusk'));
  world.events.on('waveStarted', ({ boss }) => {
    audio.play('alarm');
    audio.play('gloop');
    audio.night('wave');
    if (boss) audio.play('brute');
  });
  world.events.on('waveCleared', () => {
    audio.play('victory');
    audio.night('cleared');
  });
  world.events.on('dawnBroke', () => {
    audio.night('dawn');
    audio.play('dawn');
  });
  world.events.on('queenAnnounced', () => audio.play('horn'));
  world.events.on('queenLaid', () => audio.play('gloop'));
  world.events.on('queenDived', () => audio.play('gloop'));
  world.events.on('queenSlain', () => audio.play('objective'));
  world.events.on('lootPicked', () => audio.play('pickup'));
  world.events.on('childBorn', () => audio.play('baby'));
  world.events.on('eveArrived', () => audio.play('build'));
  world.events.on('traded', () => audio.play('deliver'));
  world.events.on('questCompleted', () => audio.play('build'));
  world.events.on('townHallDestroyed', () => {
    audio.play('defeat');
    audio.night('dawn');
  });
  // Le dernier objectif, et la fin d'un acte, ont leur fanfare à eux.
  world.events.on('objectiveCompleted', ({ index }) =>
    audio.play(index < OBJECTIVES.length - 1 && !(OBJECTIVES[index] as ObjectiveProto).banner ? 'objective' : 'colony'),
  );
  world.events.on('antennaRaised', () => audio.play('build'));
  world.events.on('antennaFell', () => audio.play('alarm'));
  world.events.on('survivorsArrived', () => audio.play('build'));
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
 * Les moments clés (un bâtiment terminé, une vague repoussée, l'aube, un
 * objectif réussi) arrivent en plein tick ; ils ne font que lever un drapeau, et
 * l'écriture attend la fin du tick, quand l'état est cohérent.
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
  world.events.on('siteCancelled', () => {
    due = true;
  });
  world.events.on('buildingUpgraded', () => {
    due = true;
  });
  world.events.on('objectiveCompleted', () => {
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
  // Un échange sac ⇄ coffre est un geste du joueur : il ne doit pas se perdre à la fermeture de l'onglet.
  world.events.on('itemsTransferred', () => {
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

/**
 * Le record « nuits tenues après le Signal » : chaque aube d'après le Signal
 * le propose, et la chute de la mairie aussi. Renvoie le record au démarrage,
 * pour l'écran titre.
 */
function wireRecord(world: World, records: LocalRecord): number {
  const offer = (): void => void records.offer(world.nightsAfterSignal());

  world.events.on('dawnBroke', offer);
  world.events.on('townHallDestroyed', offer);
  return records.load();
}

/** Les éclats : copeaux à la coupe, sang vert à l'impact, gravats à l'effondrement. */
function wireParticles(world: World, renderer: GameRenderer): void {
  const { particles } = renderer;

  world.events.on('resourceHarvested', ({ tx, ty, item }) =>
    particles.burst((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, ITEM_PARTICLES[item]),
  );
  // Les petits éclats d'un coup de hache de bûcheron, au pied du tronc.
  world.events.on('treeChopped', ({ tx, ty, remaining }) =>
    particles.burst((tx + 0.4) * TILE_SIZE, (ty + 0.8) * TILE_SIZE, PARTICLES.wood, remaining > 0 ? 3 : 8, 0.07),
  );
  // Chaque flèche qui porte ouvre un anneau blanc là où elle touche.
  world.events.on('mutantHit', ({ x, y }) => {
    particles.ring(x, y - 12);
    particles.burst(x, y - 12, PARTICLES.mutant, 4);
  });
  world.events.on('mutantDied', ({ x, y }) => {
    particles.ring(x, y - 12);
    particles.burst(x, y - 12, PARTICLES.mutant, 12, 0.12);
  });
  world.events.on('mutantFled', ({ x, y }) => particles.burst(x, y - 12, PARTICLES.mutant, 6, 0.1));
  world.events.on('beastHit', ({ proto, x, y }) => {
    particles.ring(x, y - 8);
    particles.burst(x, y - 8, BEAST_PARTICLES[proto], 4);
  });
  world.events.on('beastDied', ({ proto, x, y }) => {
    particles.ring(x, y - 8);
    particles.burst(x, y - 8, BEAST_PARTICLES[proto], 10, 0.12);
  });
  world.events.on('buildingDamaged', ({ id }) => {
    const entity = world.entities.get(id);

    if (!entity) return;

    const impact = impactOn(world, entity);

    particles.burst(impact.x, impact.y, CHIP_PARTICLES, 4);
  });
  world.events.on('buildingCorroded', ({ id }) => {
    const entity = world.entities.get(id);

    if (entity) particles.burst((entity.tx + entity.width / 2) * TILE_SIZE, entity.ty * TILE_SIZE + 8, PARTICLES.acid, 4);
  });
  world.events.on('buildingCompleted', ({ id }) => {
    const entity = world.entities.get(id);

    if (!entity) return;

    // Le bâtiment fait « pop » (`entityLayer.ts`), un anneau de poussière s'ouvre à son pied, puis
    // des confettis tout le long : ça y est, il tient debout.
    const foot = (entity.ty + entity.height) * TILE_SIZE;

    particles.dustRing((entity.tx + entity.width / 2) * TILE_SIZE, foot, entity.width * TILE_SIZE);
    for (let i = 0; i <= entity.width; i += 1) {
      particles.burst((entity.tx + i) * TILE_SIZE, foot, PARTICLES.confetti, 7, 0.16);
    }
  });
  world.events.on('buildingUpgraded', ({ id }) => {
    const entity = world.entities.get(id);

    if (!entity) return;

    // Des éclats de fer et des confettis qui sautent du haut de l'emprise : le blindage est vissé.
    for (let i = 0; i <= entity.width; i += 1) {
      particles.burst((entity.tx + i) * TILE_SIZE, entity.ty * TILE_SIZE, PARTICLES.iron, 6, 0.14);
      particles.burst((entity.tx + i) * TILE_SIZE, entity.ty * TILE_SIZE, PARTICLES.confetti, 5, 0.16);
    }
  });
  world.events.on('buildingDestroyed', ({ tx, ty }) =>
    particles.burst((tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE, PARTICLES.rubble, 16, 0.14),
  );
  world.events.on('siteCancelled', ({ tx, ty }) => particles.burst((tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE, PARTICLES.rubble, 8, 0.08));
  // Une poussière de pierre sur chaque dalle posée ou retirée.
  const roadDust = ({ tiles }: { tiles: readonly { tx: number; ty: number }[] }): void => {
    for (const { tx, ty } of tiles) particles.burst((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, PARTICLES.stone, 3, 0.06);
  };

  world.events.on('roadPaved', roadDust);
  world.events.on('roadRemoved', roadDust);
  world.events.on('lootDropped', ({ x, y }) => particles.burst(x, y - 6, PARTICLES.confetti, 5, 0.08));
  world.events.on('mutantStunned', ({ x, y }) => particles.burst(x, y - 16, PARTICLES.star, 6, 0.1));
  world.events.on('mutantHealed', ({ x, y }) => particles.burst(x, y - 12, PARTICLES.confetti, 10, 0.14));
  world.events.on('kidGrewUp', ({ x, y }) => particles.burst(x, y - 12, PARTICLES.confetti, 10, 0.14));
  world.events.on('lootPicked', ({ item, x, y }) => particles.burst(x, y - 6, ITEM_PARTICLES[item], 6, 0.1));
  world.events.on('waveCleared', () => {
    const hall = world.entities.get(world.townHallId);

    if (!hall) return;

    // Des confettis sur le toit de la mairie : elle a tenu.
    for (let i = 0; i <= hall.width; i += 1) {
      particles.burst((hall.tx + i) * TILE_SIZE, hall.ty * TILE_SIZE, PARTICLES.confetti, 8, 0.16);
    }
  });
}

/**
 * Où un bâtiment est frappé : le point de son emprise le plus proche du
 * mutant le plus proche, un peu au-dessus du sol. Le sim ne dit pas qui
 * frappe ; le plus proche, collé au mur, l'est presque toujours.
 */
function impactOn(world: World, entity: Entity): { x: number; y: number } {
  const left = entity.tx * TILE_SIZE;
  const top = entity.ty * TILE_SIZE;
  const right = (entity.tx + entity.width) * TILE_SIZE;
  const bottom = (entity.ty + entity.height) * TILE_SIZE;
  let x = (left + right) / 2;
  let y = bottom;
  let best = Infinity;

  for (const mobile of world.mobiles.values()) {
    if (mobile.kind !== 'mutant') continue;

    const px = Math.max(left, Math.min(right, mobile.x));
    const py = Math.max(top, Math.min(bottom, mobile.y));
    const distance = (px - mobile.x) ** 2 + (py - mobile.y) ** 2;

    if (distance < best) {
      best = distance;
      x = px;
      y = py;
    }
  }
  return { x, y: y - 10 };
}

/**
 * La mairie frappée hors de l'écran : son repère clignote, le bord de l'écran
 * vire au rouge et le téléphone vibre. Sous les yeux du joueur, la secousse suffit.
 */
function wireAlarm(world: World, renderer: GameRenderer, hud: Hud): void {
  world.events.on('buildingDamaged', ({ id, hp }) => {
    if (id === world.townHallId && hp > 0 && renderer.alarmTownHall()) hud.alarm();
  });
}

/**
 * La caméra encaisse les coups : un peu pour un mur, beaucoup pour la mairie.
 * Et elle recule un peu quand une vague s'annonce, le temps qu'elle sorte de
 * terre, pour qu'on la voie arriver — puis elle revient d'elle-même.
 *
 * Sauf si le joueur est occupé (`busy`) : la carte ne glisse pas sous un
 * bâtiment qu'on pose ou une fenêtre qu'on lit. Le bandeau et le repère de
 * bord de la vague disent la direction à sa place.
 */
function wireShake(world: World, renderer: GameRenderer, busy: () => boolean): void {
  world.events.on('waveCountdown', ({ seconds, x, y }) => {
    if (seconds === WAVE_ANNOUNCE_SECONDS && !busy()) renderer.zoomOut(WAVE_ZOOM, WAVE_ZOOM_MS, { x, y });
  });
  world.events.on('waveStarted', ({ x, y }) => {
    if (!busy()) renderer.zoomOut(WAVE_ZOOM, WAVE_ZOOM_MS - WAVE_ANNOUNCE_SECONDS * 1000, { x, y });
  });
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
