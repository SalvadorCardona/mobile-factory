/**
 * Les bases mutantes : leur campement, leur pancarte, et la zone qu'elles tiennent.
 *
 * Le campement est un sprite trié en profondeur avec les bâtiments, les
 * arbres et les personnages (`EntityLayer.container`) : Adam passe derrière
 * le drapeau. Le badge de ses assaillants en réserve (`sign0` à `sign9`) se
 * pose dessus dans le même cadre : il monte le jour et retombe la nuit. Le
 * bouclier de son chef (`shield`) aussi, tant que le chef vit. Entamée, la base montre sa barre de vie au-dessus du
 * drapeau ; sous la moitié, sa version `damaged`. Frappée, elle tremble — un
 * minuteur de vue, la simulation n'en sait rien. Abattue, elle disparaît.
 * Sous le brouillard de guerre, seules les bases explorées se montrent, et
 * hors de vue telles qu'on les a vues la dernière fois (`World.knownEnemyBases`).
 *
 * Le danger se lit avant d'y aller : à l'approche (`GUARD_RANGE.showTiles`),
 * l'anneau corail de la portée de ses boules de feu se dessine au sol, de
 * plus en plus net, et autant de flammes que son niveau montent sur son
 * drapeau. Quand elle charge un tir, une lueur gonfle au-dessus du
 * campement (`FIREBALL.tellTicks`) : c'est le signal d'esquiver.
 *
 * La zone tenue est un disque vert fluo très pâle au sol, sous les ombres :
 * on voit où l'on ne bâtira pas sans que la carte en soit voilée. Le
 * `Graphics` n'est redessiné que quand une base tombe.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_SIZE, distanceSq, floorDiv } from '../core/grid.ts';
import { LIGHT, PALETTE, STROKE, hex } from '../data/artDirection.ts';
import { ENEMY_BASE, FIREBALL, GUARD_RANGE, enemyBaseLevel } from '../data/enemyBases.ts';
import { SPRITES } from '../data/sprites.ts';
import { baseCenter, isShielded, isStanding } from '../sim/enemyBases.ts';
import { terrainAt } from '../sim/terrain.ts';
import type { EnemyBase } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

const ZONE_COLOR = hex(PALETTE.toxic.base);
const ZONE_EDGE = hex(PALETTE.toxic.shade);
const BAR_TRACK = hex(PALETTE.paper.base);
const HP_FG = hex(PALETTE.coral.base);
const DANGER_COLOR = hex(PALETTE.coral.base);
const FLAME_COLOR = hex(PALETTE.orange.base);
const FLAME_CORE = hex(PALETTE.yellow.base);
const BAR_WIDTH = 64;
const BAR_HEIGHT = 8;
/** Durée du tremblement d'une base frappée. */
const WOBBLE_MS = 220;
/** Durée de la lueur de charge : `FIREBALL.tellTicks` à 20 ticks par seconde. */
const CHARGE_MS = (FIREBALL.tellTicks / 20) * 1000;
/** Au plus net, l'anneau de portée n'est pas plus opaque que ceci. */
const DANGER_ALPHA = 0.55;

interface BaseView {
  root: Container;
  main: Sprite;
  sign: Sprite;
  /** Le bouclier de son chef, planté tant qu'il vit. */
  shield: Sprite;
  /** Le nombre que montre le badge : sa texture n'est changée que s'il change. */
  raiders: number;
  shadow: Sprite;
  bar: Graphics;
  /** La lueur d'un tir qui se charge ; `charge` : millisecondes restantes. */
  glow: Sprite;
  charge: number;
  /** Morceau affiché et ratio de la barre : rien n'est refait s'ils n'ont pas changé. */
  part: string;
  barKey: string;
  wobble: number;
}

export class EnemyBaseLayer {
  /** La teinte des zones, au sol : à poser sous les ombres. */
  public readonly zones = new Graphics();

  /** Les anneaux de portée des bases proches d’Adam, redessinés à chaque image. */
  private readonly danger = new Graphics();
  private readonly views = new Map<number, BaseView>();
  private zonesKey = '';

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly sorted: Container;
  private readonly shadows: Container;

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, sorted: Container, shadows: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.sorted = sorted;
    this.shadows = shadows;

