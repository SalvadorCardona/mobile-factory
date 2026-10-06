/**
 * Ce que la carte du monde a le droit de montrer : l'état de chaque case,
 * et les bornes de la zone découverte.
 *
 * Trois états, ceux du brouillard de guerre : **inexplorée** (rien
 * d'affiché), **explorée** (le sol et le bâti, voilés, sans personne
 * dessus), **visible** (tout, en direct). La carte ne lit que cette
 * interface : le brouillard du monde la remplira par `World.sightAt`.
 *
 * En attendant, `SeenArea` en tient lieu : les blocs de 16 × 16 tuiles que
 * la caméra a montrés depuis le chargement, plus les abords du bâti et
 * d'Adam au départ. Tout ce qui a été vu est « visible » — sans brouillard,
 * le monde se voit en direct. C'est une mémoire de la vue, pas de la
 * partie : rien n'est sauvegardé.
 *
 * Sans DOM ni Pixi : se teste en Node.
 */

import { floorDiv } from '../core/grid.ts';

export type Sight = 'unexplored' | 'explored' | 'visible';

/** Un rectangle de tuiles, bornes comprises. */
export interface TileRect {
  minTx: number;
  minTy: number;
  maxTx: number;
  maxTy: number;
}

export interface MapSight {
  /** L'état de la case (tx, ty). */
  sightAt(tx: number, ty: number): Sight;
  /** Le rectangle qui contient toute la zone découverte, ou `null` si rien ne l'est. */
  known(): TileRect | null;
  /** Monte quand une case change d'état : la carte refait alors son fond. */
  readonly revision: number;
}

/** Côté d'un bloc de la zone vue, en tuiles : celui des blocs de sol bakés. */
export const SEEN_BLOCK = 16;

export class SeenArea implements MapSight {
  public revision = 0;

  private readonly blocks = new Set<number>();
  private bounds: { minBx: number; minBy: number; maxBx: number; maxBy: number } | null = null;

  /** Marque vus les blocs qui recouvrent le rectangle de tuiles. */
  public see(rect: TileRect): void {
    const minBx = floorDiv(rect.minTx, SEEN_BLOCK);
    const minBy = floorDiv(rect.minTy, SEEN_BLOCK);
    const maxBx = floorDiv(rect.maxTx, SEEN_BLOCK);
    const maxBy = floorDiv(rect.maxTy, SEEN_BLOCK);

    for (let by = minBy; by <= maxBy; by += 1) {
      for (let bx = minBx; bx <= maxBx; bx += 1) {
        const key = blockKey(bx, by);

        if (this.blocks.has(key)) continue;
        this.blocks.add(key);
        this.revision += 1;
        const b = this.bounds;

        this.bounds = b
          ? { minBx: Math.min(b.minBx, bx), minBy: Math.min(b.minBy, by), maxBx: Math.max(b.maxBx, bx), maxBy: Math.max(b.maxBy, by) }
          : { minBx: bx, minBy: by, maxBx: bx, maxBy: by };
      }
    }
  }

  /** Marque vu le carré de `radius` tuiles autour de (tx, ty). */
  public seeAround(tx: number, ty: number, radius: number): void {
    this.see({ minTx: tx - radius, minTy: ty - radius, maxTx: tx + radius, maxTy: ty + radius });
  }

  public sightAt(tx: number, ty: number): Sight {
    return this.blocks.has(blockKey(floorDiv(tx, SEEN_BLOCK), floorDiv(ty, SEEN_BLOCK))) ? 'visible' : 'unexplored';
  }

  public known(): TileRect | null {
    const b = this.bounds;

    if (!b) return null;
    return {
      minTx: b.minBx * SEEN_BLOCK,
      minTy: b.minBy * SEEN_BLOCK,
      maxTx: (b.maxBx + 1) * SEEN_BLOCK - 1,
      maxTy: (b.maxBy + 1) * SEEN_BLOCK - 1,
    };
  }
}

/** Une clé numérique par bloc : pas de chaîne à fabriquer à chaque case lue. */
function blockKey(bx: number, by: number): number {
  return (bx + 0x8000) * 0x10000 + (by + 0x8000);
}
