import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId, type BuildingUpgrade } from './buildings.ts';
import { ITEMS } from './items.ts';
import { QUESTS } from './quests.ts';
import { RECIPES, type RecipeProto } from './recipes.ts';
import { RESEARCH, type ResearchProto } from './research.ts';
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
    // Sans la forge, l'aciérie, les foreuses rapides et le haut fourneau du labo ni l'étage 2 de l'antenne, le charbon ne servirait à rien : la validation doit le dire.
    const forge = RECIPES.smeltPlate as RecipeProto;
    const steel = RECIPES.castSteel as RecipeProto;
    const drills = RESEARCH.fastDrills as ResearchProto;
    const furnace = RESEARCH.steelmaking as ResearchProto;
    const floor = BUILDINGS.antenna.upgrades[0] as BuildingUpgrade;
    const inputs = forge.inputs;
    const steelInputs = steel.inputs;
    const cost = drills.cost;
    const furnaceCost = furnace.cost;
    const floorCost = floor.cost;

    forge.inputs = { ironOre: 2 };
    steel.inputs = { ironPlate: 2 };
    drills.cost = { ironOre: 10 };
    furnace.cost = { tools: 8, ironPlate: 10 };
    floor.cost = { ironPlate: 40, radCore: 1 };
    try {
      expect(validatePrototypes()).toContain(
        "ITEMS.coal : aucun débouché — ni coût de bâtiment ou d'amélioration, ni entrée de recette, ni coût de recherche, ni besoin",
      );
    } finally {
      forge.inputs = inputs;
      steel.inputs = steelInputs;
      drills.cost = cost;
      furnace.cost = furnaceCost;
      floor.cost = floorCost;
    }
    expect(validatePrototypes()).toEqual([]);
  });

  it('refuse une quête qui demande un bâtiment qu’on ne trouve qu’au labo', () => {
    const goal = QUESTS.housing.goal as { building: BuildingId };
    const building = goal.building;

    goal.building = 'clinic';
    try {
      expect(validatePrototypes()).toContain("QUESTS.housing : demande « clinic », qui n'arrive qu'au labo");
    } finally {
      goal.building = building;
    }
    expect(validatePrototypes()).toEqual([]);
  });

  it('refuse un bâtiment débloqué par deux recherches', () => {
    const boots = RESEARCH.walkingBoots as ResearchProto;
    const unlocks = boots.unlocks;

    boots.unlocks = ['forge'];
    try {
      expect(validatePrototypes()).toContain('RESEARCH.walkingBoots : « forge » déjà débloqué par metalworking');
    } finally {
      boots.unlocks = unlocks;
    }
  });
});
