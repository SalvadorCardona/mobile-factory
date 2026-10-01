/**
 * L'eau qui bouge : l'écume des rives et les vaguelettes du large.
 *
 * Le sol est baké une fois par bloc et ne l'est jamais plus (`chunkLayer.ts`) :
 * ce qui bouge ne peut pas y vivre. L'écume et les vaguelettes sont donc des
 * sprites de l'atlas, posés au-dessus du sol baké, sous les ombres portées —
 * tous sur la même page, un appel de dessin.
 *
 * Rien ne glisse ni ne s'allume : tout vit par la taille, sans transparence.
 * - L'**écume** borde chaque côté de tuile d'eau qui touche la rive : une
 *   rangée de bulles qui gonfle et monte d'un pas sur la rive, puis se
 *   retire, avec un déphasage le long de la rive — le ressac qui court.
 * - Les **vaguelettes** vivent sur une tuile du large sur huit : un croissant
 *   naît de rien, dérive de quelques pixels avec le vent en grandissant, puis
 *   se résorbe ; il renaît ailleurs dans sa tuile, à son propre rythme — pas
 *   de motif, pas de battement d'ensemble.
 *
 * Coût tenu ici, par les mêmes blocs de 16 × 16 tuiles que le sol :
 * - un bloc n'existe que s'il touche l'écran, et il est détruit avec la
 *   même marge d'éviction que le sol ;
 * - un bloc hors de l'écran est caché et n'est pas animé ; dans un bloc
 *   visible, un sprite hors de l'écran est caché et n'est pas animé non plus,
 *   et une vaguelette entre deux vies est cachée ;
 * - `prefers-reduced-motion` : l'eau est figée, au repos — rien n'est animé.
 *
 * Tout est seedé par tuile : les mêmes tuiles ont la même écume et les
 * mêmes vaguelettes d'une partie à l'autre. Rien ici n'est de l'état de jeu.
 */

import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE, coordKey } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import type { Camera } from './camera.ts';
import { BAKE_MARGIN, BLOCK_SIZE, BLOCK_TILES, KEEP_MARGIN } from './chunkLayer.ts';
import { BlockTerrain, SIDES, SIDE_OFFSET, type Side, type TerrainTiles } from './terrainTiles.ts';

/** Période du ressac, et durée d'une vie de vaguelette (plus un écart tiré par tuile), en millisecondes. */
const FOAM_PERIOD_MS = 4200;
const WAVELET_LIFE_MS = 4200;
const WAVELET_LIFE_SPREAD_MS = 2400;

/** Ressac : de combien l'écume monte sur la rive, s'épaissit et s'allonge. */
const FOAM_REACH_PX = 1.5;
const FOAM_SWELL = 0.2;
const FOAM_STRETCH = 0.07;

/** Dérive d'une vaguelette sur sa vie, avec le vent : vers la droite, un peu vers le haut. */
const WAVELET_DRIFT_X = 5;
const WAVELET_DRIFT_Y = -1.5;
/** En dessous de cette taille, une vaguelette entre deux vies est cachée. */
const WAVELET_MIN_SCALE = 0.05;

/** Une vaguelette sur huit tuiles du large. */
const WAVELET_ODDS = 8;

/** Écart de l'écume au bord de la tuile, en pixels monde ; en bas, la face avant du creux la repousse. */
const FOAM_INSET = 2;
const FOAM_BOTTOM = 21;

type Kind = 'foam' | 'wavelet';

interface Ripple {
  sprite: Sprite;
  kind: Kind;
  tx: number;
  ty: number;
  /** Écume : position de repos ; vaguelette : coin de sa tuile. */
  x: number;
  y: number;
  /** Direction de la rive, vers où l'écume monte. */
  towardX: number;
  towardY: number;
  /** Écume : déphasage, en radians ; vaguelette : décalage de sa vie, en vies. */
  phase: number;
  /** Durée d'une vie de vaguelette, en millisecondes. */
  life: number;
  /** Le tirage de la tuile : d'où renaît la vaguelette. */
  roll: number;
  /** ±1 : l'écume est retournée une fois sur deux, pour ne pas faire de motif. */
  flip: number;
}

