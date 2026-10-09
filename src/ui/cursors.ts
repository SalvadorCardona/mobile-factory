/**
 * Les curseurs de souris, posés en variables CSS.
 *
 * `style.css` lit `--cursor-arrow`, `--cursor-hand`… (avec, par défaut, le
 * curseur système) ; ce module n'en change la valeur que sur un appareil à
 * souris (`DESKTOP_POINTER`) — un téléphone ne voit rien. Le curseur reste
 * celui du navigateur, natif : aucun sprite ne suit la souris.
 */

import { CURSORS, CURSOR_IDS, DESKTOP_POINTER, type CursorId } from '../data/cursors.ts';
import { CURSOR_SVGS } from '../art/cursors.ts';

/** La valeur CSS d'un curseur : l'image, son point chaud, puis le curseur système en repli. */
export function cursorValue(id: CursorId): string {
  const { hotspot, fallback } = CURSORS[id];
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(CURSOR_SVGS[id])}`;

  return `url("${image}") ${hotspot.x} ${hotspot.y}, ${fallback}`;
}

/** Le nom de la variable CSS d'un curseur. */
export function cursorVar(id: CursorId): string {
  return `--cursor-${id}`;
}

/** Pose les curseurs dessinés tant que l'appareil a une souris, les retire sinon. */
export function installCursors(root: HTMLElement = document.documentElement): void {
  const media = window.matchMedia(DESKTOP_POINTER);
  const apply = () => {
    for (const id of CURSOR_IDS) {
      if (media.matches) root.style.setProperty(cursorVar(id), cursorValue(id));
      else root.style.removeProperty(cursorVar(id));
    }
  };

  apply();
  media.addEventListener('change', apply);
}
