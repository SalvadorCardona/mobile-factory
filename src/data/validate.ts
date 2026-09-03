/**
 * Contrôle d'intégrité des prototypes, exécuté au démarrage en développement.
 *
 * TypeScript attrape déjà les ids inconnus. Ce qu'il n'attrape pas, ce sont les
 * incohérences entre tables : une recette dont le bâtiment n'existe plus, une
 * quantité nulle, un libellé dupliqué. Tout ça se voit ici, au chargement,
 * plutôt qu'en jeu trois semaines plus tard.
 *
 * Plus tard s'ajouteront les cycles dans l'arbre techno et les déblocages en
 * double, quand `technologies.ts` existera.
 */

import { BUILDINGS } from './buildings.ts';
import { ITEMS } from './items.ts';
import { RECIPES } from './recipes.ts';

export function validatePrototypes(): string[] {
  const errors: string[] = [];

  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.stack <= 0) {
      errors.push(`ITEMS.${id} : stack doit être strictement positif`);
    }
  }

  for (const [id, building] of Object.entries(BUILDINGS)) {
    if (building.width <= 0 || building.height <= 0) {
      errors.push(`BUILDINGS.${id} : emprise invalide`);
    }
    if (building.storage < 0) {
      errors.push(`BUILDINGS.${id} : capacité de coffre négative`);
    }
    for (const [itemId, amount] of Object.entries<number>(building.cost)) {
      if (!(itemId in ITEMS)) {
        errors.push(`BUILDINGS.${id} : coût en objet inconnu « ${itemId} »`);
      }
      if (amount <= 0) {
        errors.push(`BUILDINGS.${id} : coût nul ou négatif en « ${itemId} »`);
      }
    }
  }

  const buildingsWithRecipe = new Set<string>();

  for (const [id, recipe] of Object.entries(RECIPES)) {
    if (!(recipe.building in BUILDINGS)) {
      errors.push(`RECIPES.${id} : bâtiment inconnu « ${recipe.building} »`);
    } else {
      buildingsWithRecipe.add(recipe.building);
    }

    if (recipe.duration <= 0) {
      errors.push(`RECIPES.${id} : durée nulle ou négative`);
    }

    for (const [itemId, amount] of Object.entries({ ...recipe.inputs, ...recipe.outputs })) {
      if (!(itemId in ITEMS)) {
        errors.push(`RECIPES.${id} : objet inconnu « ${itemId} »`);
      }
      if (amount <= 0) {
        errors.push(`RECIPES.${id} : quantité nulle ou négative pour « ${itemId} »`);
      }
    }

    if (Object.keys(recipe.outputs).length === 0) {
      errors.push(`RECIPES.${id} : aucune sortie`);
    }
  }

  for (const [id, building] of Object.entries(BUILDINGS)) {
    if (building.kind === 'drill' && !buildingsWithRecipe.has(id)) {
      errors.push(`BUILDINGS.${id} : aucun bâtiment producteur sans recette associée`);
    }
  }

  const labels = new Map<string, string>();

  for (const [id, proto] of [...Object.entries(ITEMS), ...Object.entries(BUILDINGS)]) {
    const previous = labels.get(proto.label);

    if (previous) {
      errors.push(`Libellé « ${proto.label} » partagé par ${previous} et ${id}`);
    }
    labels.set(proto.label, id);
  }

  return errors;
}

/** Lance la validation et hurle en console. Appelé depuis `main.ts` en dev seulement. */
export function assertPrototypes(): void {
  const errors = validatePrototypes();

  if (errors.length > 0) {
    throw new Error(`Prototypes invalides :\n- ${errors.join('\n- ')}`);
  }
}
