/**
 * Le cadre de sélection : un rectangle arrondi, en contour seul, autour de
 * l'emprise du bâtiment (ou du chantier) dont la fenêtre est ouverte — ou
 * autour de la silhouette de l'habitant ou de l'ennemi qu'on lit
 * (`selectionFrame.ts` dit quoi entourer). Un seul à la fois : celui de la
 * fenêtre.
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
 * Une créature, elle, n'a pas d'emprise : le même cadre entoure son pantin
 * et le suit pas à pas, à la position interpolée. Il passe alors dans le
 * conteneur trié, juste sous elle : un toit derrière elle ne le mange pas,
 * un arbre devant elle, si.
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

import { Container, Graphics } from 'pixi.js';
import { PALETTE, RADIUS, STROKE, hex } from '../data/artDirection.ts';
import type { World } from '../sim/world.ts';
import type { Selection } from '../ui/creatureView.ts';
import { selectionFrame } from './selectionFrame.ts';

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
  /** La place du cadre au sol, sous le conteneur trié : celle d'un bâtiment. */
  public readonly container = new Container();

  private readonly frame = new Graphics();
  private lastKey = '';
  private shownTarget: string | null = null;
  private popLeft = 0;
  private clock = 0;
  private readonly reducedMotion: MediaQueryList | null;
  private readonly world: World;
  /** Le conteneur trié en profondeur, où passe le cadre d'une créature. */
  private readonly sorted: Container;

  public constructor(world: World, sorted: Container) {
    this.world = world;
    this.sorted = sorted;
    this.frame.visible = false;
    this.container.addChild(this.frame);
    this.reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }

  /** `selected` : le bâtiment ou la créature dont la fenêtre est ouverte, ou `null`. */
  public update(selected: Selection | null, alpha: number, deltaMs: number): void {
    // Rasé, annulé, mort, parti ou rentré : le cadre part avec lui.
    const frame = selectionFrame(this.world, selected, alpha);

    this.frame.visible = frame !== null;
    if (!frame) {
      this.shownTarget = null;
      return;
    }

    if (frame.target !== this.shownTarget) {
      this.shownTarget = frame.target;
      this.popLeft = POP_MS;
      this.clock = 0;
    }

    const parent = frame.depth === null ? this.container : this.sorted;

    if (this.frame.parent !== parent) parent.addChild(this.frame);
    if (frame.depth !== null) this.frame.zIndex = frame.depth;

    const key = `${frame.width}:${frame.height}`;

    if (key !== this.lastKey) {
      this.lastKey = key;
      this.redraw(frame.width, frame.height);
    }
    // Centré sur ce qu'il entoure : le rebond part du milieu.
    this.frame.position.set(frame.x, frame.y);

    this.animate(deltaMs);
  }

  private redraw(width: number, height: number): void {
    const w = width + MARGIN * 2;
    const h = height + MARGIN * 2;
    const radius = Math.min(RADIUS.block, w / 2, h / 2);

    this.frame
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
      this.frame.scale.set(1);
      this.frame.alpha = 1;
      return;
    }

    this.popLeft = Math.max(0, this.popLeft - deltaMs);
    this.frame.scale.set(popScale(1 - this.popLeft / POP_MS));

    if (this.popLeft > 0) {
      this.frame.alpha = 1;
      return;
    }
    this.clock = (this.clock + deltaMs) % BREATH_MS;
    this.frame.alpha = 1 - (BREATH_DEPTH * (1 - Math.cos((this.clock / BREATH_MS) * Math.PI * 2))) / 2;
  }

  public destroy(): void {
    // Dans le conteneur trié, il a pu partir avec lui.
    if (!this.frame.destroyed) this.frame.destroy();
    this.container.destroy();
  }
}

/** L'échelle du rebond à la fraction `t` (0 à 1) : de `POP_FROM` à `POP_UNDER` aux deux tiers, puis 1. */
function popScale(t: number): number {
  const ease = (x: number): number => x * x * (3 - 2 * x);

  if (t < 2 / 3) return POP_FROM + (POP_UNDER - POP_FROM) * ease(t * 1.5);
  return POP_UNDER + (1 - POP_UNDER) * ease((t - 2 / 3) * 3);
}
