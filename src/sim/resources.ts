/**
 * Index des ressources de surface : ce que le joueur en a arraché, et rien
 * d'autre.
 *
 * La carte génère un arbre ou un rocher par tuile (`terrain.resourceAt`) ;
 * cet index ne retient que les tuiles entamées, sous la forme
 * `tuile → unités déjà prises`. Une tuile absente est intacte, une tuile
 * vidée reste dans la map pour que la sauvegarde sache qu'elle a disparu.
 *
 * Trois états visibles, et seulement trois : intact, entamé (moins de la
 * moitié), disparu. Le rendu ne rebake un chunk que lorsqu'une tuile change
 * d'état, pas à chaque unité récoltée.
 */

import { coordKey } from '../core/grid.ts';
import { RESOURCES, type ResourceId } from '../data/resources.ts';
import { resourceAt } from './terrain.ts';

export type ResourceStage = 'full' | 'damaged' | 'gone';

export interface SurfaceResource {
  id: ResourceId;
  remaining: number;
  stage: ResourceStage;
}

export function stageOf(id: ResourceId, remaining: number): ResourceStage {
  if (remaining <= 0) return 'gone';
  return remaining * 2 <= RESOURCES[id].amount ? 'damaged' : 'full';
}

export class ResourceIndex {
  private readonly taken = new Map<string, number>();

  private readonly seed: number;

  public constructor(seed: number) {
    this.seed = seed;
  }

  /** La ressource présente sur la tuile, ou `null` si elle est nue ou vidée. */
  public at(tx: number, ty: number): SurfaceResource | null {
    const id = resourceAt(this.seed, tx, ty);

    if (!id) return null;

    const remaining = RESOURCES[id].amount - (this.taken.get(coordKey(tx, ty)) ?? 0);

    if (remaining <= 0) return null;

    return { id, remaining, stage: stageOf(id, remaining) };
  }

  /** Une ressource bloque le passage tant qu'il en reste. */
  public isSolid(tx: number, ty: number): boolean {
    return this.at(tx, ty) !== null;
  }

  /**
   * Arrache une unité et renvoie l'état après coup, ou `null` s'il n'y avait
   * rien à prendre. `stageChanged` dit au monde s'il faut salir le chunk.
   */
  public take(tx: number, ty: number): { resource: SurfaceResource; stageChanged: boolean } | null {
    const before = this.at(tx, ty);

    if (!before) return null;

    const key = coordKey(tx, ty);

    this.taken.set(key, (this.taken.get(key) ?? 0) + 1);

    const remaining = before.remaining - 1;
    const stage = stageOf(before.id, remaining);

    return {
      resource: { id: before.id, remaining, stage },
      stageChanged: stage !== before.stage,
    };
  }

  /** Vide la tuile d'un coup — le dégagement du point d'apparition. */
  public clear(tx: number, ty: number): boolean {
    const id = resourceAt(this.seed, tx, ty);

    if (!id) return false;

    this.taken.set(coordKey(tx, ty), RESOURCES[id].amount);
    return true;
  }

  /** Nombre de tuiles entamées — c'est la taille de la sauvegarde. */
  public size(): number {
    return this.taken.size;
  }

  public toJSON(): Record<string, number> {
    return Object.fromEntries(this.taken);
  }
}
