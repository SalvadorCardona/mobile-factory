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
import { ITEMS, type ItemId } from '../data/items.ts';
import type { World } from '../sim/world.ts';

/** Ce que le joueur a déjà fait : un conseil compris ne revient pas. */
export interface HintProgress {
  harvestedWood: boolean;
  harvestedStone: boolean;
  delivered: boolean;
}

/** Un conseil, et la ressource qu'il envoie chercher : le repère d'objectif y mène. */
export interface Advice {
  text: string;
  wants: ItemId | null;
}

/** Le sac contient-il au moins un objet qu'on attend quelque part — chantier, recette ou ville ? */
export function carriesWanted(world: World): boolean {
  return world.player.inventory.entries().some(([item]) => world.wanted(item) > 0);
}

/**
 * Le conseil d'un sac plein dont personne ne veut rien : il ne sert à rien
 * d'aller livrer, il faut poser un chantier ou jeter. On nomme l'objet qui
 * prend le plus de place. `null` si le sac n'est pas dans ce cas.
 */
export function uselessBagHint(world: World): string | null {
  const { inventory } = world.player;

  if (inventory.freeSpace() > 0 || carriesWanted(world)) return null;

  const [bulk] = inventory.entries().sort((a, b) => b[1] - a[1])[0] ?? [];

  return bulk ? EVE_LINES.hints.bagUseless.replace('{item}', ITEMS[bulk].label.toLowerCase()) : null;
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

    const useless = uselessBagHint(world);

    if (useless) return say(useless);
    // Sac plein, mais de quoi livrer : le chantier le prendra.
    if (inventory.freeSpace() <= 0) return say(lines.bagFull);
    if (!progress.harvestedWood && needs('wood')) return say(lines.wood, 'wood');
    if (!progress.harvestedStone && needs('stone')) return say(lines.stone, 'stone');
    if (carries && !progress.delivered) return say(lines.deliver);
    return null;
  }

  if (world.night === 0 && !towers) return say(lines.tower);
  if (mutants > 0 && world.night <= 2) return say(lines.bow);

  // Entre deux nuits, tant qu'elle n'est pas là : elle annonce son arrivée.
  if (mutants === 0 && world.night > 0 && world.night < EVE.arrivalNight && !world.eve()) {
    const left = EVE.arrivalNight - world.night;

    return say(lines.coming.replace('{n}', String(left)).replace('{s}', left > 1 ? 's' : ''));
  }

  // La forge se débloque à la tombée d'une nuit : le charbon, jusque-là sans usage, devient un objectif.
  const forged = [...world.entities.values()].some((entity) => BUILDINGS[entity.proto].kind === 'forge');

  if (mutants === 0 && world.isUnlocked('forge') && !forged) return say(lines.forge, 'coal');
  return null;
}
