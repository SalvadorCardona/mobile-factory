import { describe, expect, it } from 'vitest';
import { TILE_SIZE, worldToTile } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { DAY_CYCLE } from '../data/dayNight.ts';
import type { ItemId } from '../data/items.ts';
import { OBJECTIVES } from '../data/objectives.ts';
import { QUEST_IDS } from '../data/quests.ts';
import { RECIPES } from '../data/recipes.ts';
import { validatePrototypes } from '../data/validate.ts';
import { BUILD_REACH_TILES, INVENTORY_CAPACITY } from './player.ts';
import { SAVE_VERSION, decodeSave, encodeSave, serialize } from './save.ts';
import { currentObjective, goalProgress } from './objectives.ts';
import { oreAt } from './terrain.ts';
import type { Entity, EntityId } from './types.ts';
import { World } from './world.ts';

/** Place Adam sur une tuile libre collée à l'emprise, et renvoie l'axe qui pousse vers elle. */
function standNextTo(world: World, tx: number, ty: number, width: number, height: number): { x: number; y: number } {
  const candidates: [number, number, number, number][] = [];

  for (let x = tx; x < tx + width; x += 1) {
    candidates.push([x, ty + height, 0, -1], [x, ty - 1, 0, 1]);
  }
  for (let y = ty; y < ty + height; y += 1) {
    candidates.push([tx + width, y, -1, 0], [tx - 1, y, 1, 0]);
  }

  for (const [x, y, axisX, axisY] of candidates) {
    if (world.isSolid(x, y)) continue;

    world.player.x = (x + 0.5) * TILE_SIZE;
    world.player.y = (y + 0.5) * TILE_SIZE;
    return { x: axisX, y: axisY };
  }
  throw new Error('emprise cernée');
}

/** Remplit le sac avec le coût et pousse contre le chantier : le dernier objet livré l'achève. */
function completeSite(world: World, id: EntityId): Entity {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount);
  }

  world.push({ type: 'setMoveAxis', ...standNextTo(world, site.tx, site.ty, site.width, site.height) });

  for (let i = 0; i < 400; i += 1) {
    world.tick();

    const current = world.entities.get(id);

    if (current?.kind !== 'site') break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  world.tick();

  const built = world.entities.get(id);

  if (!built || built.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
  return built;
}

/** Pose un chantier en (tx, ty) et l'achève. */
function buildAt(world: World, building: BuildingId, tx: number, ty: number): Entity {
  const before = new Set(world.entities.keys());

  world.push({ type: 'placeBuilding', building, tx, ty });
  world.tick();

  const id = [...world.entities.keys()].find((key) => !before.has(key));

  if (id === undefined) throw new Error(`${building} n’a pas été posé`);
  return completeSite(world, id);
}

/** Une case gardée pour plus tard : aucun autre bâtiment 2 × 2 ne doit la chevaucher. */
type Reserved = { tx: number; ty: number } | null;

function overlaps(tx: number, ty: number, reserved: Reserved): boolean {
  return reserved !== null && Math.abs(tx - reserved.tx) < 2 && Math.abs(ty - reserved.ty) < 2;
}

/** La première case posable autour d'Adam, éventuellement sur un filon de fer. */
function spot(world: World, building: BuildingId, iron = false, reserved: Reserved = null): { tx: number; ty: number } | null {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (iron && oreAt(world.seed, tx, ty)?.item !== 'ironOre') continue;
      if (overlaps(tx, ty, reserved)) continue;
      if (world.canPlace(building, tx, ty) === null) return { tx, ty };
    }
  }
  return null;
}

function build(world: World, building: BuildingId, reserved: Reserved = null): Entity {
  const found = spot(world, building, false, reserved);

  if (!found) throw new Error(`aucune case posable pour ${building}`);
  return buildAt(world, building, found.tx, found.ty);
}

/** Une tour de guet sur chaque côté de la mairie, au plus près de `gap` tuiles d'elle. */
function fortify(world: World, reserved: Reserved, gap = 2): void {
  const hall = world.entities.get(world.townHallId)!;
  const cx = hall.tx + 1;
  const cy = hall.ty + 1;
  const sides = [
    [cx - gap - 2, cy],
    [cx + gap + 2, cy],
    [cx, cy - gap - 2],
    [cx, cy + gap + 2],
  ] as const;

  for (const [x, y] of sides) {
    guardTownHall(world);

    let placed = false;

    for (let radius = 0; radius < 4 && !placed; radius += 1) {
      for (let dy = -radius; dy <= radius && !placed; dy += 1) {
        for (let dx = -radius; dx <= radius && !placed; dx += 1) {
          if (overlaps(x + dx, y + dy, reserved) || world.canPlace('watchtower', x + dx, y + dy) !== null) continue;
          buildAt(world, 'watchtower', x + dx, y + dy);
          placed = true;
        }
      }
    }
  }
  guardTownHall(world);
}

