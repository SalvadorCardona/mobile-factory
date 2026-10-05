import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, MENU_BUILDING_IDS, type BuildingId } from '../data/buildings.ts';
import { ENEMIES, WILDLIFE } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import { COLONY } from '../data/inhabitants.ts';
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/research.ts';
import { validatePrototypes } from '../data/validate.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { ResearchRejection } from './commands.ts';
import { INVENTORY_CAPACITY } from './player.ts';
import { STAT_BASE, researchBonus, researchCost, researchStatus, unlockingResearch } from './research.ts';
import { SAVE_VERSION, decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { Arrow, Lab, Mutant } from './types.ts';
import { World } from './world.ts';

/** Les objets que seuls les ennemis lâchent. */
const LOOT_ONLY: readonly ItemId[] = ['mutantGoo', 'wolfFang', 'crabClaw'];

function fill(world: World, amounts: Partial<Record<ItemId, number>>): void {
  for (const [item, amount] of Object.entries(amounts) as [ItemId, number][]) world.player.inventory.add(item, amount);
}

/** Une case où poser `building` d'ici, ou une erreur. */
function spot(world: World, building: BuildingId): { tx: number; ty: number } {
  const px = Math.floor(world.player.x / TILE_SIZE);
  const py = Math.floor(world.player.y / TILE_SIZE);

  for (let r = 2; r <= 6; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (world.canPlace(building, px + dx, py + dy) === null) return { tx: px + dx, ty: py + dy };
      }
    }
  }
  throw new Error(`aucune place pour ${building}`);
}

/** Pose un bâtiment et le livre d'un coup depuis le sac. */
function build(world: World, building: BuildingId): number {
  const { tx, ty } = spot(world, building);
  let id = -1;
  const off = world.events.on('buildingPlaced', (event) => (id = event.id));

  world.push({ type: 'placeBuilding', building, tx, ty });
  world.tick();
  off();
  fill(world, BUILDINGS[building].cost);
  world.push({ type: 'transferToSite', id });
  world.tick();
  return id;
}

/** Une seed dont la clairière est toute sèche autour de la mairie : les porteurs y passent en ligne droite. */
function drySeed(): number {
  for (let seed = 1; seed < 400; seed += 1) {
    const world = new World(seed);
    const hall = world.entities.get(world.townHallId)!;
    let dry = true;

    for (let ty = hall.ty - 8; ty < hall.ty + 12 && dry; ty += 1) {
      for (let tx = hall.tx - 10; tx < hall.tx + 12 && dry; tx += 1) {
        if (!isWalkable(terrainAt(world.seed, tx, ty))) dry = false;
      }
    }
    if (dry) return seed;
  }
  throw new Error('aucune seed sèche');
}

/** Un monde dont la mairie est bâtie, et un labo fini à côté d'Adam. */
function withLab(seed = drySeed()): { world: World; lab: Lab } {
  const world = new World(seed);

  fill(world, BUILDINGS.townHall.cost);
  world.push({ type: 'transferToSite', id: world.townHallId });
  world.tick();

  const id = build(world, 'lab');
  const lab = world.entities.get(id);

  if (lab?.kind !== 'lab') throw new Error('le labo ne s’est pas achevé');
  return { world, lab };
}

function labOf(world: World): Lab {
  const lab = world.lab();

  if (!lab) throw new Error('pas de labo');
  return lab;
}

function rejections(world: World): ResearchRejection[] {
  const found: ResearchRejection[] = [];

  world.events.on('researchRejected', ({ reason }) => found.push(reason));
  return found;
}

/** Lance une recherche et paie tout son coût depuis le sac. */
function pay(world: World, research: ResearchId): void {
  const lab = labOf(world);

  world.push({ type: 'startResearch', lab: lab.id, research });
  fill(world, RESEARCH[research].cost);
  world.push({ type: 'transferToLab', id: lab.id });
  world.tick();
}

function finish(world: World, research: ResearchId): void {
  pay(world, research);
  for (let i = 0; i < RESEARCH[research].duration + 1; i += 1) world.tick();
  if (!world.researchDone.includes(research)) throw new Error(`${research} ne s’est pas terminée`);
}

