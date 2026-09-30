/**
 * La météo à l'écran : pluie, vent, brouillard, arc-en-ciel et fleurs.
 *
 * Tout est en particules légères — un `ParticleContainer` par sorte, une
 * seule texture chacun (les morceaux du sprite `weather`), des positions
 * mises à jour à chaque frame et rien d'autre. Les pools sont créés une
 * fois ; seule la météo en cours est affichée et animée : par temps calme,
 * la couche ne coûte rien.
 *
 * Pluie, vent et brouillard vivent en **pixels écran** (dans le HUD Pixi,
 * sous les repères de bord) : leur nombre ne dépend pas du zoom, et les
 * repères restent au-dessus du brouillard. Les fleurs de l'arc-en-ciel
 * poussent dans le **monde**, sur l'herbe autour d'Adam, sous tout ce qui
 * est trié en profondeur.
 *
 * Lisibilité : la pluie et le vent sont translucides et clairsemés, jamais
 * au point de masquer un mutant ; le brouillard, lui, cache ce qui est loin
 * — c'est son rôle — et les repères de bord désignent alors les mutants
 * qu'il avale (`indicatorLayer.ts`).
 *
 * Le hasard d'ici (`Math.random`) est de l'affichage : la simulation ne le
 * voit jamais.
 */

import { Container, Particle, ParticleContainer, Sprite, type Texture } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { WEAPONS } from '../data/weapons.ts';
import { WEATHER, type WeatherId } from '../data/weather.ts';
import { terrainAt } from '../sim/terrain.ts';
import type { WeatherSpell } from '../sim/weather.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';

/** Rayon dégagé du brouillard, en tuiles autour d'Adam : ce que son arc voit encore. */
export const FOG_CLEAR_TILES = WEAPONS.bow.range * WEATHER.fog.weaponRange + 0.5;

/** Ticks de fondu à l'entrée et à la sortie d'une météo. */
const FADE_TICKS = 40;

const RAIN_DROPS = 90;
const RAIN_ALPHA = 0.7;
/** Pixels écran par milliseconde. */
const RAIN_SPEED = 0.9;
const RAIN_SLANT = 0.18;

const GUSTS = 24;
const GUST_ALPHA = 0.6;
const GUST_SPEED = 0.7;

/** Espacement de la grille de bouffées, en pixels écran, et leur agrandissement. */
const PUFF_STEP = 96;
const PUFF_SCALE = 5;
const PUFF_ALPHA = 0.92;
const PUFF_DRIFT = 0.012;
/** Largeur de la frange entre le clair et le brouillard, en pixels écran. */
const FOG_FEATHER = 90;

const RAINBOW_ALPHA = 0.5;

const MAX_BLOOMS = 40;
const BLOOM_EVERY_MS = 160;
const BLOOM_GROW_MS = 520;
const BLOOM_RADIUS_TILES = 7;

interface Drift {
  particle: Particle;
  vx: number;
  vy: number;
}

interface Bloom {
  particle: Particle;
  age: number;
  /** Faux tant que l'arc-en-ciel brille ; vrai quand la fleur se referme. */
  closing: boolean;
}

export class WeatherLayer {
  /** En pixels écran, sous les repères de bord. */
  public readonly screen = new Container();
  /** En pixels monde, entre les ombres et le conteneur trié. */
  public readonly ground: ParticleContainer;

  private readonly world: World;
  private readonly rain: ParticleContainer;
  private readonly wind: ParticleContainer;
  private readonly fog: ParticleContainer;
  private readonly rainbow: Sprite;
  private readonly drops: Drift[] = [];
  private readonly gusts: Drift[] = [];
  private readonly puffs: Drift[] = [];
  private readonly blooms: Bloom[] = [];
  private readonly textures: { drop: Texture; gust: Texture; puff: Texture; bloom: Texture };

  private width = 0;
  private height = 0;
  private windStart = -1;
  private bloomClock = 0;

  public constructor(world: World, library: SpriteLibrary) {
    this.world = world;
    this.textures = {
      drop: library.part('weather', 'drop'),
      gust: library.part('weather', 'gust'),
      puff: library.part('weather', 'puff'),
      bloom: library.part('weather', 'bloom'),
    };

    const moving = { position: true, rotation: false, vertex: false, color: false, uvs: false };

    this.rain = new ParticleContainer({ texture: this.textures.drop, dynamicProperties: moving });
    this.wind = new ParticleContainer({ texture: this.textures.gust, dynamicProperties: moving });
    this.fog = new ParticleContainer({
      texture: this.textures.puff,
      dynamicProperties: { ...moving, color: true },
    });
    this.ground = new ParticleContainer({
      texture: this.textures.bloom,
      dynamicProperties: { position: false, rotation: false, vertex: true, color: false, uvs: false },
    });

    this.rainbow = new Sprite(library.part('rainbow', 'arc'));
    this.rainbow.anchor.set(0.5, 1);

    for (const layer of [this.rain, this.wind, this.fog, this.rainbow]) layer.visible = false;
    this.screen.addChild(this.rainbow, this.rain, this.wind, this.fog);
  }