/** Sprites d'eau à l'écran au dernier cadre, et combien bougent. */
export interface WaterStats {
  sprites: number;
  animated: number;
}

interface WaterBlock {
  bx: number;
  by: number;
  container: Container;
  ripples: Ripple[];
}

export class WaterLayer {
  public readonly container = new Container();

  private readonly blocks = new Map<string, WaterBlock>();
  private readonly tiles: TerrainTiles;
  private readonly seed: number;
  private readonly reducedMotion: MediaQueryList | null;
  private time = 0;

  /** Sprites affichés et animés au dernier cadre — remonté au HUD de debug. */
  public stats: WaterStats = { sprites: 0, animated: 0 };

  public constructor(tiles: TerrainTiles, seed: number) {
    this.tiles = tiles;
    this.seed = seed;
    this.reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }

  public update(camera: Camera, deltaMs: number): void {
    const still = this.reducedMotion?.matches ?? false;
    const blocks = camera.visibleCells(BLOCK_SIZE, BAKE_MARGIN);
    const view = camera.visibleCells(TILE_SIZE, 0);

    if (!still) this.time += deltaMs;

    for (let by = blocks.minCy; by <= blocks.maxCy; by += 1) {
      for (let bx = blocks.minCx; bx <= blocks.maxCx; bx += 1) {
        const key = coordKey(bx, by);

        if (!this.blocks.has(key)) this.blocks.set(key, this.build(bx, by));
      }
    }

    let sprites = 0;
    let animated = 0;

    for (const block of this.blocks.values()) {
      const { bx, by } = block;
      const onScreen = bx >= blocks.minCx && bx <= blocks.maxCx && by >= blocks.minCy && by <= blocks.maxCy;

      block.container.visible = onScreen;
      if (!onScreen) continue;

      for (const ripple of block.ripples) {
        const visible = ripple.tx >= view.minCx && ripple.tx <= view.maxCx && ripple.ty >= view.minCy && ripple.ty <= view.maxCy;

        ripple.sprite.visible = visible;
        if (!visible) continue;

        pose(ripple, still ? 0 : 1, this.time);
        if (!ripple.sprite.visible) continue;
        sprites += 1;
        if (!still) animated += 1;
      }
    }

    this.stats = { sprites, animated };
    this.evict(camera.visibleCells(BLOCK_SIZE, KEEP_MARGIN));
  }

  /** L'écume et les vaguelettes d'un bloc, tirées une fois depuis la seed. */
  private build(bx: number, by: number): WaterBlock {
    const baseTx = bx * BLOCK_TILES;
    const baseTy = by * BLOCK_TILES;
    const terrain = new BlockTerrain(this.seed, baseTx, baseTy, BLOCK_TILES, 2);
    const container = new Container();
    const ripples: Ripple[] = [];

    for (let ly = 0; ly < BLOCK_TILES; ly += 1) {
      for (let lx = 0; lx < BLOCK_TILES; lx += 1) {
        if (terrain.kind(lx, ly) !== 'water') continue;

        const tx = baseTx + lx;
        const ty = baseTy + ly;

        for (const side of SIDES) {
          const [dx, dy] = SIDE_OFFSET[side];

          if (terrain.kind(lx + dx, ly + dy) !== 'water') ripples.push(this.foam(tx, ty, side));
        }

        const roll = hash3(this.seed ^ 0x3c6ef372, tx, ty);

        if (terrain.depth(lx, ly) > 0 && roll % WAVELET_ODDS === 0) ripples.push(this.wavelet(tx, ty, roll));
      }
    }

    for (const ripple of ripples) {
      container.addChild(ripple.sprite);
      pose(ripple, 0, 0);
    }
    this.container.addChild(container);
    return { bx, by, container, ripples };
  }