describe('recherches — données', () => {
  it('passe la validation, de six à douze recherches', () => {
    expect(validatePrototypes()).toEqual([]);
    expect(RESEARCH_IDS.length).toBeGreaterThanOrEqual(6);
    expect(RESEARCH_IDS.length).toBeLessThanOrEqual(12);
  });

  it('mêle objets communs et butin : le combat nourrit la recherche, la récolte aussi', () => {
    const lootCosts = RESEARCH_IDS.filter((id) => researchCost(id).some(([item]) => LOOT_ONLY.includes(item)));
    const commonOnly = RESEARCH_IDS.filter((id) => researchCost(id).every(([item]) => !LOOT_ONLY.includes(item)));

    expect(lootCosts.length).toBeGreaterThanOrEqual(3);
    expect(commonOnly.length).toBeGreaterThanOrEqual(3);
  });

  it('chaque trophée tombe d’un ennemi : mutant, crabe et loup ont le leur', () => {
    expect(ENEMIES.mutant.loot.map((entry) => entry.item)).toContain('mutantGoo');
    expect(WILDLIFE.crab.loot.map((entry) => entry.item)).toContain('crabClaw');
    expect(WILDLIFE.wolf.loot.map((entry) => entry.item)).toContain('wolfFang');
  });

  it('les modificateurs s’additionnent à la base des données, sans les toucher', () => {
    expect(researchBonus([], 'bowDamage')).toBe(0);
    expect(researchBonus(['sharpArrows'], 'bowDamage')).toBe(0.5);
    expect(STAT_BASE.bowDamage).toBe(WEAPONS.bow.damage);
    expect(WEAPONS.bow.damage).toBe(1);
  });
});

