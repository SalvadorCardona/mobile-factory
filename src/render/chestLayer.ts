/**
 * Les coffres de la carte : fermés, ils sautillent pour se faire voir ;
 * ouverts, ils restent béants là où Adam les a trouvés.
 *
 * Un coffre est un sprite trié en profondeur avec les arbres et les
 * personnages (`EntityLayer.container`) ; son ombre est sous tout le reste.
 * Seuls ceux des chunks à l'écran existent, et seulement sur une case
 * explorée : le brouillard les cache comme le reste de la carte.
 *
 * L'ouverture (`chestOpened`) est une courte animation, un minuteur de vue
 * que la simulation ignore : la caisse se tasse, le couvercle bascule vers
 * sa charnière puis se relève derrière elle avec un rebond, et une gerbe de
 * lumière jaune jaillit puis s'éteint. Les confettis et le son sont branchés
 * dans `main.ts`, comme les autres.
 */

import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { LIGHT } from '../data/artDirection.ts';
import type { PartOf } from '../data/sprites.ts';
import type { Chest } from '../sim/chests.ts';
import { terrainAt } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

/** Durée de l'ouverture. */
const OPEN_MS = 900;
/** Un coffre fermé sautille une fois par période, chacun à sa phase. */
const HOP_MS = 2600;
const HOP_LENGTH_MS = 360;

interface ChestView {
  root: Container;
  box: Sprite;
  lid: Sprite;
  lidOpen: Sprite;
  rays: Sprite;
  shadow: Sprite;
  /** Millisecondes écoulées depuis l'ouverture ; `null` : fermé ou ouvert depuis longtemps. */
  opening: number | null;
  open: boolean;
}

export class ChestLayer {
  private readonly views = new Map<number, ChestView>();
  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly sorted: Container;
  private readonly shadows: Container;
  private clock = 0;

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, sorted: Container, shadows: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.sorted = sorted;
    this.shadows = shadows;

