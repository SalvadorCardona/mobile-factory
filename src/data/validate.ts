/**
 * Contrôle d'intégrité des prototypes, exécuté au démarrage en développement.
 *
 * TypeScript attrape déjà les ids inconnus. Ce qu'il n'attrape pas, ce sont les
 * incohérences entre tables : une recette dont le bâtiment n'existe plus, une
 * quantité nulle, un libellé dupliqué, une planche de sprites dont le
 * placeholder n'a pas la taille annoncée. Tout ça se voit ici, au chargement,
 * plutôt qu'en jeu trois semaines plus tard.
 *
 * Plus tard s'ajouteront les cycles dans l'arbre techno et les déblocages en
 * double, quand `technologies.ts` existera.
 */

import { ART_PIXELS_PER_TILE, PALETTE } from './artDirection.ts';
import { BUILDINGS } from './buildings.ts';
import { ENEMIES, WAVES } from './enemies.ts';
import { ICON_SIZE, ITEM_ICONS } from './icons.ts';
import { ITEMS } from './items.ts';
import { PIXEL_MAPS } from './pixelmaps.ts';
import { RECIPES } from './recipes.ts';
import { RESOURCES } from './resources.ts';
import { SPRITES, type AnimationProto } from './sprites.ts';
import { WEAPONS } from './weapons.ts';

