/**
 * HUD.
 *
 * Du DOM au-dessus du canvas, pas du texte Pixi : sur mobile le texte système
 * est net à toutes les densités, se met à l'échelle avec les réglages
 * d'accessibilité, et ne coûte pas un atlas de police.
 *
 * Le HUD **lit** le monde et s'abonne à ses événements. Il ne le modifie
 * jamais — c'est le rôle des commandes.
 */

import { ITEMS } from '../data/items.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import type { World } from '../sim/world.ts';

const REJECTION_LABELS: Record<PlacementRejection, string> = {
  occupied: 'Emplacement déjà occupé',
  terrain: 'Terrain non constructible',
  outOfReach: 'Trop loin — rapprochez-vous',
};

export class Hud {
  public readonly root: HTMLElement;

  private readonly stats: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;

  private readonly world: World;

  public constructor(world: World) {
    this.world = world;
    this.root = document.createElement('div');
    this.root.className = 'hud';

    this.stats = document.createElement('div');
    this.stats.className = 'panel hud-stats';

    this.toast = document.createElement('div');
    this.toast.className = 'panel hud-toast';

    this.root.append(this.stats, this.toast);

    world.events.on('placementRejected', ({ reason }) => this.notify(REJECTION_LABELS[reason]));
  }

  public notify(message: string): void {
    this.toast.textContent = message;
    this.toast.dataset['visible'] = 'true';

    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.dataset['visible'] = 'false';
    }, 1600);
  }

  /** `fps` et `chunks` viennent du renderer : le monde ne les connaît pas. */
  public update(fps: number, chunks: number): void {
    const { cx, cy } = this.world.playerChunk();
    const lines = [
      `tick ${this.world.tickCount}   ${fps.toFixed(0)} fps`,
      `chunk ${cx},${cy}   ${chunks} bakés`,
      `${this.world.entities.size} bâtiment(s)   ${this.world.pendingWakes()} réveil(s)`,
    ];

    for (const entity of this.world.entities.values()) {
      const contents = entity.store
        .entries()
        .map(([item, amount]) => `${ITEMS[item].label} ${amount}`)
        .join(', ');

      lines.push(
        `#${entity.id} ${contents || 'vide'}${entity.blocked ? ' — arrêtée' : ''}`,
      );
    }

    this.stats.textContent = lines.join('\n');
  }

  public destroy(): void {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
  }
}
