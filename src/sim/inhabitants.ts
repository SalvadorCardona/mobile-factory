/**
 * Les habitants : leur âge, leur prénom, ce qu'ils font.
 *
 * L'âge est de l'état (il avance à l'aube, `World.dawn`) ; le prénom ne
 * l'est pas : il se relit dans la seed et l'id, qu'un enfant garde en
 * devenant ouvrier. Rien ici ne tire le PRNG du monde — un âge d'adulte est
 * un hachage, comme la flânerie : en ajouter un ne change pas la suite des
 * vagues.
 */

import { hash3 } from '../core/rng.ts';
import { AGES, NAMES } from '../data/inhabitants.ts';
import type { MobileId } from './types.ts';

/** Sel du hachage d'Adam, qui n'a pas d'id de mobile. */
export const ADAM_SALT = -1;

/** L'âge d'un adulte arrivé tout fait, entre `AGES.adultMin` et `AGES.adultMax`, tiré de la seed. */
export function adultAge(seed: number, id: MobileId): number {
  const span = AGES.adultMax - AGES.adultMin + 1;

  return AGES.adultMin + (hash3(seed, id, 0x0a9e) % span);
}

/** Le prénom d'un habitant, tiré de la seed et de son id. */
export function nameOf(seed: number, id: MobileId): string {
  return NAMES[hash3(seed, id, 0x4a3e) % NAMES.length]!;
}

/** Les aubes qu'il reste à un enfant avant de travailler ; 0 s'il a l'âge. */
export function yearsToWork(age: number): number {
  return Math.max(0, Math.ceil((AGES.work - age) / AGES.yearsPerCycle));
}

/** A-t-il l'âge de travailler ? */
export function canWork(age: number): boolean {
  return age >= AGES.work;
}
