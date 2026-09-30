/**
 * Le conseil du HUD — le tutoriel, sans tutoriel.
 *
 * Une seule phrase, choisie d'après l'état du monde et ce que le joueur a
 * déjà fait. Elle se tait dès que l'étape est franchie : un joueur qui sait
 * déjà jouer ne la voit presque pas.
 *
 * C'est Ève qui parle (`EVE_LINES.hints`) : par radio tant qu'elle n'est pas
 * arrivée, de vive voix ensuite. Elle tutoie Adam.
 *
 * Fonction pure, sans DOM : `hud.ts` l'affiche, les tests la lisent.
 */

import { BUILDINGS } from '../data/buildings.ts';
import { EVE, EVE_LINES } from '../data/eve.ts';
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

/** Un conseil, et la ressource qu'il envoie chercher : le repère d'objectif y mène. */
export interface Advice {
  text: string;
  wants: ItemId | null;
}

export function tutorialHint(world: World, progress: HintProgress, towers: boolean, mutants: number): string | null {
  return tutorialAdvice(world, progress, towers, mutants)?.text ?? null;
}

export function tutorialAdvice(world: World, progress: HintProgress, towers: boolean, mutants: number): Advice | null {
  const say = (text: string, wants: ItemId | null = null): Advice => ({ text, wants });
  const hall = world.entities.get(world.townHallId);
  const { inventory } = world.player;

  const lines = EVE_LINES.hints;

  if (world.defeated || !hall) return null;

  if (hall.kind === 'site') {
    const cost = BUILDINGS[hall.proto].cost as Partial<Record<ItemId, number>>;
    const needs = (item: ItemId): boolean => (hall.delivered[item] ?? 0) < (cost[item] ?? 0);
    const carries = (Object.keys(cost) as ItemId[]).some((item) => needs(item) && inventory.count(item) > 0);

    // Sa fenêtre ouverte, le chantier est tapé : le bouton « Construire » est sous les yeux.
    if (siteMissing(hall) === 0) return progress.inspected === hall.id ? null : say(lines.tapSite);
    if (inventory.freeSpace() <= 0) return say(lines.bagFull);
    if (!progress.harvestedWood && needs('wood')) return say(lines.wood, 'wood');
    if (!progress.harvestedStone && needs('stone')) return say(lines.stone, 'stone');
    if (carries && !progress.delivered) return say(lines.deliver);
    return null;
  }

  if (world.wave === 0 && !towers) return say(lines.tower);
  if (mutants > 0 && world.wave <= 2) return say(lines.bow);

  // Entre deux vagues, tant qu'elle n'est pas là : elle annonce son arrivée.
  if (mutants === 0 && world.wave > 0 && world.wave < EVE.arrivalWave && !world.eve()) {
    const left = EVE.arrivalWave - world.wave;

    return say(lines.coming.replace('{n}', String(left)).replace('{s}', left > 1 ? 's' : ''));
  }

  // La forge se débloque après quelques vagues : le charbon, jusque-là sans usage, devient un objectif.
  const forged = [...world.entities.values()].some((entity) => BUILDINGS[entity.proto].kind === 'forge');

  if (mutants === 0 && world.isUnlocked('forge') && !forged) return say(lines.forge, 'coal');
  return null;
}
