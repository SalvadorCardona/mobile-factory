/**
 * Le conseil du HUD — le tutoriel, sans tutoriel.
 *
 * Une seule phrase, choisie d'après l'état du monde et ce que le joueur a
 * déjà fait. Elle se tait dès que l'étape est franchie : un joueur qui sait
 * déjà jouer ne la voit presque pas.
 *
 * Fonction pure, sans DOM : `hud.ts` l'affiche, les tests la lisent.
 */

import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import type { EntityId } from '../sim/types.ts';
import { siteMissing, type World } from '../sim/world.ts';

/** Ce que le joueur a déjà fait : un conseil compris ne revient pas. */
export interface HintProgress {
  harvestedWood: boolean;
  harvestedStone: boolean;
  delivered: boolean;
  /** Le bâtiment dont la fenêtre est ouverte, s'il y en a une. */
  inspected: EntityId | null;
}

export function tutorialHint(world: World, progress: HintProgress, towers: boolean, mutants: number): string | null {
  const hall = world.entities.get(world.townHallId);
  const { inventory } = world.player;

  if (world.defeated || !hall) return null;

  if (hall.kind === 'site') {
    const cost = BUILDINGS[hall.proto].cost as Partial<Record<ItemId, number>>;
    const needs = (item: ItemId): boolean => (hall.delivered[item] ?? 0) < (cost[item] ?? 0);
    const carries = (Object.keys(cost) as ItemId[]).some((item) => needs(item) && inventory.count(item) > 0);

    // Sa fenêtre ouverte, le chantier est tapé : le bouton « Construire » est sous les yeux.
    if (siteMissing(hall) === 0) return progress.inspected === hall.id ? null : 'Tapez le chantier, puis « Construire ».';
    if (inventory.freeSpace() <= 0) return 'Sac plein ! Marchez contre le chantier pour livrer.';
    if (!progress.harvestedWood && needs('wood')) return 'Marchez contre un arbre pour couper du bois.';
    if (!progress.harvestedStone && needs('stone')) return 'Il faut de la pierre : foncez dans un rocher rose.';
    if (carries && !progress.delivered) return 'Marchez contre le chantier pour livrer — ou tapez-le.';
    return null;
  }

  if (world.wave === 0 && !towers) return 'Les mutants arrivent : construisez une tour de guet.';
  if (mutants > 0 && world.wave <= 2) return 'Restez près d’eux : votre arc tire tout seul.';
  return null;
}
