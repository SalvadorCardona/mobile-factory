import { describe, expect, it } from 'vitest';
import { TILE_SIZE, tileToChunk, worldToTile } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';
import type { PlacementRejection } from './commands.ts';
import { BUILD_REACH_TILES, INVENTORY_CAPACITY, PLAYER_SPEED_TILES } from './player.ts';
import { oreAt, terrainAt } from './terrain.ts';
import type { Entity, EntityId } from './types.ts';
import { HARVEST_MAX_NODES, HARVEST_PASS_TICKS, TICKS_PER_SECOND, World, siteMissing } from './world.ts';

const DRILL = BUILDINGS.drill;
const CYCLE = RECIPES.mineOre.duration;

/** Tuile à portée du joueur portant un gisement et posable, ou `null`. */
function drillSpot(world: World): { tx: number; ty: number } | null {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (!oreAt(world.seed, tx, ty)) continue;
      if (world.canPlace('drill', tx, ty) !== null) continue;

      return { tx, ty };
    }
  }
  return null;
}

/** Première seed offrant un gisement constructible à portée du point d'apparition. */
function worldWithOre(): { world: World; spot: { tx: number; ty: number } } {
  for (let seed = 1; seed < 600; seed += 1) {
    const world = new World(seed);
    const spot = drillSpot(world);

    if (spot) return { world, spot };
  }
  throw new Error('aucune seed testable — la génération de gisements a changé');
}

/**
 * Retire les rochers et arbres autour de l'emplacement : sinon la récolte de
 * proximité remplit le sac pendant qu'Adam livre un chantier ou vide la foreuse.
 */
function clearAround(world: World, spot: { tx: number; ty: number }): void {
  for (let ty = spot.ty - 6; ty <= spot.ty + 6; ty += 1) {
    for (let tx = spot.tx - 6; tx <= spot.tx + 6; tx += 1) world.resources.clear(tx, ty);
  }
}

/** Première seed dont le point d'apparition peut avancer vers l'est sans butée. */
function seedWithFreeMoveEast(): number {
  for (let seed = 1; seed < 400; seed += 1) {
    const world = new World(seed);
    const startX = world.player.x;

    world.push({ type: 'setMoveAxis', x: 1, y: 0 });
    world.tick();

    if (world.player.x > startX) return seed;
  }
  throw new Error('aucune seed testable — la génération de terrain a changé');
}

/**
 * Place Adam sur une tuile libre collée à l'emprise, et renvoie l'axe qui
 * pousse vers elle. `null` si l'emprise est cernée.
 */
function standNextTo(
  world: World,
  tx: number,
  ty: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
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
  return null;
}

/** Remplit le sac avec le coût, va au contact du chantier, et pousse jusqu'à l'achèvement. */
function completeSite(world: World, id: EntityId): Entity {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);

  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) {
    world.player.inventory.add(item, amount);
  }

  const axis = standNextTo(world, site.tx, site.ty, site.width, site.height);

  if (!axis) throw new Error('chantier inaccessible');

  world.push({ type: 'setMoveAxis', ...axis });

  for (let i = 0; i < 400; i += 1) {
    world.tick();

    const current = world.entities.get(id);

    if (current?.kind !== 'site') break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  // Un tick de plus, comme avant : les cadences des tests se comptent depuis là.
  world.tick();

  const built = world.entities.get(id);

  if (!built || built.kind === 'site') throw new Error('le chantier ne s’est pas achevé');
  return built;
}

/** Pose une foreuse et l'achève. Renvoie l'entité. */
function buildDrill(world: World, spot: { tx: number; ty: number }): Entity {
  const before = new Set(world.entities.keys());

  world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
  world.tick();

  const id = [...world.entities.keys()].find((key) => !before.has(key));

  if (id === undefined) throw new Error('la foreuse n’a pas été posée');
  return completeSite(world, id);
}

/** Une ressource de surface accessible par une tuile libre, et l'axe pour la heurter. */
function harvestable(world: World): { tx: number; ty: number; axis: { x: number; y: number } } | null {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -12; dy <= 12; dy += 1) {
    for (let dx = -12; dx <= 12; dx += 1) {
      const tx = origin.tx + dx;
      const ty = origin.ty + dy;

      if (!world.resources.at(tx, ty)) continue;

      const axis = standNextTo(world, tx, ty, 1, 1);

      if (axis) return { tx, ty, axis };
    }
  }
  return null;
}

function worldWithHarvestable(): { world: World; tx: number; ty: number; axis: { x: number; y: number } } {
  for (let seed = 1; seed < 200; seed += 1) {
    const world = new World(seed);
    const found = harvestable(world);

    if (found) return { world, ...found };
  }
  throw new Error('aucune ressource accessible — la génération a changé');
}

