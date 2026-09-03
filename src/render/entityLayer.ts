/**
 * Bâtiments et joueur.
 *
 * Les sprites ne sont pas reconstruits à chaque frame : ils sont créés à
 * l'événement `buildingPlaced` et ne bougent plus. Seul le joueur est
 * repositionné, et il l'est par **interpolation** entre `prevX/prevY` et la
 * position du tick courant : la simulation tourne à 20 TPS, l'écran à 60 ou
 * 120 Hz. Sans interpolation, le personnage avance par à-coups visibles.
 */

import { Container, Sprite } from 'pixi.js';
import { TILE_SIZE } from '../core/grid.ts';
import type { EntityId } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import type { Atlas } from './atlas.ts';

export class EntityLayer {
  public readonly container = new Container();

  private readonly sprites = new Map<EntityId, Sprite>();
  private readonly player: Sprite;

  private readonly world: World;
  private readonly atlas: Atlas;

  public constructor(world: World, atlas: Atlas) {
    this.world = world;
    this.atlas = atlas;
    this.player = new Sprite(atlas.player);
    this.player.anchor.set(0.5);

    world.events.on('buildingPlaced', ({ id }) => this.addBuilding(id));
    for (const id of world.entities.keys()) this.addBuilding(id);

    this.container.addChild(this.player);
  }

  private addBuilding(id: EntityId): void {
    const entity = this.world.entities.get(id);

    if (!entity || this.sprites.has(id)) return;

    const sprite = new Sprite(this.atlas.buildings[entity.proto]);

    sprite.position.set(entity.tx * TILE_SIZE, entity.ty * TILE_SIZE);
    // Une foreuse posée hors gisement reste visible, mais délavée : le joueur
    // doit comprendre pourquoi elle ne produit rien sans ouvrir un panneau.
    sprite.alpha = entity.output ? 1 : 0.45;

    this.sprites.set(id, sprite);
    this.container.addChildAt(sprite, 0);
  }

  /** `alpha` est la fraction du pas de simulation déjà écoulée, dans [0, 1[. */
  public update(alpha: number): void {
    const { player } = this.world;

    this.player.position.set(
      player.prevX + (player.x - player.prevX) * alpha,
      player.prevY + (player.y - player.prevY) * alpha,
    );

    for (const [id, sprite] of this.sprites) {
      const entity = this.world.entities.get(id);

      if (!entity) {
        sprite.destroy();
        this.sprites.delete(id);
        continue;
      }
      sprite.alpha = entity.output ? 1 : 0.45;
    }
  }

  /** Position interpolée du joueur — le HUD et la caméra la réutilisent. */
  public playerScreenPosition(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