  private foam(tx: number, ty: number, side: Side): Ripple {
    const sprite = new Sprite(this.tiles.water(hash3(this.seed ^ 0x510e527f, tx, ty + SIDES.indexOf(side)) & 1 ? 'foam.1' : 'foam.0'));
    const [dx, dy] = SIDE_OFFSET[side];
    const left = tx * TILE_SIZE;
    const top = ty * TILE_SIZE;
    const middle = TILE_SIZE / 2;
    const [x, y] =
      side === 'top'
        ? [left + middle, top + FOAM_INSET]
        : side === 'bottom'
          ? [left + middle, top + FOAM_BOTTOM]
          : side === 'left'
            ? [left + FOAM_INSET, top + middle]
            : [left + TILE_SIZE - FOAM_INSET, top + middle];

    sprite.anchor.set(0.5);
    if (dx !== 0) sprite.rotation = Math.PI / 2;

    return {
      sprite,
      kind: 'foam',
      tx,
      ty,
      x,
      y,
      towardX: dx,
      towardY: dy,
      // Le ressac court le long de la rive : la phase suit la position.
      phase: (tx + ty) * 0.55,
      life: 0,
      roll: 0,
      flip: (tx + ty) & 1 ? -1 : 1,
    };
  }

  private wavelet(tx: number, ty: number, roll: number): Ripple {
    const sprite = new Sprite(this.tiles.water(roll & 0x100 ? 'wavelet.1' : 'wavelet.0'));

    // Ancrée à sa base : elle naît du niveau de l'eau.
    sprite.anchor.set(0.5, 0.8);
    return {
      sprite,
      kind: 'wavelet',
      tx,
      ty,
      x: tx * TILE_SIZE,
      y: ty * TILE_SIZE,
      towardX: 0,
      towardY: 0,
      phase: ((roll >>> 13) % 1000) / 1000,
      life: WAVELET_LIFE_MS + ((roll >>> 9) % WAVELET_LIFE_SPREAD_MS),
      roll,
      flip: 1,
    };
  }

  private evict(bounds: { minCx: number; minCy: number; maxCx: number; maxCy: number }): void {
    for (const [key, block] of this.blocks) {
      const { bx, by } = block;

      if (bx >= bounds.minCx && bx <= bounds.maxCx && by >= bounds.minCy && by <= bounds.maxCy) continue;

      block.container.destroy({ children: true });
      this.blocks.delete(key);
    }
  }

  public destroy(): void {
    for (const block of this.blocks.values()) block.container.destroy({ children: true });
    this.blocks.clear();
    this.container.destroy();
  }
}

/**
 * Pose un sprite d'eau à l'instant `time`. `motion` vaut 0 pour l'eau au
 * repos : l'écume à sa place, chaque vaguelette au plus haut de sa première vie.
 */
function pose(ripple: Ripple, motion: number, time: number): void {
  const { sprite } = ripple;

  if (ripple.kind === 'foam') {
    const wave = Math.sin((time / FOAM_PERIOD_MS) * Math.PI * 2 + ripple.phase) * motion;
    const reach = wave * FOAM_REACH_PX;

    sprite.position.set(ripple.x + ripple.towardX * reach, ripple.y + ripple.towardY * reach);
    sprite.scale.set(ripple.flip * (1 + wave * FOAM_STRETCH), 1 + wave * FOAM_SWELL);
    return;
  }

  // Au repos, la vaguelette est figée au milieu de sa première vie.
  const age = motion === 0 ? 0.5 : time / ripple.life + ripple.phase;
  const cycle = Math.floor(age);
  const t = age - cycle;
  // Elle naît, grandit puis se résorbe : jamais d'apparition ni d'effacement d'un coup.
  const size = Math.sin(Math.PI * t);

  sprite.visible = size > WAVELET_MIN_SCALE;
  if (!sprite.visible) return;

  // Chaque vie renaît ailleurs dans la tuile, loin des bords.
  const spot = hash3(ripple.roll, cycle, 0x2545f491);

  sprite.position.set(
    ripple.x + 8 + (spot % 12) + (t - 0.5) * WAVELET_DRIFT_X * motion,
    ripple.y + 10 + ((spot >>> 8) % 14) + (t - 0.5) * WAVELET_DRIFT_Y * motion,
  );
  sprite.scale.set(size);
}
