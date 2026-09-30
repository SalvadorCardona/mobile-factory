/**
 * Pourquoi « Poser » est grisé — en une ligne, sous le nom du bâtiment.
 *
 * Un bouton qui se grise sans rien dire laisse deviner : c'est l'arbre ?
 * l'eau ? la distance ? Le fantôme recouvre souvent ce qui gêne. La
 * simulation connaît le motif et les cases (`World.placementBlock`) ; ici on
 * le dit, et quand c'est un arbre ou un rocher on dit aussi le remède : Adam
 * n'a qu'à le heurter. Une foreuse hors filon : on dit où la poser, et le
 * posable dit ce qu'elle extraira (`placementOutput`).
 *
 * Fonction pure, sans DOM : `buildMenu.ts` l'affiche, les tests la lisent.
 */

import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ITEMS } from '../data/items.ts';
import type { ResourceId } from '../data/resources.ts';
import type { PlacementRejection } from '../sim/commands.ts';
import type { PlacementBlock, World } from '../sim/world.ts';

export interface PlacementReason {
  /** Le motif : « Un arbre gêne ». */
  text: string;
  /** Le remède, s'il y en a un à portée de main : « Adam peut le couper ». */
  remedy: string | null;
}

const LABELS: Readonly<Record<Exclude<PlacementRejection, 'resource' | 'noOre'>, string>> = {
  locked: 'Il vous manque le plan',
  terrain: 'Pas sur l’eau',
  occupied: 'Case occupée',
  onPlayer: 'Vous êtes sur l’emplacement',
  outOfReach: 'Trop loin — rapprochez-vous',
  unique: 'Un seul par colonie',
};

/** Les filons se voient en mode construction, même sous les rochers qui les couvrent. */
const NO_ORE: PlacementReason = {
  text: 'Aucun filon ici',
  remedy: 'Cassez un rocher, puis posez la foreuse à sa place',
};

export function placementReason(block: PlacementBlock, world: World): PlacementReason {
  if (block.reason === 'noOre') return NO_ORE;
  if (block.reason !== 'resource') return { text: LABELS[block.reason], remedy: null };

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

  if (trees > 0 && rocks > 0) return { text: 'Des arbres et des rochers gênent', remedy: 'Adam peut les récolter' };
  if (rocks > 0) {
    return many
      ? { text: 'Des rochers gênent', remedy: 'Adam peut les casser' }
      : { text: 'Un rocher gêne', remedy: 'Adam peut le casser' };
  }
  return many
    ? { text: 'Des arbres gênent', remedy: 'Adam peut les couper' }
    : { text: 'Un arbre gêne', remedy: 'Adam peut le couper' };
}

/** Ce que produira le bâtiment posé là : « Extraira : Pierre » pour une foreuse, `null` sinon. */
export function placementOutput(building: BuildingId, tx: number, ty: number, world: World): string | null {
  if (BUILDINGS[building].kind !== 'drill') return null;

  const item = world.oreUnder(building, tx, ty);

  return item ? `Extraira : ${ITEMS[item].label}` : null;
}
