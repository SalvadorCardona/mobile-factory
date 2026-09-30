/**
 * Déplacer une sélection dans une grille, au clavier.
 *
 * Le menu de construction range ses cartes en grille (`auto-fill`) : le
 * nombre de colonnes dépend de la largeur de l'écran, et la dernière ligne
 * peut être incomplète. Cette fonction ne connaît ni le DOM ni la mise en
 * page — l'appelant mesure les colonnes, elle calcule l'index suivant.
 *
 * Aux bords, la sélection s'arrête au lieu de reboucler : sur une grille de
 * six cartes, sauter du bout à l'autre fait perdre le fil. Descendre depuis
 * une carte au-dessus d'une case vide de la dernière ligne mène à la
 * dernière carte, comme dans une grille d'icônes de téléphone.
 */

export type GridMove = 'left' | 'right' | 'up' | 'down';

/**
 * L'index sélectionné après `move`. Un `index` hors de la grille (rien de
 * sélectionné, `-1`) donne la première case, quel que soit le mouvement.
 */
export function gridStep(index: number, count: number, columns: number, move: GridMove): number {
  if (count <= 0) return -1;
  if (index < 0 || index >= count) return 0;

  const cols = Math.max(1, Math.floor(columns));
  const row = Math.floor(index / cols);
  const lastRow = Math.floor((count - 1) / cols);

  switch (move) {
    case 'left':
      return Math.max(0, index - 1);
    case 'right':
      return Math.min(count - 1, index + 1);
    case 'up':
      return index - cols >= 0 ? index - cols : index;
    case 'down':
      return row < lastRow ? Math.min(count - 1, index + cols) : index;
  }
}
