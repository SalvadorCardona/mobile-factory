/** Section `menu` du dictionnaire français : le tiroir « Bâtir », la carte Route, la barre de placement. */

/** « 1 pierre », « 3 pierres ». */
const count = (n: number, word: string): string => `${n} ${word}${n > 1 ? 's' : ''}`;

export const menu = {
  /** Le bouton du tiroir : aucun autre bouton ne porte ce libellé. */
  build: 'Bâtir',
  /** Les touches, en petites capsules (masquées sans clavier). */
  keys: {
    space: 'Espace',
    arrows: 'Flèches',
    enter: 'Entrée',
    escape: 'Échap',
  },
  drawerTitle: 'Bâtiments',
  /** La ligne d'effet au pied du tiroir, tant qu'aucune carte n'a été lue. */
  effectPrompt: 'Appui long sur une carte : à quoi sert le bâtiment',
  /** La ligne d'effet d'une carte lue : « Forge : … ». */
  cardEffect: (name: string, effect: string): string => `${name} : ${effect}`,
  /** Un bâtiment sans coût. */
  free: 'gratuit',
  employs: (n: number): string => `Emploie ${n} ouvrier${n > 1 ? 's' : ''}`,
  road: 'Route',
  /** Ce que fait la route ; `speed` est déjà formaté (« 1,6 »). */
  roadEffect: (speed: string): string => `Adam et les ouvriers y vont ${speed} fois plus vite. Glissez de tuile en tuile`,
  roadMeta: 'par tuile · sans chantier',
  /** Pourquoi une carte est grisée. */
  locked: {
    hall: 'Débloqué après la mairie',
    unique: 'Un seul par colonie',
    objective: (n: number): string => `Après l’objectif ${n}`,
    night: (n: number): string => `Dès la nuit ${n}`,
  },
  place: 'Poser',
  placeAgain: 'Poser encore',
  remove: 'Retirer',
  pave: 'Paver',
  /** La barre de placement, fantôme posé. */
  placing: (name: string): string => `Poser : ${name}`,
  /** La barre de placement, avant de taper la carte. */
  tapToPlace: (name: string): string => `Tapez la carte pour placer ${name}`,
  removeCount: (slabs: number): string => `Retirer ${count(slabs, 'dalle')} — rend ${count(slabs, 'pierre')}`,
  removeHint: 'Retirer : glissez sur les dalles',
  roadCount: (tiles: number): string => `Route : ${count(tiles, 'tuile')} — ${count(tiles, 'pierre')}`,
  roadHint: 'Route : glissez de tuile en tuile',
};
