import { describe, expect, it } from 'vitest';
import { BUILDINGS } from './buildings.ts';
import { ITEMS } from './items.ts';
import { RECIPES, type RecipeProto } from './recipes.ts';
import { validatePrototypes } from './validate.ts';

describe('prototypes', () => {
  it('passe la validation du démarrage', () => {
    expect(validatePrototypes()).toEqual([]);
  });

  /*
   * Noté sur la page projet comme manquant. Le test est là moins pour l'objet
   * lui-même que pour le contrat : un objet du jeu a un libellé français et
   * une taille de pile.
   */
  it('contient le bois', () => {
    expect(ITEMS.wood).toEqual({ label: 'Bois', stack: 100 });
  });

  it('n’a aucune recette orpheline', () => {
    for (const recipe of Object.values(RECIPES)) {
      expect(Object.keys(BUILDINGS)).toContain(recipe.building);
    }
  });

  it('refuse un objet récoltable sans débouché', () => {
    // Sans la forge, le charbon ne servirait à rien : la validation doit le dire.
    const forge = RECIPES.smeltPlate as RecipeProto;
    const inputs = forge.inputs;

    forge.inputs = { ironOre: 2 };
    try {
      expect(validatePrototypes()).toContain('ITEMS.coal : aucun débouché — ni coût de bâtiment, ni entrée de recette');
    } finally {
      forge.inputs = inputs;
    }
    expect(validatePrototypes()).toEqual([]);
  });
});
