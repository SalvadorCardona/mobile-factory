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
 * Trois panneaux : l'objectif (le chantier de la mairie, puis rien), le sac
 * d'Adam, et les statistiques de debug. Les récoltes et les livraisons
 * n'ouvrent pas de fenêtre : un mot qui flotte au-dessus du sac suffit.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { LORE } from '../data/lore.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import { siteMissing, type World } from '../sim/world.ts';

const REJECTION_LABELS: Record<PlacementRejection, string> = {
  occupied: 'Emplacement déjà occupé',
  terrain: 'Terrain non constructible',
  outOfReach: 'Trop loin — rapprochez-vous',
  resource: 'Dégagez d’abord les arbres et rochers',
  onPlayer: 'Vous êtes sur l’emplacement',
};

/** Durée de vie d'un mot flottant, en ms. */
const FLOAT_MS = 900;

export class Hud {
  public readonly root: HTMLElement;

  private readonly objective: HTMLElement;
  private readonly bag: HTMLElement;
  private readonly floats: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;
  private lastBag = '';
  private lastObjective = '';

  private readonly world: World;

  public constructor(world: World) {
    this.world = world;
    this.root = document.createElement('div');
    this.root.className = 'hud';

    this.objective = document.createElement('div');
    this.objective.className = 'panel hud-objective';

    this.bag = document.createElement('div');
    this.bag.className = 'panel hud-bag';

    this.floats = document.createElement('div');
    this.floats.className = 'hud-floats';

    this.stats = document.createElement('div');
    this.stats.className = 'panel hud-stats';

    this.toast = document.createElement('div');
    this.toast.className = 'panel hud-toast';

    this.root.append(this.objective, this.bag, this.floats, this.stats, this.toast);

    world.events.on('placementRejected', ({ reason }) => this.notify(REJECTION_LABELS[reason]));
    world.events.on('resourceHarvested', ({ item }) => this.float(`+1 ${ITEMS[item].label}`));
    world.events.on('siteDelivered', ({ item }) => this.float(`−1 ${ITEMS[item].label}`, true));
    world.events.on('inventoryFull', () => this.notify('Sac plein — livrez le chantier'));
    world.events.on('buildingCompleted', ({ id }) => {
      const entity = world.entities.get(id);

      if (entity) this.notify(`${BUILDINGS[entity.proto].label} terminée`, true);
    });
  }

  public notify(message: string, good = false): void {
    this.toast.textContent = message;
    this.toast.dataset['visible'] = 'true';
    this.toast.dataset['good'] = String(good);

    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.dataset['visible'] = 'false';
    }, 1600);
  }

  /** Un mot qui monte et s'efface. Le DOM le retire lui-même à la fin de l'animation. */
  private float(text: string, out = false): void {
    const element = document.createElement('span');

    element.className = 'hud-float';
    element.dataset['out'] = String(out);
    element.textContent = text;
    this.floats.append(element);
    window.setTimeout(() => element.remove(), FLOAT_MS);
  }

  /** `fps` et `chunks` viennent du renderer : le monde ne les connaît pas. */
  public update(fps: number, chunks: number): void {
    this.updateObjective();
    this.updateBag();

    const { cx, cy } = this.world.playerChunk();
    const lines = [
      `tick ${this.world.tickCount}   ${fps.toFixed(0)} fps`,
      `chunk ${cx},${cy}   ${chunks} bakés   ${this.world.resources.size()} tuiles entamées`,
      `${this.world.entities.size} bâtiment(s)   ${this.world.pendingWakes()} réveil(s)`,
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

  private updateObjective(): void {
    const hall = this.world.entities.get(this.world.townHallId);
    let text: string;

    if (hall?.kind === 'site') {
      const cost = BUILDINGS[hall.proto].cost;
      const parts = (Object.entries(cost) as [ItemId, number][]).map(
        ([item, needed]) => `${ITEMS[item].label} ${hall.delivered[item] ?? 0}/${needed}`,
      );

      text = `Construire la ${LORE.buildings.townHall.name} — ${parts.join(', ')}`;
      if (siteMissing(hall) === 0) text = `${LORE.buildings.townHall.name} terminée`;
    } else {
      text = `${LORE.buildings.townHall.name} debout. Explorez, récoltez, forez.`;
    }

    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.objective.textContent = text;
  }

  private updateBag(): void {
    const { inventory } = this.world.player;
    const entries = inventory.entries();
    const text =
      `Sac ${inventory.total()}/${inventory.capacity}` +
      (entries.length ? '\n' + entries.map(([item, amount]) => `${ITEMS[item].label} ${amount}`).join('\n') : '');

    if (text === this.lastBag) return;
    this.lastBag = text;
    this.bag.textContent = text;
  }

  public destroy(): void {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
  }
}
