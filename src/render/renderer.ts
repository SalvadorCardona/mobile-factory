/**
 * Le renderer : la seule chose qui parle à Pixi.
 *
 * Il lit le monde, il ne l'écrit jamais. `draw()` reçoit `alpha`, la fraction
 * du pas de simulation déjà écoulée, et s'en sert pour interpoler — la
 * simulation avance à 20 TPS, l'écran affiche à 60 ou 120 Hz.
 *
 * Deux conteneurs seulement :
 * - `world`, translaté par la caméra, où vit tout ce qui a des coordonnées
 *   monde : le sol baké, l'eau qui bouge par-dessus, les ombres portées, puis le conteneur trié en
 *   profondeur (bâtiments, arbres, rochers, personnages), les particules et
 *   le fantôme de construction ;
 * - `hud`, en pixels écran, où vivent le joystick et les repères de bord.
 *
 * Tout est vectoriel, rastérisé à la résolution de l'écran : aucune texture
 * n'est agrandie, aucune n'est en `nearest`.
 */

import { Application, Container, Sprite } from 'pixi.js';
import { GROUND, hex } from '../data/artDirection.ts';
import type { ItemId } from '../data/items.ts';
import type { JoystickState } from '../input/joystick.ts';
import type { GhostState } from '../input/placement.ts';
import { STEP_MS, type World } from '../sim/world.ts';
import { createAtlas, type Atlas } from './atlas.ts';
import { Camera } from './camera.ts';
import { ChunkLayer } from './chunkLayer.ts';
import { EntityLayer } from './entityLayer.ts';
import { GhostLayer } from './ghostLayer.ts';
import { IndicatorLayer, indicatorSources, type ScreenRect } from './indicatorLayer.ts';
import { ParticleLayer } from './particles.ts';
import { ResourceLayer } from './resourceLayer.ts';
import { SpriteLibrary, type AtlasStats } from './spriteLibrary.ts';
import { TerrainTiles, terrainSources } from './terrainTiles.ts';
import { WaterLayer, type WaterStats } from './waterLayer.ts';

export class GameRenderer {
  public readonly camera = new Camera();

  private readonly worldContainer = new Container();
  private readonly hudContainer = new Container();
  private readonly chunkLayer: ChunkLayer;
  private readonly waterLayer: WaterLayer;
  private readonly shadows = new Container();
  private readonly entityLayer: EntityLayer;
  private readonly resourceLayer: ResourceLayer;
  private readonly ghostLayer: GhostLayer;
  public readonly particles = new ParticleLayer();
  private readonly joystickBase: Sprite;
  private readonly joystickKnob: Sprite;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly indicators: IndicatorLayer;

  public readonly app: Application;

  private readonly world: World;

