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
 *
 * Les cultures des fermiers aussi : `tuile → tick du semis`, qui dit leur
 * stade (`CROPS` : semis, pousse, mûre). Elles ne sont jamais une
 * ressource — ni récoltées par Adam, ni solides — ; le fermier les récolte
 * mûres (`reap`) et la case redevient libre.
 */

import { coordKey, type TileCoord } from '../core/grid.ts';
import { CROPS, RESOURCES, SAPLING, type ResourceId } from '../data/resources.ts';
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

/** Ce qu'est une culture, selon son âge : un semis, une pousse, une culture mûre à récolter. */
export type CropStage = 'sown' | 'growing' | 'ripe';

/** Le stade d'une culture semée depuis `age` ticks. */
export function cropStage(age: number): CropStage {
  if (age >= CROPS.ripeTicks) return 'ripe';
  return age >= CROPS.growingTicks ? 'growing' : 'sown';
}

interface Crop {
  /** Tick du semis : c'est lui qui est sauvegardé. */
  tick: number;
  /** Le stade au dernier passage de croissance : c'est lui que lisent le fermier et le rendu. */
  stage: CropStage;
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

/**
 * Ce qu'une tuile montre de ses ressources : la capture qu'en garde le
 * brouillard (`sim/fog.ts`) quand elle change hors de vue. Une tuile nue
 * n'a ni ressource ni pousse.
 */
export interface TileLook {
  /** La ressource debout, ou `null`. */
  resource: ResourceId | null;
  /** Entamée ou intacte ; sans ressource, `'gone'`. */
  stage: ResourceStage;
  /** Un arbre planté par le forestier, pousse ou adulte : il n'a pas l'essence de la carte. */
  planted: boolean;
  /** La pousse ou le jeune arbre, ou `null`. */
  sapling: Exclude<GrowthStage, 'tree'> | null;
}

export function stageOf(id: ResourceId, remaining: number): ResourceStage {
  if (remaining <= 0) return 'gone';
  return remaining * 2 <= RESOURCES[id].amount ? 'damaged' : 'full';
}

export class ResourceIndex {
  private readonly taken = new Map<string, number>();

  private readonly planted = new Map<string, Planted>();

  private readonly crops = new Map<string, Crop>();

  private readonly seed: number;

  /** Prévenu juste avant qu'une tuile change : le brouillard y fige ce qu'on en a vu. */
  private watcher: ((tx: number, ty: number) => void) | null = null;

  public constructor(seed: number) {
    this.seed = seed;
  }

  /** `watcher` est appelé avant chaque changement d'une tuile — coupe, plantation, croissance. */
  public watch(watcher: (tx: number, ty: number) => void): void {
    this.watcher = watcher;
  }

  /** Ce que la tuile montre en ce moment. */
  public look(tx: number, ty: number): TileLook {
    const resource = this.at(tx, ty);

    return {
      resource: resource?.id ?? null,
      stage: resource?.stage ?? 'gone',
      planted: this.isPlanted(tx, ty),
      sapling: this.sapling(tx, ty),
    };
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

    this.watcher?.(tx, ty);

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

    this.watcher?.(tx, ty);
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

    if (this.planted.has(key) || this.crops.has(key) || this.at(tx, ty) !== null) return false;
    this.watcher?.(tx, ty);
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

  /** La tuile est-elle prise : une ressource debout, une pousse, une culture ? Ni bâtiment ni route ne s'y posent. */
  public isTaken(tx: number, ty: number): boolean {
    return this.isPlanted(tx, ty) || this.crop(tx, ty) !== null || this.at(tx, ty) !== null;
  }

  /**
   * Sème une culture sur la tuile au tick `tick`. Refusé — `false` — si la
   * tuile porte déjà une ressource, un arbre planté ou une culture : c'est à
   * l'appelant de juger le terrain, le bâti et les routes.
   */
  public sow(tx: number, ty: number, tick: number): boolean {
    const key = coordKey(tx, ty);

    if (this.crops.has(key) || this.planted.has(key) || this.at(tx, ty) !== null) return false;
    this.crops.set(key, { tick, stage: 'sown' });
    return true;
  }

  /** Le stade de la culture semée sur la tuile, ou `null` s'il n'y en a pas. */
  public crop(tx: number, ty: number): CropStage | null {
    if (this.crops.size === 0) return null;
    return this.crops.get(coordKey(tx, ty))?.stage ?? null;
  }

  /** Récolte la culture mûre de la tuile, qui redevient libre ; `false` si elle n'est pas mûre. */
  public reap(tx: number, ty: number): boolean {
    const key = coordKey(tx, ty);

    if (this.crops.get(key)?.stage !== 'ripe') return false;
    this.crops.delete(key);
    return true;
  }

  /** Arrache la culture de la tuile, à n'importe quel stade : son champ n'est plus cultivé. Vrai s'il y en avait une. */
  public wither(tx: number, ty: number): boolean {
    return this.crops.delete(coordKey(tx, ty));
  }

  /** Les tuiles semées. */
  public *cropTiles(): IterableIterator<TileCoord> {
    for (const key of this.crops.keys()) {
      const [tx, ty] = key.split(',').map(Number) as [number, number];

      yield { tx, ty };
    }
  }

  /**
   * Un passage de croissance au tick `now` : chaque pousse et chaque
   * culture prend le stade de son âge. Renvoie les tuiles qui ont changé de
   * stade — leur chunk est à redessiner.
   */
  public grow(now: number): TileCoord[] {
    const changed: TileCoord[] = [];

    for (const [key, crop] of this.crops) {
      if (crop.stage === 'ripe') continue;

      const stage = cropStage(now - crop.tick);

      if (stage === crop.stage) continue;
      crop.stage = stage;

      const [tx, ty] = key.split(',').map(Number) as [number, number];

      changed.push({ tx, ty });
    }

    for (const [key, planted] of this.planted) {
      if (planted.stage === 'tree') continue;

      const stage = growthStage(now - planted.tick);

      if (stage === planted.stage) continue;

      const [tx, ty] = key.split(',').map(Number) as [number, number];

      this.watcher?.(tx, ty);
      planted.stage = stage;

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

  /** Les cultures semées : tuile → tick du semis, qui dit leur stade. */
  public cropsJSON(): Record<string, number> {
    return Object.fromEntries([...this.crops].map(([key, { tick }]) => [key, tick]));
  }

  /**
   * Remplace les tuiles entamées, les arbres plantés et les cultures par ceux
   * d'une sauvegarde ; `now`, le tick sauvegardé, redonne à chaque pousse et
   * à chaque culture son stade.
   */
  public restore(taken: Record<string, number>, planted: Record<string, PlantedTree> = {}, now = 0, crops: Record<string, number> = {}): void {
    this.taken.clear();
    for (const [key, amount] of Object.entries(taken)) this.taken.set(key, amount);
    this.planted.clear();
    for (const [key, { tick, taken: cut }] of Object.entries(planted)) {
      this.planted.set(key, { tick, taken: cut, stage: growthStage(now - tick) });
    }
    this.crops.clear();
    for (const [key, tick] of Object.entries(crops)) this.crops.set(key, { tick, stage: cropStage(now - tick) });
  }
}
