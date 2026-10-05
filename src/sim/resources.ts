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
 *
 * Les arbres plantés par le forestier sont l'autre modification du joueur :
 * `tuile → tick de plantation et unités déjà prises`. Pousse puis jeune
 * arbre (`SAPLING`), ils ne sont pas encore une ressource — ni coupés, ni
 * récoltés, ni solides ; adultes, ils sont un `tree` comme un autre. Coupé
 * jusqu'au bout, l'arbre planté s'efface de l'index : la case se replante.
 */

import { coordKey, type TileCoord } from '../core/grid.ts';
import { RESOURCES, SAPLING, type ResourceId } from '../data/resources.ts';
import { resourceAt } from './terrain.ts';

export type ResourceStage = 'full' | 'damaged' | 'gone';

/** Ce qu'est un arbre planté, selon son âge : une pousse, un jeune arbre, un arbre à couper. */
export type GrowthStage = 'sprout' | 'young' | 'tree';

/** Un arbre planté, tel qu'il est sauvegardé : son stade se relit dans son âge. */
export interface PlantedTree {
  /** Tick de la plantation. */
  tick: number;
  /** Unités déjà coupées, une fois adulte. */
  taken: number;
}

/** Le stade d'un arbre planté depuis `age` ticks. */
export function growthStage(age: number): GrowthStage {
  if (age >= SAPLING.adultTicks) return 'tree';
  return age >= SAPLING.youngTicks ? 'young' : 'sprout';
}

interface Planted extends PlantedTree {
  /** Le stade au dernier passage de croissance : c'est lui que lisent la récolte et le rendu. */
  stage: GrowthStage;
}

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

  private readonly planted = new Map<string, Planted>();

  private readonly seed: number;

  public constructor(seed: number) {
    this.seed = seed;
  }

  /** La ressource présente sur la tuile, ou `null` si elle est nue ou vidée. */
  public at(tx: number, ty: number): SurfaceResource | null {
    // Sans arbre planté, pas de clé à fabriquer : `at()` est appelé des milliers de fois par tick.
    const planted = this.planted.size > 0 ? this.planted.get(coordKey(tx, ty)) : undefined;

    // Un arbre planté recouvre la tuile nue qu'il occupe ; il n'est une ressource qu'adulte.
    if (planted) {
      if (planted.stage !== 'tree') return null;

      const remaining = RESOURCES.tree.amount - planted.taken;

      return { id: 'tree', remaining, stage: stageOf('tree', remaining) };
    }

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
    const planted = this.planted.get(key);

    if (planted) {
      planted.taken += 1;
      // Abattu : la case est de nouveau libre, le forestier la replantera.
      if (planted.taken >= RESOURCES.tree.amount) this.planted.delete(key);
    } else {
      this.taken.set(key, (this.taken.get(key) ?? 0) + 1);
    }

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

  /**
   * Plante une pousse sur la tuile au tick `tick`. Refusé — `false` — si la
   * tuile porte déjà une ressource ou un arbre planté : c'est à l'appelant
   * de juger le terrain, le bâti et les routes.
   */
  public plant(tx: number, ty: number, tick: number): boolean {
    const key = coordKey(tx, ty);

    if (this.planted.has(key) || this.at(tx, ty) !== null) return false;
    this.planted.set(key, { tick, taken: 0, stage: 'sprout' });
    return true;
  }

  /** Le stade de la pousse plantée sur la tuile, ou `null` s'il n'y en a pas — un arbre adulte n'en est plus une. */
  public sapling(tx: number, ty: number): Exclude<GrowthStage, 'tree'> | null {
    const stage = this.planted.get(coordKey(tx, ty))?.stage;

    return stage === undefined || stage === 'tree' ? null : stage;
  }

  /** La tuile porte-t-elle un arbre planté — pousse ou adulte ? */
  public isPlanted(tx: number, ty: number): boolean {
    return this.planted.has(coordKey(tx, ty));
  }

  /** La tuile est-elle prise : une ressource debout, ou une pousse ? Ni bâtiment ni route ne s'y posent. */
  public isTaken(tx: number, ty: number): boolean {
    return this.isPlanted(tx, ty) || this.at(tx, ty) !== null;
  }

  /**
   * Un passage de croissance au tick `now` : chaque pousse prend le stade de
   * son âge. Renvoie les tuiles qui ont changé de stade — leur chunk est à
   * redessiner.
   */
  public grow(now: number): TileCoord[] {
    const changed: TileCoord[] = [];

    for (const [key, planted] of this.planted) {
      if (planted.stage === 'tree') continue;

      const stage = growthStage(now - planted.tick);

      if (stage === planted.stage) continue;
      planted.stage = stage;

      const [tx, ty] = key.split(',').map(Number) as [number, number];

      changed.push({ tx, ty });
    }
    return changed;
  }

  /** Nombre de tuiles entamées — c'est la taille de la sauvegarde. */
  public size(): number {
    return this.taken.size;
  }

  public toJSON(): Record<string, number> {
    return Object.fromEntries(this.taken);
  }

  /** Les arbres plantés, pousses comprises : leur âge dit leur stade. */
  public plantedJSON(): Record<string, PlantedTree> {
    return Object.fromEntries([...this.planted].map(([key, { tick, taken }]) => [key, { tick, taken }]));
  }

  /**
   * Remplace les tuiles entamées et les arbres plantés par ceux d'une
   * sauvegarde ; `now`, le tick sauvegardé, redonne à chaque pousse son stade.
   */
  public restore(taken: Record<string, number>, planted: Record<string, PlantedTree> = {}, now = 0): void {
    this.taken.clear();
    for (const [key, amount] of Object.entries(taken)) this.taken.set(key, amount);
    this.planted.clear();
    for (const [key, { tick, taken: cut }] of Object.entries(planted)) {
      this.planted.set(key, { tick, taken: cut, stage: growthStage(now - tick) });
    }
  }
}