describe('labo de recherche', () => {
  it('un seul labo par colonie, chantier compris', () => {
    const world = new World(drySeed());

    fill(world, BUILDINGS.townHall.cost);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();

    const { tx, ty } = spot(world, 'lab');

    world.push({ type: 'placeBuilding', building: 'lab', tx, ty });
    world.tick();

    const other = spot(world, 'nursery');

    expect(world.atLimit('lab')).toBe(true);
    expect(world.canPlace('lab', other.tx, other.ty)).toBe('unique');
  });

  it('refuse une recherche dont un prérequis manque', () => {
    const { world, lab } = withLab();
    const refused = rejections(world);

    expect(researchStatus('quickDraw', world.researchDone, lab)).toBe('locked');
    world.push({ type: 'startResearch', lab: lab.id, research: 'quickDraw' });
    world.tick();

    expect(refused).toEqual(['locked']);
    expect(lab.research).toBeNull();
  });

  it('attend tout son coût — objets communs et butin — avant que le compte à rebours ne parte', () => {
    const { world, lab } = withLab();

    world.push({ type: 'startResearch', lab: lab.id, research: 'sharpArrows' });
    fill(world, { wood: 8, wolfFang: 1 });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();

    // Le bois est posé, il manque deux crocs : ça attend.
    expect(lab.research).toBe('sharpArrows');
    expect(lab.endTick).toBe(0);
    expect(lab.store.count('wood')).toBe(8);
    expect(world.player.inventory.count('wood')).toBe(0);

    fill(world, { wolfFang: 2 });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();

    // Tout est là : le coût est consommé, le compte à rebours tourne.
    expect(lab.endTick).toBe(world.tickCount + RESEARCH.sharpArrows.duration);
    expect(lab.store.total()).toBe(0);
    expect(world.player.inventory.count('wolfFang')).toBe(0);
    expect(researchStatus('sharpArrows', world.researchDone, lab)).toBe('running');
  });

  it('prend aussi dans le stock de la ville, si le labo est dans son rayon', () => {
    const { world, lab } = withLab();

    expect(world.labInTownRange(lab)).toBe(true);
    world.townStock()!.add('stone', 6);
    world.townStock()!.add('food', 6);
    world.push({ type: 'startResearch', lab: lab.id, research: 'walkingBoots' });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();

    expect(lab.endTick).toBeGreaterThan(0);
    expect(world.townStock()!.count('stone')).toBe(0);
  });

  it('une seule recherche à la fois', () => {
    const { world, lab } = withLab();
    const refused = rejections(world);

    pay(world, 'walkingBoots');
    expect(lab.endTick).toBeGreaterThan(0);

    world.push({ type: 'startResearch', lab: lab.id, research: 'sharpAxes' });
    world.tick();

    expect(refused).toEqual(['busy']);
    expect(lab.research).toBe('walkingBoots');
  });

  it('abandonner une recherche qui attend : rien de déposé n’est perdu', () => {
    const { world, lab } = withLab();

    world.push({ type: 'startResearch', lab: lab.id, research: 'sharpArrows' });
    fill(world, { wood: 5 });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();
    world.push({ type: 'cancelResearch', lab: lab.id });
    world.tick();

    expect(lab.research).toBeNull();
    expect(world.takeable(lab)).toEqual([['wood', 5]]);

    world.push({ type: 'takeFromBuilding', id: lab.id });
    world.tick();

    expect(world.player.inventory.count('wood')).toBe(5);
    expect(lab.store.total()).toBe(0);
  });

  it('change d’avis en cours de collecte : ce qui est déposé sert à la suivante', () => {
    const { world, lab } = withLab();

    world.push({ type: 'startResearch', lab: lab.id, research: 'sharpArrows' });
    fill(world, { wood: 8 });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();
    world.push({ type: 'startResearch', lab: lab.id, research: 'bigBag' });
    fill(world, { crabClaw: 4 });
    world.push({ type: 'transferToLab', id: lab.id });
    world.tick();

    // Le bois de l'une a payé l'autre.
    expect(lab.research).toBe('bigBag');
    expect(lab.endTick).toBeGreaterThan(0);
  });

  it('à la fin, l’effet s’applique : les flèches d’Adam font plus mal', () => {
    const { world } = withLab();
    const done: ResearchId[] = [];

    world.events.on('researchCompleted', ({ research }) => done.push(research));
    finish(world, 'sharpArrows');

    expect(done).toEqual(['sharpArrows']);
    expect(world.bonus('bowDamage')).toBe(0.5);
    expect(labOf(world).research).toBeNull();

    // Un mutant à deux cases : la prochaine flèche porte les dégâts améliorés.
    const mutant: Mutant = {
      kind: 'mutant',
      id: 9000,
      proto: 'mutant',
      x: world.player.x + 2 * TILE_SIZE,
      y: world.player.y,
      prevX: world.player.x + 2 * TILE_SIZE,
      prevY: world.player.y,
      facing: 'down',
      moving: false,
      hp: ENEMIES.mutant.hp,
      age: 30,
      attackCooldown: 0,
      emerge: 0,
    };

    world.mobiles.set(mutant.id, mutant);
    world.player.bowCooldown = 0;
    world.tick();

    const arrows = [...world.mobiles.values()].filter((mobile): mobile is Arrow => mobile.kind === 'arrow');

    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows[0]!.damage).toBe(WEAPONS.bow.damage + 0.5);
  });

  it('tir rapide : le délai de l’arc raccourcit', () => {
    const { world } = withLab();

    finish(world, 'sharpArrows');
    finish(world, 'quickDraw');
    expect(world.bonus('bowCooldown')).toBe(-4);
  });

  it('grand sac : le sac grandit sur-le-champ, sans rien perdre', () => {
    const { world } = withLab();

    world.player.inventory.add('stone', 3);
    finish(world, 'bigBag');

    expect(world.player.inventory.capacity).toBe(INVENTORY_CAPACITY + 15);
    expect(world.player.inventory.count('stone')).toBe(3);
  });

  it('bottes de marche : Adam va plus loin en un tick', () => {
    // Le plus long pas d'un tick, dans les quatre directions : l'une d'elles au moins est dégagée.
    const stride = (world: World): number => {
      let best = 0;

      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const from = { x: world.player.x, y: world.player.y };

        world.push({ type: 'setMoveAxis', x, y });
        world.tick();
        best = Math.max(best, Math.hypot(world.player.x - from.x, world.player.y - from.y));
        world.push({ type: 'setMoveAxis', x: 0, y: 0 });
        world.tick();
      }
      return best;
    };
    const { world } = withLab();
    const before = stride(world);

    finish(world, 'walkingBoots');
    expect(stride(world)).toBeGreaterThan(before);
  });

  it('les porteurs livrent le labo depuis la mairie', () => {
    const built = withLab().world;
    // Une maison des constructeurs posée d'un coup (il faudrait son plan) : ses porteurs s'y installent au chargement.
    const state = built.snapshot();
    const { tx, ty } = spot(built, 'nursery');

    state.entities.push({ kind: 'house', id: state.nextId, proto: 'builderHouse', tx, ty, width: 2, height: 2, store: {}, hp: BUILDINGS.builderHouse.hp, level: 1, paused: false, staff: BUILDINGS.builderHouse.workers });
    state.nextId += 1;

    const world = World.restore(state);
    const lab = labOf(world);

    world.townStock()!.add('stone', 20);
    world.townStock()!.add('food', 20);
    // Adam s'éloigne : ce sont les porteurs qu'on regarde.
    world.player.x -= 12 * TILE_SIZE;
    world.push({ type: 'startResearch', lab: lab.id, research: 'walkingBoots' });

    for (let i = 0; i < 20 * 90 && lab.endTick === 0; i += 1) world.tick();

    expect(lab.endTick).toBeGreaterThan(0);
    expect(world.townStock()!.count('stone')).toBe(14);
    // Les 6 de la recherche, pris aux 20 posés et aux nourritures de départ de la mairie.
    expect(world.townStock()!.count('food')).toBe(20 + COLONY.startingStock.food - 6);
  });
});

