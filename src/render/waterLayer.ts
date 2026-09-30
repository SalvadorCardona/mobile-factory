/**
 * L'eau qui bouge : l'écume des rives et les reflets du large.
 *
 * Le sol est baké une fois par bloc et ne l'est jamais plus (`chunkLayer.ts`) :
 * ce qui bouge ne peut pas y vivre. L'écume et les reflets sont donc des
 * sprites de l'atlas, posés au-dessus du sol baké, sous les ombres portées —
 * tous sur la même page, un appel de dessin.
 *
 * - L'**écume** borde chaque côté de tuile d'eau qui touche la rive. Elle
 *   respire : elle s'allonge et avance d'un pixel vers le large, puis
 *   revient, avec un déphasage le long de la rive — une vague lente qui court.
 * - Les **reflets** tombent sur une tuile du large sur six, parmi celles que
 *   le sol baké laisse sans reflet. Ils glissent d'un ou deux pixels,
 *   s'allongent puis se rétractent en six secondes, sans jamais disparaître
 *   ni devenir transparents : un scintillement, pas un clignotement.
 *
 * Coût tenu ici, par les mêmes blocs de 16 × 16 tuiles que le sol :
 * - un bloc n'existe que s'il touche l'écran, et il est détruit avec la
 *   même marge d'éviction que le sol ;
 * - un bloc hors de l'écran est caché et n'est pas animé ; dans un bloc
 *   visible, un sprite hors de l'écran est caché et n'est pas animé non plus ;
 * - `prefers-reduced-motion` : l'eau est figée, au repos — rien n'est animé.
 *
 * Tout est seedé par tuile : les mêmes tuiles ont la même écume et les
 * mêmes reflets d'une partie à l'autre. Rien ici n'est de l'état de jeu.
 */

import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE, coordKey } from '../core/grid.ts';
import { hash3 } from '../core/rng.ts';
import type { Camera } from './camera.ts';
import { BAKE_MARGIN, BLOCK_SIZE, BLOCK_TILES, KEEP_MARGIN } from './chunkLayer.ts';
import { BlockTerrain, SIDES, SIDE_OFFSET, groundRoll, variantOf, type Side, type TerrainTiles } from './terrainTiles.ts';

/** Période de la respiration de l'écume, et de l'éclat d'un reflet, en millisecondes. */
const FOAM_PERIOD_MS = 3200;
const GLINT_PERIOD_MS = 6000;

/** Amplitudes : de combien l'écume s'allonge et avance, de combien un reflet glisse. */
const FOAM_STRETCH = 0.08;
const FOAM_SWELL_PX = 1;
const GLINT_DRIFT_PX = 1.5;
const GLINT_SHRINK = 0.25;

/** Un reflet sur six tuiles du large laissées sans reflet par le sol baké. */
const GLINT_ODDS = 6;

/** Écart de l'écume au bord de la tuile, en pixels monde ; en bas, la face avant du creux la repousse. */
const FOAM_INSET = 2;
const FOAM_BOTTOM = 21;

type Kind = 'foam' | 'glint';

interface Ripple {
  sprite: Sprite;
  kind: Kind;
  tx: number;
  ty: number;
  /** Position de repos, et direction du large (vers où l'écume avance). */
  x: number;
  y: number;
  towardX: number;
  towardY: number;
  /** Déphasage, en radians. */
  phase: number;
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

        sprites += 1;
        pose(ripple, still ? 0 : 1, this.time);
        if (!still) animated += 1;
      }
    }

    this.stats = { sprites, animated };
    this.evict(camera.visibleCells(BLOCK_SIZE, KEEP_MARGIN));
  }

  /** L'écume et les reflets d'un bloc, tirés une fois depuis la seed. */
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

        // Le même tirage que le sol baké : un reflet ne se pose que là où le sol n'en a pas.
        const bakedGlint = variantOf(groundRoll(this.seed, tx, ty)) !== 0;
        const roll = hash3(this.seed ^ 0x3c6ef372, tx, ty);

        if (terrain.depth(lx, ly) > 0 && !bakedGlint && roll % GLINT_ODDS === 0) ripples.push(this.glint(tx, ty, roll));
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
      towardX: -dx,
      towardY: -dy,
      // La vague court le long de la rive : la phase suit la position.
      phase: (tx + ty) * 0.9,
      flip: (tx + ty) & 1 ? -1 : 1,
    };
  }

  private glint(tx: number, ty: number, roll: number): Ripple {
    const sprite = new Sprite(this.tiles.water(roll & 0x100 ? 'glint.1' : 'glint.0'));

    sprite.anchor.set(0.5);
    return {
      sprite,
      kind: 'glint',
      tx,
      ty,
      // Quelque part dans le milieu de la tuile, loin des bords.
      x: tx * TILE_SIZE + 10 + ((roll >>> 9) % 12),
      y: ty * TILE_SIZE + 8 + ((roll >>> 13) % 16),
      towardX: 1,
      towardY: 0,
      phase: ((roll >>> 17) % 628) / 100,
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
 * repos : l'écume à sa taille, le reflet net, à sa place.
 */
function pose(ripple: Ripple, motion: number, time: number): void {
  const { sprite } = ripple;

  if (ripple.kind === 'foam') {
    const wave = Math.sin((time / FOAM_PERIOD_MS) * Math.PI * 2 + ripple.phase) * motion;
    const swell = wave * FOAM_SWELL_PX;

    sprite.position.set(ripple.x + ripple.towardX * swell, ripple.y + ripple.towardY * swell);
    sprite.scale.set(ripple.flip * (1 + wave * FOAM_STRETCH), 1);
    return;
  }

  const angle = (time / GLINT_PERIOD_MS) * Math.PI * 2 + ripple.phase;
  const shine = Math.sin(angle) * motion;

  sprite.position.set(ripple.x + Math.sin(angle * 0.5) * GLINT_DRIFT_PX * motion, ripple.y);
  // Pas de transparence : le reflet s'allonge puis se rétracte de moitié, jamais éteint.
  sprite.scale.set(1 - (1 - shine) * GLINT_SHRINK * motion, 1);
}
