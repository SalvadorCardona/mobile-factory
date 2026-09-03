import { describe, expect, it } from 'vitest';
import { Store } from './store.ts';

describe('Store', () => {
  it('plafonne sur le nombre total d’objets, pas sur des piles', () => {
    const store = new Store(10);

    expect(store.add('wood', 6)).toBe(6);
    expect(store.add('stone', 6)).toBe(4);
    expect(store.total()).toBe(10);
    expect(store.freeSpace()).toBe(0);
  });

  it('ne jette rien en silence : le refus est dans la valeur de retour', () => {
    const store = new Store(3);

    expect(store.add('wood', 10)).toBe(3);
    expect(store.count('wood')).toBe(3);
  });

  /*
   * Le piège des jeux de colonie : deux jobs qui promettent le même tas. La
   * réservation se prend à la création du job, donc le second ne peut plus
   * voir ce stock. Le bug n'existe pas structurellement.
   */
  it('empêche deux réservations sortantes de viser le même stock', () => {
    const store = new Store(100);

    store.add('ironOre', 50);

    expect(store.reserveOut('ironOre', 50)).toBe(true);
    expect(store.available('ironOre')).toBe(0);
    expect(store.reserveOut('ironOre', 1)).toBe(false);
    // Le stock physique, lui, n'a pas bougé : le porteur n'est pas arrivé.
    expect(store.count('ironOre')).toBe(50);
  });

  it('empêche deux livraisons de se promettre la même place', () => {
    const store = new Store(10);

    expect(store.reserveIn('wood', 10)).toBe(true);
    expect(store.freeSpace()).toBe(0);
    expect(store.reserveIn('stone', 1)).toBe(false);
  });

  it('rend la place au rollback quand la seconde réservation échoue', () => {
    const source = new Store(100);
    const destination = new Store(5);

    source.add('wood', 20);

    expect(source.reserveOut('wood', 20)).toBe(true);
    expect(destination.reserveIn('wood', 20)).toBe(false);

    source.releaseOut('wood', 20);
    expect(source.available('wood')).toBe(20);
  });

  it('transforme la promesse en mouvement réel au commit', () => {
    const source = new Store(100);
    const destination = new Store(100);

    source.add('coal', 30);
    source.reserveOut('coal', 30);
    destination.reserveIn('coal', 30);

    expect(source.commitOut('coal', 30)).toBe(30);
    expect(destination.commitIn('coal', 30)).toBe(30);

    expect(source.total()).toBe(0);
    expect(destination.count('coal')).toBe(30);
    expect(destination.freeSpace()).toBe(70);
  });

  /*
   * Le point de la reprise notée sur la page projet : un entrepôt est un Store
   * de capacité infinie, pas une Map de stock à part. Il participe donc aux
   * réservations comme n'importe quel coffre.
   */
  it('accepte une capacité infinie sans casser les réservations', () => {
    const warehouse = new Store(Infinity);

    warehouse.add('wood', 1_000_000);
    expect(warehouse.freeSpace()).toBe(Infinity);
    expect(warehouse.reserveIn('stone', 500)).toBe(true);
    expect(warehouse.reserveOut('wood', 999_999)).toBe(true);
    expect(warehouse.available('wood')).toBe(1);
  });

  it('se sérialise sans les réservations', () => {
    const store = new Store(100);

    store.add('wood', 5);
    store.reserveOut('wood', 3);

    const restored = Store.fromJSON(100, store.toJSON());

    expect(restored.count('wood')).toBe(5);
    expect(restored.available('wood')).toBe(5);
  });
});
