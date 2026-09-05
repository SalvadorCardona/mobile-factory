/**
 * Icônes d'objets — contenu pur.
 *
 * Une ressource = une icône. `ITEM_ICONS` est un `Record<ItemId, PixelIcon>` :
 * ajouter un objet dans `items.ts` sans lui donner d'icône ici ne compile pas.
 * C'est la seule garantie qui tienne ; un `icon?: string` optionnel finit en
 * carré vide dans le sac au bout de trois objets.
 *
 * Même format que les placeholders (`pixelmaps.ts`) : une palette locale vers
 * `PALETTE`, une grille de caractères, `.` transparent. Le HUD les bake en
 * `data:` URL (`ui/icons.ts`) ; le rendu Pixi pourrait les baker en texture
 * exactement de la même façon. Les icônes suivent la direction artistique :
 * 12 × 12 pixels source, contour d'un pixel, palette du jeu.
 */

import type { PaletteKey } from './artDirection.ts';
import type { ItemId } from './items.ts';
import type { PixelPalette } from './pixelmaps.ts';

/** Taille d'une icône, en pixels source. */
export const ICON_SIZE = 12;

export interface PixelIcon {
  palette: PixelPalette;
  rows: readonly string[];
}

const ICON_PALETTE: PixelPalette = {
  o: 'outline',
  t: 'trunk',
  T: 'trunkShadow',
  b: 'beam',
  r: 'rock',
  R: 'rockLight',
  d: 'rockDark',
  c: 'coal',
  C: 'coalLight',
  i: 'iron',
  I: 'ironLight',
  g: 'leaves',
  G: 'leavesLight',
  k: 'leavesDark',
  a: 'accent',
} satisfies Record<string, PaletteKey>;

/** Deux bûches empilées, en coupe : on voit les cernes. */
const WOOD = [
  '............',
  '............',
  '..ooooooo...',
  '.obbbbbbbTo.',
  '.obtttttbTo.',
  '.obtbbbtbTo.',
  '.obtbbbtbTo.',
  '.obtttttbTo.',
  '.obbbbbbbTo.',
  '..oTTTTTTTo.',
  '...ooooooo..',
  '............',
];

/** Une pierre taillée, un éclat de lumière en haut à gauche. */
const STONE = [
  '............',
  '............',
  '....oooo....',
  '..ooRRRroo..',
  '.oRRrrrrrdo.',
  '.oRrrrrrrdo.',
  '.orrrrrrrdo.',
  '.orrrrrrddo.',
  '.odrrrdddo..',
  '..oddddoo...',
  '...oooo.....',
  '............',
];

/** Un morceau de charbon, noir et anguleux, une facette claire. */
const COAL = [
  '............',
  '............',
  '...ooooo....',
  '..oCCcccoo..',
  '.oCcccccoco.',
  '.occccccoco.',
  '.occcccccco.',
  '.oocccccco..',
  '..occccoo...',
  '...ooooo....',
  '............',
  '............',
];

/** Une pierre veinée de minerai orangé. */
const IRON_ORE = [
  '............',
  '............',
  '....oooo....',
  '..ooRRIroo..',
  '.oRrIIrIrdo.',
  '.oRrIrrrIdo.',
  '.orIIrIIrdo.',
  '.orrIrrrddo.',
  '.odrIIdddo..',
  '..oddddoo...',
  '...oooo.....',
  '............',
];

/** Une pousse verte dans un sillon : ce que la ferme produit. */
const FOOD = [
  '............',
  '.....oo.....',
  '....oGgo....',
  '...oGgggo...',
  '..oGgkoggo..',
  '..ogkoGgko..',
  '...oookoo...',
  '.....oko....',
  '....ookoo...',
  '..ooTTTTToo.',
  '.oTTtttttTo.',
  '..ooooooooo.',
];

export const ITEM_ICONS: Record<ItemId, PixelIcon> = {
  wood: { palette: ICON_PALETTE, rows: WOOD },
  stone: { palette: ICON_PALETTE, rows: STONE },
  coal: { palette: ICON_PALETTE, rows: COAL },
  ironOre: { palette: ICON_PALETTE, rows: IRON_ORE },
  food: { palette: ICON_PALETTE, rows: FOOD },
};
