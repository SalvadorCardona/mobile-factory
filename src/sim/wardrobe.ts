/**
 * La garde-robe d'Adam : ce qu'il a le droit de porter, et ce qu'il trouve.
 *
 * Pur et sans état : le monde garde l'apparence et les pièces trouvées
 * (`Player.look`, `Player.wardrobe`) et appelle ces fonctions — pour juger
 * la commande `dressAdam`, pour tirer une pièce quand une source en donne une
 * (`WARDROBE_LOOT`, `BASE_WARDROBE_LOOT`), pour relire une sauvegarde.
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
  isStarter,
  wardrobeDrop,
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

/** Un tirage : la pièce trouvée, `'spare'` si le sort en donnait une mais qu'Adam a déjà tout, `null` si le sort n'en donne pas. */
type Roll = PieceId | 'spare' | null;

function rollOne(seed: number, source: LootSource, key: number, draw: number, wardrobe: readonly PieceId[], drop: WardrobeDrop): Roll {
  const salt = LOOT_SOURCES.indexOf(source) + 1;
  const roll = (n: number): number => hash3(seed, salt * 7919 + draw * 3 + n, key) / 4294967296;

  if (roll(0) >= drop.chance) return null;

  const missing = PIECE_IDS.filter((piece) => !owns(wardrobe, piece));

  if (missing.length === 0) return 'spare';

  const rarities = RARITY_IDS.filter((rarity) => (drop.weights[rarity] ?? 0) > 0 && missing.some((piece) => PIECES[piece].rarity === rarity));
  const total = rarities.reduce((sum, rarity) => sum + (drop.weights[rarity] ?? 0), 0);

  // Les raretés de la source épuisées : une autre pièce qui manque, plutôt qu'un doublon.
  if (total === 0) return missing[Math.floor(roll(2) * missing.length)] ?? 'spare';

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

  return pool[Math.floor(roll(2) * pool.length)] ?? 'spare';
}

/**
 * La pièce que donne la source `source` pour l'événement `key` (l'index d'un
 * objectif, l'id d'une base, d'une bête ou d'un coffre, le numéro de la nuit
 * de la Reine), parmi celles qu'Adam n'a pas encore — d'abord dans les
 * raretés de la source, sinon n'importe laquelle qui manque ; `null` si le
 * sort ne la donne pas, ou si Adam a déjà tout.
 */
export function rollPiece(seed: number, source: LootSource, key: number, wardrobe: readonly PieceId[], drop: WardrobeDrop = wardrobeDrop(source)): PieceId | null {
  const piece = rollOne(seed, source, key, 0, wardrobe, drop);

  return piece === 'spare' ? null : piece;
}

/** Ce que donne une source : les pièces trouvées, sans doublon, et le nombre de tirages tombés quand Adam avait déjà tout. */
export interface PieceDraw {
  pieces: PieceId[];
  spares: number;
}

/** Tous les tirages d'une source (`WardrobeDrop.count`) : chacun voit les pièces des précédents. */
export function drawPieces(seed: number, source: LootSource, key: number, wardrobe: readonly PieceId[], drop: WardrobeDrop = wardrobeDrop(source)): PieceDraw {
  const result: PieceDraw = { pieces: [], spares: 0 };

  for (let draw = 0; draw < (drop.count ?? 1); draw += 1) {
    const piece = rollOne(seed, source, key, draw, [...wardrobe, ...result.pieces], drop);

    if (piece === 'spare') result.spares += 1;
    else if (piece !== null) result.pieces.push(piece);
  }
  return result;
}

/** Les pièces pas encore regardées d'une sauvegarde : des pièces trouvées, sans doublon. */
export function readUnseen(raw: unknown, wardrobe: readonly PieceId[]): PieceId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((piece): piece is PieceId => typeof piece === 'string' && wardrobe.includes(piece as PieceId)))];
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
