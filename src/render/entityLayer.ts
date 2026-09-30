/**
 * Chantiers, bâtiments et joueur.
 *
 * Les sprites ne sont pas reconstruits à chaque frame : ils sont créés à
 * l'événement `buildingPlaced`, échangés à `buildingCompleted`, et ne bougent
 * plus. Seul Adam est repositionné, et il l'est par **interpolation** entre
 * `prevX/prevY` et la position du tick courant : la simulation tourne à
 * 20 TPS, l'écran à 60 ou 120 Hz. Sans interpolation, le personnage avance
 * par à-coups visibles.
 *
 * Un bâtiment a trois visages, trois morceaux de son sprite : le chantier,
 * le bâtiment fini, et le bâtiment cabossé, affiché dès que les mutants lui
 * ont pris la moitié de ses points de vie. Certains ont en plus un morceau
 * animé : la roue de la foreuse tourne quand elle travaille, les cultures de
 * la ferme ondulent.
 *
 * Tri en profondeur : les enfants sont ordonnés par le bas de leur emprise,
 * pour qu'Adam passe derrière la mairie quand il est au-dessus d'elle et
 * devant quand il est en dessous. Les arbres et les rochers
 * (`resourceLayer.ts`) et les mobiles partagent ce conteneur.
 *
 * Le ressenti : un bâtiment achevé « pousse » (il sort du sol en rebondissant),
 * un bâtiment frappé rougit et tremble. Les deux sont des minuteurs de vue,
 * en millisecondes d'écran — la simulation n'en sait rien.
 */

import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { LIGHT, PALETTE, hex } from '../data/artDirection.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { SPRITES, type SpriteProto } from '../data/sprites.ts';
import type { Entity, EntityId } from '../sim/types.ts';
import { terrainAt } from '../sim/terrain.ts';
import { siteMissing, type World } from '../sim/world.ts';
import { MobileLayer } from './mobileLayer.ts';
import { Puppet } from './puppet.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

/** Dessous de la boîte de collision d'Adam, pour le tri en profondeur. */
const PLAYER_FOOT = 7;

const BAR_TRACK = hex(PALETTE.paper.base);
const PROGRESS_FG = hex(PALETTE.yellow.shade);
const HP_FG = hex(PALETTE.coral.base);

/** Durée du rebond d'un bâtiment achevé, et de la secousse d'un bâtiment frappé. */
const POP_MS = 420;
const HIT_MS = 220;
const HIT_TINT = hex(PALETTE.coral.light);

/** Sous cette part de ses points de vie, un bâtiment montre ses blessures. */
const DAMAGED_RATIO = 0.5;

/**
 * L'arc d'Adam tire de sa poitrine, `BOW_RISE` px au-dessus de sa position
 * (`World.shootPlayerBow`) ; un tir parti de là, à `SHOOTER_EPSILON` près,
 * est le sien — les tours tirent d'ailleurs.
 */
const BOW_RISE = 8;
const SHOOTER_EPSILON = 1;

interface EntityView {
  root: Container;
  /** Le bâtiment (ou le chantier) lui-même. */
  main: Sprite;
  /** Morceau animé : roue de foreuse, cultures. */
  moving: Sprite | null;
  shadow: Sprite;
  /** Barre d'avancement d'un chantier, ou barre de vie d'un bâtiment entamé. */
  bar: Graphics;
  /** Millisecondes restantes de rebond et de secousse. */
  pop: number;
  hit: number;
  /** Position de repos du pied de l'emprise, en pixels monde. */
  baseX: number;
  /** Morceau affiché (`built`, `damaged`…) : ne change la texture que s'il change. */
  shown: string;
  /** Dernier état dessiné de la barre : ne retessèle que s'il change. */
  barKey: string;
}

export class EntityLayer {
  public readonly container = new Container();

  private readonly views = new Map<EntityId, EntityView>();
  private readonly adam: Puppet;
  private readonly mobiles: MobileLayer;
  private readonly shadows: Container;
  private groundTile = '';

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, shadows: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.shadows = shadows;
    this.container.sortableChildren = true;
    this.mobiles = new MobileLayer(world, library, tiles, this.container);

    this.adam = new Puppet(library, 'adam', tiles.shadow('grass'), { shadowWidth: 22, stride: 4 });
    this.container.addChild(this.adam.root);

