/**
 * Contrôle d'intégrité des prototypes, exécuté au démarrage en développement.
 *
 * TypeScript attrape déjà les ids inconnus. Ce qu'il n'attrape pas, ce sont les
 * incohérences entre tables : une recette dont le bâtiment n'existe plus, une
 * quantité nulle, un libellé dupliqué, un sprite à qui il manque un morceau
 * ou qui enfreint la direction artistique — ou un objet sans débouché, qu'on
 * récolterait pour remplir son sac pour rien. Tout ça se voit ici, au chargement,
 * plutôt qu'en jeu trois semaines plus tard.
 *
 * Plus tard s'ajouteront les cycles dans l'arbre techno et les déblocages en
 * double, quand `technologies.ts` existera.
 */

import { TILE_SIZE } from '../core/grid.ts';
import { auditSvg } from './artDirection.ts';
import { BUILDINGS } from './buildings.ts';
import { ENEMIES, LOOT_DROPS, WAVES, WILDLIFE, WILDLIFE_SPAWN, type LootTable, type WildlifeProto } from './enemies.ts';
import { EVE } from './eve.ts';
import { ICON_SIZE, ITEM_ICONS } from './icons.ts';
import { ITEMS } from './items.ts';
import { PERKS, type PerkProto } from './perks.ts';
import { QUESTS, QUEST_IDS, TOOLS, type QuestProto } from './quests.ts';
import { RECIPES, type RecipeProto } from './recipes.ts';
import { RESOURCES } from './resources.ts';
import { BUILDING_PARTS, RESOURCE_PARTS, SPRITES, WALKER_PARTS, type SpriteProto } from './sprites.ts';
import { WEAPONS } from './weapons.ts';
import { WEATHER, WEATHER_CALENDAR, type WeatherProto } from './weather.ts';

