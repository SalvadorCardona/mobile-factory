/**
 * La garde-robe d'Adam : ce qu'il a le droit de porter, et ce qu'il trouve.
 *
 * Pur et sans état : le monde garde l'apparence et les pièces trouvées
 * (`Player.look`, `Player.wardrobe`) et appelle ces fonctions — pour juger
 * la commande `dressAdam`, pour tirer une pièce quand une source en donne une
 * (`WARDROBE_LOOT`), pour relire une sauvegarde.
 *
 * Le tirage est un **hachage** de la seed, de la source et de ce qui l'a
 * donné (l'objectif, la base, la bête) : jamais le PRNG du monde, pour que
 * trouver une pièce ne décale aucun autre tirage de la partie.
 */

import { hash3 } from '../core/rng.ts';
import { PALETTE, type Tone } from '../data/artDirection.ts';
import {
  COLOR_SLOTS,
  DEFAULT_LOOK,
  LOOK_COLORS,
  LOOK_SLOTS,
  LOOT_SOURCES,
  PIECES,
  PIECE_IDS,
  RARITY_IDS,
  WARDROBE_LOOT,
  isStarter,
  type Look,
  type LootSource,
  type PieceId,
  type Rarity,
  type WardrobeDrop,
} from '../data/wardrobe.ts';

/** Pourquoi une apparence est refusée : une pièce inconnue, hors de son emplacement, pas encore trouvée, ou une couleur hors du nuancier. */
export type LookRejection = 'unknown' | 'slot' | 'locked' | 'color';

/** Adam peut-il porter cette pièce ? Celles du départ, et celles qu'il a trouvées. */
export function owns(wardrobe: readonly PieceId[], piece: PieceId): boolean {
  return isStarter(piece) || wardrobe.includes(piece);
}

/** Ce qui cloche dans une apparence demandée, ou `null` si Adam peut la porter. */
export function lookRejection(look: Look, wardrobe: readonly PieceId[]): LookRejection | null {
  for (const slot of LOOK_SLOTS) {
    const piece = look.pieces[slot];

    if (!Object.hasOwn(PIECES, piece)) return 'unknown';
    if (PIECES[piece].slot !== slot) return 'slot';
    if (!owns(wardrobe, piece)) return 'locked';
  }
  for (const slot of COLOR_SLOTS) {
    if (!(LOOK_COLORS[slot] as readonly Tone[]).includes(look.colors[slot])) return 'color';
  }
  return null;
}

/**
 * La pièce que donne la source `source` pour l'événement `key` (l'index d'un
 * objectif, l'id d'une base ou d'une bête, le numéro de la nuit de la
 * Reine), parmi celles qu'Adam n'a pas encore ; `null` si le sort ne la donne
 * pas, ou s'il ne reste rien de ce qu'elle peut donner.
 */
export function rollPiece(seed: number, source: LootSource, key: number, wardrobe: readonly PieceId[]): PieceId | null {
  const drop: WardrobeDrop = WARDROBE_LOOT[source];
  const salt = LOOT_SOURCES.indexOf(source) + 1;
  const roll = (n: number): number => hash3(seed, salt * 7919 + n, key) / 4294967296;

  if (roll(0) >= drop.chance) return null;

  const missing = PIECE_IDS.filter((piece) => !owns(wardrobe, piece));
  const rarities = RARITY_IDS.filter((rarity) => (drop.weights[rarity] ?? 0) > 0 && missing.some((piece) => PIECES[piece].rarity === rarity));
  const total = rarities.reduce((sum, rarity) => sum + (drop.weights[rarity] ?? 0), 0);

  if (total === 0) return null;

  let pick = roll(1) * total;
  let rarity: Rarity = rarities[rarities.length - 1]!;

  for (const candidate of rarities) {
    pick -= drop.weights[candidate] ?? 0;
    if (pick < 0) {
      rarity = candidate;
      break;
    }
  }

  const pool = missing.filter((piece) => PIECES[piece].rarity === rarity);

  return pool[Math.floor(roll(2) * pool.length)] ?? null;
}

/**
 * L'apparence d'une sauvegarde, relue sans faire tomber la partie : une
 * sauvegarde d'avant la garde-robe, une pièce retirée du catalogue, une
 * couleur hors du nuancier — l'emplacement reprend sa valeur par défaut.
 */
export function readLook(raw: unknown, wardrobe: readonly PieceId[]): Look {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const pieces = typeof record['pieces'] === 'object' && record['pieces'] !== null ? (record['pieces'] as Record<string, unknown>) : {};
  const colors = typeof record['colors'] === 'object' && record['colors'] !== null ? (record['colors'] as Record<string, unknown>) : {};
  const look: Look = { pieces: { ...DEFAULT_LOOK.pieces }, colors: { ...DEFAULT_LOOK.colors } };

  for (const slot of LOOK_SLOTS) {
    const piece = pieces[slot];

    if (typeof piece === 'string' && Object.hasOwn(PIECES, piece) && PIECES[piece as PieceId].slot === slot && owns(wardrobe, piece as PieceId)) {
      look.pieces[slot] = piece as PieceId;
    }
  }
  for (const slot of COLOR_SLOTS) {
    const tone = colors[slot];

    if (typeof tone === 'string' && Object.hasOwn(PALETTE, tone) && (LOOK_COLORS[slot] as readonly string[]).includes(tone)) {
      look.colors[slot] = tone as Tone;
    }
  }
  return look;
}

/** Les pièces trouvées d'une sauvegarde : les ids connus, sans doublon ni pièce du départ. */
export function readWardrobe(raw: unknown): PieceId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((piece): piece is PieceId => typeof piece === 'string' && Object.hasOwn(PIECES, piece) && !isStarter(piece as PieceId)))];
}
