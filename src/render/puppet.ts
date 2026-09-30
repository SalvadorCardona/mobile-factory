/**
 * Un pantin : un personnage animé par morceaux.
 *
 * Plus de planche d'images. Adam, un mutant, un enfant sont des morceaux —
 * un corps par direction, deux pieds, un arc, un halo — superposés au même
 * point (les pieds) et animés par transformation :
 * - la **marche** fait alterner les pieds et rebondir le corps ;
 * - le repos le fait respirer ;
 * - la **frappe** (Adam contre un arbre) l'écrase et le pousse vers ce qu'il
 *   heurte ;
 * - un **coup reçu** montre le corps « touché » un instant et le fait gicler ;
 * - un **tir** tend l'arc puis le relâche.
 *
 * Le profil gauche est le miroir du profil droit ; l'ombre portée, elle, ne
 * se retourne pas : la lumière vient toujours d'en haut à gauche.
 *
 * Tout est minuteur de vue, en millisecondes d'écran : la simulation n'en sait rien.
 */

import { Container, Sprite, type Texture } from 'pixi.js';
import { LIGHT } from '../data/artDirection.ts';
import { SPRITES, type SpriteId, type SpriteProto } from '../data/sprites.ts';
import type { Facing } from '../sim/types.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';

/** Ce que fait le pantin à cet instant. */
export type Verb = 'idle' | 'walk' | 'act';

type View = 'down' | 'up' | 'side';

/** Pas de marche : radians de cycle par milliseconde. */
const WALK_RATE = 0.018;
/** Cadence de frappe. */
const ACT_RATE = 0.028;
const HURT_MS = 150;
const SHOT_MS = 260;

export interface PuppetOptions {
  /** Largeur de l'ombre portée, en pixels monde. */
  shadowWidth: number;
  /** Écart des pieds de part et d'autre du centre. */
  stride: number;
}

export class Puppet {
  /** Posé aux pieds, en coordonnées monde. */
  public readonly root = new Container();
  public readonly shadow: Sprite;

  private readonly figure = new Container();
  private readonly body: Sprite;
  private readonly feet: [Sprite, Sprite];
  private readonly bow: Sprite | null;
  private readonly halo: Sprite | null;

  private readonly library: SpriteLibrary;
  private readonly id: 'adam' | 'mutant' | 'kid';
  private readonly proto: SpriteProto;
  private readonly stride: number;

  private phase = 0;
  private clock = Math.random() * 1000;
  private hurt = 0;
  private shot = 0;
  private view: View | '' = '';
  private hurtShown = false;

  public constructor(library: SpriteLibrary, id: 'adam' | 'mutant' | 'kid', shadow: Texture, options: PuppetOptions) {
    this.library = library;
    this.id = id;
    this.proto = SPRITES[id];
    this.stride = options.stride;

    this.shadow = new Sprite(shadow);
    this.shadow.anchor.set(0.5);
    this.shadow.width = options.shadowWidth;
    this.shadow.height = options.shadowWidth * 0.3;
    this.shadow.position.set(LIGHT.shadowOffset.x * 0.6, 1);

    this.halo = id === 'mutant' ? this.part('halo') : null;
    this.feet = [this.part('foot'), this.part('foot')];
    this.body = this.part('down');
    this.bow = id === 'adam' ? this.part('bow') : null;

    if (this.halo) this.halo.alpha = 0.35;

    this.figure.addChild(...[this.halo, ...this.feet, this.body, this.bow].filter((sprite) => sprite !== null));
    this.root.addChild(this.shadow, this.figure);
  }

  /** Un morceau, placé pour que le cadre du sprite tombe sur l'ancre commune. */
  private part(name: string): Sprite {
    const { width, height, anchorX, anchorY, pivots } = this.proto;
    const sprite = new Sprite(this.library.texture(`${this.id}.${name}`));
    const pivot = pivots?.[name];

    if (pivot) {
      sprite.anchor.set(pivot[0] / width, pivot[1] / height);
      sprite.position.set(pivot[0] - anchorX * width, pivot[1] - anchorY * height);
    } else {
      sprite.anchor.set(anchorX, anchorY);
    }
    return sprite;
  }

