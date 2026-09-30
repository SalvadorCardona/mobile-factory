/**
 * Mutants, bêtes sauvages, flèches, enfants et Ève.
 *
 * Les mobiles n'ont pas d'événement de création : ils apparaissent dans
 * `world.mobiles`, et cette couche s'y synchronise à chaque frame — une vue
 * par id présent, détruite dès que l'id ne l'est plus. Ils sont peu
 * nombreux, et c'est ce qui rend ce balayage acceptable là où il ne le
 * serait pas pour des tuiles.
 *
 * Les pantins vivent dans le conteneur trié de `EntityLayer` : un mutant
 * qui contourne la mairie passe derrière elle quand il est au-dessus, devant
 * quand il est en dessous — comme Adam.
 *
 * Un mutant touché fait la grimace (yeux en croix) et gicle ; un mutant qui
 * apparaît sort de la brume en fondu ; un mutant qui meurt s'écrase comme
 * une flaque et s'efface. Ce sont des minuteurs de vue : la simulation ne
 * connaît que ses points de vie. Crabes et loups font de même, et frappent
 * (pinces qui claquent, bond) quand ils touchent Adam.
 *
 * Ève arrive sur son vélo-cargo : tant qu'elle roule, sa vue est le vélo,
 * roues qui tournent et cadre qui cahote ; à pied, c'est son pantin, qui
 * frappe le mur qu'elle répare.
 *
 * Le marqueur de cible — un anneau jaune au sol et une pointe au-dessus de
 * la tête — suit ce que l'arc d'Adam vise (`player.target`).
 */

import { Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { PALETTE, hex } from '../data/artDirection.ts';
import { ENEMIES, WILDLIFE } from '../data/enemies.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Mobile, MobileId } from '../sim/types.ts';
import { terrainAt } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import { Puppet, type PuppetId } from './puppet.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

const HP_TRACK = hex(PALETTE.paper.base);
const HP_FG = hex(PALETTE.coral.base);

const SPAWN_MS = 500;
const DEATH_MS = 520;

/** Le pantin de chaque marcheur : sprite, ombre, écart des pieds, allure. */
function puppetOf(mobile: Exclude<Mobile, { kind: 'arrow' }>): { id: PuppetId; shadowWidth: number; stride: number; gait?: 'scuttle' } {
  switch (mobile.kind) {
    case 'mutant':
      return { id: ENEMIES[mobile.proto].sprite, shadowWidth: 22, stride: 4 };
    case 'kid':
      return { id: 'kid', shadowWidth: 15, stride: 3 };
    case 'eve':
      return { id: 'eve', shadowWidth: 20, stride: 4 };
    case 'beast':
      return mobile.proto === 'crab'
        ? { id: WILDLIFE.crab.sprite, shadowWidth: 22, stride: 8, gait: 'scuttle' }
        : { id: WILDLIFE.wolf.sprite, shadowWidth: 26, stride: 3 };
  }
}

interface MobileView {
  root: Container;
  puppet: Puppet | null;
  /** Barre de vie d'un mutant entamé. */
  hp: Graphics | null;
  /** Points de vie au dernier cadre : une baisse déclenche la grimace. */
  lastHp: number;
  age: number;
  /** Tuile sous les pieds : l'ombre ne change de teinte qu'en changeant de sol. */
  tile: string;
  /** Le vélo-cargo d'Ève, montré tant qu'elle roule. */
  bike: BikeView | null;
}

/** Le vélo-cargo : une ombre, le cadre avec Ève en selle, deux roues qui tournent. */
interface BikeView {
  root: Container;
  shadow: Sprite;
  figure: Container;
  wheels: Sprite[];
  clock: number;
}

/** Un mutant mort, qui s'écrase et s'efface là où il est tombé. */
interface Corpse {
  puppet: Puppet;
  left: number;
}

export class MobileLayer {
  private readonly views = new Map<MobileId, MobileView>();
  private readonly corpses: Corpse[] = [];

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly container: Container;

  /** Le marqueur de cible : anneau au sol, pointe au-dessus de la tête. */
  private readonly ring: Sprite;
  private readonly pointer: Sprite;
  private clock = 0;

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, container: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.container = container;

    this.ring = new Sprite(library.part('target', 'ring'));
    this.pointer = new Sprite(library.part('target', 'pointer'));
    this.ring.anchor.set(SPRITES.target.anchorX, SPRITES.target.anchorY);
    this.pointer.anchor.set(0.5, 1);
    this.ring.visible = false;
    this.pointer.visible = false;
    container.addChild(this.ring, this.pointer);

    const fall = ({ id, x, y }: { id: number; x: number; y: number }): void => {
      const view = this.views.get(id);

      if (view?.puppet) {
        // La vue quitte la synchronisation : elle devient un corps qui s'efface.
        this.views.delete(id);
        view.hp?.destroy();
        view.root.destroy();
        view.puppet.root.position.set(x, y);
        view.puppet.root.zIndex = y;
        this.container.addChild(view.puppet.root);
        this.corpses.push({ puppet: view.puppet, left: DEATH_MS });
      }
    };

    world.events.on('mutantDied', fall);
    world.events.on('beastDied', fall);
    world.events.on('playerHurt', ({ by }) => this.views.get(by)?.puppet?.strike());
  }

  public update(alpha: number, ticker: Ticker): void {
    const deltaMs = ticker.deltaMS;

    for (const mobile of this.world.mobiles.values()) {
      const view = this.views.get(mobile.id) ?? this.add(mobile);
      const x = mobile.prevX + (mobile.x - mobile.prevX) * alpha;
      const y = mobile.prevY + (mobile.y - mobile.prevY) * alpha;

      view.root.position.set(x, y);

      switch (mobile.kind) {
        case 'arrow':
          view.root.rotation = Math.atan2(mobile.vy, mobile.vx);
          // Une flèche vole au-dessus de tout ce qui marche.
          view.root.zIndex = y + 64;
          break;

        case 'eve': {
          const riding = mobile.state === 'arriving';

          view.root.zIndex = y + 6;
          this.ground(view, x, y);
          view.puppet!.root.visible = !riding;
          view.bike!.root.visible = riding;

          if (riding) rideBike(view.bike!, mobile.facing === 'left', deltaMs);
          else view.puppet!.update(deltaMs, mobile.facing, mobile.working ? 'act' : mobile.moving ? 'walk' : 'idle');
          break;
        }

        case 'mutant':
        case 'beast':
        case 'kid': {
          const puppet = view.puppet!;

          view.root.zIndex = y + 6;
          this.ground(view, x, y);

          if (mobile.kind !== 'kid' && view.hp) {
            const max = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].hp : WILDLIFE[mobile.proto].hp;

            view.hp.visible = mobile.hp < max;
            if (view.hp.visible) drawHp(view.hp, mobile.hp / max);
            if (mobile.hp < view.lastHp) puppet.hit();
            view.lastHp = mobile.hp;

            if (view.age < SPAWN_MS) {
              view.age = Math.min(SPAWN_MS, view.age + deltaMs);
              view.root.alpha = view.age / SPAWN_MS;
            }
          }

          puppet.update(deltaMs, mobile.facing, mobile.moving ? 'walk' : 'idle');
          break;
        }
      }
    }

    for (const [id, view] of this.views) {
      if (this.world.mobiles.has(id)) continue;

      view.puppet?.destroy();
      view.root.destroy({ children: true });
      this.views.delete(id);
    }

    this.bury(deltaMs);
    this.mark(alpha, deltaMs);
  }

  /** Pose le marqueur sur la cible de l'arc d'Adam, et le fait respirer. */
  private mark(alpha: number, deltaMs: number): void {
    const id = this.world.player.target;
    const target = id === null ? undefined : this.world.mobiles.get(id);
    const visible = target !== undefined && (target.kind === 'mutant' || target.kind === 'beast');

    this.ring.visible = visible;
    this.pointer.visible = visible;
    if (!visible) return;

    this.clock += deltaMs;

    const x = target.prevX + (target.x - target.prevX) * alpha;
    const y = target.prevY + (target.y - target.prevY) * alpha;
    const sprite = SPRITES[puppetOf(target).id];
    const breath = Math.sin(this.clock * 0.008);
    const head = y - sprite.height * sprite.anchorY + 4;

    this.ring.position.set(x, y);
    this.ring.scale.set(0.9 + breath * 0.06);
    this.ring.zIndex = y - 1;
    this.pointer.position.set(x, head - 2 + breath * 1.5);
    this.pointer.scale.set(0.6);
    this.pointer.zIndex = y + 64;
  }

  private add(mobile: Mobile): MobileView {
    const root = new Container();
    let view: MobileView;

    if (mobile.kind === 'arrow') {
      const sprite = new Sprite(this.library.part('arrow', 'fly'));

      sprite.anchor.set(SPRITES.arrow.anchorX, SPRITES.arrow.anchorY);
      root.addChild(sprite);
      view = { root, puppet: null, hp: null, lastHp: 0, age: SPAWN_MS, tile: '', bike: null };
    } else {
      const foe = mobile.kind === 'mutant' || mobile.kind === 'beast';
      const { id, ...options } = puppetOf(mobile);
      const puppet = new Puppet(this.library, id, this.tiles.shadow('grass'), options);
      let hp: Graphics | null = null;

      root.addChild(puppet.root);

      const bike = mobile.kind === 'eve' ? this.bike(this.tiles.shadow('grass')) : null;

      if (bike) root.addChild(bike.root);

      if (foe) {
        const proto = SPRITES[id];

        hp = new Graphics();
        hp.position.set(-9, -proto.height * proto.anchorY - 2);
        hp.visible = false;
        root.addChild(hp);
        root.alpha = 0;
      }
      view = { root, puppet, hp, lastHp: foe ? mobile.hp : 0, age: foe ? 0 : SPAWN_MS, tile: '', bike };
    }

    this.views.set(mobile.id, view);
    this.container.addChild(view.root);
    return view;
  }

  /** L'ombre portée prend la teinte du sol sous les pieds. */
  private ground(view: MobileView, x: number, y: number): void {
    const tx = floorDiv(x, TILE_SIZE);
    const ty = floorDiv(y, TILE_SIZE);
    const key = `${tx},${ty}`;

    if (key === view.tile || !view.puppet) return;
    view.tile = key;
    view.puppet.setShadow(this.tiles.shadow(terrainAt(this.world.seed, tx, ty)));
    if (view.bike) view.bike.shadow.texture = this.tiles.shadow(terrainAt(this.world.seed, tx, ty));
  }

  /** Le vélo-cargo, morceaux posés pour que le cadre du sprite tombe sur l'ancre commune. */
  private bike(shadowTexture: Texture): BikeView {
    const { width, height, anchorX, anchorY, pivots } = SPRITES.cargoBike;
    const root = new Container();
    const figure = new Container();
    const shadow = new Sprite(shadowTexture);
    const frame = new Sprite(this.library.part('cargoBike', 'frame'));
    const wheels = (['wheelBack', 'wheelFront'] as const).map((name) => {
      const wheel = new Sprite(this.library.part('cargoBike', name));
      const [px, py] = pivots[name];

      wheel.anchor.set(px / width, py / height);
      wheel.position.set(px - anchorX * width, py - anchorY * height);
      return wheel;
    });

    shadow.anchor.set(0.5);
    shadow.width = 54;
    shadow.height = 10;
    shadow.position.set(3, 1);
    frame.anchor.set(anchorX, anchorY);
    figure.addChild(...wheels, frame);
    root.addChild(shadow, figure);
    return { root, shadow, figure, wheels, clock: 0 };
  }

  /** Les morts s'aplatissent comme une flaque, puis s'effacent. */
  private bury(deltaMs: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i -= 1) {
      const corpse = this.corpses[i]!;

      corpse.left = Math.max(0, corpse.left - deltaMs);

      const t = 1 - corpse.left / DEATH_MS;
      const root = corpse.puppet.root;

      root.scale.set(1 + t * 0.5, Math.max(0.12, 1 - t * 1.2));
      root.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;

      if (corpse.left === 0) {
        corpse.puppet.destroy();
        this.corpses.splice(i, 1);
      }
    }
  }

  public destroy(): void {
    for (const view of this.views.values()) {
      view.puppet?.destroy();
      view.root.destroy({ children: true });
    }
    for (const corpse of this.corpses) corpse.puppet.destroy();
    this.views.clear();
    this.corpses.length = 0;
  }
}

/** Les roues tournent, le cadre cahote ; à gauche, le vélo se retourne. */
function rideBike(bike: BikeView, left: boolean, deltaMs: number): void {
  bike.clock += deltaMs;
  bike.figure.scale.x = left ? -1 : 1;
  bike.figure.y = -Math.abs(Math.sin(bike.clock * 0.02)) * 0.8;
  for (const wheel of bike.wheels) wheel.rotation += deltaMs * 0.012;
}

/** Une capsule blanche et son remplissage corail, au-dessus de la tête. */
export function drawHp(graphics: Graphics, ratio: number): void {
  graphics.clear().roundRect(0, 0, 18, 6, 3).fill(HP_TRACK);
  if (ratio > 0) graphics.roundRect(1.5, 1.5, Math.max(3, 15 * ratio), 3, 1.5).fill(HP_FG);
}
