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
 * Quatre panneaux : l'objectif (le chantier de la mairie, puis sa santé et la
 * vague en cours), le sac d'Adam, les statistiques de debug, et — si la
 * mairie tombe — l'écran de défaite. Les récoltes et les livraisons
 * n'ouvrent pas de fenêtre : un mot qui flotte au-dessus du sac suffit.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { LORE } from '../data/lore.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import { siteMissing, type World } from '../sim/world.ts';
import { itemAmount, itemIcon } from './icons.ts';

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
  private readonly defeat: HTMLElement;
  public readonly audioButton: HTMLButtonElement;
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

    this.audioButton = document.createElement('button');
    this.audioButton.type = 'button';
    this.audioButton.className = 'hud-audio';
    this.audioButton.setAttribute('aria-label', 'Son');

    this.defeat = document.createElement('div');
    this.defeat.className = 'hud-defeat';
    this.defeat.hidden = true;

    const defeatPanel = document.createElement('div');
    const defeatTitle = document.createElement('h2');
    const defeatText = document.createElement('p');
    const retry = document.createElement('button');

    defeatPanel.className = 'panel';
    defeatTitle.textContent = `La ${LORE.buildings.townHall.name.toLowerCase()} est tombée`;
    defeatText.textContent = 'Les mutants ont eu raison du premier toit de la colonie.';
    retry.type = 'button';
    retry.textContent = 'Recommencer';
    retry.addEventListener('click', () => window.location.reload());
    defeatPanel.append(defeatTitle, defeatText, retry);
    this.defeat.append(defeatPanel);

    this.root.append(this.objective, this.bag, this.floats, this.stats, this.toast, this.audioButton, this.defeat);

    world.events.on('placementRejected', ({ reason }) => this.notify(REJECTION_LABELS[reason]));
    world.events.on('resourceHarvested', ({ item }) => this.float(item, 1));
    world.events.on('siteDelivered', ({ item, amount }) => this.float(item, -amount));
    world.events.on('siteReady', () => this.notify('Chantier livré — appuyez sur Construire', true));
    world.events.on('siteRejected', ({ reason }) => {
      if (reason === 'outOfReach') this.notify(REJECTION_LABELS.outOfReach);
      if (reason === 'nothingToGive') this.notify('Rien dans le sac que ce chantier attende');
    });
    world.events.on('inventoryFull', () => this.notify('Sac plein — livrez le chantier'));
    world.events.on('buildingCompleted', ({ id }) => {
      const entity = world.entities.get(id);

      if (entity) this.notify(`${BUILDINGS[entity.proto].label} terminée`, true);
    });
    world.events.on('waveStarted', ({ wave, count }) =>
      this.notify(`Vague ${wave} — ${count} mutant${count > 1 ? 's' : ''} en approche !`),
    );
    world.events.on('buildingDestroyed', ({ proto }) => this.notify(`${BUILDINGS[proto].label} détruite`));
    world.events.on('childBorn', () => this.notify('Un enfant est né !', true));
    world.events.on('townHallDestroyed', () => {
      this.defeat.hidden = false;
    });
  }

  /** L'icône du bouton son suit l'état du moteur audio. */
  public setMuted(muted: boolean): void {
    this.audioButton.textContent = muted ? '🔇' : '🔊';
    this.audioButton.dataset['muted'] = String(muted);
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

  /** Une icône et un delta qui montent et s'effacent. Le DOM les retire à la fin de l'animation. */
  private float(item: ItemId, delta: number): void {
    const element = document.createElement('span');

    element.className = 'hud-float';
    element.dataset['out'] = String(delta < 0);
    element.append(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, itemIcon(item, 16));
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

  private updateObjective(): void {
    const hall = this.world.entities.get(this.world.townHallId);
    let text: string;

    if (hall?.kind === 'site') {
      const cost = BUILDINGS[hall.proto].cost;
      const parts = (Object.entries(cost) as [ItemId, number][]).map(
        ([item, needed]) => `${ITEMS[item].label} ${hall.delivered[item] ?? 0}/${needed}`,
      );

      text = `Construire la ${LORE.buildings.townHall.name} — ${parts.join(', ')}`;
      if (siteMissing(hall) === 0) text = `${LORE.buildings.townHall.name} livrée — tapez-la et appuyez sur Construire`;
    } else if (hall) {
      const health = `♥ ${hall.hp}/${BUILDINGS[hall.proto].hp}`;
      const { children } = this.world.population();
      const people = children > 0 ? ` · ${1 + children} habitants` : '';

      text =
        this.world.wave === 0
          ? `${LORE.buildings.townHall.name} debout ${health}${people} — les mutants vont venir.`
          : `${LORE.buildings.townHall.name} ${health}${people} — vague ${this.world.wave}`;
    } else {
      text = `La ${LORE.buildings.townHall.name.toLowerCase()} est tombée.`;
    }

    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.objective.textContent = text;
  }

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

    const title = document.createElement('div');

    title.className = 'hud-bag-title';
    title.textContent = `Sac ${inventory.total()}/${inventory.capacity}`;
    title.dataset['full'] = String(inventory.freeSpace() <= 0);

    this.bag.replaceChildren(title, ...entries.map(([item, amount]) => itemAmount(item, amount)));
  }

  public destroy(): void {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
  }
}
