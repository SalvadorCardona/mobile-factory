/**
 * L'allumage de l'antenne : le Signal part.
 *
 * Au `signalSent`, des ondes cyan claires (`SIGNAL_WAVES`) partent de
 * l'émetteur, l'une après l'autre, et s'élargissent jusqu'à couvrir tout
 * l'écran en s'effaçant. Elles vivent en pixels écran, au-dessus de la nuit
 * — la nuit ne les éteint pas —, centrées sur l'antenne, qui peut bouger à
 * l'écran pendant que la caméra recule vers elle.
 *
 * Un minuteur de vue en millisecondes d'écran : la simulation n'en sait rien.
 * Sous `prefers-reduced-motion`, une seule onde, plus lente.
 */

import { Graphics } from 'pixi.js';
import { SIGNAL_WAVES, hex } from '../data/artDirection.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';

/** L'émetteur, au bout de la parabole (`art/antenna.ts`) : en pixels monde depuis le centre de l'emprise. */
const EMITTER_SHIFT = -22;
const EMITTER_RISE = 115;

const COLOR = hex(SIGNAL_WAVES.color);

export class SignalLayer {
  public readonly container = new Graphics();

  /** Le centre de l'emprise de l'antenne, en pixels monde, et le temps écoulé ; `null` au repos. */
  private wave: { x: number; y: number; elapsed: number } | null = null;

  private readonly calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  public constructor(world: World) {
    world.events.on('signalSent', ({ x, y }) => {
      this.wave = { x: x + EMITTER_SHIFT, y: y - EMITTER_RISE, elapsed: 0 };
    });
  }

  public update(camera: Camera, deltaMs: number): void {
    const wave = this.wave;

    this.container.clear();
    if (!wave) return;

    wave.elapsed += deltaMs;
    if (wave.elapsed >= SIGNAL_WAVES.durationMs) {
      this.wave = null;
      return;
    }

    const { x, y } = camera.worldToScreen(wave.x, wave.y);
    // Assez grand pour atteindre le coin d'écran le plus lointain.
    const reach = Math.hypot(Math.max(x, camera.viewWidth - x), Math.max(y, camera.viewHeight - y));
    const count = this.calm ? 1 : SIGNAL_WAVES.count;
    // Chaque onde met la moitié de l'allumage à traverser l'écran ; elles partent à intervalles réguliers.
    const travel = SIGNAL_WAVES.durationMs / 2;
    const gap = count > 1 ? (SIGNAL_WAVES.durationMs - travel) / (count - 1) : 0;

    for (let i = 0; i < count; i += 1) {
      const t = (wave.elapsed - i * gap) / (this.calm ? SIGNAL_WAVES.durationMs : travel);

      if (t <= 0 || t >= 1) continue;

      // Une sortie rapide qui ralentit : l'onde jaillit de l'émetteur, puis s'étale.
      const eased = 1 - (1 - t) * (1 - t);

      this.container
        .circle(x, y, 8 + eased * reach)
        .stroke({ width: SIGNAL_WAVES.thickness * (1 - t * 0.6), color: COLOR, alpha: 1 - t });
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}