  public update(camera: Camera, deltaMs: number, alpha: number): void {
    const spell = this.world.weather();
    const id: WeatherId | null = spell?.id ?? null;
    const intensity = spell ? fade(spell, this.world.tickCount + alpha) : 0;

    this.resize(camera.viewWidth, camera.viewHeight);

    this.rain.visible = id === 'acidRain';
    this.wind.visible = id === 'wind';
    this.fog.visible = id === 'fog';
    this.rainbow.visible = id === 'rainbow';

    if (spell && id === 'acidRain') this.updateRain(deltaMs, intensity);
    if (spell && id === 'wind') this.updateWind(spell, deltaMs, intensity);
    if (id === 'fog') this.updateFog(camera, deltaMs, alpha, intensity);
    if (id === 'rainbow') this.updateRainbow(intensity);

    this.updateBlooms(deltaMs, id === 'rainbow');
  }

  /* ------------------------------------------------------------------ pluie */

  private updateRain(deltaMs: number, intensity: number): void {
    this.rain.alpha = RAIN_ALPHA * intensity;

    for (const drop of this.drops) {
      const p = drop.particle;

      p.x += drop.vx * deltaMs;
      p.y += drop.vy * deltaMs;
      if (p.y > this.height + 20) {
        p.y -= this.height + 40;
        p.x = Math.random() * (this.width + 60) - 30;
      }
      if (p.x > this.width + 30) p.x -= this.width + 60;
    }
  }

  /* ------------------------------------------------------------------- vent */

  private updateWind(spell: WeatherSpell, deltaMs: number, intensity: number): void {
    // La direction des traits ne change qu'avec le coup de vent : une remise à jour des propriétés fixes, pas une par frame.
    if (spell.start !== this.windStart) {
      this.windStart = spell.start;

      const rotation = Math.atan2(spell.windY, spell.windX);

      for (const gust of this.gusts) {
        const speed = GUST_SPEED * (0.7 + Math.random() * 0.6);

        gust.vx = spell.windX * speed;
        gust.vy = spell.windY * speed;
        gust.particle.rotation = rotation;
      }
      this.wind.update();
    }

    this.wind.alpha = GUST_ALPHA * intensity;

    for (const gust of this.gusts) {
      const p = gust.particle;

      p.x += gust.vx * deltaMs;
      p.y += gust.vy * deltaMs;
      wrap(p, this.width, this.height, 60);
    }
  }

  /* -------------------------------------------------------------- brouillard */

  private updateFog(camera: Camera, deltaMs: number, alpha: number, intensity: number): void {
    const { player } = this.world;
    const adam = camera.worldToScreen(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
    );
    const clear = FOG_CLEAR_TILES * TILE_SIZE * camera.zoom;

    for (const puff of this.puffs) {
      const p = puff.particle;

      p.x += puff.vx * deltaMs;
      p.y += puff.vy * deltaMs;
      wrap(p, this.width, this.height, PUFF_STEP);

      const distance = Math.hypot(p.x - adam.x, p.y - adam.y);

      p.alpha = PUFF_ALPHA * intensity * Math.min(1, Math.max(0, (distance - clear) / FOG_FEATHER));
    }
  }

  /* ------------------------------------------------------------ arc-en-ciel */

  private updateRainbow(intensity: number): void {
    const scale = Math.min(3, (this.width * 0.95) / this.rainbow.texture.width);

    this.rainbow.scale.set(scale);
    this.rainbow.position.set(this.width / 2, this.height * 0.52);
    this.rainbow.alpha = RAINBOW_ALPHA * intensity;
  }

  /** Des touffes de fleurs poussent sur l'herbe autour d'Adam, et se referment quand l'arc-en-ciel passe. */
  private updateBlooms(deltaMs: number, shining: boolean): void {
    if (shining) {
      this.bloomClock += deltaMs;
      while (this.bloomClock >= BLOOM_EVERY_MS) {
        this.bloomClock -= BLOOM_EVERY_MS;
        if (this.blooms.length < MAX_BLOOMS) this.plantBloom();
      }
    }

    for (let i = this.blooms.length - 1; i >= 0; i -= 1) {
      const bloom = this.blooms[i]!;

      if (!shining) bloom.closing = true;
      bloom.age += bloom.closing ? -deltaMs * 2 : deltaMs;

      if (bloom.closing && bloom.age <= 0) {
        this.ground.removeParticle(bloom.particle);
        this.blooms.splice(i, 1);
        continue;
      }

      const scale = popIn(Math.min(1, bloom.age / BLOOM_GROW_MS));

      bloom.particle.scaleX = scale;
      bloom.particle.scaleY = scale;
    }
  }

