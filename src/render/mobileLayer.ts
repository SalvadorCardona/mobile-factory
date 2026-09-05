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
 */

import { AnimatedSprite, Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import { ENEMIES } from '../data/enemies.ts';
import { SPRITES, type AnimationOf } from '../data/sprites.ts';
import type { Facing, Mobile, MobileId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { SPRITE_SCALE, type AnimationFrames, type SpriteLibrary } from './spriteLibrary.ts';

const HP_BG = 0x11161d;
const HP_FG = 0xe2725b;

interface MobileView {
  root: Container;
  sprite: AnimatedSprite | Sprite;
  animation: string;
  /** Barre de vie d'un mutant entamé. */
  hp: Graphics | null;
}

type Walker = 'mutant' | 'kid';

/** Les planches des marcheurs partagent les six animations direction + marche. */
type WalkerAnimation = AnimationOf<Walker>;

export class MobileLayer {
  private readonly views = new Map<MobileId, MobileView>();

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly container: Container;

  public constructor(world: World, library: SpriteLibrary, container: Container) {
    this.world = world;
    this.library = library;
    this.container = container;
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
      view = { root, sprite, animation: 'fly', hp: null };
    } else {
      const id: Walker = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].sprite : 'kid';
      const proto = SPRITES[id];
      const frames = this.library.animation(id, 'idleDown');
      const sprite = new AnimatedSprite({ textures: frames.textures, autoUpdate: false });

      sprite.anchor.set(proto.anchorX, proto.anchorY);
      sprite.scale.set(SPRITE_SCALE);
      root.addChild(sprite);

      let hp: Graphics | null = null;

      if (mobile.kind === 'mutant') {
        hp = new Graphics();
        hp.position.set(-8, -proto.frameHeight * SPRITE_SCALE * proto.anchorY - 6);
        hp.visible = false;
        root.addChild(hp);
      }
      view = { root, sprite, animation: '', hp };
    }

    this.views.set(mobile.id, view);
    this.container.addChild(root);
    return view;
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