    this.zones.addChild(this.danger);
    world.events.on('baseFireWarned', ({ id }) => {
      const view = this.views.get(id);

      if (view) view.charge = CHARGE_MS;
    });
    world.events.on('enemyBaseHit', ({ id }) => {
      const view = this.views.get(id);

      if (view) view.wobble = WOBBLE_MS;
    });
  }

  public update(deltaMs: number): void {
    // Le brouillard : une base jamais vue ne se montre pas ; vue de loin, elle est telle qu'on l'a laissée.
    const standing = this.world.knownEnemyBases().filter(isStanding);

    this.drawZones(standing);
    this.drawDanger(standing);

    const alive = new Set<number>();

    for (const base of standing) {
      alive.add(base.id);

      const view = this.views.get(base.id) ?? this.create(base);

      this.refresh(view, base, deltaMs);
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      view.shadow.destroy();
      this.views.delete(id);
    }
  }

  /** L'anneau de portée des boules de feu des bases à moins de `showTiles` d'Adam : net près d'elle, pâle au loin. */
  private drawDanger(standing: readonly EnemyBase[]): void {
    const { player } = this.world;
    const show = GUARD_RANGE.showTiles * TILE_SIZE;

    this.danger.clear();
    for (const base of standing) {
      const { x, y } = baseCenter(base);
      const { fire } = enemyBaseLevel(base.level);
      const distance = Math.sqrt(distanceSq(player.x, player.y, x, y));

      if (distance > show) continue;

      const near = 1 - Math.max(0, distance - fire.range * TILE_SIZE) / (show - fire.range * TILE_SIZE);

      this.danger
        .circle(x, y, fire.range * TILE_SIZE)
        .fill({ color: DANGER_COLOR, alpha: 0.08 * near })
        .stroke({ width: STROKE.width * 1.5, color: DANGER_COLOR, alpha: DANGER_ALPHA * near });
    }
  }

  private drawZones(standing: readonly EnemyBase[]): void {
    const key = standing.map((base) => base.id).join(',');

    if (key === this.zonesKey) return;
    this.zonesKey = key;
    this.zones.clear();
    for (const base of standing) {
      const { x, y } = baseCenter(base);

      this.zones
        .circle(x, y, enemyBaseLevel(base.level).zoneRadius * TILE_SIZE)
        .fill({ color: ZONE_COLOR, alpha: 0.1 })
        .stroke({ width: STROKE.width, color: ZONE_EDGE, alpha: 0.35 });
    }
  }

  private create(base: EnemyBase): BaseView {
    const root = new Container();
    const height = ENEMY_BASE.height * TILE_SIZE;
    const main = new Sprite(this.library.texture('enemyBase.built'));
    const sign = new Sprite(this.library.texture(signPart(base.raiders)));
    const shield = new Sprite(this.library.texture('enemyBase.shield'));

    for (const sprite of [main, sign, shield]) {
      sprite.anchor.set(0, 1);
      sprite.y = height;
    }

    const bar = new Graphics();
    const glow = new Sprite(this.library.part('fireball', 'glow'));

    bar.visible = false;
    glow.anchor.set(0.5);
    glow.visible = false;
    glow.position.set((ENEMY_BASE.width * TILE_SIZE) / 2, height - FIREBALL.muzzle - (ENEMY_BASE.height * TILE_SIZE) / 2);
    root.addChild(main, sign, shield, flames(base.level, height - SPRITES.enemyBase.height), bar, glow);
    root.position.set(base.tx * TILE_SIZE, base.ty * TILE_SIZE);
    root.zIndex = (base.ty + ENEMY_BASE.height) * TILE_SIZE;

    const ground = terrainAt(this.world.seed, base.tx + floorDiv(ENEMY_BASE.width, 2), base.ty + ENEMY_BASE.height - 1);
    const shadow = new Sprite(this.tiles.shadow(ground));
    const width = ENEMY_BASE.width * TILE_SIZE;

    shadow.anchor.set(0.5);
    shadow.width = width - 4;
    shadow.height = 14;
    shadow.position.set(
      (base.tx + ENEMY_BASE.width / 2) * TILE_SIZE + LIGHT.shadowOffset.x,
      (base.ty + ENEMY_BASE.height) * TILE_SIZE - 6 + LIGHT.shadowOffset.y,
    );

    this.sorted.addChild(root);
    this.shadows.addChild(shadow);

    const view: BaseView = { root, main, sign, shield, raiders: base.raiders, shadow, bar, glow, charge: 0, part: 'built', barKey: '', wobble: 0 };

    this.views.set(base.id, view);
    return view;
  }

  private refresh(view: BaseView, base: EnemyBase, deltaMs: number): void {
    const max = enemyBaseLevel(base.level).hp;
    const ratio = base.hp / max;
    const part = ratio < 0.5 ? 'damaged' : 'built';

    if (part !== view.part) {
      view.part = part;
      view.main.texture = this.library.texture(`enemyBase.${part}`);
    }
    // Le bouclier tombe avec le chef.
    view.shield.visible = isShielded(base);
    if (base.raiders !== view.raiders) {
      view.raiders = base.raiders;
      view.sign.texture = this.library.texture(signPart(base.raiders));
    }

    view.bar.visible = ratio < 1;
    if (view.bar.visible) {
      const key = ratio.toFixed(3);

      if (key !== view.barKey) {
        view.barKey = key;

        const x = (ENEMY_BASE.width * TILE_SIZE - BAR_WIDTH) / 2;
        const y = ENEMY_BASE.height * TILE_SIZE - SPRITES.enemyBase.height - 4;
        const fill = Math.max(0, Math.min(1, ratio)) * (BAR_WIDTH - 4);

        view.bar.clear().roundRect(x, y, BAR_WIDTH, BAR_HEIGHT, 4).fill(BAR_TRACK);
        if (fill > 0) view.bar.roundRect(x + 2, y + 2, Math.max(4, fill), 4, 2).fill(HP_FG);
      }
    }

    // Elle charge un tir : la lueur gonfle et vire au clair, puis s'éteint d'un coup avec la boule qui part.
    view.charge = Math.max(0, view.charge - deltaMs);
    view.glow.visible = view.charge > 0;
    if (view.glow.visible) {
      const progress = 1 - view.charge / CHARGE_MS;

      view.glow.scale.set(0.6 + progress * 1.4);
      view.glow.alpha = 0.35 + progress * 0.5;
    }

    // Frappée : elle tremble, puis revient exactement à sa place.
    view.wobble = Math.max(0, view.wobble - deltaMs);

    const strength = view.wobble / WOBBLE_MS;

    view.root.x = base.tx * TILE_SIZE + Math.sin(view.wobble * 0.09) * 2.5 * strength;
  }

  public destroy(): void {
    for (const view of this.views.values()) {
      view.root.destroy({ children: true });
      view.shadow.destroy();
    }
    this.views.clear();
    this.zones.destroy({ children: true });
  }
}

/**
 * Autant de flammes que le niveau de la base, en rang au-dessus du drapeau :
 * on lit le danger d'un coup d'œil. Rondes, deux tons, sans contour.
 */
function flames(level: number, top: number): Graphics {
  const row = new Graphics();
  const gap = 11;
  const left = (ENEMY_BASE.width * TILE_SIZE - (level - 1) * gap) / 2;

  for (let i = 0; i < level; i += 1) {
    const x = left + i * gap;

    row.circle(x, top - 6, 5).fill(FLAME_COLOR).circle(x - 0.5, top - 5, 2.6).fill(FLAME_CORE);
    row.roundRect(x - 1.6, top - 15, 3.2, 6, 1.6).fill(FLAME_COLOR);
  }
  return row;
}

/** Le morceau du badge pour `raiders` assaillants en réserve : un seul chiffre (`RAIDS.capacityMax`). */
function signPart(raiders: number): string {
  return `enemyBase.sign${Math.max(0, Math.min(9, raiders))}`;
}