    world.events.on('buildingPlaced', ({ id }) => this.add(id));
    world.events.on('buildingCompleted', ({ id }) => {
      this.replace(id);

      const view = this.views.get(id);

      if (view) view.pop = POP_MS;
    });
    world.events.on('buildingDamaged', ({ id }) => {
      const view = this.views.get(id);

      if (view) view.hit = HIT_MS;
    });
    world.events.on('arrowShot', ({ x, y }) => {
      const { player } = world;

      if (Math.abs(x - player.x) < SHOOTER_EPSILON && Math.abs(y - (player.y - BOW_RISE)) < SHOOTER_EPSILON) {
        this.adam.shoot();
      }
    });
    for (const id of world.entities.keys()) this.add(id);
  }

  private add(id: EntityId): void {
    const entity = this.world.entities.get(id);

    if (!entity || this.views.has(id)) return;

    const view = this.build(entity);

    // Pivot au pied de l'emprise : le rebond part du sol, pas du coin haut gauche.
    view.baseX = (entity.tx + entity.width / 2) * TILE_SIZE;
    view.root.pivot.set((entity.width * TILE_SIZE) / 2, entity.height * TILE_SIZE);
    view.root.position.set(view.baseX, (entity.ty + entity.height) * TILE_SIZE);
    view.root.zIndex = (entity.ty + entity.height) * TILE_SIZE;
    this.views.set(id, view);
    this.container.addChild(view.root);
    this.shadows.addChild(view.shadow);
  }

  private replace(id: EntityId): void {
    const view = this.views.get(id);

    if (view) this.remove(id, view);
    this.add(id);
  }

  private remove(id: EntityId, view: EntityView): void {
    view.root.destroy({ children: true });
    view.shadow.destroy();
    this.views.delete(id);
  }

  private build(entity: Entity): EntityView {
    const root = new Container();
    const proto = BUILDINGS[entity.proto];
    const art: SpriteProto = SPRITES[proto.sprite];
    const shown = entity.kind === 'site' ? 'site' : this.faceOf(entity);
    const main = footSprite(this.library.texture(`${proto.sprite}.${shown}`), entity);
    const moving = entity.kind !== 'site' && art.parts['wheel'] ? 'wheel' : entity.kind !== 'site' && art.parts['crops'] ? 'crops' : null;
    let movingSprite: Sprite | null = null;

    root.addChild(main);

    if (moving) {
      const [px, py] = art.pivots?.[moving] ?? [0, art.height];

      movingSprite = new Sprite(this.library.texture(`${proto.sprite}.${moving}`));
      movingSprite.anchor.set(px / art.width, py / art.height);
      movingSprite.position.set(px, entity.height * TILE_SIZE - art.height + py);
      root.addChild(movingSprite);
    }

    // Une foreuse posée hors gisement reste visible, mais délavée : le joueur
    // doit comprendre pourquoi elle ne produit rien sans ouvrir un panneau.
    if (entity.kind === 'drill' && !entity.output) root.alpha = 0.5;

    // L'ombre portée : pleine, teinte foncée du sol, sous l'emprise.
    const width = entity.width * TILE_SIZE;
    const ground = terrainAt(this.world.seed, entity.tx + floorDiv(entity.width, 2), entity.ty + entity.height - 1);
    const shadow = new Sprite(this.tiles.shadow(ground));

    shadow.anchor.set(0.5);
    shadow.width = width - 4;
    shadow.height = 14;
    shadow.position.set(
      (entity.tx + entity.width / 2) * TILE_SIZE + LIGHT.shadowOffset.x,
      (entity.ty + entity.height) * TILE_SIZE - 6 + LIGHT.shadowOffset.y,
    );

    const bar = new Graphics();

    bar.visible = false;
    root.addChild(bar);

    return { root, main, moving: movingSprite, shadow, bar, pop: 0, hit: 0, baseX: 0, shown, barKey: '' };
  }

  /** Fini ou cabossé, selon ce qu'il reste de points de vie. */
  private faceOf(entity: Exclude<Entity, { kind: 'site' }>): 'built' | 'damaged' {
    return entity.hp <= BUILDINGS[entity.proto].hp * DAMAGED_RATIO ? 'damaged' : 'built';
  }

  private drawBar(view: EntityView, entity: Entity): void {
    let ratio: number;
    let color: number;

    if (entity.kind === 'site') {
      const total = Object.values(BUILDINGS[entity.proto].cost).reduce((sum, amount) => sum + amount, 0);

      ratio = total === 0 ? 1 : 1 - siteMissing(entity) / total;
      color = PROGRESS_FG;
    } else {
      const max = BUILDINGS[entity.proto].hp;

      ratio = entity.hp / max;
      color = HP_FG;
      if (ratio >= 1) {
        view.bar.visible = false;
        return;
      }
    }

    const key = `${color}:${ratio.toFixed(3)}`;

    view.bar.visible = true;
    if (key === view.barKey) return;
    view.barKey = key;

    // Une capsule blanche et son remplissage, flottant au-dessus du bâtiment — comme la maquette.
    const width = Math.min(72, entity.width * TILE_SIZE - 12);
    const x = (entity.width * TILE_SIZE - width) / 2;
    const y = entity.height * TILE_SIZE - SPRITES[BUILDINGS[entity.proto].sprite].height - 12;
    const fill = Math.max(0, Math.min(1, ratio)) * (width - 4);

    view.bar.clear().roundRect(x, y, width, 8, 4).fill(BAR_TRACK);
    if (fill > 0) view.bar.roundRect(x + 2, y + 2, Math.max(4, fill), 4, 2).fill(color);
  }

  /** `alpha` est la fraction du pas de simulation déjà écoulée, dans [0, 1[. */
  public update(alpha: number, ticker: Ticker): void {
    const { player } = this.world;
    const x = player.prevX + (player.x - player.prevX) * alpha;
    const y = player.prevY + (player.y - player.prevY) * alpha;

    this.adam.root.position.set(x, y);
    this.adam.root.zIndex = y + PLAYER_FOOT;
    this.adam.update(ticker.deltaMS, player.facing, player.harvesting ? 'act' : player.moving ? 'walk' : 'idle');
    this.updateShadow(x, y);
    this.mobiles.update(alpha, ticker);

    for (const [id, view] of this.views) {
      const entity = this.world.entities.get(id);

      if (!entity) {
        this.remove(id, view);
        continue;
      }

      if (entity.kind !== 'site') {
        const face = this.faceOf(entity);

        if (face !== view.shown) {
          view.shown = face;
          view.main.texture = this.library.texture(`${BUILDINGS[entity.proto].sprite}.${face}`);
        }
      }

      this.drawBar(view, entity);
      this.feel(view, ticker.deltaMS);
      this.animate(view, entity, ticker.lastTime);
    }
  }

  /** L'ombre d'Adam prend la teinte du sol sous ses pieds. */
  private updateShadow(x: number, y: number): void {
    const tx = floorDiv(x, TILE_SIZE);
    const ty = floorDiv(y, TILE_SIZE);
    const key = `${tx},${ty}`;

    if (key === this.groundTile) return;
    this.groundTile = key;
    this.adam.setShadow(this.tiles.shadow(terrainAt(this.world.seed, tx, ty)));
  }

  /** La roue tourne quand la foreuse travaille ; les cultures ondulent. */
  private animate(view: EntityView, entity: Entity, now: number): void {
    if (!view.moving) return;

    if (entity.kind === 'drill') {
      if (entity.output !== null && !entity.blocked) view.moving.rotation = (now * 0.006) % (Math.PI * 2);
    } else if (entity.kind === 'farm') {
      const sway = Math.sin(now * 0.002 + entity.id);

      view.moving.skew.x = sway * 0.05;
      view.moving.scale.y = 1 + Math.sin(now * 0.004 + entity.id) * 0.03;
    }
  }

  /** Rebond d'achèvement et secousse d'impact, puis retour exact au repos. */
  private feel(view: EntityView, deltaMs: number): void {
    const { root } = view;

    if (view.pop > 0) {
      view.pop = Math.max(0, view.pop - deltaMs);

      // Ressort amorti : écrasé, étiré, puis posé.
      const t = 1 - view.pop / POP_MS;
      const spring = Math.exp(-5 * t) * Math.cos(t * Math.PI * 3);

      root.scale.set(1 - spring * 0.12, 1 + spring * 0.18);
    } else if (root.scale.x !== 1) {
      root.scale.set(1);
    }

    if (view.hit > 0) {
      view.hit = Math.max(0, view.hit - deltaMs);

      const strength = view.hit / HIT_MS;

      root.x = view.baseX + Math.sin(view.hit * 0.25) * 3 * strength;
      view.main.tint = strength > 0.35 ? HIT_TINT : 0xffffff;
    } else if (root.x !== view.baseX) {
      root.x = view.baseX;
      view.main.tint = 0xffffff;
    }
  }

  public destroy(): void {
    this.mobiles.destroy();
    this.adam.destroy();
    this.container.destroy({ children: true });
  }
}

/**
 * Les bâtiments sont vus en 3/4 : leur cadre est plus haut que l'emprise.
 * Ancré au pied, il s'aligne sur le bas de l'emprise et le toit monte
 * au-dessus des tuiles de derrière — le tri par `zIndex` fait le reste.
 */
function footSprite(texture: Sprite['texture'], entity: Entity): Sprite {
  const sprite = new Sprite(texture);

  sprite.anchor.set(0, 1);
  sprite.y = entity.height * TILE_SIZE;
  return sprite;
}
