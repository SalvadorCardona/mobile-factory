/**
 * Jobs de transport : qui porte quoi, d'où, vers où — et les réservations.
 *
 * C'est là que les jeux de colonie se cassent : deux porteurs qui partent
 * chercher le même tas, ou qui livrent tous les deux un chantier qui n'avait
 * de place que pour un. La parade : **réserver à la création du job**. Le
 * stock est marqué sortant à la source (`Store.reserveOut`), la place
 * réservée à l'arrivée (`Store.reserveIn`, ou le registre des chantiers) ;
 * si la seconde réservation échoue, la première est annulée. Un job est une
 * promesse déjà couverte des deux côtés, et toute décision se prend sur
 * `available()` et la place libre, jamais sur le stock brut : un second job
 * ne voit plus ce qui est promis. Le bug n'existe pas, structurellement.
 *
 * Un chantier n'a pas de coffre : ce qui lui est promis tient dans le
 * registre `incoming` de ce tableau. Ce registre n'est pas sauvegardé — il se
 * recalcule depuis les jobs des ouvriers (`rebuild`), comme les réservations
 * des coffres, dont la sauvegarde ne garde que le stock réel.
 *
 * Premier périmètre : livrer les chantiers et le labo de recherche depuis la
 * mairie, et vider les coffres des foreuses, des fermes et des cabanes de
 * bûcheron dans la mairie.
 */

import { TILE_SIZE, distanceSq } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { JOB_PRIORITY, PORTERS } from '../data/workers.ts';
import { labSurplus, labWants, researchCost } from './research.ts';
import type { Entity, EntityId, Job, Site } from './types.ts';

/** Le trajet en ligne droite de (x0, y0) à (x1, y1) est-il praticable ? */
export type LineTest = (x0: number, y0: number, x1: number, y1: number) => boolean;

/** Un transport pas encore réservé : ce que le tableau propose. */
type Offer = Omit<Job, 'carried'>;

/**
 * Le seuil d'une emprise : le milieu de son bord bas, juste dehors. C'est
 * là qu'un porteur ramasse, dépose, et rentre chez lui.
 */
export function doorOf(entity: { tx: number; ty: number; width: number; height: number }): { x: number; y: number } {
  return { x: (entity.tx + entity.width / 2) * TILE_SIZE, y: (entity.ty + entity.height) * TILE_SIZE + 6 };
}

export class JobBoard {
  /** Ce qui est déjà promis à chaque chantier, par objet. */
  private readonly incoming = new Map<EntityId, Map<ItemId, number>>();

  /** Ce qu'un job en route apporte déjà au chantier. */
  public siteIncoming(id: EntityId, item: ItemId): number {
    return this.incoming.get(id)?.get(item) ?? 0;
  }

  /** Ce que le chantier attend encore et que personne n'apporte : la « place libre » d'un chantier. */
  public siteWants(site: Site, item: ItemId): number {
    const needed = (BUILDINGS[site.proto].cost as Partial<Record<ItemId, number>>)[item] ?? 0;

    return Math.max(0, needed - (site.delivered[item] ?? 0) - this.siteIncoming(site.id, item));
  }

  /**
   * Le meilleur job pour un porteur en (x, y), déjà réservé des deux côtés,
   * ou `null`. Le plus prioritaire d'abord, puis la source la plus proche ;
   * un trajet qui traverserait l'eau — jusqu'à la source, jusqu'à la
   * destination, puis jusqu'à la maison — n'est pas proposé. `carry` : ce
   * que le porteur prend en un voyage.
   */
  public assign(
    entities: ReadonlyMap<EntityId, Entity>,
    hallId: EntityId,
    from: { x: number; y: number },
    home: { x: number; y: number },
    clear: LineTest,
    carry: number = PORTERS.carry,
  ): Job | null {
    const offers = this.offers(entities, hallId, carry).map((offer) => {
      const source = entities.get(offer.from)!;
      const door = doorOf(source);

      return { offer, door, distance: distanceSq(from.x, from.y, door.x, door.y) };
    });

    offers.sort((a, b) => b.offer.priority - a.offer.priority || a.distance - b.distance);

    for (const { offer, door } of offers) {
      const target = doorOf(entities.get(offer.to)!);

      if (!clear(from.x, from.y, door.x, door.y)) continue;
      if (!clear(door.x, door.y, target.x, target.y)) continue;
      if (!clear(target.x, target.y, home.x, home.y)) continue;

      const job: Job = { ...offer, carried: false };

      if (this.open(entities, job)) return job;
    }
    return null;
  }

