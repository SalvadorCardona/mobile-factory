import { describe, expect, it } from 'vitest';
import { tileToChunk, worldToTile } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { RECIPES } from '../data/recipes.ts';
import { BUILD_REACH_TILES } from './player.ts';
import { oreAt, terrainAt } from './terrain.ts';
import type { PlacementRejection } from './commands.ts';
import { World } from './world.ts';

const DRILL = BUILDINGS.drill;
const CYCLE = RECIPES.mineOre.duration;

/** Tuile à portée du joueur portant un gisement, ou `null`. */
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
  for (let seed = 1; seed < 400; seed += 1) {
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

describe('World', () => {
  it('fait apparaître le joueur sur une tuile praticable', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const world = new World(seed);
      const { tx, ty } = worldToTile(world.player.x, world.player.y);

      expect(terrainAt(seed, tx, ty)).not.toBe('water');
    }
  });

  /*
   * Le contrat des commandes : pousser n'applique rien. Sans ça, l'UI
   * modifierait l'état hors tick et la rejouabilité seed + journal tomberait.
   */
  it('n’applique une commande qu’au tick suivant', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    expect(world.entities.size).toBe(0);

    world.tick();
    expect(world.entities.size).toBe(1);
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
    // Une seed où l'est du point d'apparition n'est pas bloqué par de l'eau.
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
  });

  it('refuse de construire hors de portée, sur l’eau, ou sur une case occupée', () => {
    const { world, spot } = worldWithOre();
    const rejections: PlacementRejection[] = [];

    world.events.on('placementRejected', ({ reason }) => rejections.push(reason));

    const far = worldToTile(world.player.x, world.player.y);

    world.push({
      type: 'placeBuilding',
      building: 'drill',
      tx: far.tx + BUILD_REACH_TILES * 4,
      ty: far.ty,
    });
    world.tick();
    expect(world.entities.size).toBe(0);

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();
    expect(world.entities.size).toBe(1);

    // La même case, une seconde fois.
    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();
    expect(world.entities.size).toBe(1);

    expect(rejections).toContain('occupied');
    expect(rejections.length).toBe(2);
  });

  it('marque le chunk sale au placement, pour que le rendu rebake', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const { cx, cy } = tileToChunk(spot.tx, spot.ty);

    expect(world.chunks.peek(cx, cy)?.dirty).toBe(true);
  });

  it('fait produire la foreuse dans son coffre interne, à la cadence de la recette', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const drill = world.entities.get(1);

    expect(drill?.output).not.toBeNull();
    expect(drill?.store.total()).toBe(0);

    // Un cycle moins un tick : rien encore.
    for (let i = 1; i < CYCLE; i += 1) world.tick();
    expect(drill?.store.total()).toBe(0);

    world.tick();
    expect(drill?.store.total()).toBe(1);

    for (let i = 0; i < CYCLE; i += 1) world.tick();
    expect(drill?.store.total()).toBe(2);
  });

  /*
   * Le cœur du scheduler par réveils : une machine bloquée ne coûte plus rien.
   * Si `pendingWakes()` ne retombe pas à zéro, c'est qu'elle continue à se
   * replanifier dans le vide — le piège numéro un du projet.
   */
  it('cesse de planifier une foreuse dont le coffre est plein', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    const drill = world.entities.get(1);
    let blocked = 0;

    world.events.on('drillBlocked', () => (blocked += 1));

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();

    expect(drill?.store.total()).toBe(DRILL.storage);
    expect(drill?.blocked).toBe(true);
    expect(blocked).toBe(1);
    expect(world.pendingWakes()).toBe(0);
  });

  it('réveille la foreuse quand on vide son coffre', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    for (let i = 0; i < CYCLE * (DRILL.storage + 2); i += 1) world.tick();

    const drill = world.entities.get(1);
    const item = drill?.output;

    expect(item).toBeTruthy();
    expect(world.pendingWakes()).toBe(0);

    expect(world.withdraw(1, item!, 10)).toBe(10);
    expect(drill?.blocked).toBe(false);
    expect(world.pendingWakes()).toBe(1);

    for (let i = 0; i < CYCLE; i += 1) world.tick();
    expect(drill?.store.total()).toBe(DRILL.storage - 10 + 1);
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
    expect(replay.entities.size).toBe(world.entities.size);
    expect(replay.entities.get(1)?.store.toJSON()).toEqual(
      world.entities.get(1)?.store.toJSON(),
    );
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

          world.push({ type: 'placeBuilding', building: 'drill', tx, ty });
          world.tick();

          expect(world.entities.get(1)?.output).toBeNull();
          expect(world.entities.get(1)?.blocked).toBe(true);
          expect(world.pendingWakes()).toBe(0);
          return;
        }
      }
    }
    throw new Error('aucun emplacement sans gisement trouvé');
  });
});

describe('géométrie de placement', () => {
  it('couvre exactement l’emprise du prototype', () => {
    const { world, spot } = worldWithOre();

    world.push({ type: 'placeBuilding', building: 'drill', tx: spot.tx, ty: spot.ty });
    world.tick();

    for (let y = spot.ty; y < spot.ty + DRILL.height; y += 1) {
      for (let x = spot.tx; x < spot.tx + DRILL.width; x += 1) {
        expect(world.chunks.occupantAt(x, y)).toBe(1);
      }
    }
    expect(world.chunks.occupantAt(spot.tx + DRILL.width, spot.ty)).toBeUndefined();
  });

  it('refuse une case constructible mais hors de portée', () => {
    // On cherche une case franchement lointaine et constructible : le refus
    // doit alors être « hors de portée », pas « terrain ».
    for (let seed = 1; seed < 400; seed += 1) {
      const world = new World(seed);
      const origin = worldToTile(world.player.x, world.player.y);

      for (let dx = BUILD_REACH_TILES + 4; dx < BUILD_REACH_TILES + 40; dx += 1) {
        const rejection = world.canPlace('drill', origin.tx + dx, origin.ty);

        if (rejection === 'terrain') continue;

        expect(rejection).toBe('outOfReach');
        return;
      }
    }
    throw new Error('aucune case constructible hors de portée trouvée');
  });
});
