import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { FLOW_SAMPLE_TICKS, FLOW_SAMPLES, MAX_ALERTS } from './flows.ts';
import { decodeSave, encodeSave, type SavedEntity } from './save.ts';
import { isWalkable, terrainAt } from './terrain.ts';
import type { EntityId } from './types.ts';
import { TICKS_PER_SECOND, World } from './world.ts';

type Stock = Partial<Record<ItemId, number>>;

const MINUTE = 60 * TICKS_PER_SECOND;

interface Layout {
  hall: Stock;
  houses?: number;
  drills?: number;
  forges?: Stock[];
}

/** Une seed dont la mairie a une plaine sans eau au sud : les porteurs y vont en ligne droite. */
function landSeed(): { world: World; hx: number; hy: number } {
  for (let seed = 1; seed < 400; seed += 1) {
    const world = new World(seed);
    const hall = world.entities.get(world.townHallId)!;
    let dry = true;

    for (let ty = hall.ty - 1; ty < hall.ty + 12 && dry; ty += 1) {
      for (let tx = hall.tx - 8; tx < hall.tx + 8 && dry; tx += 1) {
        if (!isWalkable(terrainAt(world.seed, tx, ty))) dry = false;
      }
    }
    if (dry) return { world, hx: hall.tx, hy: hall.ty };
  }
  throw new Error('aucune seed testable — la génération de terrain a changé');
}

/** Une colonie posée d'un coup, en retouchant la sauvegarde d'un monde neuf : les maisons se peuplent au chargement. */
function colony(layout: Layout): World {
  const { world, hx, hy } = landSeed();
  const state = world.snapshot();
  const slots: [number, number][] = [
    [-6, 5],
    [-3, 5],
    [0, 5],
    [3, 5],
    [-6, 8],
    [-3, 8],
  ];
  const entities: SavedEntity[] = [
    { kind: 'townHall', id: world.townHallId, proto: 'townHall', tx: hx, ty: hy, width: 3, height: 3, store: layout.hall, hp: BUILDINGS.townHall.hp, level: 1, paused: false, staff: BUILDINGS.townHall.workers },
  ];
  let nextId = state.nextId;

  const place = (proto: BuildingId): { id: EntityId; proto: BuildingId; tx: number; ty: number; width: number; height: number } => {
    const [dx, dy] = slots.shift()!;
    const { width, height } = BUILDINGS[proto];

    return { id: nextId++, proto, tx: hx + dx, ty: hy + dy, width, height };
  };

  for (const store of layout.forges ?? []) {
    entities.push({ ...place('forge'), kind: 'forge', store, hp: BUILDINGS.forge.hp, level: 1, paused: false, staff: BUILDINGS.forge.workers, blocked: true });
  }
  for (let i = 0; i < (layout.houses ?? 0); i += 1) {
    entities.push({ ...place('builderHouse'), kind: 'house', store: {}, hp: BUILDINGS.builderHouse.hp, level: 1, paused: false, staff: BUILDINGS.builderHouse.workers });
  }
  // Une foreuse bloquée, coffre plein : le premier porteur qui la vide la relance.
  for (let i = 0; i < (layout.drills ?? 0); i += 1) {
    entities.push({ ...place('drill'), kind: 'drill', store: { ironOre: 5 }, hp: BUILDINGS.drill.hp, level: 1, paused: false, staff: BUILDINGS.drill.workers, output: 'ironOre', blocked: true });
  }

  // Adam à l'écart, immobile : il ne dépose rien en ville.
  state.player = { ...state.player, x: (hx - 20) * TILE_SIZE, y: (hy - 20) * TILE_SIZE };
  state.entities = entities;
  state.nextId = nextId;
  state.mobiles = [];
  return World.restore(state);
}

function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) world.tick();
}

function idOf(world: World, kind: string): EntityId {
  return [...world.entities.values()].find((entity) => entity.kind === kind)!.id;
}

describe('débit de la ville', () => {
  it('une foreuse seule, vidée par les porteurs : +30 minerais de fer par minute', () => {
    const world = colony({ hall: {}, houses: 1, drills: 1 });

    // Le temps que les porteurs prennent leur rythme, puis deux minutes de mesure.
    run(world, MINUTE / 2 + 2 * MINUTE);

    const rate = world.flows.netRate('ironOre');

    expect(rate).toBeGreaterThanOrEqual(27);
    expect(rate).toBeLessThanOrEqual(33);
    expect(world.flows.netRate('wood')).toBe(0);
  });

  it('l’anneau ne garde que les deux dernières minutes', () => {
    const world = colony({ hall: {}, houses: 1, drills: 1 });

    run(world, 2 * MINUTE);
    // Plus de foreuse : la ville cesse de recevoir, et le débit retombe à zéro passé deux minutes.
    world.entities.delete(idOf(world, 'drill'));
    run(world, MINUTE / 2);
    expect(world.flows.netRate('ironOre')).toBeGreaterThan(0);
    run(world, FLOW_SAMPLES * FLOW_SAMPLE_TICKS);
    expect(world.flows.netRate('ironOre')).toBe(0);
  });

  it('rien sans deux échantillons ; l’anneau n’est pas sauvegardé', () => {
    const world = colony({ hall: {}, houses: 1, drills: 1 });

    run(world, MINUTE);
    expect(world.flows.netRate('ironOre')).toBeGreaterThan(0);

    const loaded = decodeSave(encodeSave(world, 1));

    if (!loaded.ok) throw new Error(`sauvegarde refusée : ${loaded.reason}`);
    expect(loaded.world.flows.netRate('ironOre')).toBe(0);
  });
});

describe('alertes de la ville', () => {
  it('une forge sans charbon, du minerai en ville : alerte charbon, vers la forge', () => {
    const world = colony({ hall: { ironOre: 40 }, forges: [{}] });

    run(world, 2);

    const alerts = world.flows.alerts(world);

    expect(alerts[0]).toEqual({
      kind: 'shortage',
      item: 'coal',
      text: 'Charbon : la forge attend (0 en ville)',
      target: idOf(world, 'forge'),
    });
    // Le minerai, lui, est en ville : la forge ne l'attend pas.
    expect(alerts.some((alert) => alert.item === 'ironOre')).toBe(false);
  });

  it('du charbon en ville : plus d’alerte', () => {
    const world = colony({ hall: { ironOre: 40, coal: 10 }, forges: [{}] });

    run(world, 2);
    expect(world.flows.alerts(world)).toEqual([]);
  });

  it('une forge à l’arrêt n’utilise pas le minerai : au-delà de 100, c’est un surplus, vers la foreuse', () => {
    const world = colony({ hall: { ironOre: 311, food: 199 }, houses: 1, drills: 1, forges: [{}] });

    run(world, MINUTE);

    const alerts = world.flows.alerts(world);

    expect(alerts).toHaveLength(MAX_ALERTS);
    expect(alerts[0]!.item).toBe('coal');
    expect(alerts[1]!.kind).toBe('surplus');
    expect(alerts[1]!.item).toBe('ironOre');
    expect(alerts[1]!.target).toBe(idOf(world, 'drill'));
    expect(alerts[1]!.text).toMatch(/^Minerai de fer : \+\d+\/min, personne ne l’utilise$/);
  });

  it('une forge en pause n’attend rien', () => {
    const world = colony({ hall: { ironOre: 40 }, forges: [{}] });

    world.push({ type: 'pauseBuilding', id: idOf(world, 'forge'), paused: true });
    run(world, 2);
    expect(world.flows.alerts(world)).toEqual([]);
  });
});
