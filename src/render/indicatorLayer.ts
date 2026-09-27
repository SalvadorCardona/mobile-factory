/**
 * Repères au bord de l'écran.
 *
 * Sur un téléphone, on voit une douzaine de tuiles de large : un mutant qui
 * arrive à vingt tuiles est invisible jusqu'au dernier moment, et la mairie
 * se perd dès qu'on part couper du bois. Un jeu pro ne laisse pas le joueur
 * deviner — il montre la direction.
 *
 * Deux sortes de repères, en pixels écran, plaqués contre le bord :
 * - une flèche rouge par mutant hors champ, plus opaque quand il approche ;
 * - une flèche ambre vers la mairie (ou son chantier) quand elle sort du
 *   champ, qui pulse tant que le chantier attend quelque chose.
 *
 * Tout est redessiné à chaque frame dans un seul `Graphics` : quelques
 * triangles, pas de quoi justifier un pool.
 */

import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE } from '../data/artDirection.ts';
import type { World } from '../sim/world.ts';
import type { Camera } from './camera.ts';

/**
 * Marges par défaut où les repères ne vont pas : l'objectif en haut, le bouton
 * de construction en bas. Le HUD les corrige à chaque instant (`setInsets`) :
 * la quête grandit quand un conseil s'affiche.
 */
const MARGIN_TOP = 132;
const MARGIN_BOTTOM = 96;
const MARGIN_SIDE = 22;

/** Écart entre le bord du HUD et la pointe d'une flèche. */
const INSET_GAP = 18;

const DANGER = 0xe2725b;
const HOME = PALETTE.accent;

/** Au-delà de cette distance en tuiles, un mutant hors champ est dessiné au minimum d'opacité. */
const FAR_TILES = 24;

export class IndicatorLayer {
  public readonly container = new Container();

  private readonly graphics = new Graphics();
  private readonly world: World;
  private elapsed = 0;
  private insetTop = MARGIN_TOP;
  private insetBottom = MARGIN_BOTTOM;

  public constructor(world: World) {
    this.world = world;
    this.container.addChild(this.graphics);
  }

  /** Hauteurs occupées par le HUD en haut et en bas, en pixels écran. */
  public setInsets(top: number, bottom: number): void {
    this.insetTop = top + INSET_GAP;
    this.insetBottom = bottom + INSET_GAP;
  }

  public update(camera: Camera, deltaMs: number, alpha: number): void {
    const g = this.graphics;

    this.elapsed += deltaMs;
    g.clear();

    const { player } = this.world;
    const px = player.prevX + (player.x - player.prevX) * alpha;
    const py = player.prevY + (player.y - player.prevY) * alpha;

    for (const mobile of this.world.mobiles.values()) {
      if (mobile.kind !== 'mutant') continue;

      const x = mobile.prevX + (mobile.x - mobile.prevX) * alpha;
      const y = mobile.prevY + (mobile.y - mobile.prevY) * alpha;
      const distance = Math.hypot(x - px, y - py) / TILE_SIZE;
      const near = 1 - Math.min(1, distance / FAR_TILES);

      this.arrow(camera, x, y - 16, DANGER, 0.45 + near * 0.55, 1);
    }

    const hall = this.world.entities.get(this.world.townHallId);

    if (hall) {
      const x = (hall.tx + hall.width / 2) * TILE_SIZE;
      const y = (hall.ty + hall.height / 2) * TILE_SIZE;
      const pulse = hall.kind === 'site' ? 1 + Math.sin(this.elapsed / 180) * 0.12 : 1;

      this.arrow(camera, x, y, HOME, 0.95, pulse, true);
    }
  }

  /** Une flèche au bord, pointée vers (x, y) monde — rien si le point est à l'écran. */
  private arrow(camera: Camera, x: number, y: number, color: number, opacity: number, scale: number, home = false): void {
    const screen = camera.worldToScreen(x, y);
    const width = camera.viewWidth;
    const height = camera.viewHeight;
    const left = MARGIN_SIDE;
    const right = width - MARGIN_SIDE;
    const top = Math.min(this.insetTop, height / 2 - 40);
    const bottom = Math.max(height - this.insetBottom, height / 2 + 40);

    if (screen.x >= 0 && screen.x <= width && screen.y >= 0 && screen.y <= height) return;

    // Projette la direction depuis le centre de la zone utile jusqu'à son bord.
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const dx = screen.x - cx;
    const dy = screen.y - cy;
    const tx = dx === 0 ? Infinity : (dx > 0 ? right - cx : left - cx) / dx;
    const ty = dy === 0 ? Infinity : (dy > 0 ? bottom - cy : top - cy) / dy;
    const t = Math.min(tx, ty);
    const ex = cx + dx * t;
    const ey = cy + dy * t;
    const angle = Math.atan2(dy, dx);
    const size = 11 * scale;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const point = (along: number, across: number): [number, number] => [
      ex + cos * along - sin * across,
      ey + sin * along + cos * across,
    ];

    const tip = point(size, 0);
    const back1 = point(-size * 0.7, size * 0.8);
    const back2 = point(-size * 0.7, -size * 0.8);

    this.graphics
      .poly([...tip, ...back1, ...back2])
      .fill({ color, alpha: opacity })
      .stroke({ color: PALETTE.outline, width: 2, alpha: opacity });

    if (home) {
      // Un petit toit derrière la flèche : c'est la maison, pas un ennemi.
      const [hx, hy] = point(-size * 1.9, 0);

      this.graphics
        .rect(hx - 5, hy - 2, 10, 7)
        .fill({ color: PALETTE.plaster, alpha: opacity })
        .poly([hx - 7, hy - 1, hx, hy - 8, hx + 7, hy - 1])
        .fill({ color: PALETTE.roof, alpha: opacity })
        .stroke({ color: PALETTE.outline, width: 1.5, alpha: opacity });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