/** Adam revient au pied de la mairie, où son arc la défend. */
function guardTownHall(world: World): void {
  const hall = world.entities.get(world.townHallId)!;

  standNextTo(world, hall.tx, hall.ty, hall.width, hall.height);
}

/** Avance jusqu'à ce que `done` soit vrai, en `limit` ticks au plus. */
function runUntil(world: World, done: () => boolean, limit: number): void {
  for (let i = 0; i < limit && !done(); i += 1) world.tick();
  if (!done()) throw new Error(`rien au bout de ${limit} ticks (objectif ${world.objective}, mairie tombée : ${world.defeated})`);
}

/** Une seed qui offre, à portée du point d'apparition, un filon de fer où poser une foreuse. */
function seedWithIron(): number {
  for (let seed = 1; seed < 800; seed += 1) {
    if (spot(new World(seed), 'drill', true)) return seed;
  }
  throw new Error('aucune seed testable — la génération de filons a changé');
}

/** Un jour, son crépuscule, sa nuit et son aube. */
const CYCLE = DAY_CYCLE.day + DAY_CYCLE.dusk + DAY_CYCLE.night + DAY_CYCLE.dawn;

describe('objectifs', () => {
  it('sont une donnée valide', () => {
    expect(validatePrototypes().filter((error) => error.startsWith('OBJECTIVES'))).toEqual([]);
  });

  it('commencent sur le chantier de la mairie', () => {
    const world = new World(7);

    expect(world.objective).toBe(0);
    expect(currentObjective(world)?.title).toBe(OBJECTIVES[0].title);
    expect(goalProgress(world, OBJECTIVES[0].goals[0])).toEqual({ have: 0, need: 1 });
  });

  /*
   * Une partie scriptée, de la mairie à la victoire : seed + commandes. Adam
   * ne triche que pour le sac — il reçoit le coût de chaque chantier et la
   * nourriture de l'enfant au lieu d'aller les chercher — et pour se poster
   * au pied de la mairie. Une dizaine de nuits simulées tick par tick :
   * plusieurs secondes, au-delà du délai par défaut.
   */
  it('s’enchaînent d’une partie scriptée jusqu’à la victoire', () => {
    const world = new World(seedWithIron());
    const completed: number[] = [];
    let victories = 0;

    world.events.on('objectiveCompleted', ({ index }) => completed.push(index));
    world.events.on('victory', () => (victories += 1));

    // Là où Adam s'éveille, un filon de fer est à portée : la case est gardée pour la foreuse.
    const iron = spot(world, 'drill', true);

    // 1. La mairie : elle devient la ville.
    completeSite(world, world.townHallId);
    expect(completed).toEqual([0]);
    expect(world.objective).toBe(1);
    expect(world.townStock()).not.toBeNull();

    // Des tours tout de suite, comme le conseil le dit : elles compteront pour la quête d'Ève.
    fortify(world, iron);
    fortify(world, iron, 6);

    // La nurserie aussi, nourrie : l'enfant naîtra bien avant qu'on le demande, et comptera.
    const nursery = build(world, 'nursery', iron);

    world.player.inventory.add('food', RECIPES.raiseChild.inputs.food);
    world.push({ type: 'supplyBuilding', id: nursery.id });
    world.tick();
    guardTownHall(world);

    // 2. Trois nuits survécues : Ève arrive, le sac grandit.
    runUntil(world, () => world.objective === 2, CYCLE * 4);
    expect(world.stats.nightsSurvived).toBeGreaterThanOrEqual(3);
    expect(world.player.inventory.capacity).toBe(INVENTORY_CAPACITY + 20);
    runUntil(world, () => world.eve()?.state === 'idle' || world.eve()?.state === 'repair', 20 * 60);
    expect(world.population().adults).toBe(2);

    // 3. Les demandes d'Ève : la ferme donne le plan de la maison, les tours sont déjà là.
    const hall = world.entities.get(world.townHallId)!;

    if (hall.kind === 'site') throw new Error('la mairie est redevenue un chantier');
    build(world, 'farm', iron);
    runUntil(world, () => world.questsDone >= 2, 20 * 5);
    expect(world.isUnlocked('builderHouse')).toBe(true);
    build(world, 'builderHouse', iron);
    guardTownHall(world);
    hall.hp -= 30;
    runUntil(world, () => world.objective === 3, 20 * 5);
    expect(world.questsDone).toBe(QUEST_IDS.length);
    expect(hall.hp).toBe(BUILDINGS.townHall.hp);

    // 4. Une foreuse sur le fer, et vingt minerais sortis.
    if (!iron) throw new Error('pas de filon de fer à portée');
    standNextTo(world, iron.tx, iron.ty, 2, 2);
    buildAt(world, 'drill', iron.tx, iron.ty);
    guardTownHall(world);
    runUntil(world, () => world.objective >= 4, RECIPES.mineOre.duration * 25 + 10);
    expect(world.stats.produced.ironOre).toBeGreaterThanOrEqual(20);

    // 5. Le premier enfant : la nurserie posée au début a fait son œuvre — l'objectif tombe dans la foulée.
    runUntil(world, () => world.objective >= 5, RECIPES.raiseChild.duration + 10);
    expect(world.stats.births).toBeGreaterThanOrEqual(1);
    expect(victories).toBe(0);

    // 6. Cinq nuits de plus, comptées depuis le début de l'objectif.
    const survived = world.stats.nightsSurvived;

    runUntil(world, () => world.victory, CYCLE * 6);
    expect(world.stats.nightsSurvived - survived).toBe(5);
    expect(completed).toEqual([0, 1, 2, 3, 4, 5]);
    expect(victories).toBe(1);
    expect(world.objective).toBe(OBJECTIVES.length);
    expect(currentObjective(world)).toBeNull();
    expect(world.defeated).toBe(false);

    // Le mode infini : les nuits continuent, la victoire ne se refête pas.
    const night = world.night;

    for (let i = 0; i < CYCLE + 1; i += 1) world.tick();
    expect(world.night).toBeGreaterThan(night);
    expect(victories).toBe(1);
  }, 30_000);

  it('comptent ce qui a été fait avant qu’on le demande', () => {
    const world = new World(seedWithIron());
    const completed: number[] = [];

    world.events.on('objectiveCompleted', ({ index }) => completed.push(index));

    completeSite(world, world.townHallId);

    // Une foreuse bâtie et du fer extrait bien avant qu'on les demande : l'objectif 4 les trouvera.
    const iron = spot(world, 'drill', true);

    if (!iron) throw new Error('pas de filon de fer à portée');
    buildAt(world, 'drill', iron.tx, iron.ty);
    world.stats.produced.ironOre = 20;
    expect(world.objective).toBe(1);

    world.stats.nightsSurvived = 3;
    world.questsDone = QUEST_IDS.length;
    world.tick();
    expect(completed).toEqual([0, 1, 2, 3]);
  });

  it('comptent les nuits à tenir depuis le début de l’objectif', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    world.stats.nightsSurvived = 2;
    world.objectiveBase = { ...world.stats };
    world.tick();
    expect(world.objective).toBe(1);
    expect(goalProgress(world, OBJECTIVES[1].goals[0])).toEqual({ have: 0, need: 3 });

    world.stats.nightsSurvived = 4;
    expect(goalProgress(world, OBJECTIVES[1].goals[0])).toEqual({ have: 2, need: 3 });
  });

  it('dépose dans la mairie ce qui ne tient pas dans le sac', () => {
    const world = new World(seedWithIron());
    let stored: Partial<Record<ItemId, number>> = {};

    world.events.on('objectiveCompleted', (event) => (stored = event.stored));
    completeSite(world, world.townHallId);

    const iron = spot(world, 'drill', true);

    if (!iron) throw new Error('pas de filon de fer à portée');
    buildAt(world, 'drill', iron.tx, iron.ty);

    // Le sac est presque plein quand la foreuse remplit son objectif : rien de la récompense ne doit se perdre.
    const town = world.townStock()!;
    const before = { wood: town.count('wood'), stone: town.count('stone') };

    world.player.inventory.add('coal', world.player.inventory.freeSpace() - 5);
    world.objective = 3;
    world.stats.produced.ironOre = 20;
    world.tick();

    expect(world.objective).toBe(4);
    expect(world.player.inventory.freeSpace()).toBe(0);
    expect(world.player.inventory.count('wood')).toBe(5);
    expect(stored).toEqual({ wood: 9, stone: 6 });
    expect(town.count('wood') - before.wood).toBe(9);
    expect(town.count('stone') - before.stone).toBe(6);
  });

  it('s’arrêtent avec la défaite', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    world.defeated = true;
    world.stats.nightsSurvived = 3;
    world.tick();
    expect(world.objective).toBe(1);
  });

  it('survivent à la sauvegarde : objectif, compteurs et taille du sac', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    world.stats.nightsSurvived = 3;
    world.tick();
    expect(world.objective).toBe(2);

    const decoded = decodeSave(encodeSave(world, 1));

    if (!decoded.ok) throw new Error(`sauvegarde refusée : ${decoded.reason}`);
    expect(decoded.world.objective).toBe(2);
    expect(decoded.world.player.inventory.capacity).toBe(INVENTORY_CAPACITY + 20);
    expect(serialize(decoded.world)).toEqual(serialize(world));
  });

  it('reprennent une sauvegarde d’avant les objectifs au premier', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);

    // Ce qu'une sauvegarde d'avant les objectifs ne connaissait pas.
    const old: Record<string, unknown> = { ...serialize(world) };

    for (const key of ['objective', 'victory', 'victoryTick', 'stats', 'objectiveBase']) delete old[key];

    const decoded = decodeSave(JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: old }));

    if (!decoded.ok) throw new Error(`sauvegarde refusée : ${decoded.reason}`);
    expect(decoded.world.objective).toBe(0);

    // La mairie est debout : le premier objectif tombe au tick suivant, récompense comprise.
    decoded.world.tick();
    expect(decoded.world.objective).toBe(1);
  });
});