  /** Tout ce qu'il y aurait à porter, calculé sur le disponible et la place libre, jamais sur le stock brut. */
  private offers(entities: ReadonlyMap<EntityId, Entity>, hallId: EntityId, carry: number): Offer[] {
    const hall = entities.get(hallId);

    // Pas de mairie debout, pas d'entrepôt : rien à porter.
    if (hall?.kind !== 'townHall') return [];

    const offers: Offer[] = [];

    for (const entity of entities.values()) {
      switch (entity.kind) {
        case 'site':
          for (const item of Object.keys(BUILDINGS[entity.proto].cost) as ItemId[]) {
            const amount = Math.min(carry, this.siteWants(entity, item), hall.store.available(item));

            if (amount > 0) offers.push({ from: hall.id, to: entity.id, item, amount, priority: JOB_PRIORITY.site });
          }
          break;

        case 'lab':
          // Ce que la recherche attend, depuis la mairie, comme un chantier ; le reste d'une recherche abandonnée y retourne.
          for (const [item] of entity.research === null ? [] : researchCost(entity.research)) {
            const amount = Math.min(carry, labWants(entity, item), hall.store.available(item), entity.store.freeSpace());

            if (amount > 0) offers.push({ from: hall.id, to: entity.id, item, amount, priority: JOB_PRIORITY.site });
          }
          for (const [item] of entity.store.entries()) {
            const amount = Math.min(carry, labSurplus(entity, item), hall.store.freeSpace());

            if (amount > 0) offers.push({ from: entity.id, to: hall.id, item, amount, priority: JOB_PRIORITY.surplus });
          }
          break;

        case 'drill':
        case 'farm':
        case 'lumberCamp':
          for (const [item] of entity.store.entries()) {
            const available = entity.store.available(item);
            const amount = Math.min(carry, available, hall.store.freeSpace());

            if (amount <= 0) continue;

            const priority = available >= carry ? JOB_PRIORITY.empty : JOB_PRIORITY.surplus;

            offers.push({ from: entity.id, to: hall.id, item, amount, priority });
          }
          break;

        default:
          break;
      }
    }
    return offers;
  }

  /**
   * Réserve les deux côtés du job : la sortie à la source (sauf si la charge
   * est déjà ramassée), puis la place à l'arrivée. Si la seconde échoue, la
   * première est annulée — rien ne reste à moitié promis.
   */
  public open(entities: ReadonlyMap<EntityId, Entity>, job: Job): boolean {
    const source = entities.get(job.from);

    if (!job.carried) {
      if (!source || source.kind === 'site' || !source.store.reserveOut(job.item, job.amount)) return false;
    }

    if (this.reserveIn(entities.get(job.to), job.item, job.amount)) return true;

    if (!job.carried && source && source.kind !== 'site') source.store.releaseOut(job.item, job.amount);
    return false;
  }

  private reserveIn(target: Entity | undefined, item: ItemId, amount: number): boolean {
    if (!target) return false;
    if (target.kind !== 'site') return target.store.reserveIn(item, amount);
    if (this.siteWants(target, item) < amount) return false;

    const promised = this.incoming.get(target.id) ?? new Map<ItemId, number>();

    promised.set(item, (promised.get(item) ?? 0) + amount);
    this.incoming.set(target.id, promised);
    return true;
  }

  /**
   * Libère la place réservée à l'arrivée. Un chantier achevé entre-temps
   * garde le même id : sa promesse est toujours dans le registre.
   */
  public releaseIn(entities: ReadonlyMap<EntityId, Entity>, job: Job): void {
    const promised = this.incoming.get(job.to);
    const current = promised?.get(job.item) ?? 0;

    if (promised && current > 0) {
      const left = current - job.amount;

      if (left > 0) promised.set(job.item, left);
      else promised.delete(job.item);
      if (promised.size === 0) this.incoming.delete(job.to);
      return;
    }

    const target = entities.get(job.to);

    if (target && target.kind !== 'site') target.store.releaseIn(job.item, job.amount);
  }

  /** Abandonne un job : les deux réservations sont rendues. */
  public cancel(entities: ReadonlyMap<EntityId, Entity>, job: Job): void {
    const source = entities.get(job.from);

    if (!job.carried && source && source.kind !== 'site') source.store.releaseOut(job.item, job.amount);
    this.releaseIn(entities, job);
  }

  /**
   * Après un chargement : les coffres ne savent plus ce qui leur était
   * promis, le registre des chantiers est vide. Les jobs des ouvriers, eux,
   * sont sauvegardés — on rejoue leurs réservations.
   */
  public rebuild(entities: ReadonlyMap<EntityId, Entity>, jobs: Iterable<Job>): Job[] {
    const broken: Job[] = [];

    this.incoming.clear();
    for (const job of jobs) {
      if (!this.open(entities, job)) broken.push(job);
    }
    return broken;
  }
}