describe('World', () => {
  it('fait apparaître le joueur sur une tuile praticable', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const world = new World(seed);
      const { tx, ty } = worldToTile(world.player.x, world.player.y);

      expect(terrainAt(seed, tx, ty)).not.toBe('water');
      expect(world.isSolid(tx, ty)).toBe(false);
    }
  });

  /*
   * Le pitch : la partie commence sur le chantier de la mairie. Adam est à
   * côté, pas dedans, et rien ne l'empêche d'aller le heurter.
   */
  it('ouvre le chantier de la mairie au démarrage, à portée d’Adam', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const world = new World(seed);
      const hall = world.entities.get(world.townHallId);

      expect(hall?.kind).toBe('site');
      expect(hall?.proto).toBe('townHall');
      expect(world.canPlace('townHall', hall!.tx, hall!.ty)).toBe('occupied');

      const centerX = (hall!.tx + hall!.width / 2) * TILE_SIZE;
      const centerY = (hall!.ty + hall!.height / 2) * TILE_SIZE;

      expect(Math.hypot(world.player.x - centerX, world.player.y - centerY)).toBeLessThan(
        BUILD_REACH_TILES * TILE_SIZE,
      );
      expect(standNextTo(world, hall!.tx, hall!.ty, hall!.width, hall!.height)).not.toBeNull();
    }
  });

  /*
   * Le contrat des commandes : pousser n'applique rien. Sans ça, l'UI
   * modifierait l'état hors tick et la rejouabilité seed + journal tomberait.
   */
  it('n’applique une commande qu’au tick suivant', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    expect(world.entities.size).toBe(1);

    world.tick();
    expect(world.entities.size).toBe(2);
  });

  it('journalise les commandes avec leur tick', () => {
    const world = new World(42);

    world.push({ type: 'setMoveAxis', x: 1, y: 0 });
    world.tick();

    expect(world.commandLog()).toEqual([
      { tick: 1, command: { type: 'setMoveAxis', x: 1, y: 0 } },
    ]);
  });

  it('déplace le joueur selon l’axe analogique, pas seulement selon sa direction', () => {
    // Une seed où l'est du point d'apparition n'est pas bloqué.
    const seed = seedWithFreeMoveEast();
    const full = new World(seed);
    const half = new World(seed);
    const startX = full.player.x;

    full.push({ type: 'setMoveAxis', x: 1, y: 0 });
    half.push({ type: 'setMoveAxis', x: 0.5, y: 0 });
    full.tick();
    half.tick();

    // À mi-course, on avance de moitié. Si la sortie du joystick était
    // seulement directionnelle, les deux distances seraient égales.
    expect(half.player.x - startX).toBeCloseTo((full.player.x - startX) / 2, 8);
    expect(full.player.prevX).toBe(startX);
    expect(full.player.facing).toBe('right');
    expect(full.player.moving).toBe(true);
  });

  it('refuse de construire hors de portée, sur une case occupée, ou sur Adam', () => {
    const { world, spot } = worldWithOre();
    const rejections: PlacementRejection[] = [];

    world.events.on('placementRejected', ({ reason }) => rejections.push(reason));

    const origin = worldToTile(world.player.x, world.player.y);

    world.push({
      type: 'placeBuilding',
      building: 'drill',
      tx: origin.tx + BUILD_REACH_TILES * 4,
      ty: origin.ty,
    });
    world.tick();
    expect(world.entities.size).toBe(1);

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();
    expect(world.entities.size).toBe(2);

    // La même case, une seconde fois.
    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();
    expect(world.entities.size).toBe(2);

    expect(rejections).toContain('occupied');
    expect(rejections.length).toBe(2);

    // Sous les pieds d'Adam : il resterait emmuré.
    expect(world.canPlace('drill', origin.tx, origin.ty)).toBe('onPlayer');
  });

  it('refuse de construire sur un arbre ou un rocher encore debout', () => {
    const { world, tx, ty } = worldWithHarvestable();

    expect(world.canPlace('drill', tx, ty)).toBe('resource');
  });

  it('désigne les cases qui bloquent, pas toute l’emprise', () => {
    const { world, tx, ty } = worldWithHarvestable();
    const block = world.placementBlock('drill', tx, ty);
    const solid: { tx: number; ty: number }[] = [];

    for (let y = ty; y < ty + DRILL.height; y += 1) {
      for (let x = tx; x < tx + DRILL.width; x += 1) {
        if (world.resources.isSolid(x, y)) solid.push({ tx: x, ty: y });
      }
    }

    expect(block?.reason).toBe('resource');
    expect(block?.tiles).toEqual(solid);
    expect(block?.tiles).toContainEqual({ tx, ty });
  });

  it('sous Adam : seules les cases qu’il touche', () => {
    const { world } = worldWithOre();
    const origin = worldToTile(world.player.x, world.player.y);
    const block = world.placementBlock('drill', origin.tx, origin.ty);

    expect(block?.reason).toBe('onPlayer');
    expect(block?.tiles).toContainEqual(origin);
    expect(block!.tiles.length).toBeLessThan(DRILL.width * DRILL.height);
  });

  it('trop loin : toute l’emprise est fautive', () => {
    const world = new World(1);
    const origin = worldToTile(world.player.x, world.player.y);

    for (let d = BUILD_REACH_TILES + 2; d < BUILD_REACH_TILES + 40; d += 1) {
      const block = world.placementBlock('drill', origin.tx + d, origin.ty);

      if (block?.reason !== 'outOfReach') continue;
      expect(block.tiles).toHaveLength(DRILL.width * DRILL.height);
      return;
    }
    throw new Error('aucune case libre hors de portée');
  });

  it('marque le chunk sale au placement, pour que le rendu rebake', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const { cx, cy } = tileToChunk(spot.tx, spot.ty);

    expect(world.chunks.peek(cx, cy)?.dirty).toBe(true);
  });

  it('ouvre un chantier, que le contact d’Adam remplit avec son sac', () => {
    const { world, spot } = worldWithOre();

    clearAround(world, spot);
    const delivered: ItemId[] = [];
    const completed: EntityId[] = [];

    world.events.on('siteDelivered', ({ item }) => delivered.push(item));
    world.events.on('buildingCompleted', ({ id }) => completed.push(id));

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const site = world.entities.get(2);

    expect(site?.kind).toBe('site');
    expect(siteMissing(site as Extract<Entity, { kind: 'site' }>)).toBe(
      Object.values(DRILL.cost).reduce((sum, amount) => sum + amount, 0),
    );

    const drill = completeSite(world, 2);

    expect(drill.kind).toBe('drill');
    expect(completed).toEqual([2]);
    expect(delivered.length).toBe(DRILL.cost.stone + DRILL.cost.ironOre);
    expect(world.player.inventory.total()).toBe(0);
  });

  it('transfère le sac d’un coup dans le chantier, qui s’achève au dernier objet', () => {
    const world = new World(7);
    const completed: EntityId[] = [];
    const rejected: string[] = [];

    world.events.on('buildingCompleted', ({ id }) => completed.push(id));
    world.events.on('siteRejected', ({ reason }) => rejected.push(reason));

    // Un sac à moitié rempli : tout passe, le chantier reste un chantier.
    world.player.inventory.add('wood', 5);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();

    const site = world.entities.get(world.townHallId);

    expect(site?.kind).toBe('site');
    expect(site?.kind === 'site' && site.delivered.wood).toBe(5);
    expect(world.player.inventory.total()).toBe(0);
    expect(completed).toEqual([]);

    // Rien à donner : refusé, sans rien casser.
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();
    expect(rejected).toEqual(['nothingToGive']);

    // Le reste, plus du surplus qui doit rester dans le sac : la mairie est bâtie sans autre commande.
    world.player.inventory.add('wood', 20);
    world.player.inventory.add('stone', 12);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();
    expect(world.player.inventory.count('wood')).toBe(5);
    expect(completed).toEqual([world.townHallId]);
    expect(world.entities.get(world.townHallId)?.kind).toBe('townHall');
  });

  it('achève au chargement un chantier livré d’une ancienne sauvegarde', () => {
    const world = new World(7);
    const hall = world.entities.get(world.townHallId);

    if (hall?.kind !== 'site') throw new Error('la partie ne commence plus sur le chantier de la mairie');
    hall.delivered = { ...BUILDINGS[hall.proto].cost };

    const restored = World.restore(world.snapshot());

    expect(restored.entities.get(restored.townHallId)?.kind).toBe('townHall');
  });

  it('compte les ouvriers des bâtiments finis dans la population', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    expect(world.population().workers).toBe(0);

    const spot = { tx: Math.floor(world.player.x / TILE_SIZE) + 2, ty: Math.floor(world.player.y / TILE_SIZE) + 2 };

    for (let y = spot.ty - 1; y < spot.ty + 3; y += 1) {
      for (let x = spot.tx - 1; x < spot.tx + 3; x += 1) world.resources.clear(x, y);
    }
    world.push({ type: 'placeBuilding', building: 'farm', tx: spot.tx, ty: spot.ty });
    world.tick();

    const id = Math.max(...world.entities.keys());

    // Un chantier n'emploie personne.
    expect(world.population().workers).toBe(0);
    completeSite(world, id);
    expect(world.population().workers).toBe(BUILDINGS.farm.workers);
  });

  it('achève la mairie quand Adam y a tout apporté', () => {
    const world = new World(7);
    const hall = completeSite(world, world.townHallId);

    expect(hall.kind).toBe('townHall');
    expect(hall.kind === 'townHall' && hall.store.capacity).toBe(Infinity);
    expect(world.entities.get(world.townHallId)).toBe(hall);
  });

  it('fait produire la foreuse dans son coffre interne, à la cadence de la recette', () => {
    const { world, spot } = worldWithOre();
    const drill = buildDrill(world, spot);

    if (drill.kind !== 'drill') throw new Error('pas une foreuse');

    expect(drill.output).not.toBeNull();
    expect(drill.store.total()).toBe(0);

    // Un cycle moins un tick : rien encore (le tick d'achèvement compte déjà).
    for (let i = 1; i < CYCLE - 1; i += 1) world.tick();
    expect(drill.store.total()).toBe(0);

    world.tick();
    expect(drill.store.total()).toBe(1);

    for (let i = 0; i < CYCLE; i += 1) world.tick();
    expect(drill.store.total()).toBe(2);
  });

  /*
   * Le cœur du scheduler par réveils : une machine bloquée ne coûte plus rien.
   * Si `pendingWakes()` ne retombe pas à zéro, c'est qu'elle continue à se
   * replanifier dans le vide — le piège numéro un du projet.
   */
  it('cesse de planifier une foreuse dont le coffre est plein', () => {
    const { world, spot } = worldWithOre();
    const drill = buildDrill(world, spot);
    let blocked = 0;

    if (drill.kind !== 'drill') throw new Error('pas une foreuse');

    world.events.on('drillBlocked', () => (blocked += 1));

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();

    expect(drill.store.total()).toBe(DRILL.storage);
    expect(drill.blocked).toBe(true);
    expect(blocked).toBe(1);
    expect(world.pendingWakes()).toBe(0);
  });

  it('réveille la foreuse quand on vide son coffre', () => {
    const { world, spot } = worldWithOre();
    const drill = buildDrill(world, spot);

    if (drill.kind !== 'drill') throw new Error('pas une foreuse');

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();

    const item = drill.output;

    expect(item).toBeTruthy();
    expect(world.pendingWakes()).toBe(0);

    expect(world.withdraw(drill.id, item!, 10)).toBe(10);
    expect(drill.blocked).toBe(false);
    expect(world.pendingWakes()).toBe(1);

    for (let i = 0; i < CYCLE; i += 1) world.tick();
    expect(drill.store.total()).toBe(DRILL.storage - 10 + 1);
  });

  it('vide une foreuse pleine qu’Adam heurte, dans la limite du sac, et la réveille', () => {
    const { world, spot } = worldWithOre();

    clearAround(world, spot);
    const drill = buildDrill(world, spot);
    const taken: number[] = [];
    let full = 0;

    if (drill.kind !== 'drill') throw new Error('pas une foreuse');

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();
    expect(drill.blocked).toBe(true);
    expect(world.pendingWakes()).toBe(0);

    // Trois places dans le sac, pas une de plus.
    world.player.inventory.add('wood', INVENTORY_CAPACITY - 3);
    world.events.on('storeTaken', ({ amount }) => taken.push(amount));
    world.events.on('inventoryFull', () => (full += 1));

    const axis = standNextTo(world, drill.tx, drill.ty, drill.width, drill.height);

    if (!axis) throw new Error('foreuse inaccessible');
    world.push({ type: 'setMoveAxis', ...axis });

    for (let i = 0; i < CYCLE && taken.length === 0; i += 1) world.tick();

    // Le premier objet pris réveille la foreuse : elle se replanifie.
    expect(taken).toEqual([1]);
    expect(drill.blocked).toBe(false);
    expect(world.pendingWakes()).toBe(1);

    for (let i = 0; i < 20; i += 1) world.tick();

    expect(taken).toEqual([1, 1, 1]);
    expect(world.player.inventory.total()).toBe(INVENTORY_CAPACITY);
    expect(world.player.inventory.count(drill.output!)).toBe(3);
    expect(full).toBeGreaterThan(0);
  });

  it('« Prendre » vide le coffre dans le sac, à portée et dans la limite de la place', () => {
    const { world, spot } = worldWithOre();

    clearAround(world, spot);
    const drill = buildDrill(world, spot);
    const rejected: string[] = [];

    if (drill.kind !== 'drill') throw new Error('pas une foreuse');

    world.events.on('takeRejected', ({ reason }) => rejected.push(reason));

    // Coffre vide : refusé.
    world.push({ type: 'takeFromBuilding', id: drill.id });
    world.tick();
    expect(rejected).toEqual(['empty']);

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();
    expect(drill.blocked).toBe(true);

    world.player.inventory.add('wood', INVENTORY_CAPACITY - 5);
    world.push({ type: 'takeFromBuilding', id: drill.id });
    world.tick();

    expect(world.player.inventory.count(drill.output!)).toBe(5);
    expect(drill.store.total()).toBe(DRILL.storage - 5);
    expect(drill.blocked).toBe(false);
    expect(world.pendingWakes()).toBe(1);

    // Sac plein : refusé, rien n'est jeté.
    world.push({ type: 'takeFromBuilding', id: drill.id });
    world.tick();
    expect(rejected).toEqual(['empty', 'bagFull']);
    expect(drill.store.total()).toBe(DRILL.storage - 5);

    // Trop loin : refusé.
    world.player.inventory.remove('wood', 10);
    world.player.x += (BUILD_REACH_TILES + 4) * TILE_SIZE;
    world.push({ type: 'takeFromBuilding', id: drill.id });
    world.tick();
    expect(rejected).toEqual(['empty', 'bagFull', 'outOfReach']);

    // Un chantier n'a rien à prendre.
    world.push({ type: 'takeFromBuilding', id: world.townHallId });
    world.tick();
    expect(rejected).toEqual(['empty', 'bagFull', 'outOfReach', 'missing']);
  });

  it('récupère la nourriture d’une ferme pleine, qui repart aussitôt', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const world = new World(seed);
      const origin = worldToTile(world.player.x, world.player.y);
      let spot: { tx: number; ty: number } | null = null;

      for (let dy = -3; dy <= 3 && !spot; dy += 1) {
        for (let dx = -3; dx <= 3 && !spot; dx += 1) {
          if (world.canPlace('farm', origin.tx + dx, origin.ty + dy) === null) spot = { tx: origin.tx + dx, ty: origin.ty + dy };
        }
      }
      if (!spot) continue;

      world.push({ type: 'placeBuilding', building: 'farm', tx: spot.tx, ty: spot.ty });
      world.tick();

      const farm = completeSite(world, Math.max(...world.entities.keys()));
      const { duration, outputs } = RECIPES.growFood;

      if (farm.kind !== 'farm') throw new Error('pas une ferme');

      for (let i = 0; i < duration * (BUILDINGS.farm.storage / outputs.food + 2); i += 1) world.tick();
      expect(farm.blocked).toBe(true);
      expect(world.pendingWakes()).toBe(0);

      world.push({ type: 'takeFromBuilding', id: farm.id });
      world.tick();

      expect(world.player.inventory.count('food')).toBe(BUILDINGS.farm.storage);
      expect(farm.store.isEmpty()).toBe(true);
      expect(farm.blocked).toBe(false);
      expect(world.pendingWakes()).toBe(1);

      for (let i = 0; i < duration; i += 1) world.tick();
      expect(farm.store.count('food')).toBe(outputs.food);
      return;
    }
    throw new Error('aucun emplacement de ferme trouvé');
  });

  it('ne retire rien d’un chantier', () => {
    const world = new World(3);

    expect(world.withdraw(world.townHallId, 'wood', 1)).toBe(0);
  });

  /*
   * Rejouabilité : même seed et même journal de commandes ⇒ même état final.
   * C'est ce que le pas fixe, le PRNG à seed et les commandes achètent
   * ensemble. On ne construit pas le lockstep déterministe ici, on vérifie
   * juste que la porte reste ouverte.
   */
  it('rejoue une partie à l’identique depuis la seed et le journal', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'setMoveAxis', x: 0.3, y: -0.7 });
    world.tick();
    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    for (let i = 0; i < 200; i += 1) world.tick();

    const log = world.commandLog().map((entry) => ({ ...entry }));
    const replay = new World(world.seed);

    for (let tick = 1; tick <= world.tickCount; tick += 1) {
      for (const entry of log) {
        if (entry.tick === tick) replay.push(entry.command);
      }
      replay.tick();
    }

    expect(replay.player.x).toBeCloseTo(world.player.x, 10);
    expect(replay.player.y).toBeCloseTo(world.player.y, 10);
    expect(replay.player.inventory.toJSON()).toEqual(world.player.inventory.toJSON());
    expect(replay.resources.toJSON()).toEqual(world.resources.toJSON());
    expect(replay.entities.size).toBe(world.entities.size);
  });

  it('pose une foreuse hors gisement sans jamais la planifier', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const world = new World(seed);
      const origin = worldToTile(world.player.x, world.player.y);

      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const tx = origin.tx + dx;
          const ty = origin.ty + dy;

          if (oreAt(seed, tx, ty)) continue;
          if (world.canPlace('drill', tx, ty) !== null) continue;

          const drill = buildDrill(world, { tx, ty });

          if (drill.kind !== 'drill') throw new Error('pas une foreuse');

          expect(drill.output).toBeNull();
          expect(drill.blocked).toBe(true);
          expect(world.pendingWakes()).toBe(0);
          return;
        }
      }
    }
    throw new Error('aucun emplacement sans gisement trouvé');
  });
});

