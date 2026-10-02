/**
 * Le cadre de sélection : un rectangle arrondi, en contour seul, autour de
 * l'emprise du bâtiment (ou du chantier) dont la fenêtre est ouverte.
 *
 * Avec plusieurs bâtiments proches, la fenêtre seule ne dit pas lequel on
 * lit : le cadre le montre sur la carte. Il est **au sol** — sous le conteneur
 * trié en profondeur, au-dessus des ombres —, comme un tracé à la craie
 * autour du pied du bâtiment : le toit, la barre et les bulles passent
 * par-dessus, et rien ne voile la façade. Un rectangle entier plutôt que
 * des coins en crochets : en 3/4, le toit cache le bord du fond, et des
 * crochets y perdraient leurs deux coins du haut ; le rectangle garde ses
 * deux côtés et son bord avant, toujours lisibles.
 *
 * Jaune colonie, deux tons comme une capsule de l'interface : un trait
 * `shade` décalé vers le bas — la face avant, qui le détache du sable —
 * sous un trait `base`. Le jaune est la couleur la plus claire de la
 * palette : il tranche sur l'herbe, l'eau, et reste le plus lumineux sous le
 * voile indigo de la nuit.
 *
 * À l'apparition, il rebondit (un peu trop grand, un peu trop petit, posé),
 * puis respire lentement ; figé sous `prefers-reduced-motion`. Le
 * `Graphics` n'est retessélé que si l'emprise change : le rebond et la
 * respiration ne touchent que l'échelle et l'opacité.
 */

import { Graphics } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import { PALETTE, RADIUS, STROKE, hex } from '../data/artDirection.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

const BASE = hex(PALETTE.yellow.base);
const SHADE = hex(PALETTE.yellow.shade);

/** Écart entre l'emprise et le milieu du trait, en pixels monde. */
const MARGIN = 5;
/** Un trait épais : le double du trait des détails. */
const WIDTH = STROKE.width * 2;
/** La face avant dépasse d'autant sous le trait. */
const FACE_DROP = 2;

/** Le rebond d'apparition : de `POP_FROM` à 1, en passant un peu sous 1. */
const POP_MS = 320;
const POP_FROM = 1.12;
const POP_UNDER = 0.97;

/** La respiration : l'opacité descend jusqu'à `1 - BREATH_DEPTH`, en `BREATH_MS`. */
const BREATH_MS = 2400;
const BREATH_DEPTH = 0.3;

export class SelectionLayer {
  public readonly container = new Graphics();

  private lastKey = '';
  private shownId: EntityId | null = null;
  private popLeft = 0;
  private clock = 0;
  private readonly reducedMotion: MediaQueryList | null;
  private readonly world: World;

  public constructor(world: World) {
    this.world = world;
    this.container.visible = false;
    this.reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }

  /** `selected` : le bâtiment dont la fenêtre est ouverte, ou `null`. */
  public update(selected: EntityId | null, deltaMs: number): void {
    // Rasé ou annulé, il n'est plus dans le monde : le cadre part avec lui.
    const entity = selected === null ? undefined : this.world.entities.get(selected);

    this.container.visible = entity !== undefined;
    if (!entity) {
      this.shownId = null;
      return;
    }

    if (entity.id !== this.shownId) {
      this.shownId = entity.id;
      this.popLeft = POP_MS;
      this.clock = 0;
    }

    const key = `${entity.tx}:${entity.ty}:${entity.width}:${entity.height}`;

    if (key !== this.lastKey) {
      this.lastKey = key;
      this.redraw(entity.width * TILE_SIZE, entity.height * TILE_SIZE);
      // Centré sur l'emprise : le rebond part du milieu.
      this.container.position.set((entity.tx + entity.width / 2) * TILE_SIZE, (entity.ty + entity.height / 2) * TILE_SIZE);
    }

    this.animate(deltaMs);
  }

  private redraw(width: number, height: number): void {
    const w = width + MARGIN * 2;
    const h = height + MARGIN * 2;
    const radius = Math.min(RADIUS.block, w / 2, h / 2);

    this.container
      .clear()
      .roundRect(-w / 2, -h / 2 + FACE_DROP, w, h, radius)
      .stroke({ width: WIDTH, color: SHADE, cap: STROKE.cap, join: STROKE.join })
      .roundRect(-w / 2, -h / 2, w, h, radius)
      .stroke({ width: WIDTH, color: BASE, cap: STROKE.cap, join: STROKE.join });
  }

  /** Rebond puis respiration : du ressenti, rien que des minuteurs de vue. */
  private animate(deltaMs: number): void {
    if (this.reducedMotion?.matches) {
      this.popLeft = 0;
      this.container.scale.set(1);
      this.container.alpha = 1;
      return;
    }

    this.popLeft = Math.max(0, this.popLeft - deltaMs);
    this.container.scale.set(popScale(1 - this.popLeft / POP_MS));

    if (this.popLeft > 0) {
      this.container.alpha = 1;
      return;
    }
    this.clock = (this.clock + deltaMs) % BREATH_MS;
    this.container.alpha = 1 - (BREATH_DEPTH * (1 - Math.cos((this.clock / BREATH_MS) * Math.PI * 2))) / 2;
  }

  public destroy(): void {
    this.container.destroy();
  }
}

/** L'échelle du rebond à la fraction `t` (0 à 1) : de `POP_FROM` à `POP_UNDER` aux deux tiers, puis 1. */
function popScale(t: number): number {
  const ease = (x: number): number => x * x * (3 - 2 * x);

  if (t < 2 / 3) return POP_FROM + (POP_UNDER - POP_FROM) * ease(t * 1.5);
  return POP_UNDER + (1 - POP_UNDER) * ease((t - 2 / 3) * 3);
}