  private constructor(app: Application, world: World, atlas: Atlas, library: SpriteLibrary) {
    this.app = app;
    this.world = world;
    this.library = library;
    this.tiles = new TerrainTiles(library);
    this.chunkLayer = new ChunkLayer(app.renderer, library, this.tiles, world.seed);
    this.waterLayer = new WaterLayer(this.tiles, world.seed);
    this.entityLayer = new EntityLayer(world, library, this.tiles, this.shadows);
    this.resourceLayer = new ResourceLayer(world, library, this.tiles, this.entityLayer.container, this.shadows);
    this.indicators = new IndicatorLayer(world, library);
    this.ghostLayer = new GhostLayer(world, library);

    this.worldContainer.addChild(
      this.chunkLayer.container,
      this.waterLayer.container,
      this.shadows,
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
    this.hudContainer.addChild(this.indicators.container, this.joystickBase, this.joystickKnob);

    app.stage.addChild(this.worldContainer, this.hudContainer);

    this.camera.centerOn(world.player.x, world.player.y);
  }

  public static async create(world: World, mount: HTMLElement): Promise<GameRenderer> {
    const app = new Application();

    await app.init({
      resizeTo: mount,
      background: hex(GROUND.grass.base),
      // Les sprites arrivent déjà lissés de la rastérisation SVG : l'anticrénelage
      // du framebuffer ne servirait qu'aux barres, et coûte cher sur mobile.
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      // Le doigt est routé par `input/pointer.ts` : on désactive le système
      // d'événements de Pixi plutôt que de le laisser tester la scène pour rien.
      eventMode: 'none',
    });

    mount.append(app.canvas);

    const library = await SpriteLibrary.load([...terrainSources(), ...indicatorSources()]);

    return new GameRenderer(app, world, createAtlas(app.renderer), library);
  }

  public get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  public screenToWorld(x: number, y: number): { x: number; y: number } {
    return this.camera.screenToWorld(x, y);
  }

  public worldToScreen(x: number, y: number): { x: number; y: number } {
    return this.camera.worldToScreen(x, y);
  }

  /**
   * Place occupée par le HUD en haut et en bas de l'écran, et ce qu'il pose le
   * long des bords entre les deux : les repères de bord l'évitent.
   */
  public setHudInsets(top: number, bottom: number, obstacles: readonly ScreenRect[]): void {
    this.indicators.setInsets(top, bottom, obstacles);
  }

  /** La ressource que réclame le conseil : un repère pointe vers son gisement le plus proche. */
  public setObjective(item: ItemId | null): void {
    this.indicators.setObjective(item);
  }

  /** Le repère de la mairie est-il sous ce point écran ? */
  public homeIndicatorAt(x: number, y: number): boolean {
    return this.indicators.homeAt(x, y);
  }

  /** La caméra glisse vers (x, y) monde, s'y attarde une seconde, puis revient sur Adam. */
  public peek(x: number, y: number): void {
    this.camera.peek(x, y);
  }

  /** Recule la caméra un instant : cf. `Camera.zoomOut`. */
  public zoomOut(zoom: number, holdMs: number, focus: { x: number; y: number } | null = null): void {
    this.camera.zoomOut(zoom, holdMs, focus);
  }

  /** Un clic de souris refusé : le fantôme secoue la tête. */
  public refuseGhost(): void {
    this.ghostLayer.refuse();
  }

  /** Secoue la caméra : 0.2 pour un coup, 0.6 pour un effondrement. */
  public shake(amount: number): void {
    this.camera.shake(amount);
  }

  public draw(alpha: number, building: boolean, ghost: GhostState | null, joystick: JoystickState): void {
    const { player } = this.world;

    this.camera.resize(this.app.screen.width, this.app.screen.height);
    // La caméra suit la position interpolée, pas la position de simulation :
    // sinon elle avance par sauts de 7 pixels à 20 TPS. La vitesse, elle, se
    // lit sur le dernier pas : c'est elle qui décide de l'avance.
    this.camera.follow(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
      (player.x - player.prevX) / STEP_MS,
      (player.y - player.prevY) / STEP_MS,
      this.app.ticker.deltaMS,
    );

    // Décalage arrondi au pixel d'écran : une caméra sub-pixel fait scintiller les bords des tuiles.
    const resolution = this.app.renderer.resolution;

    this.worldContainer.position.set(
      Math.round(this.camera.offsetX() * resolution) / resolution,
      Math.round(this.camera.offsetY() * resolution) / resolution,
    );
    this.worldContainer.scale.set(this.camera.zoom);

    this.chunkLayer.update(this.camera);
    this.waterLayer.update(this.camera, this.app.ticker.deltaMS);
    // Un seul appel au juge par frame : le fantôme colore les cases, l'arbre qui gêne clignote.
    const block = building && ghost ? this.world.placementBlock(ghost.building, ghost.tx, ghost.ty) : null;

    this.resourceLayer.update(this.camera, this.app.ticker.deltaMS, block?.reason === 'resource' ? block.tiles : []);
    this.entityLayer.update(alpha, this.app.ticker);
    this.particles.update(this.app.ticker.deltaMS);
    this.ghostLayer.update(building, ghost, block, this.app.ticker.deltaMS);
    this.indicators.update(this.camera, this.app.ticker.deltaMS, alpha);

    this.joystickBase.visible = joystick.active;
    this.joystickKnob.visible = joystick.active;

    if (joystick.active) {
      this.joystickBase.position.set(joystick.originX, joystick.originY);
      this.joystickKnob.position.set(joystick.knobX, joystick.knobY);
    }
  }

  /** Nombre de blocs de sol bakés — le HUD de debug l'affiche. */
  public get bakedChunks(): number {
    return this.chunkLayer.drawn;
  }

  /** Sprites d'eau à l'écran, et combien sont animés — le HUD de debug les affiche. */
  public get waterStats(): WaterStats {
    return this.waterLayer.stats;
  }

  /** Coût de l'atlas de sprites : pages, images, mémoire, temps de chargement. */
  public get atlasStats(): AtlasStats {
    return this.library.stats;
  }

  public destroy(): void {
    this.chunkLayer.destroy();
    this.waterLayer.destroy();
    this.resourceLayer.destroy();
    this.entityLayer.destroy();
    this.ghostLayer.destroy();
    this.indicators.destroy();
    this.particles.destroy();
    this.library.destroy();
    this.app.destroy(true, { children: true });
  }
}
