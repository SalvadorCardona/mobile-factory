/**
 * Le renderer : la seule chose qui parle à Pixi.
 *
 * Il lit le monde, il ne l'écrit jamais. `draw()` reçoit `alpha`, la fraction
 * du pas de simulation déjà écoulée, et s'en sert pour interpoler — la
 * simulation avance à 20 TPS, l'écran affiche à 60 ou 120 Hz.
 *
 * Deux conteneurs seulement :
 * - `world`, translaté par la caméra, où vit tout ce qui a des coordonnées monde ;
 * - `hud`, en pixels écran, où vit le joystick.
 */

import { Application, Container, Sprite, TextureSource } from 'pixi.js';
import type { JoystickState } from '../input/joystick.ts';
import type { GhostState } from '../input/placement.ts';
import type { World } from '../sim/world.ts';
import { createAtlas, type Atlas } from './atlas.ts';
import { Camera } from './camera.ts';
import { ChunkLayer } from './chunkLayer.ts';
import { EntityLayer } from './entityLayer.ts';
import { GhostLayer } from './ghostLayer.ts';
import { ParticleLayer } from './particles.ts';
import { SpriteLibrary } from './spriteLibrary.ts';

export class GameRenderer {
  public readonly camera = new Camera();

  private readonly worldContainer = new Container();
  private readonly hudContainer = new Container();
  private readonly chunkLayer: ChunkLayer;
  private readonly entityLayer: EntityLayer;
  private readonly ghostLayer: GhostLayer;
  public readonly particles = new ParticleLayer();
  private readonly joystickBase: Sprite;
  private readonly joystickKnob: Sprite;
  private readonly library: SpriteLibrary;

  public readonly app: Application;

  private readonly world: World;

  private constructor(app: Application, world: World, atlas: Atlas, library: SpriteLibrary) {
    this.app = app;
    this.world = world;
    this.library = library;
    this.chunkLayer = new ChunkLayer(app.renderer, library);
    this.entityLayer = new EntityLayer(world, library);
    this.ghostLayer = new GhostLayer(world, library);

    this.worldContainer.addChild(
      this.chunkLayer.container,
      this.entityLayer.container,
      this.particles.container,
      this.ghostLayer.container,
    );

    this.joystickBase = new Sprite(atlas.joystickBase);
    this.joystickKnob = new Sprite(atlas.joystickKnob);
    this.joystickBase.anchor.set(0.5);
    this.joystickKnob.anchor.set(0.5);
    this.joystickBase.visible = false;
    this.joystickKnob.visible = false;
    this.hudContainer.addChild(this.joystickBase, this.joystickKnob);

    app.stage.addChild(this.worldContainer, this.hudContainer);

    this.camera.centerOn(world.player.x, world.player.y);
  }

  public static async create(world: World, mount: HTMLElement, baseUrl: string): Promise<GameRenderer> {
    // Pixel art : aucune texture n'est jamais lissée. Réglé avant la moindre
    // création de texture, RenderTextures des chunks comprises.
    TextureSource.defaultOptions.scaleMode = 'nearest';

    const app = new Application();

    await app.init({
      resizeTo: mount,
      background: 0x11161d,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      // Le doigt est routé par `input/pointer.ts` : on désactive le système
      // d'événements de Pixi plutôt que de le laisser tester la scène pour rien.
      eventMode: 'none',
    });

    mount.append(app.canvas);

    const library = await SpriteLibrary.load(app.renderer, baseUrl);

    return new GameRenderer(app, world, createAtlas(app.renderer), library);
  }

  public get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  public screenToWorld(x: number, y: number): { x: number; y: number } {
    return this.camera.screenToWorld(x, y);
  }

  public draw(alpha: number, building: boolean, ghost: GhostState | null, joystick: JoystickState): void {
    const { player } = this.world;

    this.camera.resize(this.app.screen.width, this.app.screen.height);
    // La caméra suit la position interpolée, pas la position de simulation :
    // sinon elle avance par sauts de 7 pixels à 20 TPS.
    this.camera.centerOn(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
    );

    // Décalage arrondi au pixel : une caméra sub-pixel fait vibrer le pixel art.
    this.worldContainer.position.set(Math.round(this.camera.offsetX()), Math.round(this.camera.offsetY()));
    this.worldContainer.scale.set(this.camera.zoom);

    this.chunkLayer.update(this.world, this.camera);
    this.entityLayer.update(alpha, this.app.ticker);
    this.particles.update(this.app.ticker.deltaMS);
    this.ghostLayer.update(building, ghost);

    this.joystickBase.visible = joystick.active;
    this.joystickKnob.visible = joystick.active;

    if (joystick.active) {
      this.joystickBase.position.set(joystick.originX, joystick.originY);
      this.joystickKnob.position.set(joystick.knobX, joystick.knobY);
    }
  }

  /** Nombre de chunks bakés — le HUD l'affiche. */
  public get bakedChunks(): number {
    return this.chunkLayer.drawn;
  }

  public destroy(): void {
    this.chunkLayer.destroy();
    this.entityLayer.destroy();
    this.ghostLayer.destroy();
    this.particles.destroy();
    this.library.destroy();
    this.app.destroy(true, { children: true });
  }
}
