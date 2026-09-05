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
 * Les animations sont pilotées par le ticker du renderer, pas par le ticker
 * partagé de Pixi : une seule horloge, celle qu'on contrôle.
 *
 * Tri en profondeur : les enfants sont ordonnés par le bas de leur emprise,
 * pour qu'Adam passe derrière la mairie quand il est au-dessus d'elle et
 * devant quand il est en dessous.
 */

import { AnimatedSprite, Container, Graphics, Sprite, type Texture, type Ticker, TilingSprite } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Entity, EntityId, Facing } from '../sim/types.ts';
import { siteMissing, type World } from '../sim/world.ts';
import { SPRITE_SCALE, type AnimationFrames, type SpriteLibrary } from './spriteLibrary.ts';

/** Dessous de la boîte de collision d'Adam, pour le tri en profondeur. */
const PLAYER_FOOT = 7;

const PROGRESS_BG = 0x11161d;
const PROGRESS_FG = 0x7fc8a9;

interface EntityView {
  root: Container;
  /** Sprite animé du bâtiment fini, s'il en a un (la foreuse). */
  animated: AnimatedSprite | null;
  /** Barre d'avancement d'un chantier. */
  progress: Graphics | null;
}

export class EntityLayer {
  public readonly container = new Container();

  private readonly views = new Map<EntityId, EntityView>();
  private readonly player: AnimatedSprite;
  private playerAnimation = '';

  private readonly world: World;
  private readonly library: SpriteLibrary;

  public constructor(world: World, library: SpriteLibrary) {
    this.world = world;
    this.library = library;
    this.container.sortableChildren = true;

    const adam = SPRITES.adam;

    this.player = new AnimatedSprite({ textures: library.animation('adam', 'idleDown').textures, autoUpdate: false });
    this.player.anchor.set(adam.anchorX, adam.anchorY);
    this.player.scale.set(SPRITE_SCALE);
    this.container.addChild(this.player);

    world.events.on('buildingPlaced', ({ id }) => this.add(id));
    world.events.on('buildingCompleted', ({ id }) => this.replace(id));
    for (const id of world.entities.keys()) this.add(id);
  }

  private add(id: EntityId): void {
    const entity = this.world.entities.get(id);

    if (!entity || this.views.has(id)) return;

    const view = this.build(entity);

    view.root.position.set(entity.tx * TILE_SIZE, entity.ty * TILE_SIZE);
    view.root.zIndex = (entity.ty + entity.height) * TILE_SIZE;
    this.views.set(id, view);
    this.container.addChild(view.root);
  }

  private replace(id: EntityId): void {
    const view = this.views.get(id);

    if (view) {
      view.root.destroy({ children: true });
      this.views.delete(id);
    }
    this.add(id);
  }

  private build(entity: Entity): EntityView {
    const root = new Container();

    if (entity.kind === 'site') {
      const tile = this.library.still('site', 'idle');
      const ground = new TilingSprite({
        texture: tile,
        width: entity.width * TILE_SIZE,
        height: entity.height * TILE_SIZE,
      });

      ground.tileScale.set(SPRITE_SCALE);

      // Le bâtiment à venir, en filigrane : on voit ce qu'on construit.
      const preview = new Sprite(this.library.still(BUILDINGS[entity.proto].sprite, 'idle'));

      preview.scale.set(SPRITE_SCALE);
      preview.alpha = 0.35;

      const progress = new Graphics();

      root.addChild(ground, preview, progress);
      this.drawProgress(progress, entity);

      return { root, animated: null, progress };
    }

    const proto = BUILDINGS[entity.proto];
    const frames: AnimationFrames =
      entity.kind === 'drill' && entity.output
        ? this.library.animation('drill', 'work')
        : this.library.animation(proto.sprite, 'idle');
    const sprite = animated(frames);

    // Une foreuse posée hors gisement reste visible, mais délavée : le joueur
    // doit comprendre pourquoi elle ne produit rien sans ouvrir un panneau.
    if (entity.kind === 'drill' && !entity.output) sprite.alpha = 0.45;

    root.addChild(sprite);
    return { root, animated: sprite, progress: null };
  }

  private drawProgress(graphics: Graphics, entity: Entity): void {
    if (entity.kind !== 'site') return;

    const total = Object.values(BUILDINGS[entity.proto].cost).reduce((sum, amount) => sum + amount, 0);
    const done = total === 0 ? 1 : 1 - siteMissing(entity) / total;
    const width = entity.width * TILE_SIZE - 8;
    const y = entity.height * TILE_SIZE - 8;

    graphics
      .clear()
      .rect(4, y, width, 4)
      .fill(PROGRESS_BG)
      .rect(4, y, Math.round(width * done), 4)
      .fill(PROGRESS_FG);
  }

  /** `alpha` est la fraction du pas de simulation déjà écoulée, dans [0, 1[. */
  public update(alpha: number, ticker: Ticker): void {
    const { player } = this.world;

    this.player.position.set(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
    );
    this.player.zIndex = this.player.y + PLAYER_FOOT;
    this.animatePlayer(player.facing, player.moving);
    this.player.update(ticker);

    for (const [id, view] of this.views) {
      const entity = this.world.entities.get(id);

      if (!entity) {
        view.root.destroy({ children: true });
        this.views.delete(id);
        continue;
      }

      if (view.progress) this.drawProgress(view.progress, entity);

      if (view.animated) {
        view.animated.update(ticker);

        if (entity.kind === 'drill') {
          const working = entity.output !== null && !entity.blocked;
          const frames = this.library.animation('drill', working ? 'work' : 'idle');

          if (view.animated.textures !== frames.textures) setFrames(view.animated, frames);
        }
      }
    }
  }

  /** Choisit l'animation d'Adam ; ne la relance que si elle change, sinon elle bégaierait. */
  private animatePlayer(facing: Facing, moving: boolean): void {
    const side = facing === 'left' || facing === 'right';
    const name = `${moving ? 'walk' : 'idle'}${side ? 'Side' : facing === 'up' ? 'Up' : 'Down'}` as const;

    // Les images de profil regardent à droite ; à gauche, on retourne le sprite.
    this.player.scale.x = facing === 'left' ? -SPRITE_SCALE : SPRITE_SCALE;

    if (name === this.playerAnimation) return;
    this.playerAnimation = name;
    setFrames(this.player, this.library.animation('adam', name));
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

function animated(frames: AnimationFrames): AnimatedSprite {
  const sprite = new AnimatedSprite({ textures: frames.textures, autoUpdate: false });

  sprite.scale.set(SPRITE_SCALE);
  setFrames(sprite, frames);
  return sprite;
}

/** `animationSpeed` est relatif à 60 images/s : 8 fps ⇒ 8/60. */
function setFrames(sprite: AnimatedSprite, frames: AnimationFrames): void {
  const textures: Texture[] = frames.textures;

  sprite.textures = textures;
  sprite.loop = frames.loop;
  sprite.animationSpeed = frames.fps / 60;

  if (textures.length > 1) sprite.gotoAndPlay(0);
  else sprite.gotoAndStop(0);
}