describe('récolte de proximité', () => {
  it('récolte ce qui est à portée, un passage toutes les 10 ticks, sans foncer dedans', () => {
    const { world, tx, ty } = worldWithHarvestable();
    const proto = RESOURCES[world.resources.at(tx, ty)!.id];
    const harvested: ItemId[] = [];

    world.events.on('resourceHarvested', ({ item }) => harvested.push(item));

    for (let i = 1; i < HARVEST_PASS_TICKS; i += 1) world.tick();
    expect(harvested).toEqual([]);

    world.tick();
    expect(harvested).toContain(proto.item);
    expect(harvested.length).toBeLessThanOrEqual(HARVEST_MAX_NODES);
    expect(world.resources.at(tx, ty)?.remaining).toBe(proto.amount - 1);
    expect(world.player.harvesting).toBe(true);
  });

  it('fait disparaître la ressource vidée, qui devient franchissable', () => {
    const { world, tx, ty } = worldWithHarvestable();
    const proto = RESOURCES[world.resources.at(tx, ty)!.id];
    const { cx, cy } = tileToChunk(tx, ty);

    for (let i = 0; i < proto.amount * HARVEST_PASS_TICKS; i += 1) world.tick();

    expect(world.resources.at(tx, ty)).toBeNull();
    expect(world.isSolid(tx, ty)).toBe(false);
    expect(world.chunks.peek(cx, cy)?.dirty).toBe(true);
    expect(world.player.inventory.count(proto.item)).toBeGreaterThanOrEqual(proto.amount);
  });

  it('arrête de récolter quand le sac est plein', () => {
    const { world, tx, ty } = worldWithHarvestable();
    const before = world.resources.at(tx, ty)!.remaining;
    let full = 0;

    world.player.inventory.add('wood', INVENTORY_CAPACITY);
    world.events.on('inventoryFull', () => (full += 1));

    for (let i = 0; i < 60; i += 1) world.tick();

    expect(full).toBeGreaterThan(0);
    expect(world.resources.at(tx, ty)?.remaining).toBe(before);
  });
});

