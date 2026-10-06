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
 *
 * La zone tenue est un disque vert fluo très pâle au sol, sous les ombres :
 * on voit où l'on ne bâtira pas sans que la carte en soit voilée. Le
 * `Graphics` n'est redessiné que quand une base tombe.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { LIGHT, PALETTE, STROKE, hex } from '../data/artDirection.ts';
import { ENEMY_BASE, enemyBaseLevel } from '../data/enemyBases.ts';
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
const BAR_WIDTH = 64;
const BAR_HEIGHT = 8;
/** Durée du tremblement d'une base frappée. */
const WOBBLE_MS = 220;

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
  /** Morceau affiché et ratio de la barre : rien n'est refait s'ils n'ont pas changé. */
  part: string;
  barKey: string;
  wobble: number;
}

export class EnemyBaseLayer {
  /** La teinte des zones, au sol : à poser sous les ombres. */
  public readonly zones = new Graphics();

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

    world.events.on('enemyBaseHit', ({ id }) => {
      const view = this.views.get(id);

      if (view) view.wobble = WOBBLE_MS;
    });
  }

  public update(deltaMs: number): void {
    const standing = this.world.enemyBases.filter(isStanding);

    this.drawZones(standing);

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

    bar.visible = false;
    root.addChild(main, sign, shield, bar);
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

    const view: BaseView = { root, main, sign, shield, raiders: base.raiders, shadow, bar, part: 'built', barKey: '', wobble: 0 };

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
    this.zones.destroy();
  }
}

/** Le morceau du badge pour `raiders` assaillants en réserve : un seul chiffre (`RAIDS.capacityMax`). */
function signPart(raiders: number): string {
  return `enemyBase.sign${Math.max(0, Math.min(9, raiders))}`;
}