export function validatePrototypes(): string[] {
  const errors: string[] = [];

  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.stack <= 0) {
      errors.push(`ITEMS.${id} : stack doit être strictement positif`);
    }

    // TypeScript garantit qu'une icône existe ; on vérifie ici son cadre et la direction artistique.
    const icon = ITEM_ICONS[id as keyof typeof ITEM_ICONS];

    if (!icon.includes(`width="${ICON_SIZE}" height="${ICON_SIZE}"`)) {
      errors.push(`ITEM_ICONS.${id} : l'icône doit faire ${ICON_SIZE} × ${ICON_SIZE}`);
    }
    for (const problem of auditSvg(icon)) errors.push(`ITEM_ICONS.${id} : ${problem}`);
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
    if (building.hp <= 0) {
      errors.push(`BUILDINGS.${id} : points de vie nuls`);
    }
    if (building.workers < 0 || !Number.isInteger(building.workers)) {
      errors.push(`BUILDINGS.${id} : nombre d'ouvriers invalide`);
    }
    if (building.unlockWave < 0 || !Number.isInteger(building.unlockWave)) {
      errors.push(`BUILDINGS.${id} : vague de déblocage invalide`);
    }
    if (building.weapon !== null && !(building.weapon in WEAPONS)) {
      errors.push(`BUILDINGS.${id} : arme inconnue « ${String(building.weapon)} »`);
    }
    if (building.kind === 'tower' && building.weapon === null) {
      errors.push(`BUILDINGS.${id} : une tour sans arme ne sert à rien`);
    }
    // La ligne d'effet du menu cite des chiffres : ils doivent suivre la donnée.
    if (building.effect.trim() === '') {
      errors.push(`BUILDINGS.${id} : ligne d'effet vide`);
    }
    if (building.weapon !== null && building.weapon in WEAPONS) {
      const range = `${WEAPONS[building.weapon].range} cases`;

      if (!building.effect.includes(range)) errors.push(`BUILDINGS.${id} : l'effet doit citer la portée (« ${range} »)`);
    }
    if (building.kind === 'nursery') {
      const minutes = `${RECIPES.raiseChild.duration / (20 * 60)} min`;

      if (!building.effect.includes(minutes)) errors.push(`BUILDINGS.${id} : l'effet doit citer « ${minutes} »`);
    }
    if (!(building.sprite in SPRITES)) {
      errors.push(`BUILDINGS.${id} : planche inconnue « ${building.sprite} »`);
    } else {
      const sprite: SpriteProto = SPRITES[building.sprite];
      const expectedW = building.width * TILE_SIZE;
      const expectedH = building.height * TILE_SIZE;

      // Vue 3/4 : aussi large que l'emprise, au moins aussi haut — le toit dépasse.
      if (sprite.width !== expectedW || sprite.height < expectedH) {
        errors.push(
          `BUILDINGS.${id} : le sprite « ${building.sprite} » fait ` +
            `${sprite.width}×${sprite.height}, l'emprise demande ${expectedW} de large ` +
            `et au moins ${expectedH} de haut`,
        );
      }
      if (sprite.anchorX !== 0 || sprite.anchorY !== 1) {
        errors.push(`BUILDINGS.${id} : le sprite « ${building.sprite} » doit être ancré en (0, 1)`);
      }
      for (const part of BUILDING_PARTS) {
        if (!(part in sprite.parts)) errors.push(`BUILDINGS.${id} : le sprite « ${building.sprite} » n'a pas de morceau « ${part} »`);
      }
    }
  }

  const buildingsWithRecipe = new Set<string>();

  for (const [id, recipe] of Object.entries(RECIPES) as [string, RecipeProto][]) {
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

    // La nurserie seule produit autre chose qu'un objet : un enfant.
    if (Object.keys(recipe.outputs).length === 0 && BUILDINGS[recipe.building].kind !== 'nursery') {
      errors.push(`RECIPES.${id} : aucune sortie`);
    }

    const needs = sum(recipe.inputs);

    if (needs > BUILDINGS[recipe.building].storage) {
      errors.push(`RECIPES.${id} : le coffre de « ${recipe.building} » ne peut pas contenir ses entrées`);
    }
  }

  // Un débouché par objet : un coût de bâtiment ou une entrée de recette.
  const consumed = new Set<string>();

  for (const building of Object.values(BUILDINGS)) {
    for (const itemId of Object.keys(building.cost)) consumed.add(itemId);
  }
  for (const recipe of Object.values(RECIPES) as RecipeProto[]) {
    for (const itemId of Object.keys(recipe.inputs)) consumed.add(itemId);
  }
  for (const id of Object.keys(ITEMS)) {
    if (!consumed.has(id)) {
      errors.push(`ITEMS.${id} : aucun débouché — ni coût de bâtiment, ni entrée de recette`);
    }
  }

  for (const [id, building] of Object.entries(BUILDINGS)) {
    if (
      (building.kind === 'drill' || building.kind === 'farm' || building.kind === 'nursery' || building.kind === 'forge') &&
      !buildingsWithRecipe.has(id)
    ) {
      errors.push(`BUILDINGS.${id} : aucun bâtiment producteur sans recette associée`);
    }
    if (building.kind === 'farm' && building.storage <= 0) {
      errors.push(`BUILDINGS.${id} : une ferme sans coffre ne peut rien récolter`);
    }
  }

  for (const [id, resource] of Object.entries(RESOURCES)) {
    if (!(resource.item in ITEMS)) {
      errors.push(`RESOURCES.${id} : objet inconnu « ${resource.item} »`);
    }
    if (resource.amount <= 0 || resource.harvestTicks <= 0) {
      errors.push(`RESOURCES.${id} : quantité ou cadence nulle`);
    }
    if ((resource.sprites as readonly string[]).length === 0) {
      errors.push(`RESOURCES.${id} : aucun sprite`);
    }
    for (const sprite of resource.sprites) {
      if (!(sprite in SPRITES)) {
        errors.push(`RESOURCES.${id} : sprite inconnu « ${sprite} »`);
        continue;
      }
      for (const part of RESOURCE_PARTS) {
        if (!(part in SPRITES[sprite].parts)) {
          errors.push(`RESOURCES.${id} : le sprite « ${sprite} » n'a pas de morceau « ${part} »`);
        }
      }
    }
  }

  for (const [id, enemy] of Object.entries(ENEMIES)) {
    if (enemy.hp <= 0 || enemy.speed <= 0 || enemy.damage <= 0 || enemy.attackTicks <= 0) {
      errors.push(`ENEMIES.${id} : points de vie, vitesse, dégâts ou cadence nuls`);
    }
    if (enemy.halfW <= 0 || enemy.halfH <= 0 || enemy.halfW * 2 > TILE_SIZE) {
      errors.push(`ENEMIES.${id} : boîte de collision invalide`);
    }
    if (!(enemy.sprite in SPRITES)) {
      errors.push(`ENEMIES.${id} : sprite inconnu « ${enemy.sprite} »`);
    } else {
      for (const part of WALKER_PARTS) {
        if (!(part in SPRITES[enemy.sprite].parts)) {
          errors.push(`ENEMIES.${id} : le sprite « ${enemy.sprite} » n'a pas de morceau « ${part} »`);
        }
      }
    }
    errors.push(...lootErrors(`ENEMIES.${id}`, enemy.loot));
  }

  for (const [id, beast] of Object.entries(WILDLIFE)) {
    const proto: WildlifeProto = beast;

    if (proto.hp <= 0 || proto.speed <= 0 || proto.chargeSpeed <= 0 || proto.damage <= 0 || proto.attackTicks <= 0) {
      errors.push(`WILDLIFE.${id} : points de vie, vitesses, dégâts ou cadence nuls`);
    }
    if (proto.halfW <= 0 || proto.halfH <= 0 || proto.halfW * 2 > TILE_SIZE) {
      errors.push(`WILDLIFE.${id} : boîte de collision invalide`);
    }
    // Rentrer avant d'avoir repéré Adam, ou lâcher la poursuite dans son propre rayon : la bête tournerait en rond.
    if (proto.aggroRadius <= 0 || proto.giveUpRadius <= proto.aggroRadius || proto.leashRadius <= proto.aggroRadius) {
      errors.push(`WILDLIFE.${id} : rayons d'aggro, d'abandon et de laisse incohérents`);
    }
    if (proto.groupMin < 1 || proto.groupMax < proto.groupMin || proto.densPerChunk < 0 || proto.respawnTicks <= 0) {
      errors.push(`WILDLIFE.${id} : effectif, densité ou repeuplement incohérents`);
    }
    errors.push(...lootErrors(`WILDLIFE.${id}`, proto.loot));
    if (!(proto.sprite in SPRITES)) {
      errors.push(`WILDLIFE.${id} : sprite inconnu « ${proto.sprite} »`);
    } else {
      for (const part of ['down', 'downHurt', 'foot']) {
        if (!(part in SPRITES[proto.sprite].parts)) {
          errors.push(`WILDLIFE.${id} : le sprite « ${proto.sprite} » n'a pas de morceau « ${part} »`);
        }
      }
    }
  }

  if (WILDLIFE_SPAWN.minPlayerDistance >= WILDLIFE_SPAWN.despawnDistance || WILDLIFE_SPAWN.cap <= 0) {
    errors.push('WILDLIFE_SPAWN : distances ou plafond incohérents');
  }

  for (const [id, weapon] of Object.entries(WEAPONS)) {
    if (weapon.range <= 0 || weapon.cooldown <= 0 || weapon.damage <= 0 || weapon.arrowSpeed <= 0) {
      errors.push(`WEAPONS.${id} : portée, cadence, dégâts ou vitesse nuls`);
    }
  }

  if (
    LOOT_DROPS.lifetimeTicks <= 0 ||
    LOOT_DROPS.pickupRadius <= 0 ||
    LOOT_DROPS.magnetRadius < LOOT_DROPS.pickupRadius ||
    LOOT_DROPS.magnetSpeed <= 0 ||
    LOOT_DROPS.scatter < 0 ||
    LOOT_DROPS.scatter > LOOT_DROPS.pickupRadius ||
    LOOT_DROPS.cap <= 0
  ) {
    errors.push('LOOT_DROPS : durée, rayons, vitesse, dispersion ou plafond incohérents');
  }

  if (WAVES.minDistance > WAVES.maxDistance || WAVES.firstDelay <= 0 || WAVES.interval <= 0) {
    errors.push('WAVES : distances ou délais incohérents');
  }

  if (QUEST_IDS.length < 3) errors.push('QUESTS : Ève doit donner au moins trois quêtes');
  if (EVE.arrivalWave < 1 || EVE.rideSpeed <= 0 || EVE.walkSpeed <= 0 || EVE.repairTicks <= 0 || EVE.repairAmount <= 0) {
    errors.push('EVE : vague d’arrivée, vitesses ou cadence de réparation nulles');
  }

  const plansGiven = new Set<string>();

  for (const id of QUEST_IDS) {
    const quest: QuestProto = QUESTS[id];

    if (quest.goal.count <= 0) errors.push(`QUESTS.${id} : objectif nul`);
    if (quest.goal.building === 'townHall') errors.push(`QUESTS.${id} : la mairie est unique, on n'en bâtit pas d'autre`);
    // Un bâtiment à plan demandé avant que son plan soit donné : la quête ne finirait jamais.
    if (BUILDINGS[quest.goal.building].plan && !plansGiven.has(quest.goal.building)) {
      errors.push(`QUESTS.${id} : demande « ${quest.goal.building} » avant d'en donner le plan`);
    }
    if (quest.reward.type === 'plan') {
      if (!BUILDINGS[quest.reward.building].plan) errors.push(`QUESTS.${id} : « ${quest.reward.building} » n'a pas besoin de plan`);
      if (plansGiven.has(quest.reward.building)) errors.push(`QUESTS.${id} : plan « ${quest.reward.building} » donné deux fois`);
      plansGiven.add(quest.reward.building);
    } else if (!(quest.reward.tool in TOOLS)) {
      errors.push(`QUESTS.${id} : outil inconnu « ${quest.reward.tool} »`);
    }
  }

  for (const [id, building] of Object.entries(BUILDINGS)) {
    if (building.plan && !plansGiven.has(id)) errors.push(`BUILDINGS.${id} : aucune quête n'en donne le plan`);
  }

  for (const [id, tool] of Object.entries(TOOLS)) {
    if (tool.harvestSpeed <= 1 || (tool.resources as readonly string[]).length === 0) errors.push(`TOOLS.${id} : l'outil ne sert à rien`);
  }

  const { slotTicks, announceTicks, calmWeight, waveMarginTicks } = WEATHER_CALENDAR;

  for (const [id, weather] of Object.entries(WEATHER) as [string, WeatherProto][]) {
    // Une météo tient dans son créneau, annonce comprise de chaque côté : deux météos ne se chevauchent jamais.
    if (weather.durationTicks <= 0 || weather.durationTicks + announceTicks * 2 > slotTicks) {
      errors.push(`WEATHER.${id} : durée nulle ou trop longue pour un créneau`);
    }
    if (weather.weight <= 0) errors.push(`WEATHER.${id} : poids de tirage nul`);
    if (weather.playerSpeed <= 0 || weather.harvestYield < 1 || weather.weaponRange <= 0) {
      errors.push(`WEATHER.${id} : vitesse, récolte ou portée nulles`);
    }
    if (weather.corrosion && (weather.corrosion.everyTicks <= 0 || weather.corrosion.damage <= 0)) {
      errors.push(`WEATHER.${id} : corrosion nulle`);
    }
  }
  if (calmWeight < 0 || announceTicks <= 0 || waveMarginTicks >= slotTicks) {
    errors.push('WEATHER_CALENDAR : poids du calme, annonce ou marge incohérents');
  }

  for (const [id, sprite] of Object.entries(SPRITES) as [string, SpriteProto][]) {
    const frame = `width="${sprite.width}" height="${sprite.height}"`;

    for (const [part, source] of Object.entries(sprite.parts)) {
      // Tous les morceaux d'un sprite partagent son cadre : c'est ce qui les superpose.
      if (!source.startsWith('<svg') || !source.includes(frame)) {
        errors.push(`SPRITES.${id}.${part} : le SVG doit avoir le cadre du sprite (${sprite.width}×${sprite.height})`);
      }
      for (const problem of auditSvg(source)) errors.push(`SPRITES.${id}.${part} : ${problem}`);
    }
    for (const part of Object.keys(sprite.pivots ?? {})) {
      if (!(part in sprite.parts)) errors.push(`SPRITES.${id} : pivot d'un morceau inconnu « ${part} »`);
    }
    if (sprite.anchorX < 0 || sprite.anchorX > 1 || sprite.anchorY < 0 || sprite.anchorY > 1) {
      errors.push(`SPRITES.${id} : ancre hors du cadre`);
    }
  }

  // Des bonus de confort : un bonus qui fait gagner une vague n'a rien à faire dans le jardin.
  for (const [id, perk] of Object.entries(PERKS) as [string, PerkProto][]) {
    const { bag, start, freeSite, harvestSpeed } = perk.effect;

    if (perk.cost <= 0 || !Number.isInteger(perk.cost)) {
      errors.push(`PERKS.${id} : coût en graines nul ou non entier`);
    }
    if (bag === undefined && start === undefined && freeSite === undefined && harvestSpeed === undefined) {
      errors.push(`PERKS.${id} : aucun effet`);
    }
    if (bag !== undefined && (bag <= 0 || !Number.isInteger(bag))) {
      errors.push(`PERKS.${id} : places de sac nulles ou non entières`);
    }
    for (const [itemId, amount] of Object.entries<number>(start ?? {})) {
      if (!(itemId in ITEMS) || amount <= 0 || !Number.isInteger(amount)) {
        errors.push(`PERKS.${id} : objet de départ invalide « ${itemId} »`);
      }
    }
    if (freeSite !== undefined && !(freeSite in BUILDINGS)) {
      errors.push(`PERKS.${id} : chantier offert inconnu « ${freeSite} »`);
    }
    for (const [resourceId, speed] of Object.entries<number>(harvestSpeed ?? {})) {
      if (!(resourceId in RESOURCES) || speed <= 0 || speed > 0.5) {
        errors.push(`PERKS.${id} : accélération de récolte invalide sur « ${resourceId} »`);
      }
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

/** Une table de butin : des objets connus, des quantités entières, et au moins une ligne qui tombe à coup sûr. */
function lootErrors(owner: string, table: LootTable): string[] {
  const errors: string[] = [];

  if (!table.some((entry) => entry.chance >= 1)) errors.push(`${owner} : aucun butin garanti — un ennemi abattu doit toujours lâcher quelque chose`);

  for (const { item, min, max, chance } of table) {
    if (!(item in ITEMS)) errors.push(`${owner} : butin inconnu « ${item} »`);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
      errors.push(`${owner} : quantités de « ${item} » incohérentes (${min}–${max})`);
    }
    if (!(chance > 0 && chance <= 1)) errors.push(`${owner} : probabilité de « ${item} » hors de ]0, 1]`);
  }
  return errors;
}

function sum(amounts: Partial<Record<string, number>>): number {
  return Object.values(amounts).reduce<number>((total, amount) => total + (amount ?? 0), 0);
}

/** Lance la validation et hurle en console. Appelé depuis `main.ts` en dev seulement. */
export function assertPrototypes(): void {
  const errors = validatePrototypes();

  if (errors.length > 0) {
    throw new Error(`Prototypes invalides :\n- ${errors.join('\n- ')}`);
  }
}
