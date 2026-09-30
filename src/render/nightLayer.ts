/**
 * La nuit : une seule passe de teinte, et quelques lueurs par-dessus.
 *
 * L'heure se lit dans la simulation (`world.clock()`, `sim/dayNight.ts`) ;
 * ici, on ne fait qu'appliquer sa part de nuit (`darkness`, de 0 à 1).
 *
 * - **Le ciel** : un seul grand sprite en fusion `multiply`, centré sur
 *   Adam. Il multiplie la carte par l'indigo-violet de `NIGHT_TINT.sky` —
 *   les couleurs glissent vers le violet sans jamais tomber au noir — et par
 *   une lavande claire dans un disque autour d'Adam : sa vision. Son alpha
 *   suit la part de nuit, ce qui fond la teinte au crépuscule et à l'aube.
 * - **Les lueurs** : des disques en fusion `add`. Jaunes sur chaque bâtiment
 *   fini — les fenêtres et les lampions de la colonie s'allument — et vert
 *   fluo autour de chaque mutant, famille réservée : dans le noir bleuté, ils
 *   se voient de loin.
 *
 * Pas de filtre, pas de texture de lumière rendue à chaque image : un quad
 * multiplié et une poignée de sprites additifs. Les textures sont bakées une
 * fois, en basse définition, et agrandies : le filtrage linéaire adoucit
 * les bords pour rien. De jour, le conteneur est invisible et ne coûte rien.
 */

import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, hex } from '../data/artDirection.ts';
import { NIGHT_TINT } from '../data/dayNight.ts';
import { darkness } from '../sim/dayNight.ts';
import type { World } from '../sim/world.ts';

/** Pixels monde par texel des textures de nuit : elles sont agrandies d'autant. */
const TEXEL = 16;

/** Demi-côté du ciel, en pixels monde : de quoi couvrir un grand écran, même caméra en avance. */
const SKY_HALF = 2560;

/** Anneaux du bord de la vision, du ciel à la lavande : un fondu en aplats, pas un dégradé. */
const VISION_RINGS = 4;

/** Rayon, en texels, du disque de lueur baké. */
const GLOW_TEXELS = 8;

/** Le halo d'un mutant est centré sur son corps, pas sur ses pieds. */
const HALO_RISE = 12;

export class NightLayer {
  public readonly container = new Container();

  private readonly sky: Sprite;
  private readonly glow: Texture;
  private readonly lamps = new Container();
  private readonly halos = new Container();
  private readonly world: World;

  public constructor(renderer: Renderer, world: World) {
    this.world = world;

    this.sky = new Sprite(bakeSky(renderer));
    this.sky.anchor.set(0.5);
    this.sky.scale.set(TEXEL);
    this.sky.blendMode = 'multiply';

    this.glow = bakeGlow(renderer);
    this.lamps.blendMode = 'add';
    this.halos.blendMode = 'add';

    this.container.addChild(this.sky, this.lamps, this.halos);
    this.container.visible = false;
  }

  public update(alpha: number): void {
    const clock = this.world.clock();
    const dark = clock ? darkness(clock) : 0;

    this.container.visible = dark > 0;
    if (dark <= 0) return;

    const { player } = this.world;

    this.sky.alpha = dark;
    this.sky.position.set(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
    );

    let lamps = 0;

    for (const entity of this.world.entities.values()) {
      if (entity.kind === 'site') continue;

      const radius = (Math.max(entity.width, entity.height) / 2 + NIGHT_TINT.lampRadius) * TILE_SIZE;

      this.place(
        this.lamps,
        lamps++,
        (entity.tx + entity.width / 2) * TILE_SIZE,
        (entity.ty + entity.height / 2) * TILE_SIZE,
        radius,
        hex(NIGHT_TINT.lamp),
        dark * NIGHT_TINT.lampStrength,
      );
    }

    let halos = 0;

    for (const mobile of this.world.mobiles.values()) {
      if (mobile.kind !== 'mutant') continue;

      this.place(
        this.halos,
        halos++,
        mobile.prevX + (mobile.x - mobile.prevX) * alpha,
        mobile.prevY + (mobile.y - mobile.prevY) * alpha - HALO_RISE,
        NIGHT_TINT.haloRadius * TILE_SIZE,
        hex(NIGHT_TINT.halo),
        dark * NIGHT_TINT.haloStrength,
      );
    }

    hideFrom(this.lamps, lamps);
    hideFrom(this.halos, halos);
  }

  /** Pose la lueur numéro `index` du groupe, en la créant au besoin : les sprites sont recyclés. */
  private place(group: Container, index: number, x: number, y: number, radius: number, tint: number, strength: number): void {
    let sprite = group.children[index] as Sprite | undefined;

    if (!sprite) {
      sprite = new Sprite(this.glow);
      sprite.anchor.set(0.5);
      group.addChild(sprite);
    }

    sprite.visible = true;
    sprite.position.set(x, y);
    sprite.scale.set(radius / GLOW_TEXELS);
    sprite.tint = tint;
    sprite.alpha = strength;
  }

  public destroy(): void {
    this.sky.texture.destroy(true);
    this.glow.destroy(true);
    this.container.destroy({ children: true });
  }
}

function hideFrom(group: Container, count: number): void {
  for (let i = count; i < group.children.length; i += 1) group.children[i]!.visible = false;
}

/**
 * Le ciel de nuit, en texels : un grand carré `sky`, et au centre la vision
 * d'Adam, `vision`, bordée de quelques anneaux qui passent de l'un à l'autre.
 */
function bakeSky(renderer: Renderer): Texture {
  const half = SKY_HALF / TEXEL;
  const radius = (NIGHT_TINT.visionRadius * TILE_SIZE) / TEXEL;
  const sky = hex(NIGHT_TINT.sky);
  const vision = hex(NIGHT_TINT.vision);
  const graphics = new Graphics().rect(0, 0, half * 2, half * 2).fill(sky);

  for (let ring = 1; ring <= VISION_RINGS; ring += 1) {
    const t = ring / VISION_RINGS;

    graphics.circle(half, half, radius * (1.5 - 0.5 * t)).fill(mix(sky, vision, t));
  }
  return bake(renderer, graphics);
}

/** Une lueur : des disques blancs empilés, plus denses au centre. Teinte et force viennent du sprite. */
function bakeGlow(renderer: Renderer): Texture {
  const graphics = new Graphics();
  const steps = 5;

  for (let step = 0; step < steps; step += 1) {
    graphics.circle(GLOW_TEXELS, GLOW_TEXELS, GLOW_TEXELS * (1 - step / steps)).fill({ color: hex(PALETTE.paper.base), alpha: 0.25 });
  }
  return bake(renderer, graphics);
}

function bake(renderer: Renderer, graphics: Graphics): Texture {
  const texture = renderer.generateTexture({ target: graphics, antialias: true, resolution: 1 });

  graphics.destroy();
  return texture;
}

/** Mélange deux couleurs `0xrrggbb`, canal par canal. */
function mix(from: number, to: number, t: number): number {
  let out = 0;

  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;

    out |= Math.round(a + (b - a) * t) << shift;
  }
  return out;
}
