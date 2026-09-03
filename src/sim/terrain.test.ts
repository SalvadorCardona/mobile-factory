import { describe, expect, it } from 'vitest';
import { oreAt, terrainAt } from './terrain.ts';

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
