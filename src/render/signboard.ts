/**
 * Les pancartes des bâtiments : un panneau planté au pied de la façade, qui
 * dit son nom court et, d'une icône, ce qu'il produit ou consomme
 * (`signs.ts` décide quoi et à quel zoom).
 *
 * Vue de 3/4 comme les façades : le panneau fait face à la caméra, une
 * capsule blanche et sa face avant lavande — les couleurs des cartes du HUD
 * —, posée sur deux piquets indigo. Une pancarte n'a pas de vie propre :
 * c'est un sprite du bâtiment (`entityLayer.ts`), qui bouge, se trie et
 * disparaît avec lui.
 *
 * Une texture par (bâtiment, objet, mode, langue), dessinée une fois et
 * partagée par tous les bâtiments du même type : le texte n'est jamais
 * remis en page à la frame, et cent foreuses de charbon font cent sprites
 * d'une seule texture. Elle est rendue à la densité de l'écran fois le zoom
 * le plus fort, pour rester nette quand on avance.
 *
 * Fredoka arrive avec les feuilles de style : tant qu'elle n'est pas chargée,
 * une pancarte s'écrit dans la police de repli, puis toutes se redessinent
 * (`generation` change, et avec elle la clé de chaque texture).
 */

import { Container, Graphics, Rectangle, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import { PALETTE, hex } from '../data/artDirection.ts';
import { ICON_SIZE } from '../data/icons.ts';
import type { ItemId } from '../data/items.ts';
import { ZOOM } from './camera.ts';
import type { SignMode } from './signs.ts';
import { screenResolution, type SpriteLibrary } from './spriteLibrary.ts';

/** Taille du nom et côté de l'icône, en pixels monde. */
const FONT = 9;
const ICON = 11;
/** Hauteur du panneau, marge intérieure, écart icône–nom. */
const HEIGHT = 13;
const PAD = 4;
const GAP = 2;
/** La face avant, plus sombre, sous le panneau : son épaisseur. */
const FACE = 2;
/** Les piquets : largeur, hauteur sous le panneau, retrait depuis chaque bord. */
const POST_W = 2;
const POST_H = 3;
const POST_INSET = 5;

const FONT_WEIGHT = '600';
const FONT_FAMILY = 'Fredoka';

const INK = hex(PALETTE.ink.base);

export class Signboards {
  private readonly textures = new Map<string, Texture>();
  /** Les textures d'avant le chargement de la police : gardées jusqu'au bout, des sprites les montrent encore une frame. */
  private readonly stale: Texture[] = [];
  private readonly renderer: Renderer;
  private readonly library: SpriteLibrary;
  private readonly resolution = screenResolution() * ZOOM.max;
  /** Change quand la police arrive : la clé de chaque texture avec. */
  public generation = 0;

  public constructor(renderer: Renderer, library: SpriteLibrary) {
    this.renderer = renderer;
    this.library = library;

    const font = `${FONT_WEIGHT} ${FONT}px ${FONT_FAMILY}`;

    if (typeof document === 'undefined' || !document.fonts || document.fonts.check(font)) return;
    document.fonts
      .load(font)
      .then(() => {
        this.stale.push(...this.textures.values());
        this.textures.clear();
        this.generation += 1;
      })
      .catch(() => {
        // Hors ligne et sans cache : la police de repli fera l'affaire.
      });
  }

  /** La texture d'une pancarte : `name` et l'icône de `item` (`full`), ou l'icône seule (`icon`). */
  public texture(name: string, item: ItemId | null, mode: Exclude<SignMode, 'none'>): Texture {
    const key = `${mode}:${item ?? ''}:${mode === 'full' ? name : ''}`;
    const cached = this.textures.get(key);

    if (cached) return cached;

    const texture = this.draw(mode === 'full' ? name : null, item);

    this.textures.set(key, texture);
    return texture;
  }

  /** Panneau, face avant, piquets, puis icône et nom : rendus une fois dans une texture. */
  private draw(name: string | null, item: ItemId | null): Texture {
    const board = new Container();
    const back = new Graphics();
    const text =
      name === null
        ? null
        : new Text({
            text: name,
            style: { fontFamily: FONT_FAMILY, fontWeight: FONT_WEIGHT, fontSize: FONT, fill: INK },
            resolution: this.resolution,
          });
    const icon = item === null ? null : new Sprite(this.library.part('loot', item));
    const content = (icon ? ICON : 0) + (icon && text ? GAP : 0) + (text ? Math.ceil(text.width) : 0);
    const width = Math.max(HEIGHT, content + PAD * 2);
    const height = HEIGHT + FACE + POST_H;

    // Les piquets d'abord : le panneau les recouvre en haut.
    for (const x of width > POST_INSET * 4 ? [POST_INSET, width - POST_INSET - POST_W] : [(width - POST_W) / 2]) {
      back.rect(x, HEIGHT, POST_W, FACE + POST_H).fill(INK);
    }
    back
      .roundRect(0, 0, width, HEIGHT + FACE, HEIGHT / 2)
      .fill(hex(PALETTE.paper.shade))
      .roundRect(0, 0, width, HEIGHT, HEIGHT / 2)
      .fill(hex(PALETTE.paper.base));
    board.addChild(back);

    let left = (width - content) / 2;

    if (icon) {
      icon.anchor.set(0.5);
      icon.scale.set(ICON / ICON_SIZE);
      icon.position.set(left + ICON / 2, HEIGHT / 2);
      board.addChild(icon);
      left += ICON + GAP;
    }
    if (text) {
      text.anchor.set(0, 0.5);
      text.position.set(left, HEIGHT / 2 + 0.5);
      board.addChild(text);
    }

    const texture = this.renderer.generateTexture({
      target: board,
      frame: new Rectangle(0, 0, width, height),
      resolution: this.resolution,
      antialias: true,
    });

    board.destroy({ children: true });
    return texture;
  }

  public destroy(): void {
    for (const texture of [...this.textures.values(), ...this.stale]) texture.destroy(true);
    this.textures.clear();
    this.stale.length = 0;
  }
}
