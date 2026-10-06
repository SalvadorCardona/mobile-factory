import { describe, expect, it } from 'vitest';
import { decorAt, findSpawn, oreAt, resourceAt, terrainAt } from './terrain.ts';

describe('terrain', () => {
  /*
   * La carte n'est jamais stockée : elle est recalculée depuis la seed à chaque
   * lancement. Si `terrainAt` n'est pas parfaitement déterministe, une partie
   * sauvegardée se rouvre sur une autre carte, avec les bâtiments dans l'eau.
   */
  it('redonne exactement le même terrain pour la même seed', () => {
    for (let tx = -40; tx < 40; tx += 7) {
      for (let ty = -40; ty < 40; ty += 7) {
        expect(terrainAt(1234, tx, ty)).toBe(terrainAt(1234, tx, ty));
      }
    }
  });

  it('donne des cartes différentes pour des seeds différentes', () => {
    const a: string[] = [];
    const b: string[] = [];

    for (let tx = 0; tx < 60; tx += 1) {
      a.push(terrainAt(1, tx, 0));
      b.push(terrainAt(2, tx, 0));
    }

    expect(a.join('')).not.toBe(b.join(''));
  });

  it('produit les quatre types de terrain sur une carte de taille raisonnable', () => {
    const kinds = new Set<string>();

    for (let tx = -120; tx < 120; tx += 3) {
      for (let ty = -120; ty < 120; ty += 3) {
        kinds.add(terrainAt(99, tx, ty));
      }
    }

    expect([...kinds].sort()).toEqual(['grass', 'rock', 'sand', 'water']);
  });

  it('ne place jamais de gisement dans l’eau', () => {
    for (let tx = -200; tx < 200; tx += 1) {
      for (let ty = -200; ty < 200; ty += 11) {
        if (terrainAt(7, tx, ty) === 'water') {
          expect(oreAt(7, tx, ty)).toBeNull();
        }
      }
    }
  });

  it('donne à un gisement un id stable, indépendant de la tuile interrogée', () => {
    const found = new Map<number, string>();

    for (let tx = 0; tx < 60; tx += 1) {
      for (let ty = 0; ty < 60; ty += 1) {
        const node = oreAt(3, tx, ty);

        if (!node) continue;

        const signature = `${node.item}:${node.tx},${node.ty},${node.radius}`;
        const previous = found.get(node.id);

        if (previous) expect(signature).toBe(previous);
        else found.set(node.id, signature);
      }
    }

    expect(found.size).toBeGreaterThan(0);
  });
});

describe('ressources de surface', () => {
  it('sont déterministes pour une seed', () => {
    for (let tx = -60; tx < 60; tx += 5) {
      for (let ty = -60; ty < 60; ty += 5) {
        expect(resourceAt(1234, tx, ty)).toBe(resourceAt(1234, tx, ty));
      }
    }
  });

  it('ne poussent jamais dans l’eau', () => {
    for (let tx = -200; tx < 200; tx += 1) {
      for (let ty = -200; ty < 200; ty += 11) {
        if (terrainAt(7, tx, ty) === 'water') {
          expect(resourceAt(7, tx, ty)).toBeNull();
        }
      }
    }
  });

  it('donnent des arbres sur l’herbe et des rochers sur les filons', () => {
    const kinds = new Set<string>();

    for (let tx = -150; tx < 150; tx += 2) {
      for (let ty = -150; ty < 150; ty += 2) {
        const id = resourceAt(99, tx, ty);

        if (!id) continue;

        kinds.add(id);

        if (id === 'tree') {
          expect(terrainAt(99, tx, ty)).toBe('grass');
          expect(oreAt(99, tx, ty)).toBeNull();
        } else {
          expect(oreAt(99, tx, ty)).not.toBeNull();
        }
      }
    }

    expect(kinds.has('tree')).toBe(true);
    expect(kinds.size).toBeGreaterThan(2);
  });

  it('laissent des clairières : une forêt n’est pas un mur', () => {
    let trees = 0;
    let grass = 0;

    for (let tx = -150; tx < 150; tx += 1) {
      for (let ty = -150; ty < 150; ty += 3) {
        if (terrainAt(5, tx, ty) !== 'grass') continue;
        grass += 1;
        if (resourceAt(5, tx, ty) === 'tree') trees += 1;
      }
    }

    expect(trees / grass).toBeGreaterThan(0.05);
    expect(trees / grass).toBeLessThan(0.5);
  });
});

describe('décor', () => {
  it('ne se pose jamais sur l’eau ni sous une ressource', () => {
    for (let tx = -150; tx < 150; tx += 1) {
      for (let ty = -150; ty < 150; ty += 7) {
        if (decorAt(3, tx, ty) === null) continue;
        expect(terrainAt(3, tx, ty)).not.toBe('water');
        expect(resourceAt(3, tx, ty)).toBeNull();
      }
    }
  });

  it('est déterministe, clairsemé et varié', () => {
    const kinds = new Set<string>();
    let decorated = 0;
    let bare = 0;

    for (let tx = -150; tx < 150; tx += 1) {
      for (let ty = -150; ty < 150; ty += 3) {
        const decor = decorAt(9, tx, ty);

        expect(decorAt(9, tx, ty)).toBe(decor);
        if (terrainAt(9, tx, ty) === 'water' || resourceAt(9, tx, ty) !== null) continue;
        bare += 1;
        if (decor === null) continue;
        decorated += 1;
        kinds.add(decor);
      }
    }

    expect(decorated / bare).toBeGreaterThan(0.02);
    expect(decorated / bare).toBeLessThan(0.15);
    expect(kinds.size).toBeGreaterThan(6);
  });
});

describe('foyer', () => {
  /** La plus proche tuile portant `id`, en tuiles depuis le départ d'Adam, hors de la clairière. */
  function nearest(seed: number, id: string, reach: number): number {
    const [sx, sy] = findSpawn(seed);
    const ax = sx;
    const ay = sy + 1;
    let best = Infinity;

    for (let ty = ay - reach; ty <= ay + reach; ty += 1) {
      for (let tx = ax - reach; tx <= ax + reach; tx += 1) {
        // `World` vide la clairière de la mairie : ce qui y pousse ne compte pas.
        if (tx >= sx - 2 && tx <= sx + 2 && ty >= sy - 3 && ty <= sy + 2) continue;
        if (resourceAt(seed, tx, ty) !== id) continue;
        best = Math.min(best, Math.hypot(tx - ax, ty - ay));
      }
    }
    return best;
  }

  /*
   * Playtest du 30/09/2026 : sur la moitié des seeds, le premier rocher de
   * pierre était à plus de trois écrans du départ. La mairie doit pouvoir se
   * bâtir sans explorer, sur toutes les seeds.
   */
  it('met des arbres à 6 tuiles, de la pierre à 12 et du fer à 20 sur 1 000 seeds', () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const trees = nearest(seed, 'tree', 6);
      const stone = nearest(seed, 'stoneRock', 12);
      const iron = nearest(seed, 'ironRock', 20);

      expect({ seed, ok: trees <= 6 && stone <= 12 && iron <= 20 }).toEqual({ seed, ok: true });
    }
  }, 30_000);

  it('se tire de la seed : même seed, mêmes filons', () => {
    const [sx, sy] = findSpawn(42);

    expect(findSpawn(42)).toEqual([sx, sy]);
    for (let ty = sy - 20; ty <= sy + 20; ty += 1) {
      for (let tx = sx - 20; tx <= sx + 20; tx += 1) {
        expect(oreAt(42, tx, ty)).toEqual(oreAt(42, tx, ty));
      }
    }
  });
});
