/**
 * Le jardin des souvenirs : ce qu'on garde d'une colonie à l'autre.
 *
 * Chaque colonie tombée laisse des graines (`seedsFor`, `data/perks.ts`) ;
 * sur l'écran titre, on les plante pour débloquer des bonus permanents,
 * appliqués au départ de chaque nouvelle colonie. « Partie pure » les met de
 * côté sans les perdre : pour un défi entre amis, à armes égales.
 *
 * Le jardin n'est pas l'état d'une partie : il survit à « Recommencer » et à
 * la chute de la mairie, et il a son propre format, versionné, à part de la
 * sauvegarde (`storage/localGarden.ts` l'écrit sous sa propre clé). Ce
 * module est pur — ni `localStorage` ni DOM — et `decodeGarden` ne lève
 * jamais : un jardin illisible redevient un jardin vide.
 */

import { PERKS, isPerkId, type PerkId } from '../data/perks.ts';

/** Version du format. À incrémenter à chaque changement incompatible de `Garden`. */
export const GARDEN_VERSION = 1;

export interface Garden {
  /** Graines pas encore plantées. */
  seeds: number;
  /** Bonus débloqués, dans l'ordre où ils ont été plantés. */
  planted: PerkId[];
  /** « Partie pure » : les nouvelles colonies partent sans bonus. */
  pure: boolean;
}

export const EMPTY_GARDEN: Readonly<Garden> = { seeds: 0, planted: [], pure: false };

/** Le jardin enrichi des graines d'une colonie. */
export function harvestSeeds(garden: Garden, seeds: number): Garden {
  return { ...garden, seeds: garden.seeds + Math.max(0, Math.floor(seeds)) };
}

/** Peut-on planter ce bonus : pas encore débloqué, et assez de graines ? */
export function canPlant(garden: Garden, perk: PerkId): boolean {
  return !garden.planted.includes(perk) && garden.seeds >= PERKS[perk].cost;
}

/** Plante un bonus ; renvoie le jardin tel quel si on ne peut pas. */
export function plant(garden: Garden, perk: PerkId): Garden {
  if (!canPlant(garden, perk)) return garden;
  return { ...garden, seeds: garden.seeds - PERKS[perk].cost, planted: [...garden.planted, perk] };
}

/** Les bonus avec lesquels part la prochaine colonie : aucun en partie pure. */
export function activePerks(garden: Garden): PerkId[] {
  return garden.pure ? [] : [...garden.planted];
}

export function encodeGarden(garden: Garden): string {
  return JSON.stringify({ version: GARDEN_VERSION, garden });
}

/**
 * Lit un jardin. Ne lève jamais : illisible, d'une autre version ou
 * incohérent, il redevient vide. Un bonus qui n'existe plus est ignoré sans
 * faire perdre les autres.
 */
export function decodeGarden(text: string): Garden {
  try {
    const file: unknown = JSON.parse(text);

    if (!isRecord(file) || file['version'] !== GARDEN_VERSION || !isRecord(file['garden'])) return { ...EMPTY_GARDEN };

    const { seeds, planted, pure } = file['garden'];

    if (typeof seeds !== 'number' || !Number.isInteger(seeds) || seeds < 0) return { ...EMPTY_GARDEN };
    if (!Array.isArray(planted) || typeof pure !== 'boolean') return { ...EMPTY_GARDEN };

    const perks = planted.filter((id): id is PerkId => typeof id === 'string' && isPerkId(id));

    return { seeds, planted: [...new Set(perks)], pure };
  } catch {
    return { ...EMPTY_GARDEN };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
