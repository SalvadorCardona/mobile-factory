import { describe, expect, it } from 'vitest';
import { TILE_SIZE, tileToChunk, worldToTile } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { RECIPES } from '../data/recipes.ts';
import { RESOURCES } from '../data/resources.ts';
import type { PlacementRejection } from './commands.ts';
import { BUILD_REACH_TILES, INVENTORY_CAPACITY } from './player.ts';
import { oreAt, terrainAt } from './terrain.ts';
import type { Entity, EntityId } from './types.ts';
import { World, siteMissing } from './world.ts';

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

    if (current?.kind === 'site' && siteMissing(current) === 0) break;
  }
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  world.tick();

  // Un chantier livré ne se termine jamais seul : c'est le bouton « Construire ».
  world.push({ type: 'buildSite', id });
  world.tick();
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

  it('marque le chunk sale au placement, pour que le rendu rebake', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const { cx, cy } = tileToChunk(spot.tx, spot.ty);

    expect(world.chunks.peek(cx, cy)?.dirty).toBe(true);
  });

  it('ouvre un chantier, que le contact d’Adam remplit avec son sac', () => {
    const { world, spot } = worldWithOre();
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

  it('transfère le sac d’un coup dans le chantier, puis attend « Construire »', () => {
    const world = new World(7);
    const ready: EntityId[] = [];
    const completed: EntityId[] = [];
    const rejected: string[] = [];

    world.events.on('siteReady', ({ id }) => ready.push(id));
    world.events.on('buildingCompleted', ({ id }) => completed.push(id));
    world.events.on('siteRejected', ({ reason }) => rejected.push(reason));

    // Construire avant d'avoir livré : refusé.
    world.push({ type: 'buildSite', id: world.townHallId });
    world.tick();
    expect(rejected).toEqual(['incomplete']);

    // Un sac à moitié rempli : tout passe, le chantier n'est pas prêt.
    world.player.inventory.add('wood', 5);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();

    const site = world.entities.get(world.townHallId);

    expect(site?.kind).toBe('site');
    expect(site?.kind === 'site' && site.delivered.wood).toBe(5);
    expect(world.player.inventory.total()).toBe(0);
    expect(ready).toEqual([]);

    // Rien à donner : refusé, sans rien casser.
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();
    expect(rejected).toEqual(['incomplete', 'nothingToGive']);

    // Le reste, plus du surplus qui doit rester dans le sac.
    world.player.inventory.add('wood', 20);
    world.player.inventory.add('stone', 12);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();
    expect(ready).toEqual([world.townHallId]);
    expect(world.player.inventory.count('wood')).toBe(5);
    expect(completed).toEqual([]);

    world.push({ type: 'buildSite', id: world.townHallId });
    world.tick();
    expect(completed).toEqual([world.townHallId]);
    expect(world.entities.get(world.townHallId)?.kind).toBe('townHall');
  });

  it('compte les ouvriers des bâtiments finis dans la population', () => {
    const world = new World(7);

    completeSite(world, world.townHallId);
    expect(world.population().workers).toBe(0);

    const spot = { tx: Math.floor(world.player.x / TILE_SIZE) + 2, ty: Math.floor(world.player.y / TILE_SIZE) + 2 };

    for (let y = spot.ty - 1; y < spot.ty + 3; y += 1) {
      for (let x = spot.tx - 1; x < spot.tx + 3; x += 1) world.resources.clear(x, y);
    }
    world.push({ type: 'placeBuilding', building: 'builderHouse', tx: spot.tx, ty: spot.ty });
    world.tick();

    const id = Math.max(...world.entities.keys());

    // Un chantier n'emploie personne.
    expect(world.population().workers).toBe(0);
    completeSite(world, id);
    expect(world.population().workers).toBe(BUILDINGS.builderHouse.workers);
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

describe('récolte par contact', () => {
  it('bloque Adam sur une ressource et la récolte tant qu’il pousse', () => {
    const { world, tx, ty, axis } = worldWithHarvestable();
    const resource = world.resources.at(tx, ty)!;
    const proto = RESOURCES[resource.id];
    const harvested: ItemId[] = [];

    world.events.on('resourceHarvested', ({ item }) => harvested.push(item));
    world.push({ type: 'setMoveAxis', ...axis });

    // Il faut d'abord arriver au contact, puis tenir `harvestTicks` ticks.
    let ticks = 0;

    while (harvested.length === 0 && ticks < 100) {
      world.tick();
      ticks += 1;
    }

    expect(harvested).toEqual([proto.item]);
    expect(world.player.inventory.count(proto.item)).toBe(1);
    expect(world.resources.at(tx, ty)?.remaining).toBe(proto.amount - 1);

    // Adam n'a pas traversé la tuile.
    const standing = worldToTile(world.player.x, world.player.y);

    expect(standing.tx === tx && standing.ty === ty).toBe(false);

    // La cadence est régulière : la suivante tombe `harvestTicks` ticks plus tard.
    for (let i = 0; i < proto.harvestTicks; i += 1) world.tick();
    expect(harvested.length).toBe(2);
  });

  it('fait disparaître la ressource vidée, qui devient franchissable', () => {
    const { world, tx, ty, axis } = worldWithHarvestable();
    const proto = RESOURCES[world.resources.at(tx, ty)!.id];
    const { cx, cy } = tileToChunk(tx, ty);
    let remaining = -1;

    world.events.on('resourceHarvested', (event) => (remaining = event.remaining));
    world.push({ type: 'setMoveAxis', ...axis });

    for (let i = 0; i < 40 + proto.amount * proto.harvestTicks; i += 1) {
      world.tick();
      if (remaining === 0) break;
    }

    expect(remaining).toBe(0);
    expect(world.resources.at(tx, ty)).toBeNull();
    expect(world.isSolid(tx, ty)).toBe(false);
    expect(world.chunks.peek(cx, cy)?.dirty).toBe(true);
    expect(world.player.inventory.count(proto.item)).toBe(proto.amount);
  });

  it('arrête de récolter quand le sac est plein', () => {
    const { world, tx, ty, axis } = worldWithHarvestable();
    const before = world.resources.at(tx, ty)!.remaining;
    let full = 0;

    world.player.inventory.add('wood', INVENTORY_CAPACITY);
    world.events.on('inventoryFull', () => (full += 1));
    world.push({ type: 'setMoveAxis', ...axis });

    for (let i = 0; i < 60; i += 1) world.tick();

    expect(full).toBeGreaterThan(0);
    expect(world.resources.at(tx, ty)?.remaining).toBe(before);
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