/** Une tuile libre dont les huit voisines sont des arbres, dans une forêt sans eau ni rocher alentour. */
function closedGrove(): { seed: number; tx: number; ty: number } {
  for (let seed = 1; seed < 100; seed += 1) {
    const world = new World(seed);

    for (let ty = -60; ty < 60; ty += 1) {
      for (let tx = -60; tx < 60; tx += 1) {
        if (world.resources.at(tx, ty) || !onlyTrees(world, tx, ty, 4)) continue;

        let ring = 0;

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (world.resources.at(tx + dx, ty + dy)?.id === 'tree') ring += 1;
          }
        }
        if (ring === 8) return { seed, tx, ty };
      }
    }
  }
  throw new Error('aucun bosquet fermé — la génération des forêts a changé');
}

/** Autour de la tuile, rien d'autre que de l'herbe, des arbres et du vide : ni eau, ni rocher, ni bâti. */
function onlyTrees(world: World, tx: number, ty: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = tx + dx;
      const y = ty + dy;

      if (terrainAt(world.seed, x, y) === 'water' || world.chunks.occupantAt(x, y) !== undefined) return false;
      if (world.resources.at(x, y) && world.resources.at(x, y)?.id !== 'tree') return false;
    }
  }
  return true;
}

/** Une rangée de 12 tuiles de forêt dense (au moins 60 % d'arbres sur trois rangées), sans autre obstacle. */
function denseForestRow(): { seed: number; tx: number; ty: number } {
  const length = 12;

  for (let seed = 1; seed < 100; seed += 1) {
    const world = new World(seed);

    for (let ty = -60; ty < 60; ty += 1) {
      for (let tx = -60; tx < 60; tx += 1) {
        let trees = 0;

        for (let dx = 0; dx < length; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            if (world.resources.at(tx + dx, ty + dy)) trees += 1;
          }
        }
        if (trees < length * 3 * 0.6) continue;
        if (!onlyTrees(world, tx + length / 2, ty, length / 2)) continue;
        return { seed, tx, ty };
      }
    }
  }
  throw new Error('aucune forêt dense — la génération des forêts a changé');
}

