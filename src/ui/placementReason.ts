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
import { ITEMS } from '../data/items.ts';
import type { ResourceId } from '../data/resources.ts';
import type { PlacementRejection, RoadRejection } from '../sim/commands.ts';
import type { PlacementBlock, RoadStep, World } from '../sim/world.ts';

export interface PlacementReason {
  /** Le motif : « Un arbre gêne ». */
  text: string;
  /** Le remède, s'il y en a un à portée de main : « Adam peut le couper ». */
  remedy: string | null;
}

const LABELS: Readonly<Record<Exclude<PlacementRejection, 'resource' | 'noOre' | 'road' | 'nearHall'>, string>> = {
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

/** Une route ne se recouvre pas : le marteau la retire, et rend sa pierre. */
const ROAD: PlacementReason = {
  text: 'Une route passe ici',
  remedy: 'Retirez-la d’abord : Bâtir › Route › Retirer',
};

/** L'antenne se dresse loin : le cercle de la mairie montre jusqu'où. */
const NEAR_HALL: PlacementReason = {
  text: 'Trop près de la mairie',
  remedy: 'Éloignez-vous, hors du cercle autour d’elle',
};

export function placementReason(block: PlacementBlock, world: World): PlacementReason {
  if (block.reason === 'noOre') return NO_ORE;
  if (block.reason === 'nearHall') return NEAR_HALL;
  if (block.reason === 'road') return ROAD;
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

const ROAD_REASONS: Readonly<Record<RoadRejection, PlacementReason>> = {
  noStone: { text: 'Plus de pierre pour la suite', remedy: 'Cassez des rochers, ou tracez dans le rayon de la mairie' },
  terrain: { text: 'Pas sur l’eau', remedy: null },
  occupied: { text: 'Un bâtiment est sur le tracé', remedy: null },
  resource: { text: 'Un arbre ou un rocher gêne', remedy: 'Adam peut le récolter' },
};

/**
 * Pourquoi une partie du tracé ne sera pas pavée — le manque de pierre
 * d'abord, c'est lui qui arrête le tracé —, ou `null` s'il passe en entier.
 */
export function roadReason(plan: readonly RoadStep[]): PlacementReason | null {
  const states = plan.map((step) => step.state);

  if (states.includes('noStone')) return ROAD_REASONS.noStone;

  const refused = states.find((state): state is Exclude<RoadRejection, 'noStone'> => state !== 'pave' && state !== 'paved');

  return refused ? ROAD_REASONS[refused] : null;
}
