/**
 * Scheduler par réveils.
 *
 * Aucune entité ne se tick à chaque frame. Une machine se replanifie
 * elle-même (`schedule(id, now + 40)`) et ne se replanifie pas du tout quand
 * elle est bloquée — c'est l'événement qui libère sa sortie qui la réveille.
 *
 * Sans ça : 10 000 machines × 20 TPS = 200 000 appels par seconde pour rien.
 * Avec : quelques centaines de réveils par tick.
 *
 * Implémentation : roue de 256 slots pour les délais courts, map pour les
 * délais longs. Insertion et lecture en O(1).
 *
 * Un délai < 256 tombe dans la roue, un délai >= 256 dans la map : deux
 * réveils ne peuvent donc jamais se disputer le même slot à un tick donné, et
 * aucune migration map → roue n'est nécessaire.
 */

export type WakeId = number;

/**
 * Les réveils en attente, pour la sauvegarde : `[tick, ids]` par échéance.
 * Roue et map restent séparées — `due()` rend la roue avant la map, et c'est
 * cet ordre qui garde la partie rechargée identique à l'originale.
 */
export interface SchedulerSnapshot {
  near: [number, WakeId[]][];
  far: [number, WakeId[]][];
}

const WHEEL_SIZE = 256;

export class Scheduler {
  private readonly wheel: WakeId[][] = Array.from({ length: WHEEL_SIZE }, () => []);
  private readonly far = new Map<number, WakeId[]>();
  private pending = 0;

  /**
   * Programme un réveil de `id` au tick `atTick`.
   * `atTick` doit être strictement dans le futur par rapport au tick courant.
   */
  public schedule(id: WakeId, atTick: number, currentTick: number): void {
    const delay = atTick - currentTick;

    if (delay <= 0) {
      throw new Error(`schedule: réveil dans le passé (tick ${atTick}, courant ${currentTick})`);
    }

    if (delay < WHEEL_SIZE) {
      this.wheel[atTick % WHEEL_SIZE]!.push(id);
    } else {
      const bucket = this.far.get(atTick);

      if (bucket) bucket.push(id);
      else this.far.set(atTick, [id]);
    }
    this.pending += 1;
  }

  /**
   * Retire et renvoie les réveils dus au tick `tick`.
   * Le tableau renvoyé appartient à l'appelant pour la durée du tick.
   */
  public due(tick: number): WakeId[] {
    const slot = this.wheel[tick % WHEEL_SIZE]!;
    const distant = this.far.get(tick);

    if (distant) this.far.delete(tick);

    let result: WakeId[];

    if (slot.length === 0) {
      result = distant ?? [];
    } else if (distant) {
      result = [...slot, ...distant];
      slot.length = 0;
    } else {
      result = [...slot];
      slot.length = 0;
    }

    this.pending -= result.length;
    return result;
  }

  /**
   * Les réveils en attente, vus depuis le tick `currentTick` (déjà écoulé).
   * Un slot de la roue ne dit pas son tick : c'est le seul tick à venir,
   * à moins de 256 de `currentTick`, qui y tombe.
   */
  public toJSON(currentTick: number): SchedulerSnapshot {
    const near: [number, WakeId[]][] = [];

    this.wheel.forEach((slot, index) => {
      if (slot.length === 0) return;

      const ahead = (((index - currentTick) % WHEEL_SIZE) + WHEEL_SIZE) % WHEEL_SIZE;

      near.push([currentTick + (ahead === 0 ? WHEEL_SIZE : ahead), [...slot]]);
    });

    return { near, far: [...this.far].map(([tick, ids]) => [tick, [...ids]]) };
  }

  /** Remplace tous les réveils par ceux d'une sauvegarde. */
  public restore(snapshot: SchedulerSnapshot): void {
    for (const slot of this.wheel) slot.length = 0;
    this.far.clear();
    this.pending = 0;

    for (const [tick, ids] of snapshot.near) {
      this.wheel[tick % WHEEL_SIZE]!.push(...ids);
      this.pending += ids.length;
    }
    for (const [tick, ids] of snapshot.far) {
      this.far.set(tick, [...ids]);
      this.pending += ids.length;
    }
  }

  /** Nombre de réveils en attente — utile en test et dans l'affichage de debug. */
  public size(): number {
    return this.pending;
  }
}