  private plantBloom(): void {
    const { player } = this.world;
    const tx = Math.floor(player.x / TILE_SIZE + (Math.random() * 2 - 1) * BLOOM_RADIUS_TILES);
    const ty = Math.floor(player.y / TILE_SIZE + (Math.random() * 2 - 1) * BLOOM_RADIUS_TILES);

    if (terrainAt(this.world.seed, tx, ty) !== 'grass' || this.world.isSolid(tx, ty)) return;

    const particle = new Particle({
      texture: this.textures.bloom,
      x: (tx + 0.2 + Math.random() * 0.6) * TILE_SIZE,
      y: (ty + 0.3 + Math.random() * 0.6) * TILE_SIZE,
      anchorX: 0.5,
      anchorY: 0.8,
      scaleX: 0,
      scaleY: 0,
    });

    this.ground.addParticle(particle);
    this.blooms.push({ particle, age: 0, closing: false });
  }

  /* ----------------------------------------------------------------- pools */

  /** Les pools suivent la taille de l'écran : assez de gouttes et de bouffées pour le couvrir, pas plus. */
  private resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;

    fill(this.rain, this.drops, RAIN_DROPS, () => {
      const speed = RAIN_SPEED * (0.8 + Math.random() * 0.4);

      return {
        particle: new Particle({
          texture: this.textures.drop,
          x: Math.random() * width,
          y: Math.random() * height,
          anchorX: 0.5,
          anchorY: 0.5,
          rotation: -RAIN_SLANT,
          scaleX: 0.8,
          scaleY: 0.8 + Math.random() * 0.4,
        }),
        vx: speed * RAIN_SLANT,
        vy: speed,
      };
    });

    fill(this.wind, this.gusts, GUSTS, () => ({
      particle: new Particle({
        texture: this.textures.gust,
        x: Math.random() * width,
        y: Math.random() * height,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: 1.4 + Math.random() * 0.8,
        scaleY: 1,
      }),
      vx: 0,
      vy: 0,
    }));
    this.windStart = -1;

    // Une grille décalée de bouffées, un peu plus grande que l'écran.
    const cols = Math.ceil(width / PUFF_STEP) + 2;
    const rows = Math.ceil(height / PUFF_STEP) + 2;
    let index = 0;

    fill(this.fog, this.puffs, cols * rows, () => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      index += 1;
      return {
        particle: new Particle({
          texture: this.textures.puff,
          x: (col - 1 + (row % 2) * 0.5 + Math.random() * 0.3) * PUFF_STEP,
          y: (row - 1 + Math.random() * 0.3) * PUFF_STEP,
          anchorX: 0.5,
          anchorY: 0.5,
          scaleX: PUFF_SCALE * (0.9 + Math.random() * 0.3),
          scaleY: PUFF_SCALE * (0.8 + Math.random() * 0.3),
          alpha: 0,
        }),
        vx: PUFF_DRIFT * (0.6 + Math.random() * 0.8),
        vy: PUFF_DRIFT * (Math.random() - 0.5) * 0.4,
      };
    });
  }

  /** Nombre de particules affichées — le panneau de debug le montre. */
  public get particleCount(): number {
    return (
      (this.rain.visible ? this.drops.length : 0) +
      (this.wind.visible ? this.gusts.length : 0) +
      (this.fog.visible ? this.puffs.length : 0) +
      this.blooms.length
    );
  }

  public destroy(): void {
    this.screen.destroy({ children: true });
    this.ground.destroy();
  }
}

/** Vide le pool et le remplit de `count` particules neuves. */
function fill(container: ParticleContainer, pool: Drift[], count: number, make: () => Drift): void {
  container.removeParticles();
  pool.length = 0;
  for (let i = 0; i < count; i += 1) {
    const drift = make();

    pool.push(drift);
    container.addParticle(drift.particle);
  }
}

/** Une particule sortie de l'écran (marge comprise) revient par le bord opposé. */
function wrap(p: Particle, width: number, height: number, margin: number): void {
  if (p.x > width + margin) p.x -= width + margin * 2;
  else if (p.x < -margin) p.x += width + margin * 2;
  if (p.y > height + margin) p.y -= height + margin * 2;
  else if (p.y < -margin) p.y += height + margin * 2;
}

/** De 0 à 1 à l'entrée d'une météo, de 1 à 0 à sa sortie. */
function fade(spell: WeatherSpell, tick: number): number {
  return Math.max(0, Math.min(1, (tick - spell.start) / FADE_TICKS, (spell.end - tick) / FADE_TICKS));
}

/** Une pousse qui dépasse un peu sa taille avant de s'y poser. */
function popIn(t: number): number {
  const s = 1.7;
  const u = t - 1;

  return 1 + (s + 1) * u * u * u + s * u * u;
}
