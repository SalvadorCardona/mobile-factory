/**
 * Le conseil du HUD — le tutoriel, sans tutoriel.
 *
 * Une seule phrase, choisie d'après l'état du monde et ce que le joueur a
 * déjà fait. Elle se tait dès que l'étape est franchie : un joueur qui sait
 * déjà jouer ne la voit presque pas.
 *
 * C'est Ève qui parle (`EVE_LINES.hints`) : par radio tant qu'elle n'est pas
 * arrivée, de vive voix ensuite. Elle tutoie Adam. Quand elle n'a rien de
 * plus pressé à dire, c'est le conseil de l'objectif en cours
 * (`data/objectives.ts`) : le joueur sait toujours quoi faire ensuite.
 *
 * Fonction pure, sans DOM : `hud.ts` l'affiche, les tests la lisent.
 */

import { BUILDINGS, REPAIR, buildingLevel } from '../data/buildings.ts';
import { EVE, EVE_LINES } from '../data/eve.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { currentObjective } from '../sim/objectives.ts';
import type { World } from '../sim/world.ts';

/** Ce que le joueur a déjà fait : un conseil compris ne revient pas. */
export interface HintProgress {
  harvestedWood: boolean;
  harvestedStone: boolean;
  delivered: boolean;
  /** Adam a déjà réparé un bâtiment : il sait faire. */
  repaired: boolean;
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
 * Le message d'une récolte refusée (`harvestRefused`) : c'est le jeu qui
 * parle, il vouvoie. Tant qu'un chantier ou une recette attend l'objet
 * (`wanted` > 0), le sac en contient déjà assez — il faut aller livrer ;
 * « aucun chantier » ne se dit que si plus personne n'en veut. Quand la
 * ville en a déjà assez (`plenty`), c'est elle qui le dit.
 */
export function harvestRefusedText(item: ItemId, wanted: number, plenty = false): string {
  const label = ITEMS[item].label.toLowerCase();

  if (plenty) return `La ville a assez de ${label} — Adam n’en ramasse plus en passant`;
  if (wanted > 0) return `Assez de ${label} dans le sac pour les chantiers — allez les livrer`;
  return `Assez de ${label} : aucun chantier n’en attend plus`;
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

  // Entre deux vagues, la mairie entamée d'au moins un bois, et Ève pas encore là pour la réparer : à Adam de le faire.
  if (mutants === 0 && !progress.repaired && !world.eve() && hall.hp <= buildingLevel(hall.proto, hall.level).hp - REPAIR.hp) {
    return world.repairStock(hall) > 0 ? say(lines.repair) : say(lines.repairFetch, REPAIR.item);
  }

  // La pierre manque en ville, et rien n'en produit : la carrière, avant que les rochers ne soient vidés.
  const quarried = [...world.entities.values()].some((entity) => BUILDINGS[entity.proto].kind === 'quarry');

  if (mutants === 0 && !quarried && (world.townStock()?.available('stone') ?? 0) === 0) return say(lines.quarry);

  // Entre deux nuits, tant qu'elle n'est pas là : elle annonce son arrivée.
  if (mutants === 0 && world.night > 0 && world.night < EVE.arrivalNight && !world.eve()) {
    const left = EVE.arrivalNight - world.night;

    return say(lines.coming.replace('{n}', String(left)).replace('{s}', left > 1 ? 's' : ''));
  }

  // La forge se débloque à la tombée d'une nuit : le charbon, jusque-là sans usage, devient un objectif.
  const forged = [...world.entities.values()].some((entity) => BUILDINGS[entity.proto].kind === 'forge');

  if (mutants === 0 && world.isUnlocked('forge') && !forged) return say(lines.forge, 'coal');

  const objective = currentObjective(world);

  return objective ? say(objective.hint) : null;
}
