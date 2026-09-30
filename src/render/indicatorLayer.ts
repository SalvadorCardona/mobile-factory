/**
 * Repères au bord de l'écran.
 *
 * Sur un téléphone, on voit une douzaine de tuiles de large : un mutant qui
 * arrive à vingt tuiles est invisible jusqu'au dernier moment, et la mairie
 * se perd dès qu'on part couper du bois. Un jeu pro ne laisse pas le joueur
 * deviner — il montre la direction.
 *
 * Deux sortes de repères, en pixels écran, plaqués contre le bord : une
 * pastille ronde en trois tons, sans contour, qui pointe vers sa cible —
 * - vert fluo, avec un gros œil, par mutant hors champ (la teinte des
 *   mutants), plus opaque quand il approche ;
 * - jaune, avec un petit toit, vers la mairie (ou son chantier) quand elle
 *   sort du champ, qui pulse tant que le chantier attend quelque chose.
 *
 * Tout est redessiné à chaque frame dans un seul `Graphics` : quelques
 * disques, pas de quoi justifier un pool.
 */

import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, hex, type Tone } from '../data/artDirection.ts';
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

      this.arrow(camera, x, y - 16, 'toxic', 0.45 + near * 0.55, 1);
    }

    const hall = this.world.entities.get(this.world.townHallId);

    if (hall) {
      const x = (hall.tx + hall.width / 2) * TILE_SIZE;
      const y = (hall.ty + hall.height / 2) * TILE_SIZE;
      const pulse = hall.kind === 'site' ? 1 + Math.sin(this.elapsed / 180) * 0.12 : 1;

      this.arrow(camera, x, y, 'yellow', 1, pulse, true);
    }
  }

  /** Une flèche au bord, pointée vers (x, y) monde — rien si le point est à l'écran. */
  private arrow(camera: Camera, x: number, y: number, tone: Tone, opacity: number, scale: number, home = false): void {
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

    const colors = PALETTE[tone];
    const g = this.graphics;
    const [cx0, cy0] = point(-size * 0.4, 0);
    const radius = 11 * scale;

    // La pointe, puis la pastille : ombre en bas à droite, dessus, reflet en haut à gauche.
    g.poly([...point(size, 0), ...point(-size * 0.2, size * 0.75), ...point(-size * 0.2, -size * 0.75)]).fill({
      color: hex(colors.shade),
      alpha: opacity,
    });
    g.circle(cx0, cy0, radius).fill({ color: hex(colors.shade), alpha: opacity });
    g.circle(cx0 - 1, cy0 - 1.2, radius - 1.6).fill({ color: hex(colors.base), alpha: opacity });
    g.roundRect(cx0 - radius * 0.6, cy0 - radius * 0.62, radius * 0.6, radius * 0.26, radius * 0.13).fill({
      color: hex(colors.light),
      alpha: opacity,
    });

    if (home) {
      // Un petit toit corail et sa porte : c'est la maison, pas un ennemi.
      g.poly([cx0 - 6.5, cy0, cx0, cy0 - 6.5, cx0 + 6.5, cy0]).fill({ color: hex(PALETTE.coral.base), alpha: opacity });
      g.roundRect(cx0 - 4.5, cy0, 9, 6, 2).fill({ color: hex(PALETTE.yellow.light), alpha: opacity });
      g.roundRect(cx0 - 1.5, cy0 + 1.5, 3, 4.5, 1.5).fill({ color: hex(PALETTE.violet.shade), alpha: opacity });
    } else {
      // Un gros œil de mutant, qui louche.
      g.circle(cx0, cy0, 5).fill({ color: hex(PALETTE.paper.base), alpha: opacity });
      g.circle(cx0 + 1.2, cy0 + 1.3, 2.3).fill({ color: hex(PALETTE.ink.base), alpha: opacity });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
