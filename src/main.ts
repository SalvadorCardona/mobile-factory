/**
 * Câblage, et rien d'autre.
 *
 * Aucune règle de jeu ici : ce fichier crée le monde, le renderer, les
 * entrées, l'UI, l'audio, et les branche ensemble. Si une décision de
 * gameplay finit dans ce fichier, elle est au mauvais endroit.
 */

import './style.css';
import { AudioEngine } from './audio/engine.ts';
import { assertPrototypes } from './data/validate.ts';
import { PALETTE } from './data/artDirection.ts';
import { MENU_BUILDING_IDS } from './data/buildings.ts';
import type { ItemId } from './data/items.ts';
import { Inspect } from './input/inspect.ts';
import { Joystick } from './input/joystick.ts';
import { Keyboard } from './input/keyboard.ts';
import { Placement } from './input/placement.ts';
import { PointerRouter } from './input/pointer.ts';
import { GameRenderer } from './render/renderer.ts';
import { STEP_MS, World } from './sim/world.ts';
import { TILE_SIZE } from './core/grid.ts';
import { BuildingPanel } from './ui/buildingPanel.ts';
import { BuildMenu } from './ui/buildMenu.ts';
import { Hud } from './ui/hud.ts';

/**
 * Clamp anti-spirale de la mort.
 *
 * Critique sur mobile : revenir sur l'onglet après deux minutes en arrière-plan
 * demanderait 2 400 ticks en une frame, ce qui gèle l'application — et comme le
 * gel rallonge le retard, elle ne s'en remet jamais. Au-delà de 250 ms, on
 * saute le temps perdu au lieu de le rattraper.
 */
const MAX_FRAME_MS = 250;

/** Seuil sous lequel un mouvement d'axe ne vaut pas une commande. */
const AXIS_EPSILON = 0.01;

/** Couleurs des éclats projetés quand Adam entame une ressource. */
const HARVEST_COLORS: Record<ItemId, readonly number[]> = {
  wood: [PALETTE.trunk, PALETTE.beam, PALETTE.leavesLight],
  stone: [PALETTE.rock, PALETTE.rockLight, PALETTE.rockDark],
  ironOre: [PALETTE.rock, PALETTE.iron, PALETTE.ironLight],
  coal: [PALETTE.rock, PALETTE.coal, PALETTE.coalLight],
  food: [PALETTE.leaves, PALETTE.leavesLight, PALETTE.dirt],
};

/** Les gestes qui comptent comme une activation utilisateur pour l'audio. */
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const;

const MUTANT_COLORS = [PALETTE.radioactive, PALETTE.mutantSkin, PALETTE.mutantSkinShadow];
const RUBBLE_COLORS = [PALETTE.plaster, PALETTE.brick, PALETTE.rockDark, PALETTE.beam];

async function main(): Promise<void> {
  // Le contrôle d'intégrité des prototypes ne tourne qu'en dev : en production
  // les données sont figées au build, et TypeScript a déjà tout vérifié.
  if (import.meta.env.DEV) assertPrototypes();

  const mount = document.querySelector<HTMLDivElement>('#app');

  if (!mount) throw new Error('#app introuvable');

  const world = new World(readSeed());
  const renderer = await GameRenderer.create(world, mount, import.meta.env.BASE_URL);
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
  );

  const hud = new Hud(world);
  const buildMenu = new BuildMenu(placement, MENU_BUILDING_IDS, () => audio.play('open'));
  const panel = new BuildingPanel(world, () => audio.play('open'));
  const inspect = new Inspect(
    world,
    (x, y) => renderer.screenToWorld(x, y),
    () => placement.mode === 'idle',
    (id) => panel.show(id),
  );

  hud.root.append(buildMenu.root, panel.root);
  mount.append(hud.root);

  // Ordre d'interrogation des doigts : l'inspection d'abord (elle ne
  // revendique qu'un tap sur un bâtiment), le placement ensuite (il ne
  // revendique rien tant qu'aucun bâtiment n'est armé — mais armé, il doit
  // passer avant le joystick, sinon on ne peut pas construire sur la moitié
  // gauche de l'écran), le joystick en dernier.
  const pointers = new PointerRouter(renderer.canvas);

  pointers.add(inspect);
  pointers.add(placement);
  pointers.add(joystick);

  wireAudio(world, audio, hud);
  wireParticles(world, renderer);

  let accumulator = 0;
  let lastAxisX = 0;
  let lastAxisY = 0;

  renderer.app.ticker.add((ticker) => {
    accumulator += Math.min(ticker.deltaMS, MAX_FRAME_MS);

    while (accumulator >= STEP_MS) {
      pushAxisIfChanged();
      world.tick();
      accumulator -= STEP_MS;
    }

    renderer.draw(accumulator / STEP_MS, placement.mode !== 'idle', placement.ghost, joystick.state);
    hud.update(ticker.FPS, renderer.bakedChunks);
    buildMenu.refresh();
    panel.update();
  });

  /**
   * L'axe est lu en continu mais ne devient une commande que lorsqu'il bouge
   * vraiment. Sans ce filtre, le journal de commandes — la base de la
   * rejouabilité — grossirait de 20 entrées par seconde sans rien apprendre.
   *
   * Le pouce a la priorité sur le clavier : sur un PC tactile, un joystick
   * posé pendant qu'une touche est tenue ne doit pas se battre avec elle.
   */
  function pushAxisIfChanged(): void {
    const { axisX, axisY } = joystick.state.active ? joystick.state : keyboard.state;

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
  world.events.on('siteDelivered', () => audio.play('deliver'));
  world.events.on('siteReady', () => audio.play('open'));
  world.events.on('buildingCompleted', () => audio.play('build'));
  world.events.on('arrowShot', () => audio.play('arrow'));
  world.events.on('mutantHit', () => audio.play('hit'));
  world.events.on('mutantDied', () => audio.play('die'));
  world.events.on('buildingDamaged', ({ hp }) => {
    if (hp > 0) audio.play('thud');
  });
  world.events.on('buildingDestroyed', () => audio.play('collapse'));
  world.events.on('waveStarted', () => audio.play('alarm'));
  world.events.on('childBorn', () => audio.play('baby'));
  world.events.on('townHallDestroyed', () => audio.play('defeat'));
}

/** Les éclats : copeaux à la coupe, sang vert à l'impact, gravats à l'effondrement. */
function wireParticles(world: World, renderer: GameRenderer): void {
  const { particles } = renderer;

  world.events.on('resourceHarvested', ({ tx, ty, item }) =>
    particles.burst((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, HARVEST_COLORS[item]),
  );
  world.events.on('mutantHit', ({ x, y }) => particles.burst(x, y - 12, MUTANT_COLORS, 4));
  world.events.on('mutantDied', ({ x, y }) => particles.burst(x, y - 12, MUTANT_COLORS, 12, 0.12));
  world.events.on('buildingDamaged', ({ id }) => {
    const entity = world.entities.get(id);

    if (entity) {
      particles.burst((entity.tx + entity.width / 2) * TILE_SIZE, (entity.ty + entity.height) * TILE_SIZE, RUBBLE_COLORS, 3);
    }
  });
  world.events.on('buildingDestroyed', ({ tx, ty }) =>
    particles.burst((tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE, RUBBLE_COLORS, 16, 0.14),
  );
}

/**
 * Seed depuis `?seed=1234`, sinon aléatoire.
 * Une seed dans l'URL, c'est une carte qu'on peut se repasser telle quelle —
 * indispensable pour reproduire un bug de génération.
 */
function readSeed(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : (Math.random() * 0xffffffff) >>> 0;
}

void main();