describe('recherche — sauvegarde', () => {
  it('une recherche terminée survit au rechargement, son effet aussi', () => {
    const { world } = withLab();

    finish(world, 'bigBag');

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.world.researchDone).toEqual(['bigBag']);
    expect(decoded.world.bonus('bagCapacity')).toBe(15);
    expect(decoded.world.player.inventory.capacity).toBe(INVENTORY_CAPACITY + 15);
  });

  it('une recherche en cours reprend son compte à rebours au chargement', () => {
    const { world } = withLab();

    pay(world, 'sharpAxes');

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);

    const restored = decoded.world;

    expect(labOf(restored).research).toBe('sharpAxes');
    for (let i = 0; i < RESEARCH.sharpAxes.duration + 1; i += 1) restored.tick();
    expect(restored.researchDone).toEqual(['sharpAxes']);
  });

  it('une sauvegarde d’avant le labo se lit : aucune recherche faite', () => {
    const { world } = withLab();
    const file = JSON.parse(encodeSave(world, 0)) as { version: number; state: Record<string, unknown> };

    delete file.state['researchDone'];
    // Et sans labo : ses entités sont celles d'avant.
    file.state['entities'] = (file.state['entities'] as SavedEntity[]).filter((entity) => entity.proto !== 'lab');

    const decoded = decodeSave(JSON.stringify(file));

    expect(file.version).toBe(SAVE_VERSION);
    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.world.researchDone).toEqual([]);
    expect(decoded.world.lab()).toBeNull();
  });
});

