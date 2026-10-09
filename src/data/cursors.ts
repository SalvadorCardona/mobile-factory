/**
 * Les curseurs de souris — la table, à un seul endroit.
 *
 * Desktop seulement (`DESKTOP_POINTER`) : un doigt n'a pas de curseur. Chaque
 * curseur est un SVG de `art/cursors.ts`, du même cadre carré (`CURSOR_SIZE`,
 * en pixels CSS), dont le `hotspot` est le point qui clique — la pointe de la
 * flèche, le bout de l'index. `fallback` est le curseur système qui sert
 * tant que l'image n'est pas lue (`ui/cursors.ts` en fait la valeur CSS).
 */

/** Le média où le jeu a un curseur : une souris, pas un écran tactile. */
export const DESKTOP_POINTER = '(hover: hover) and (pointer: fine)';

/** Côté du cadre d'un curseur, en pixels CSS. */
export const CURSOR_SIZE = 32;

export const CURSORS = {
  /** Le curseur normal, sur le terrain : une flèche arrondie. */
  arrow: { hotspot: { x: 4, y: 4 }, fallback: 'default' },
  /** Tout ce qui se tape : une main, l'index levé. */
  hand: { hotspot: { x: 12, y: 4 }, fallback: 'pointer' },
  /** La carte du monde, au repos : une main ouverte. */
  grab: { hotspot: { x: 16, y: 16 }, fallback: 'grab' },
  /** La carte du monde qu'on tire : le poing. */
  grabbing: { hotspot: { x: 16, y: 16 }, fallback: 'grabbing' },
  /** Un bâtiment armé sur une case refusée. */
  forbidden: { hotspot: { x: 4, y: 4 }, fallback: 'not-allowed' },
} as const satisfies Record<string, { hotspot: { x: number; y: number }; fallback: string }>;

export type CursorId = keyof typeof CURSORS;

export const CURSOR_IDS = Object.keys(CURSORS) as CursorId[];