export function validatePrototypes(): string[] {
  const errors: string[] = [];

  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.stack <= 0) {
      errors.push(`ITEMS.${id} : stack doit être strictement positif`);
    }

    // TypeScript garantit qu'une icône existe ; on vérifie ici qu'elle a la bonne taille et sa palette.
    const icon = ITEM_ICONS[id as keyof typeof ITEM_ICONS];

    if (icon.rows.length !== ICON_SIZE) {
      errors.push(`ITEM_ICONS.${id} : ${icon.rows.length} lignes au lieu de ${ICON_SIZE}`);
    }
    for (const [y, row] of icon.rows.entries()) {
      if (row.length !== ICON_SIZE) {
        errors.push(`ITEM_ICONS.${id} ligne ${y} : ${row.length} pixels au lieu de ${ICON_SIZE}`);
      }
      for (const char of row) {
        if (char === '.') continue;

        const key = icon.palette[char];

        if (key === undefined || !(key in PALETTE)) {
          errors.push(`ITEM_ICONS.${id} : caractère « ${char} » hors palette`);
          break;
        }
      }
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
    if (building.hp <= 0) {
      errors.push(`BUILDINGS.${id} : points de vie nuls`);
    }
    if (building.workers < 0 || !Number.isInteger(building.workers)) {
      errors.push(`BUILDINGS.${id} : nombre d'ouvriers invalide`);
    }
    if (building.weapon !== null && !(building.weapon in WEAPONS)) {
      errors.push(`BUILDINGS.${id} : arme inconnue « ${String(building.weapon)} »`);
    }
    if (building.kind === 'tower' && building.weapon === null) {
      errors.push(`BUILDINGS.${id} : une tour sans arme ne sert à rien`);
    }
    if (!(building.sprite in SPRITES)) {
      errors.push(`BUILDINGS.${id} : planche inconnue « ${building.sprite} »`);
    } else {
      const sprite = SPRITES[building.sprite];
      const expectedW = building.width * ART_PIXELS_PER_TILE;
      const expectedH = building.height * ART_PIXELS_PER_TILE;

      if (sprite.frameWidth !== expectedW || sprite.frameHeight !== expectedH) {
        errors.push(
          `BUILDINGS.${id} : la planche « ${building.sprite} » fait ` +
            `${sprite.frameWidth}×${sprite.frameHeight}, l'emprise demande ${expectedW}×${expectedH}`,
        );
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
    if ((building.kind === 'drill' || building.kind === 'farm') && !buildingsWithRecipe.has(id)) {
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
    if (!(resource.sprite in SPRITES)) {
      errors.push(`RESOURCES.${id} : planche inconnue « ${resource.sprite} »`);
    } else if (!('full' in SPRITES[resource.sprite].animations)) {
      errors.push(`RESOURCES.${id} : la planche « ${resource.sprite} » n'a pas d'animation « full »`);
    }
  }

  for (const [id, enemy] of Object.entries(ENEMIES)) {
    if (enemy.hp <= 0 || enemy.speed <= 0 || enemy.damage <= 0 || enemy.attackTicks <= 0) {
      errors.push(`ENEMIES.${id} : points de vie, vitesse, dégâts ou cadence nuls`);
    }
    if (enemy.halfW <= 0 || enemy.halfH <= 0 || enemy.halfW * 2 > ART_PIXELS_PER_TILE * 2) {
      errors.push(`ENEMIES.${id} : boîte de collision invalide`);
    }
    if (!(enemy.sprite in SPRITES)) {
      errors.push(`ENEMIES.${id} : planche inconnue « ${enemy.sprite} »`);
    } else {
      for (const name of ['idleDown', 'walkDown', 'idleUp', 'walkUp', 'idleSide', 'walkSide']) {
        if (!(name in SPRITES[enemy.sprite].animations)) {
          errors.push(`ENEMIES.${id} : la planche « ${enemy.sprite} » n'a pas d'animation « ${name} »`);
        }
      }
    }
  }

  for (const [id, weapon] of Object.entries(WEAPONS)) {
    if (weapon.range <= 0 || weapon.cooldown <= 0 || weapon.damage <= 0 || weapon.arrowSpeed <= 0) {
      errors.push(`WEAPONS.${id} : portée, cadence, dégâts ou vitesse nuls`);
    }
  }

  if (WAVES.minDistance > WAVES.maxDistance || WAVES.firstDelay <= 0 || WAVES.interval <= 0) {
    errors.push('WAVES : distances ou délais incohérents');
  }

  for (const [id, sprite] of Object.entries(SPRITES)) {
    const map = PIXEL_MAPS[id as keyof typeof PIXEL_MAPS];

    const animations = sprite.animations as Record<string, AnimationProto>;

    for (const [name, animation] of Object.entries(animations)) {
      if (animation.frames <= 0 || animation.fps <= 0) {
        errors.push(`SPRITES.${id}.${name} : frames ou fps nul`);
      }

      const frames = map.animations[name];

      if (!frames) {
        errors.push(`PIXEL_MAPS.${id} : animation « ${name} » manquante`);
        continue;
      }
      if (frames.length !== animation.frames) {
        errors.push(
          `PIXEL_MAPS.${id}.${name} : ${frames.length} image(s), la planche en annonce ${animation.frames}`,
        );
      }
      for (const [index, rows] of frames.entries()) {
        if (rows.length !== sprite.frameHeight) {
          errors.push(`PIXEL_MAPS.${id}.${name}[${index}] : ${rows.length} lignes au lieu de ${sprite.frameHeight}`);
        }
        for (const [y, row] of rows.entries()) {
          if (row.length !== sprite.frameWidth) {
            errors.push(
              `PIXEL_MAPS.${id}.${name}[${index}] ligne ${y} : ${row.length} pixels au lieu de ${sprite.frameWidth}`,
            );
          }
          for (const char of row) {
            if (char === '.') continue;

            const key = map.palette[char];

            if (key === undefined) {
              errors.push(`PIXEL_MAPS.${id}.${name}[${index}] : caractère « ${char} » hors palette`);
              break;
            }
            if (!(key in PALETTE)) {
              errors.push(`PIXEL_MAPS.${id} : couleur « ${key} » inconnue de la direction artistique`);
              break;
            }
          }
        }
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

/** Lance la validation et hurle en console. Appelé depuis `main.ts` en dev seulement. */
export function assertPrototypes(): void {
  const errors = validatePrototypes();

  if (errors.length > 0) {
    throw new Error(`Prototypes invalides :\n- ${errors.join('\n- ')}`);
  }
}
