/**
 * Bâtiments — contenu pur.
 *
 * Ajouter un bâtiment = ajouter une entrée ici. Aucune ligne de logique à
 * écrire ailleurs tant que le `kind` existe déjà côté simulation.
 */

import type { ItemId } from './items.ts';

/** Comportement simulé associé au bâtiment. Un `kind` = un cas dans `sim/`. */
export type BuildingKind = 'drill';

export interface BuildingProto {
  label: string;
  kind: BuildingKind;
  /** Emprise en tuiles. */
  width: number;
  height: number;
  /** Coût de construction. Vide tant que la récolte n'existe pas. */
  cost: Partial<Record<ItemId, number>>;
  /** Capacité du coffre interne, en nombre total d'objets. */
  storage: number;
  /** Couleur de substitution, en attendant l'atlas généré. */
  tint: number;
}

export const BUILDINGS = {
  drill: {
    label: 'Foreuse',
    kind: 'drill',
    width: 2,
    height: 2,
    cost: {},
    storage: 50,
    tint: 0xd98b3a,
  },
} as const satisfies Record<string, BuildingProto>;

export type BuildingId = keyof typeof BUILDINGS;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

export function isBuildingId(value: string): value is BuildingId {
  return value in BUILDINGS;
}