    world.events.on('chestOpened', ({ id }) => {
      const view = this.views.get(id);

      if (view) view.opening = 0;
    });
  }

  public update(camera: Camera, deltaMs: number): void {
    this.clock += deltaMs;

    const visible = camera.visibleChunks(0);
    const alive = new Set<number>();

    for (let cy = visible.minCy; cy <= visible.maxCy; cy += 1) {
      for (let cx = visible.minCx; cx <= visible.maxCx; cx += 1) {
        const chest = this.world.chestOfChunk(cx, cy);

        if (!chest || this.world.sightAt(chest.tx, chest.ty) === 'unexplored') continue;
        alive.add(chest.id);
        this.refresh(this.views.get(chest.id) ?? this.create(chest), chest, deltaMs);
      }
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.drop(view);
      this.views.delete(id);
    }
  }

  private create(chest: Chest): ChestView {
    const root = new Container();
    const sprite = (part: PartOf<'chest'>): Sprite => {
      const made = new Sprite(this.library.part('chest', part));

      made.anchor.set(0.5, 31 / 36);
      return made;
    };
    const box = sprite('closed');
    const lid = sprite('lid');
    const lidOpen = sprite('lidOpen');
    const rays = sprite('rays');
    // Les pivots des morceaux qui basculent : la charnière du couvercle, le cœur de la gerbe.
    const hinge = 31 - 13;

    for (const part of [lid, lidOpen]) {
      part.anchor.set(0.5, 13 / 36);
      part.y = -hinge;
    }
    rays.anchor.set(0.5, 15 / 36);
    rays.y = -(31 - 15);
    lid.visible = rays.visible = false;
    root.addChild(lidOpen, box, lid, rays);
    root.position.set((chest.tx + 0.5) * TILE_SIZE, (chest.ty + 1) * TILE_SIZE - 4);
    root.zIndex = (chest.ty + 1) * TILE_SIZE - 4;

    const shadow = new Sprite(this.tiles.shadow(ground(this.world, chest)));

    shadow.anchor.set(0.5);
    shadow.width = 26;
    shadow.height = 8;
    shadow.position.set(root.x + LIGHT.shadowOffset.x, root.y - 2 + LIGHT.shadowOffset.y);

    this.sorted.addChild(root);
    this.shadows.addChild(shadow);

    const open = this.world.isChestOpen(chest.id);
    const view: ChestView = { root, box, lid, lidOpen, rays, shadow, opening: null, open };

    this.views.set(chest.id, view);
    this.settle(view);
    return view;
  }

  /** L'état de repos : fermé, ou ouvert et vide. */
  private settle(view: ChestView): void {
    view.box.texture = this.library.part('chest', view.open ? 'empty' : 'closed');
    view.box.scale.set(1);
    view.lidOpen.visible = view.open;
    view.lidOpen.scale.set(1);
    view.lid.visible = false;
    view.rays.visible = false;
  }

  private refresh(view: ChestView, chest: Chest, deltaMs: number): void {
    if (view.opening !== null) {
      view.opening += deltaMs;
      if (view.opening >= OPEN_MS) {
        view.opening = null;
        view.open = true;
        this.settle(view);
      } else {
        this.animateOpening(view, view.opening / OPEN_MS);
      }
      return;
    }

    if (view.open) return;

    // Fermé : un petit saut de temps en temps, chacun à sa phase, pour qu'on le repère dans l'herbe.
    const phase = (this.clock + (chest.id % HOP_MS)) % HOP_MS;
    const hop = phase < HOP_LENGTH_MS ? Math.sin((phase / HOP_LENGTH_MS) * Math.PI) : 0;

    view.box.y = -hop * 4;
    view.box.scale.set(1 + hop * 0.04, 1 - hop * 0.04 + hop * 0.08);
  }

  /** `t` dans [0, 1[ : se tasser, basculer le couvercle, le relever avec un rebond, et la gerbe. */
  private animateOpening(view: ChestView, t: number): void {
    const { box, lid, lidOpen, rays } = view;

    box.y = 0;
    if (t < 0.15) {
      // Il se tasse : on sent que ça va sauter.
      const squash = Math.sin((t / 0.15) * Math.PI * 0.5);

      box.texture = this.library.part('chest', 'closed');
      box.scale.set(1 + squash * 0.1, 1 - squash * 0.14);
      lid.visible = lidOpen.visible = rays.visible = false;
      return;
    }

    // Ça saute : la caisse s'étire puis revient, ouverte.
    const pop = Math.max(0, 1 - (t - 0.15) / 0.3);

    box.texture = this.library.part('chest', 'box');
    box.scale.set(1 - pop * 0.06, 1 + pop * 0.12);

    // Le couvercle fermé s'écrase vers sa charnière, puis le revers se dresse derrière, un peu trop, et retombe.
    lid.visible = t < 0.3;
    lid.scale.set(1, Math.max(0, 1 - (t - 0.15) / 0.15));
    lidOpen.visible = t >= 0.3;
    if (lidOpen.visible) {
      const rise = Math.min(1, (t - 0.3) / 0.25);

      lidOpen.scale.set(1, rise < 1 ? rise * 1.2 : 1 + 0.2 * Math.max(0, 1 - (t - 0.55) / 0.2));
    }

    // La gerbe : elle grandit d'un coup, tourne un peu, et s'éteint.
    const glow = (t - 0.2) / 0.8;

    rays.visible = glow > 0;
    rays.scale.set(0.4 + glow * 1.1);
    rays.rotation = glow * 0.35;
    rays.alpha = Math.max(0, 1 - glow);
  }

  private drop(view: ChestView): void {
    view.root.destroy({ children: true });
    view.shadow.destroy();
  }

  public destroy(): void {
    for (const view of this.views.values()) this.drop(view);
    this.views.clear();
  }
}

/** Le sol sous le coffre : son ombre en prend la teinte. */
function ground(world: World, chest: Chest): 'grass' | 'sand' {
  return terrainAt(world.seed, chest.tx, chest.ty) === 'sand' ? 'sand' : 'grass';
}

