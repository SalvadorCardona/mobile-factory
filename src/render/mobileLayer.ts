/**
 * Mutants, flèches et enfants.
 *
 * Les mobiles n'ont pas d'événement de création ni de disparition : ils
 * apparaissent et meurent dans `world.mobiles`, et cette couche s'y
 * synchronise à chaque frame — une vue par id présent, détruite dès que
 * l'id ne l'est plus. Ils sont peu nombreux, et c'est ce qui rend ce
 * balayage acceptable là où il ne le serait pas pour des tuiles.
 *
 * Les sprites vivent dans le conteneur trié de `EntityLayer` : un mutant
 * qui contourne la mairie passe derrière elle quand il est au-dessus, devant
 * quand il est en dessous — comme Adam.
 *
 * Un mutant touché rougit et recule d'un pixel ; un mutant qui apparaît
 * sort de la brume en fondu. Ce sont des minuteurs de vue : la simulation ne
 * connaît que ses points de vie.
 */

import { AnimatedSprite, Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { ENEMIES } from '../data/enemies.ts';
import { SPRITES, type AnimationOf } from '../data/sprites.ts';
import type { Facing, Mobile, MobileId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { SPRITE_SCALE, type AnimationFrames, type SpriteLibrary } from './spriteLibrary.ts';

const HP_BG = 0x11161d;
const HP_FG = 0xe2725b;

const HIT_MS = 140;
const HIT_TINT = 0xff6b5b;
const SPAWN_MS = 500;

interface MobileView {
  root: Container;
  sprite: AnimatedSprite | Sprite;
  animation: string;
  /** Barre de vie d'un mutant entamé. */
  hp: Graphics | null;
  /** Points de vie au dernier cadre : une baisse déclenche le flash. */
  lastHp: number;
  hit: number;
  age: number;
}

type Walker = 'mutant' | 'kid';

/** Les planches des marcheurs partagent les six animations direction + marche. */
type WalkerAnimation = AnimationOf<Walker>;

export class MobileLayer {
  private readonly views = new Map<MobileId, MobileView>();

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly container: Container;
  private readonly footShadow: Texture;

  public constructor(world: World, library: SpriteLibrary, container: Container, footShadow: Texture) {
    this.world = world;
    this.library = library;
    this.container = container;
    this.footShadow = footShadow;
  }

  public update(alpha: number, ticker: Ticker): void {
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
          view.root.zIndex = y + 6;
          this.animate(view, mobile.kind, mobile.facing, mobile.moving);
          (view.sprite as AnimatedSprite).update(ticker);

          if (mobile.kind === 'mutant' && view.hp) {
            const max = ENEMIES[mobile.proto].hp;

            view.hp.visible = mobile.hp < max;
            if (view.hp.visible) drawHp(view.hp, mobile.hp / max);
            if (mobile.hp < view.lastHp) view.hit = HIT_MS;
            view.lastHp = mobile.hp;
            this.feel(view, ticker.deltaMS);
          }
          break;
        }
      }
    }

    for (const [id, view] of this.views) {
      if (this.world.mobiles.has(id)) continue;

      view.root.destroy({ children: true });
      this.views.delete(id);
    }
  }

  private add(mobile: Mobile): MobileView {
    const root = new Container();
    let view: MobileView;

    if (mobile.kind === 'arrow') {
      const sprite = new Sprite(this.library.still('arrow', 'fly'));
      const proto = SPRITES.arrow;

      sprite.anchor.set(proto.anchorX, proto.anchorY);
      sprite.scale.set(SPRITE_SCALE);
      root.addChild(sprite);
      view = { root, sprite, animation: 'fly', hp: null, lastHp: 0, hit: 0, age: SPAWN_MS };
    } else {
      const id: Walker = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].sprite : 'kid';
      const proto = SPRITES[id];
      const frames = this.library.animation(id, 'idleDown');
      const sprite = new AnimatedSprite({ textures: frames.textures, autoUpdate: false });

      sprite.anchor.set(proto.anchorX, proto.anchorY);
      sprite.scale.set(SPRITE_SCALE);

      const shadow = new Sprite(this.footShadow);

      shadow.anchor.set(0.5);
      shadow.scale.set(mobile.kind === 'kid' ? SPRITE_SCALE * 0.7 : SPRITE_SCALE);
      shadow.y = -1;
      root.addChild(shadow, sprite);

      let hp: Graphics | null = null;

      if (mobile.kind === 'mutant') {
        hp = new Graphics();
        hp.position.set(-8, -proto.frameHeight * SPRITE_SCALE * proto.anchorY - 6);
        hp.visible = false;
        root.addChild(hp);
      }
      view = {
        root,
        sprite,
        animation: '',
        hp,
        lastHp: mobile.kind === 'mutant' ? mobile.hp : 0,
        hit: 0,
        age: mobile.kind === 'mutant' ? 0 : SPAWN_MS,
      };
      if (mobile.kind === 'mutant') root.alpha = 0;
    }

    this.views.set(mobile.id, view);
    this.container.addChild(root);
    return view;
  }

  /** Fondu d'apparition, flash rouge et recul à l'impact. */
  private feel(view: MobileView, deltaMs: number): void {
    if (view.age < SPAWN_MS) {
      view.age = Math.min(SPAWN_MS, view.age + deltaMs);
      view.root.alpha = view.age / SPAWN_MS;
    }

    if (view.hit > 0) {
      view.hit = Math.max(0, view.hit - deltaMs);
      view.sprite.tint = HIT_TINT;
      view.sprite.y = -2;
    } else if (view.sprite.y !== 0) {
      view.sprite.tint = 0xffffff;
      view.sprite.y = 0;
    }
  }

  /** Même logique qu'Adam : direction + marche, profil gauche en miroir du profil droit. */
  private animate(view: MobileView, kind: Walker, facing: Facing, moving: boolean): void {
    const side = facing === 'left' || facing === 'right';
    const name = `${moving ? 'walk' : 'idle'}${side ? 'Side' : facing === 'up' ? 'Up' : 'Down'}`;
    const sprite = view.sprite as AnimatedSprite;

    sprite.scale.x = facing === 'left' ? -SPRITE_SCALE : SPRITE_SCALE;

    if (name === view.animation) return;
    view.animation = name;

    const frames: AnimationFrames = this.library.animation(kind, name as WalkerAnimation);

    sprite.textures = frames.textures;
    sprite.loop = frames.loop;
    sprite.animationSpeed = frames.fps / 60;

    if (frames.textures.length > 1) sprite.gotoAndPlay(0);
    else sprite.gotoAndStop(0);
  }

  public destroy(): void {
    for (const view of this.views.values()) view.root.destroy({ children: true });
    this.views.clear();
  }
}

function drawHp(graphics: Graphics, ratio: number): void {
  graphics.clear().rect(0, 0, 16, 3).fill(HP_BG).rect(0, 0, Math.round(16 * ratio), 3).fill(HP_FG);
}