/** Ticks pour qu'Adam, poussé vers l'ouest depuis le bout est de la rangée, parcoure `tiles` tuiles. */
function crossWest(world: World, from: { tx: number; ty: number }, tiles: number): number {
  world.player.x = (from.tx + 11.5) * TILE_SIZE;
  world.player.y = (from.ty + 0.5) * TILE_SIZE;

  const goal = world.player.x - tiles * TILE_SIZE;
  let ticks = 0;

  world.push({ type: 'setMoveAxis', x: -1, y: 0 });
  while (world.player.x > goal && ticks < 1000) {
    world.tick();
    ticks += 1;
  }
  return ticks;
}

describe('forêt', () => {
  const plain = Math.ceil((10 * TICKS_PER_SECOND) / PLAYER_SPEED_TILES);

  it('n’enferme jamais Adam dans un bosquet fermé, sac plein', () => {
    const grove = closedGrove();

    for (const [x, y] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const world = new World(grove.seed);

      world.player.x = (grove.tx + 0.5) * TILE_SIZE;
      world.player.y = (grove.ty + 0.5) * TILE_SIZE;
      world.player.inventory.add('wood', INVENTORY_CAPACITY);
      world.push({ type: 'setMoveAxis', x, y });

      for (let i = 0; i < 2 * TICKS_PER_SECOND; i += 1) world.tick();

      const moved = (world.player.x - (grove.tx + 0.5) * TILE_SIZE) * x + (world.player.y - (grove.ty + 0.5) * TILE_SIZE) * y;

      // Sorti du bosquet, et bien au-delà : les arbres n'ont rien pris, rien n'a bloqué.
      expect(moved).toBeGreaterThan(3 * TILE_SIZE);
      expect(world.player.inventory.freeSpace()).toBe(0);
    }
  });

  it('se traverse au plus deux fois moins vite que la plaine', () => {
    const row = denseForestRow();

    // Sac plein : les arbres restent debout, c'est la forêt la plus dense possible.
    const full = new World(row.seed);

    full.player.inventory.add('wood', INVENTORY_CAPACITY);
    expect(crossWest(full, row, 10)).toBeLessThanOrEqual(2 * plain);

    // Sac vide : la récolte en chemin ne ralentit pas.
    expect(crossWest(new World(row.seed), row, 10)).toBeLessThanOrEqual(2 * plain);
  });

  it('récolte en marchant', () => {
    const row = denseForestRow();
    const world = new World(row.seed);
    let whileMoving = 0;

    world.events.on('resourceHarvested', () => {
      if (world.player.moving) whileMoving += 1;
    });
    crossWest(world, row, 10);

    expect(whileMoving).toBeGreaterThan(0);
    expect(world.player.inventory.count('wood')).toBeGreaterThan(0);
  });

  it('fait partir Adam d’une clairière qui ouvre sur le monde', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const world = new World(seed);
      const start = worldToTile(world.player.x, world.player.y);
      const seen = new Set([`${start.tx},${start.ty}`]);
      const queue = [start];

      // Les arbres ne comptent pas : Adam passe entre les troncs.
      const open = (tx: number, ty: number): boolean =>
        !world.isSolid(tx, ty) || world.resources.at(tx, ty)?.id === 'tree';

      for (let i = 0; i < queue.length && seen.size < 400; i += 1) {
        const { tx, ty } = queue[i]!;

        for (const [nx, ny] of [
          [tx + 1, ty],
          [tx - 1, ty],
          [tx, ty + 1],
          [tx, ty - 1],
        ] as const) {
          if (seen.has(`${nx},${ny}`) || !open(nx, ny)) continue;
          seen.add(`${nx},${ny}`);
          queue.push({ tx: nx, ty: ny });
        }
      }
      expect(seen.size).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('géométrie de placement', () => {
  it('couvre exactement l’emprise du prototype', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    for (let y = spot.ty; y < spot.ty + DRILL.height; y += 1) {
      for (let x = spot.tx; x < spot.tx + DRILL.width; x += 1) {
        expect(world.chunks.occupantAt(x, y)).toBe(2);
        expect(world.isSolid(x, y)).toBe(true);
      }
    }
    expect(world.chunks.occupantAt(spot.tx + DRILL.width, spot.ty)).toBeUndefined();
  });

  it('refuse une case constructible mais hors de portée', () => {
    // On cherche une case franchement lointaine et constructible : le refus
    // doit alors être « hors de portée », pas « terrain » ni « ressource ».
    const building: BuildingId = 'drill';

    for (let seed = 1; seed < 400; seed += 1) {
      const world = new World(seed);
      const origin = worldToTile(world.player.x, world.player.y);

      for (let dx = BUILD_REACH_TILES + 4; dx < BUILD_REACH_TILES + 40; dx += 1) {
        const rejection = world.canPlace(building, origin.tx + dx, origin.ty);

        if (rejection === 'terrain' || rejection === 'resource') continue;

        expect(rejection).toBe('outOfReach');
        return;
      }
    }
    throw new Error('aucune case constructible hors de portée trouvée');
  });
});

/** Pose le bâtiment sur la première case posable à portée et l'achève, quel que soit le seed. */
function buildNear(world: World, building: BuildingId): Entity {
  const origin = worldToTile(world.player.x, world.player.y);

  for (let dy = -BUILD_REACH_TILES; dy <= BUILD_REACH_TILES; dy += 1) {
    for (let dx = -BUILD_REACH_TILES; dx <= BUILD_REACH_TILES; dx += 1) {
      if (world.canPlace(building, origin.tx + dx, origin.ty + dy) !== null) continue;

      const before = new Set(world.entities.keys());

      world.push({ type: 'placeBuilding', building, tx: origin.tx + dx, ty: origin.ty + dy });
      world.tick();

      const id = [...world.entities.keys()].find((key) => !before.has(key));

      if (id !== undefined) return completeSite(world, id);
    }
  }
  throw new Error('aucune case posable à portée');
}

describe('forge', () => {
  const SMELT = RECIPES.smeltPlate;
  const FORGE = BUILDINGS.forge;

  it('reste verrouillée tant que les premières vagues ne sont pas passées', () => {
    const world = new World(7);
    const origin = worldToTile(world.player.x, world.player.y);
    const rejected: PlacementRejection[] = [];

    world.events.on('placementRejected', ({ reason }) => rejected.push(reason));
    expect(world.isUnlocked('forge')).toBe(false);
    expect(world.canPlace('forge', origin.tx + 2, origin.ty)).toBe('locked');

    world.push({ type: 'placeBuilding', building: 'forge', tx: origin.tx + 2, ty: origin.ty });
    world.tick();
    expect(rejected).toEqual(['locked']);

    world.night = FORGE.unlockNight;
    expect(world.isUnlocked('forge')).toBe(true);
  });

  it('fond fer et charbon en plaques, à la cadence de la recette, puis s’arrête faute d’entrées', () => {
    const world = new World(7);

    world.night = FORGE.unlockNight;

    const forge = buildNear(world, 'forge');
    const produced: ItemId[] = [];

    if (forge.kind !== 'forge') throw new Error('pas une forge');
    world.events.on('forgeProduced', ({ item }) => produced.push(item));

    // Coffre vide : la forge dort, sans réveil planifié.
    expect(forge.blocked).toBe(true);
    const idleWakes = world.pendingWakes();

    // Deux cycles de fer, et un peu de pierre qu'elle ne prend pas.
    world.player.inventory.add('ironOre', 4);
    world.player.inventory.add('coal', 2);
    world.player.inventory.add('stone', 3);
    world.push({ type: 'supplyBuilding', id: forge.id });
    world.tick();

    expect(forge.store.count('ironOre')).toBe(4);
    expect(forge.store.count('coal')).toBe(2);
    expect(world.player.inventory.count('stone')).toBe(3);
    expect(forge.blocked).toBe(false);
    expect(world.pendingWakes()).toBe(idleWakes + 1);

    for (let i = 0; i < SMELT.duration - 1; i += 1) world.tick();
    expect(produced).toEqual([]);
    world.tick();
    expect(produced).toEqual(['ironPlate']);

    for (let i = 0; i < SMELT.duration; i += 1) world.tick();
    expect(produced).toEqual(['ironPlate', 'ironPlate']);
    expect(forge.store.entries()).toEqual([['ironPlate', 2]]);

    // Plus de fer ni de charbon : elle ne se replanifie plus.
    expect(forge.blocked).toBe(true);
    expect(world.pendingWakes()).toBe(idleWakes);
  });

  it('ne rend que ses plaques, et garde le fer et le charbon au four', () => {
    const world = new World(7);

    world.night = FORGE.unlockNight;

    const forge = buildNear(world, 'forge');

    if (forge.kind !== 'forge') throw new Error('pas une forge');

    world.player.inventory.add('ironOre', 3);
    world.player.inventory.add('coal', 3);
    world.push({ type: 'supplyBuilding', id: forge.id });
    for (let i = 0; i < SMELT.duration + 2; i += 1) world.tick();

    world.push({ type: 'takeFromBuilding', id: forge.id });
    world.tick();

    expect(world.player.inventory.count('ironPlate')).toBe(1);
    expect(world.player.inventory.count('ironOre')).toBe(0);
    expect(forge.store.count('ironOre')).toBe(1);
    expect(forge.store.count('coal')).toBe(2);
    expect(forge.store.count('ironPlate')).toBe(0);
  });

  it('partage son coffre entre fer et charbon, au prorata de la recette', () => {
    const world = new World(7);

    world.night = FORGE.unlockNight;

    const forge = buildNear(world, 'forge');

    if (forge.kind !== 'forge') throw new Error('pas une forge');

    // Le fer seul ne remplit pas le coffre : il reste la place du charbon.
    expect(world.accepts(forge, 'ironOre')).toBe((FORGE.storage * 2) / 3);
    expect(world.accepts(forge, 'coal')).toBe(FORGE.storage / 3);
    expect(world.accepts(forge, 'stone')).toBe(0);
  });

  it('se remplit au contact d’Adam, puis lui rend ses plaques', () => {
    const world = new World(7);

    world.night = FORGE.unlockNight;

    const forge = buildNear(world, 'forge');

    if (forge.kind !== 'forge') throw new Error('pas une forge');

    world.player.inventory.add('ironOre', 2);
    world.player.inventory.add('coal', 1);

    const axis = standNextTo(world, forge.tx, forge.ty, forge.width, forge.height);

    if (!axis) throw new Error('forge inaccessible');
    world.push({ type: 'setMoveAxis', ...axis });

    for (let i = 0; i < SMELT.duration + 40; i += 1) world.tick();

    expect(world.player.inventory.count('ironOre')).toBe(0);
    expect(world.player.inventory.count('coal')).toBe(0);
    expect(world.player.inventory.count('ironPlate')).toBe(1);
    expect(forge.store.isEmpty()).toBe(true);
  });
});

describe('débouchés', () => {
  it('donne un usage à chaque objet récoltable : un coût ou une entrée de recette', () => {
    const consumed = new Set<string>([
      ...Object.values(BUILDINGS).flatMap((building) => Object.keys(building.cost)),
      ...Object.values(RECIPES).flatMap((recipe) => Object.keys(recipe.inputs)),
    ]);

    for (const resource of Object.values(RESOURCES)) expect(consumed).toContain(resource.item);
    expect(consumed).toContain('food');
    expect(consumed).toContain('ironPlate');
  });
});

/**
 * Ouvre un chantier `building` sur la première emprise posable dont le centre
 * est à `min`–`max` tuiles de la mairie, en y téléportant Adam. Renvoie son id.
 */
function openSiteAround(world: World, building: BuildingId, min: number, max: number): EntityId {
  const hall = world.entities.get(world.townHallId)!;
  const cx = hall.tx + hall.width / 2;
  const cy = hall.ty + hall.height / 2;
  const proto = BUILDINGS[building];

  for (let d = min; d <= max; d += 1) {
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]] as const) {
      const tx = Math.round(cx + dx - proto.width / 2);
      const ty = Math.round(cy + dy - proto.height / 2);
      const distance = Math.hypot(tx + proto.width / 2 - cx, ty + proto.height / 2 - cy);

      if (distance < min || distance > max) continue;

      for (let y = ty - 1; y <= ty + proto.height; y += 1) {
        for (let x = tx - 1; x <= tx + proto.width; x += 1) world.resources.clear(x, y);
      }
      // Adam juste sous l'emprise, à portée de construction.
      world.player.x = world.player.prevX = (tx + proto.width / 2) * TILE_SIZE;
      world.player.y = world.player.prevY = (ty + proto.height + 1.5) * TILE_SIZE;
      if (world.canPlace(building, tx, ty) !== null) continue;

      world.push({ type: 'placeBuilding', building, tx, ty });
      world.tick();
      return Math.max(...world.entities.keys());
    }
  }
  throw new Error('aucune emprise posable à cette distance — la génération a changé');
}

