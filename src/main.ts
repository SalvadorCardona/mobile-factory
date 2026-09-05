/**
 * Câblage, et rien d'autre.
 *
 * Aucune règle de jeu ici : ce fichier crée le monde, le renderer, les
 * entrées, l'UI, et les branche ensemble. Si une décision de gameplay finit
 * dans ce fichier, elle est au mauvais endroit.
 */

import './style.css';
import { assertPrototypes } from './data/validate.ts';
import { MENU_BUILDING_IDS } from './data/buildings.ts';
import { Joystick } from './input/joystick.ts';
import { Placement } from './input/placement.ts';
import { PointerRouter } from './input/pointer.ts';
import { GameRenderer } from './render/renderer.ts';
import { STEP_MS, World } from './sim/world.ts';
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

/** Seuil sous lequel un mouvement de joystick ne vaut pas une commande. */
const AXIS_EPSILON = 0.01;

async function main(): Promise<void> {
  // Le contrôle d'intégrité des prototypes ne tourne qu'en dev : en production
  // les données sont figées au build, et TypeScript a déjà tout vérifié.
  if (import.meta.env.DEV) assertPrototypes();

  const mount = document.querySelector<HTMLDivElement>('#app');

  if (!mount) throw new Error('#app introuvable');

  const world = new World(readSeed());
  const renderer = await GameRenderer.create(world, mount, import.meta.env.BASE_URL);

  const joystick = new Joystick(() => renderer.app.screen.width);
  const placement = new Placement(
    world,
    (x, y) => renderer.screenToWorld(x, y),
    () => buildMenu.refresh(),
  );

  const hud = new Hud(world);
  const buildMenu = new BuildMenu(placement, MENU_BUILDING_IDS);

  hud.root.append(buildMenu.root);
  mount.append(hud.root);

  // Ordre d'interrogation des doigts : le joystick d'abord (il ne revendique
  // que la moitié gauche), le placement ensuite.
  const pointers = new PointerRouter(renderer.canvas);

  pointers.add(joystick);
  pointers.add(placement);

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

    renderer.draw(accumulator / STEP_MS, placement.ghost, joystick.state);
    hud.update(ticker.FPS, renderer.bakedChunks);
    buildMenu.refresh();
  });

  /**
   * Le joystick est lu en continu mais ne devient une commande que lorsqu'il
   * bouge vraiment. Sans ce filtre, le journal de commandes — la base de la
   * rejouabilité — grossirait de 20 entrées par seconde sans rien apprendre.
   */
  function pushAxisIfChanged(): void {
    const { axisX, axisY } = joystick.state;

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
