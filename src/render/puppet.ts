/**
 * Un pantin : un personnage animé par morceaux.
 *
 * Plus de planche d'images. Adam, Ève, un mutant, un enfant, un crabe, un loup
 * sont des morceaux — un corps par direction, deux pieds, un arc, un halo,
 * des pinces — superposés au même point (les pieds) et animés par
 * transformation :
 * - la **marche** fait alterner les pieds et rebondir le corps ; un crabe,
 *   lui, **trottine de côté** : le corps se dandine, les deux peignes de
 *   pattes se lèvent tour à tour ;
 * - le repos le fait respirer ;
 * - la **frappe** (Adam contre un arbre, Ève contre un mur à réparer) l'écrase et le pousse vers ce qu'il
 *   heurte ;
 * - un **coup reçu** montre le corps « touché » un instant et le fait gicler ;
 * - un **tir** tend l'arc puis le relâche ;
 * - une **attaque** de bête fait claquer les pinces du crabe, bondir le loup ;
 * - un ouvrier qui **porte** a sa charge sur la tête, qui suit le rebond du pas.
 *
 * Le profil gauche est le miroir du profil droit ; l'ombre portée, elle, ne
 * se retourne pas : la lumière vient toujours d'en haut à gauche.
 *
 * Tout est minuteur de vue, en millisecondes d'écran : la simulation n'en sait rien.
 */

import { Container, Sprite, type Texture } from 'pixi.js';
import { LIGHT } from '../data/artDirection.ts';
import type { ItemId } from '../data/items.ts';
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
const STRIKE_MS = 240;

export interface PuppetOptions {
  /** Largeur de l'ombre portée, en pixels monde. */
  shadowWidth: number;
  /** Écart des pieds de part et d'autre du centre. */
  stride: number;
  /** `scuttle` : l'allure du crabe, de côté. Par défaut, la marche. */
  gait?: 'walk' | 'scuttle';
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
  private readonly claws: Sprite | null;
  private readonly load: Sprite | null;
  private loadItem: ItemId | null = null;

  private readonly library: SpriteLibrary;
  private readonly id: PuppetId;
  private readonly proto: SpriteProto;
  private readonly stride: number;
  private readonly gait: 'walk' | 'scuttle';

  private phase = 0;
  private clock = Math.random() * 1000;
  private hurt = 0;
  private shot = 0;
  private strikeLeft = 0;
  private view: View | '' = '';
  private hurtShown = false;

  public constructor(library: SpriteLibrary, id: PuppetId, shadow: Texture, options: PuppetOptions) {
    this.library = library;
    this.id = id;
    this.proto = SPRITES[id];
    this.stride = options.stride;
    this.gait = options.gait ?? 'walk';

    this.shadow = new Sprite(shadow);
    this.shadow.anchor.set(0.5);
    this.shadow.width = options.shadowWidth;
    this.shadow.height = options.shadowWidth * 0.3;
    this.shadow.position.set(LIGHT.shadowOffset.x * 0.6, 1);

    this.halo = id === 'mutant' ? this.part('halo') : null;
    this.feet = [this.part('foot'), this.part('foot')];
    this.body = this.part('down');
    this.bow = id === 'adam' ? this.part('bow') : null;
    this.claws = 'claws' in this.proto.parts ? this.part('claws') : null;
    this.load = id === 'worker' ? this.part('load.wood') : null;

    if (this.halo) this.halo.alpha = 0.35;
    if (this.load) this.load.visible = false;

    this.figure.addChild(
      ...[this.halo, ...this.feet, this.body, this.bow, this.claws, this.load].filter((sprite) => sprite !== null),
    );
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

  /** La charge d'un ouvrier : l'objet porté sur la tête, ou rien. */
  public carry(item: ItemId | null): void {
    if (!this.load || item === this.loadItem) return;

    this.loadItem = item;
    this.load.visible = item !== null;
    if (item) this.load.texture = this.library.texture(`${this.id}.load.${item}`);
  }

  /** Attaque d'une bête : les pinces claquent, le loup bondit. */
  public strike(): void {
    this.strikeLeft = STRIKE_MS;
  }

  public update(deltaMs: number, facing: Facing, verb: Verb): void {
    const turned: View = facing === 'left' || facing === 'right' ? 'side' : facing;
    // Un sprite sans ce point de vue (le crabe, toujours de face) garde sa face.
    const view: View = turned in this.proto.parts ? turned : 'down';
    const hurting = this.hurt > 0;

    this.clock += deltaMs;
    this.hurt = Math.max(0, this.hurt - deltaMs);
    this.shot = Math.max(0, this.shot - deltaMs);
    this.strikeLeft = Math.max(0, this.strikeLeft - deltaMs);

    if (view !== this.view || hurting !== this.hurtShown) {
      this.view = view;
      this.hurtShown = hurting;

      const hurt = `${view}Hurt`;

      this.body.texture = this.library.texture(`${this.id}.${hurting && hurt in this.proto.parts ? hurt : view}`);
    }

    this.figure.scale.x = facing === 'left' ? -1 : 1;

    const [left, right] = this.feet;
    let bodyX = 0;
    let bodyY = 0;
    let squash: number;

    if (verb === 'walk' && this.gait === 'scuttle') {
      // De côté : le corps se dandine, les peignes de pattes se lèvent tour à tour.
      this.phase += deltaMs * WALK_RATE * 1.6;

      const lift = Math.sin(this.phase);

      bodyX = lift * 1.2;
      bodyY = -Math.abs(Math.cos(this.phase)) * 0.8;
      squash = 0;
      left.position.set(-this.stride + lift * 1.2, -Math.max(0, lift) * 1.6);
      right.position.set(this.stride + lift * 1.2, -Math.max(0, -lift) * 1.6);
    } else if (verb === 'walk') {
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

    // L'attaque : un bond vers la cible, puis l'atterrissage écrasé.
    const strike = Math.sin((this.strikeLeft / STRIKE_MS) * Math.PI);

    if (this.strikeLeft > 0 && !this.claws) {
      if (view === 'side') bodyX += strike * 4;
      else bodyY += view === 'down' ? strike * 3 : -strike * 3;
      squash -= strike * 0.12;
    }

    this.body.position.set(bodyX, bodyY);
    this.body.scale.set(1 - squash * 0.6, 1 + squash);

    // La charge suit la tête : le rebond du pas, et l'étirement du corps.
    this.load?.position.set(bodyX, bodyY - squash * this.proto.height * this.proto.anchorY);

    if (this.claws) {
      // Les pinces suivent le corps ; à l'attaque, elles se lèvent et claquent.
      const [px, py] = this.proto.pivots?.['claws'] ?? [0, 0];
      const snap = this.strikeLeft > 0 ? Math.abs(Math.sin(this.strikeLeft * 0.05)) : 0;

      this.claws.position.set(
        bodyX + px - this.proto.anchorX * this.proto.width,
        bodyY + py - this.proto.anchorY * this.proto.height - strike * 3,
      );
      this.claws.scale.set(1 + snap * 0.18, 1 - snap * 0.12);
    }

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
export type PuppetId = Extract<SpriteId, 'adam' | 'eve' | 'mutant' | 'kid' | 'worker' | 'crab' | 'wolf'>;