describe('recherche — bâtiments débloqués', () => {
  /** Les bâtiments que le menu propose, dans l'ordre des données. */
  function menu(world: World): BuildingId[] {
    return MENU_BUILDING_IDS.filter((id) => world.inMenu(id));
  }

  function unlocked(world: World): BuildingId[][] {
    const found: BuildingId[][] = [];

    world.events.on('buildingsUnlocked', ({ buildings }) => found.push(buildings));
    return found;
  }

  it('une nouvelle partie ne propose rien avant la mairie, puis seulement ce qui est là au départ, sans badge', () => {
    const world = new World(drySeed());
    const events = unlocked(world);

    world.tick();
    expect(menu(world)).toEqual([]);

    fill(world, BUILDINGS.townHall.cost);
    world.push({ type: 'transferToSite', id: world.townHallId });
    world.tick();

    const start = menu(world);

    expect(start).toContain('lab');
    expect(start).toContain('watchtower');
    for (const id of ['forge', 'charcoalKiln', 'clinic', 'builderHouse', 'antenna'] as const) expect(start).not.toContain(id);
    expect(start.filter((id) => world.isNewInMenu(id))).toEqual([]);
    expect(events).toEqual([]);
  });

  it('chaque bâtiment débloqué au labo l’est par une seule recherche, qui le dit', () => {
    expect(unlockingResearch('forge')).toBe('metalworking');
    expect(unlockingResearch('charcoalKiln')).toBe('metalworking');
    expect(unlockingResearch('clinic')).toBe('fieldMedicine');
    expect(unlockingResearch('lab')).toBeNull();
  });

  it('finir la Fonderie fait entrer la forge et le four au menu, avec badge et annonce', () => {
    const { world } = withLab();
    const events = unlocked(world);

    expect(world.inMenu('forge')).toBe(false);
    expect(world.canPlace('forge', 0, 0)).toBe('locked');

    finish(world, 'metalworking');

    expect(events).toEqual([['forge', 'charcoalKiln']]);
    expect(world.inMenu('forge')).toBe(true);
    expect(world.isNewInMenu('forge')).toBe(true);
    expect(world.isNewInMenu('charcoalKiln')).toBe(true);

    // Choisir la carte efface son badge ; poser l'autre aussi.
    world.push({ type: 'seeBuilding', building: 'forge' });
    world.tick();
    expect(world.isNewInMenu('forge')).toBe(false);

    const { tx, ty } = spot(world, 'charcoalKiln');

    world.push({ type: 'placeBuilding', building: 'charcoalKiln', tx, ty });
    world.tick();
    expect(world.isNewInMenu('charcoalKiln')).toBe(false);
    // Une seule annonce : le tick d'après ne refête rien.
    expect(events).toHaveLength(1);
  });

  it('« vu » ne vaut que pour un bâtiment au menu : on n’efface pas d’avance le badge de la clinique', () => {
    const { world } = withLab();

    world.push({ type: 'seeBuilding', building: 'clinic' });
    world.tick();
    expect(world.seenBuildings.has('clinic')).toBe(false);
  });

  it('les badges et les déblocages survivent au rechargement, sans nouvelle annonce', () => {
    const { world } = withLab();

    finish(world, 'metalworking');
    world.push({ type: 'seeBuilding', building: 'forge' });
    world.tick();

    const decoded = decodeSave(encodeSave(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);

    const restored = decoded.world;
    const events = unlocked(restored);

    restored.tick();
    expect(restored.inMenu('forge')).toBe(true);
    expect(restored.isNewInMenu('forge')).toBe(false);
    expect(restored.isNewInMenu('charcoalKiln')).toBe(true);
    expect(events).toEqual([]);
  });

  /** Une sauvegarde version 7 : ni `seenBuildings`, ni les recherches qui débloquent. */
  function version7(world: World, night: number): string {
    const file = JSON.parse(encodeSave(world, 0)) as { version: number; state: Record<string, unknown> };

    file.version = 7;
    file.state['night'] = night;
    delete file.state['seenBuildings'];
    return JSON.stringify(file);
  }

  it('une vieille partie qui a vu une nuit garde forge, four et clinique, et rien n’y est « Nouveau »', () => {
    const { world } = withLab();
    const decoded = decodeSave(version7(world, 2));

    if (!decoded.ok) throw new Error(decoded.reason);

    const loaded = decoded.world;
    const events = unlocked(loaded);

    loaded.tick();
    expect(loaded.researchDone).toEqual(['metalworking', 'fieldMedicine']);
    expect(menu(loaded)).toEqual(expect.arrayContaining(['forge', 'charcoalKiln', 'clinic']));
    expect(MENU_BUILDING_IDS.filter((id) => loaded.isNewInMenu(id))).toEqual([]);
    expect(events).toEqual([]);
  });

  it('une vieille partie d’avant la première nuit les trouvera au labo', () => {
    const { world } = withLab();
    const decoded = decodeSave(version7(world, 0));

    if (!decoded.ok) throw new Error(decoded.reason);
    expect(decoded.world.researchDone).toEqual([]);
    expect(decoded.world.inMenu('forge')).toBe(false);
  });
});
