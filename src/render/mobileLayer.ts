/**
 * Mutants, flèches et enfants.
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
 * connaît que ses points de vie.
 */

import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { PALETTE, hex } from '../data/artDirection.ts';
import { ENEMIES } from '../data/enemies.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Mobile, MobileId } from '../sim/types.ts';
import { terrainAt } from '../sim/terrain.ts';
import type { World } from '../sim/world.ts';
import { Puppet } from './puppet.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

const HP_TRACK = hex(PALETTE.paper.base);
const HP_FG = hex(PALETTE.coral.base);

const SPAWN_MS = 500;
const DEATH_MS = 520;

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

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, container: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.container = container;

    world.events.on('mutantDied', ({ id, x, y }) => {
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
    });
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

        case 'mutant':
        case 'kid': {
          const puppet = view.puppet!;

          view.root.zIndex = y + 6;
          this.ground(view, x, y);

          if (mobile.kind === 'mutant' && view.hp) {
            const max = ENEMIES[mobile.proto].hp;

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
  }

  private add(mobile: Mobile): MobileView {
    const root = new Container();
    let view: MobileView;

    if (mobile.kind === 'arrow') {
      const sprite = new Sprite(this.library.part('arrow', 'fly'));

      sprite.anchor.set(SPRITES.arrow.anchorX, SPRITES.arrow.anchorY);
      root.addChild(sprite);
      view = { root, puppet: null, hp: null, lastHp: 0, age: SPAWN_MS, tile: '' };
    } else {
      const mutant = mobile.kind === 'mutant';
      const id = mutant ? ENEMIES[mobile.proto].sprite : 'kid';
      const puppet = new Puppet(this.library, id, this.tiles.shadow('grass'), {
        shadowWidth: mutant ? 22 : 15,
        stride: mutant ? 4 : 3,
      });
      let hp: Graphics | null = null;

      root.addChild(puppet.root);

      if (mutant) {
        const proto = SPRITES[id];

        hp = new Graphics();
        hp.position.set(-9, -proto.height * proto.anchorY - 2);
        hp.visible = false;
        root.addChild(hp);
        root.alpha = 0;
      }
      view = { root, puppet, hp, lastHp: mutant ? mobile.hp : 0, age: mutant ? 0 : SPAWN_MS, tile: '' };
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

/** Une capsule blanche et son remplissage corail, au-dessus de la tête. */
function drawHp(graphics: Graphics, ratio: number): void {
  graphics.clear().roundRect(0, 0, 18, 6, 3).fill(HP_TRACK);
  if (ratio > 0) graphics.roundRect(1.5, 1.5, Math.max(3, 15 * ratio), 3, 1.5).fill(HP_FG);
}
