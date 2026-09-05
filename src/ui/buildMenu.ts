/**
 * Menu de construction.
 *
 * Il affiche la liste des bâtiments débloqués et pilote la machine à états de
 * `input/placement.ts`. Le bouton « Construire » n'apparaît qu'une fois le
 * fantôme posé, et reste grisé tant que l'emplacement est refusé : le joueur
 * voit pourquoi ça ne marche pas avant d'appuyer, pas après.
 *
 * Chaque bouton porte le coût du bâtiment. Il ne se grise pas quand le sac
 * est vide : poser un chantier ne coûte rien, c'est le remplir qui coûte.
 *
 * `unlocked` est pour l'instant la liste complète des bâtiments du menu.
 * Quand la recherche existera, elle viendra de `unlockedBuildings` — le menu
 * filtrera sur une donnée, sans une ligne de logique en plus.
 */

import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import type { Placement } from '../input/placement.ts';

export class BuildMenu {
  public readonly root: HTMLElement;

  private readonly buttons = new Map<BuildingId, HTMLButtonElement>();
  private readonly confirmButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;

  private readonly placement: Placement;

  public constructor(placement: Placement, unlocked: readonly BuildingId[]) {
    this.placement = placement;
    this.root = document.createElement('div');
    this.root.className = 'build-menu';

    this.confirmButton = button('Construire', () => this.placement.confirm());
    this.confirmButton.dataset['confirm'] = 'true';

    this.cancelButton = button('Annuler', () => this.placement.cancel());

    for (const id of unlocked) {
      const proto = BUILDINGS[id];
      const element = button(proto.label, () => this.placement.select(id));
      const cost = document.createElement('small');

      cost.textContent = costLabel(proto.cost);
      element.append(cost);

      this.buttons.set(id, element);
      this.root.append(element);
    }

    this.root.append(this.confirmButton, this.cancelButton);
    this.refresh();
  }

  /** Recalcule l'état visible des boutons. Appelé à chaque changement de placement. */
  public refresh(): void {
    const armed = this.placement.armedBuilding();

    for (const [id, element] of this.buttons) {
      element.dataset['active'] = String(armed === id);
    }

    const placing = this.placement.mode === 'placing';

    this.confirmButton.hidden = !placing;
    this.confirmButton.disabled = !this.placement.isConfirmable();
    this.cancelButton.hidden = this.placement.mode === 'idle';
  }

  public destroy(): void {
    this.root.remove();
  }
}

function costLabel(cost: Partial<Record<ItemId, number>>): string {
  const parts = (Object.entries(cost) as [ItemId, number][]).map(
    ([item, amount]) => `${amount} ${ITEMS[item].label.toLowerCase()}`,
  );

  return parts.length ? parts.join(' · ') : 'gratuit';
}

function button(label: string, onTap: () => void): HTMLButtonElement {
  const element = document.createElement('button');

  element.type = 'button';
  element.textContent = label;
  // `click` et non `pointerdown` : un glissement parti d'un bouton ne doit pas
  // déclencher l'action, et `click` gère déjà l'annulation au relâchement hors
  // de la cible.
  element.addEventListener('click', onTap);
  return element;
}
