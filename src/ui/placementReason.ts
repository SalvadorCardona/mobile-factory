/**
 * Pourquoi « Poser » est grisé — en une ligne, sous le nom du bâtiment.
 *
 * Un bouton qui se grise sans rien dire laisse deviner : c'est l'arbre ?
 * l'eau ? la distance ? Le fantôme recouvre souvent ce qui gêne. La
 * simulation connaît le motif et les cases (`World.placementBlock`) ; ici on
 * le dit, et quand c'est un arbre ou un rocher on dit aussi le remède : Adam
 * n'a qu'à le heurter. Une foreuse hors filon : on dit où la poser, et le
 * posable dit ce qu'elle extraira (`placementOutput`). Un tracé de route dit
 * pourquoi une partie ne sera pas pavée (`roadReason`).
 *
 * Fonction pure, sans DOM : `buildMenu.ts` l'affiche, les tests la lisent.
 */

import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ResourceId } from '../data/resources.ts';
import { t } from '../i18n/locale.ts';
import type { PlacementRejection, RoadRejection } from '../sim/commands.ts';
import type { PlacementBlock, RoadStep, World } from '../sim/world.ts';

export interface PlacementReason {
  /** Le motif : « Un arbre gêne ». */
  text: string;
  /** Le remède, s'il y en a un à portée de main : « Adam peut le couper ». */
  remedy: string | null;
}

type SimpleRejection = Exclude<PlacementRejection, 'resource' | 'noOre' | 'road' | 'nearHall'>;

/** Une entrée du dictionnaire (remède '' = aucun) en motif affichable. */
function reason(entry: { text: string; remedy: string }): PlacementReason {
  return { text: entry.text, remedy: entry.remedy === '' ? null : entry.remedy };
}

/** Un motif sans remède : l'eau, la distance, le plan… */
function simple(rejection: SimpleRejection): PlacementReason {
  return { text: t().panel.placement[rejection], remedy: null };
}

export function placementReason(block: PlacementBlock, world: World): PlacementReason {
  const placement = t().panel.placement;

  // Les filons se voient en mode construction, même sous les rochers qui les couvrent.
  if (block.reason === 'noOre') return reason(placement.noOre);
  // L'antenne se dresse loin : le cercle de la mairie montre jusqu'où.
  if (block.reason === 'nearHall') return reason(placement.nearHall);
  // Une route ne se recouvre pas : le marteau la retire, et rend sa pierre.
  if (block.reason === 'road') return reason(placement.road);
  if (block.reason !== 'resource') return simple(block.reason);

  const found = block.tiles
    .map(({ tx, ty }) => world.resources.at(tx, ty)?.id)
    .filter((id): id is ResourceId => id !== undefined);

  return resourceReason(found);
}

/** Arbres, rochers, ou les deux ; un seul, ou plusieurs. */
function resourceReason(found: readonly ResourceId[]): PlacementReason {
  const trees = found.filter((id) => id === 'tree').length;
  const rocks = found.length - trees;
  const many = found.length > 1;
  const placement = t().panel.placement;

  if (trees > 0 && rocks > 0) return reason(placement.treesAndRocks);
  if (rocks > 0) return reason(many ? placement.rocks : placement.rock);
  return reason(many ? placement.trees : placement.tree);
}

/** Ce que produira le bâtiment posé là : « Extraira : Pierre » pour une foreuse, `null` sinon. */
export function placementOutput(building: BuildingId, tx: number, ty: number, world: World): string | null {
  if (BUILDINGS[building].kind !== 'drill') return null;

  const item = world.oreUnder(building, tx, ty);

  return item ? t().panel.placement.extracts(t().items[item]) : null;
}

/**
 * Pourquoi une partie du tracé ne sera pas pavée — le manque de pierre
 * d'abord, c'est lui qui arrête le tracé —, ou `null` s'il passe en entier.
 */
export function roadReason(plan: readonly RoadStep[]): PlacementReason | null {
  const states = plan.map((step) => step.state);

  const roads = t().panel.placement.roads;

  if (states.includes('noStone')) return reason(roads.noStone);

  const refused = states.find((state): state is Exclude<RoadRejection, 'noStone'> => state !== 'pave' && state !== 'paved');

  return refused ? reason(roads[refused]) : null;
}
