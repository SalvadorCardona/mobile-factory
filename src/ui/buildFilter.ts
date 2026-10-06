/**
 * Le filtre du menu de construction : une famille et un texte, appliqués
 * ensemble aux cartes.
 *
 * Les puces : « Tous », puis une par famille (`BUILDING_CATEGORIES`, dans cet
 * ordre) qui a au moins une carte au menu. Une famille dont tout est encore
 * verrouillé n'a pas de puce : le filtre ne révèle rien que le menu cache.
 * Chaque puce compte ses cartes au menu, sans tenir compte du texte : les
 * nombres ne bougent pas sous le doigt pendant qu'on tape.
 *
 * Le texte est celui du champ de recherche, jugé par `buildSearch.ts` (nom,
 * métier, produits, sans casse ni accents). Si la famille active n'a rien pour lui mais que
 * « Tous » a quelque chose, la vue le dit (`elsewhere` : « 2 résultats
 * dans Tous ») au lieu d'une liste vide.
 *
 * `BuildFilter` garde le choix : la famille tient tant que le menu vit — la
 * partie —, le texte se vide à chaque ouverture du tiroir.
 *
 * Fonctions pures, sans DOM : `buildMenu.ts` les applique.
 */

import type { CategoryFilter } from '../data/categoryIcons.ts';
import { BUILDING_CATEGORIES, type BuildingCategory } from '../data/buildings.ts';
import { matchesSearch } from './buildSearch.ts';

/** Ce que le filtre sait d'une carte. */
export interface FilterCard {
  category: BuildingCategory;
  /** Où chercher le texte, dans la langue du moment : nom, métier, produits (`buildingTerms`). */
  terms: readonly string[];
  /** Au menu : débloquée, et pas un bâtiment unique déjà posé. */
  shown: boolean;
}

export interface FilterChip {
  filter: CategoryFilter;
  /** Cartes au menu dans cette famille (toutes pour « Tous »). */
  count: number;
}

export interface FilterView<K> {
  /** « Tous » d'abord, puis les familles qui ont une carte au menu. */
  chips: FilterChip[];
  /** La puce active : celle choisie, ou « Tous » si elle n'a plus de carte. */
  active: CategoryFilter;
  /** Les cartes à montrer. */
  visible: Set<K>;
  /** La puce active n'a rien pour le texte, « Tous » si : combien. `null` sinon. */
  elsewhere: FilterChip | null;
}

const CATEGORIES = Object.keys(BUILDING_CATEGORIES) as BuildingCategory[];

export function filterCards<K>(cards: ReadonlyMap<K, FilterCard>, category: CategoryFilter, query: string): FilterView<K> {
  const searching = query.trim() !== '';
  const counts = new Map<BuildingCategory, number>();
  let total = 0;

  for (const card of cards.values()) {
    if (!card.shown) continue;
    counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
    total += 1;
  }

  const chips: FilterChip[] = [{ filter: 'all', count: total }];

  for (const filter of CATEGORIES) {
    const count = counts.get(filter) ?? 0;

    if (count > 0) chips.push({ filter, count });
  }

  const active = chips.some((chip) => chip.filter === category) ? category : 'all';
  const visible = new Set<K>();
  let found = 0;

  for (const [key, card] of cards) {
    if (!card.shown || (searching && !matchesSearch(query, card.terms))) continue;
    found += 1;
    if (active === 'all' || card.category === active) visible.add(key);
  }

  const elsewhere = visible.size === 0 && found > 0 ? { filter: 'all' as const, count: found } : null;

  return { chips, active, visible, elsewhere };
}

/** Le choix du joueur : la famille tient d'une ouverture à l'autre, le texte non. */
export class BuildFilter {
  public category: CategoryFilter = 'all';
  public query = '';

  /** À l'ouverture du tiroir : on repart d'une recherche vide, dans la même famille. */
  public open(): void {
    this.query = '';
  }

  public choose(category: CategoryFilter): void {
    this.category = category;
  }

  public search(query: string): void {
    this.query = query;
  }

  public view<K>(cards: ReadonlyMap<K, FilterCard>): FilterView<K> {
    return filterCards(cards, this.category, this.query);
  }
}