describe('la mairie, entrepôt de la colonie', () => {
  it('avale le sac quand Adam la heurte, une fois par contact', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);

    const hall = world.warehouse()!;
    const axis = standNextTo(world, hall.tx, hall.ty, hall.width, hall.height);
    let deposits = 0;

    if (!axis) throw new Error('mairie inaccessible');
    world.events.on('townDeposited', () => (deposits += 1));
    world.player.inventory.add('wood', 30);
    world.push({ type: 'setMoveAxis', ...axis });

    for (let i = 0; i < 40; i += 1) world.tick();

    expect(world.player.inventory.isEmpty()).toBe(true);
    expect(hall.store.count('wood')).toBe(30);
    expect(deposits).toBe(1);
  });

  it('achève en un tap un chantier dans son rayon quand le stock suffit', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);

    const stock = world.warehouse()!.store;
    const cost = BUILDINGS.farm.cost;

    stock.add('wood', cost.wood + 5);
    stock.add('stone', cost.stone);

    const id = openSiteAround(world, 'farm', 4, BUILDINGS.townHall.logisticRadius);
    const site = world.entities.get(id);

    if (site?.kind !== 'site') throw new Error('pas un chantier');
    expect(world.inTownRange(site)).toBe(true);
    expect(world.shortfall(site)).toBe(0);

    // Sac vide : « Transférer » va tout chercher dans le stock, et le dernier objet achève le chantier.
    world.push({ type: 'transferToSite', id });
    world.tick();

    expect(world.entities.get(id)?.kind).toBe('farm');
    expect(stock.count('wood')).toBe(5);
    expect(stock.count('stone')).toBe(0);
  });

  it('complète au transfert avec le sac d’abord, le stock ensuite, sans toucher au stock promis', () => {
    const world = new World(7);
    const sources: string[] = [];

    completeSite(world, world.townHallId);

    const stock = world.warehouse()!.store;
    const cost = BUILDINGS.farm.cost;

    stock.add('wood', cost.wood);
    stock.add('stone', cost.stone);
    // Un porteur a déjà promis deux pierres ailleurs : elles ne sont plus à prendre.
    stock.reserveOut('stone', 2);

    const id = openSiteAround(world, 'farm', 4, BUILDINGS.townHall.logisticRadius);
    const site = world.entities.get(id);

    if (site?.kind !== 'site') throw new Error('pas un chantier');

    world.events.on('siteDelivered', ({ item, source }) => sources.push(`${item}:${source}`));
    world.player.inventory.add('wood', 4);
    expect(world.shortfall(site)).toBe(2);

    world.push({ type: 'transferToSite', id });
    world.tick();

    expect(sources).toEqual(['wood:bag', 'wood:town', 'stone:town']);
    expect(world.player.inventory.isEmpty()).toBe(true);
    // Il manque les pierres promises : le chantier reste ouvert.
    expect(siteMissing(site)).toBe(2);
    expect(world.entities.get(id)?.kind).toBe('site');
    expect(stock.count('wood')).toBe(4);
    expect(stock.count('stone')).toBe(2);
    expect(stock.available('stone')).toBe(0);
  });

  it('laisse les chantiers hors de son rayon à livrer à la main', () => {
    const world = new World(7);
    const rejected: string[] = [];

    completeSite(world, world.townHallId);
    world.warehouse()!.store.add('wood', 100);
    world.warehouse()!.store.add('stone', 100);
    world.events.on('siteRejected', ({ reason }) => rejected.push(reason));

    const radius = BUILDINGS.townHall.logisticRadius;
    const id = openSiteAround(world, 'farm', radius + 2, radius + 30);
    const site = world.entities.get(id);

    if (site?.kind !== 'site') throw new Error('pas un chantier');
    expect(world.inTownRange(site)).toBe(false);

    world.push({ type: 'transferToSite', id });
    world.tick();

    expect(rejected).toEqual(['nothingToGive']);
    expect(siteMissing(site)).toBe(BUILDINGS.farm.cost.wood + BUILDINGS.farm.cost.stone);
  });

  it('garde le stock à la sauvegarde', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    world.warehouse()!.store.add('wood', 49);

    const restored = World.restore(world.snapshot());

    expect(restored.warehouse()?.store.count('wood')).toBe(49);
    expect(restored.warehouse()?.store.capacity).toBe(Infinity);
  });
});
