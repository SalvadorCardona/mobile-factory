/**
 * PRNG à seed, déterministe et sans état global.
 *
 * Toute génération procédurale passe par ici : le terrain et les gisements ne
 * sont jamais stockés, ils sont recalculés à partir de la seed. C'est aussi ce
 * qui laisse la porte ouverte à un lockstep déterministe plus tard — on ne
 * l'ouvre pas, on ne la ferme pas.
 */

export type Rng = () => number;

/** Générateur mulberry32 : rapide, 32 bits d'état, distribution correcte. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hachage entier de trois coordonnées vers un entier 32 bits non signé.
 * Sert à fabriquer un id déterministe pour un gisement — (cx, cy, index) —
 * sans avoir à le stocker.
 */
export function hash3(a: number, b: number, c: number): number {
  let h = 0x811c9dc5 ^ (a | 0);
  h = Math.imul(h ^ (b | 0), 0x01000193);
  h = Math.imul(h ^ (c | 0), 0x01000193);

  /*
   * Finalisation murmur3. Elle n'est pas décorative : avec un simple
   * `h ^= h >>> 16`, le dernier argument mélangé n'atteint pas les bits de
   * poids fort, et deux coordonnées qui ne diffèrent que par `c` sortent des
   * valeurs presque identiques. En pratique la carte se rayait en colonnes et
   * les gisements s'alignaient en bandes verticales.
   */
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Bruit de valeur dans [0, 1) pour une tuile, dérivé de la seed. */
export function noise2(seed: number, x: number, y: number): number {
  return hash3(seed, x, y) / 4294967296;
}