  /** Coup reçu : le corps « touché » s'affiche un instant, et gicle. */
  public hit(): void {
    this.hurt = HURT_MS;
  }

  /** Tir : l'arc se tend et se relâche. */
  public shoot(): void {
    this.shot = SHOT_MS;
  }

  public update(deltaMs: number, facing: Facing, verb: Verb): void {
    const view: View = facing === 'left' || facing === 'right' ? 'side' : facing;
    const hurting = this.hurt > 0;

    this.clock += deltaMs;
    this.hurt = Math.max(0, this.hurt - deltaMs);
    this.shot = Math.max(0, this.shot - deltaMs);

    if (view !== this.view || hurting !== this.hurtShown) {
      this.view = view;
      this.hurtShown = hurting;
      this.body.texture = this.library.texture(`${this.id}.${view}${hurting && this.id === 'mutant' ? 'Hurt' : ''}`);
    }

    this.figure.scale.x = facing === 'left' ? -1 : 1;

    const [left, right] = this.feet;
    let bodyX = 0;
    let bodyY = 0;
    let squash: number;

    if (verb === 'walk') {
      this.phase += deltaMs * WALK_RATE;

      const lift = Math.sin(this.phase);

      bodyY = -Math.abs(lift) * 1.6;
      squash = Math.cos(this.phase * 2) * 0.03;

      if (view === 'side') {
        left.position.set(-1.5 + lift * 3.5, -Math.max(0, lift) * 2);
        right.position.set(1.5 - lift * 3.5, -Math.max(0, -lift) * 2);
      } else {
        left.position.set(-this.stride, -Math.max(0, lift) * 2.4);
        right.position.set(this.stride, -Math.max(0, -lift) * 2.4);
      }
    } else {
      if (view === 'side') {
        left.position.set(-1.5, 0);
        right.position.set(1.5, 0);
      } else {
        left.position.set(-this.stride, 0);
        right.position.set(this.stride, 0);
      }

      if (verb === 'act') {
        // Coups secs vers ce qu'il heurte : l'élan, puis l'impact écrasé.
        this.phase += deltaMs * ACT_RATE;

        const punch = Math.max(0, Math.sin(this.phase));

        squash = -punch * 0.1;
        if (view === 'side') bodyX = punch * 3;
        else bodyY = view === 'down' ? punch * 2 : -punch * 2;
      } else {
        squash = Math.sin(this.clock * 0.004) * 0.025;
      }
    }

    if (hurting) {
      const t = this.hurt / HURT_MS;

      squash += t * 0.18;
      bodyY -= t * 2;
    }

    this.body.position.set(bodyX, bodyY);
    this.body.scale.set(1 - squash * 0.6, 1 + squash);

    if (this.bow) {
      // Tendu (écrasé en largeur), puis relâché en vibrant.
      const t = this.shot / SHOT_MS;
      const twang = t > 0.6 ? -(t - 0.6) * 0.8 : Math.sin(t * 30) * t * 0.25;

      this.bow.scale.set(1 + twang, 1);
      this.bow.position.x = this.body.x + (this.proto.pivots?.['bow']?.[0] ?? 0) - this.proto.anchorX * this.proto.width;
      this.bow.position.y = bodyY + (this.proto.pivots?.['bow']?.[1] ?? 0) - this.proto.anchorY * this.proto.height;
    }

    if (this.halo) {
      const breath = 1 + Math.sin(this.clock * 0.005) * 0.08;

      this.halo.scale.set(breath);
      this.halo.alpha = 0.3 + Math.sin(this.clock * 0.005) * 0.08;
    }
  }

  /** Change l'ombre portée (le sol sous les pieds a changé). */
  public setShadow(texture: Texture): void {
    if (this.shadow.texture !== texture) {
      const { width, height } = this.shadow;

      this.shadow.texture = texture;
      this.shadow.width = width;
      this.shadow.height = height;
    }
  }

  public destroy(): void {
    this.root.destroy({ children: true });
  }
}

/** Sprites qui s'animent en pantin. */
export type PuppetId = Extract<SpriteId, 'adam' | 'mutant' | 'kid'>;
