/**
 * Icônes du HUD : une carte de pixels → une `data:` URL.
 *
 * Le HUD est du DOM, pas du Pixi : ses images sont des `<img>`. On bake
 * chaque carte de pixels **une fois** sur un canvas 2D à résolution 1, et le
 * navigateur agrandit en `image-rendering: pixelated` — le même principe que
 * les placeholders côté rendu, avec un canvas au lieu d'un `Graphics`.
 *
 * Deux sources : les icônes d'objets (`data/icons.ts`, une par objet, garanti
 * par le type) et la première image `idle` de la planche d'un bâtiment, pour
 * que le menu de construction montre ce qu'on va poser.
 */

import { PALETTE } from '../data/artDirection.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ITEM_ICONS } from '../data/icons.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { PIXEL_MAPS, type PixelPalette } from '../data/pixelmaps.ts';

const cache = new Map<string, string>();

function bake(key: string, palette: PixelPalette, rows: readonly string[]): string {
  const cached = cache.get(key);

  if (cached) return cached;

  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) return '';

  const image = context.createImageData(width, height);

  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x += 1) {
      const char = row[x]!;

      if (char === '.') continue;

      const color = PALETTE[palette[char]!];
      const offset = (y * width + x) * 4;

      image.data[offset] = (color >> 16) & 0xff;
      image.data[offset + 1] = (color >> 8) & 0xff;
      image.data[offset + 2] = color & 0xff;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const url = canvas.toDataURL();

  cache.set(key, url);
  return url;
}

/** URL de l'icône d'un objet. */
export function itemIconUrl(item: ItemId): string {
  const icon = ITEM_ICONS[item];

  return bake(`item:${item}`, icon.palette, icon.rows);
}

/** URL de la vignette d'un bâtiment : sa première image `idle`. */
export function buildingIconUrl(building: BuildingId): string {
  const map = PIXEL_MAPS[BUILDINGS[building].sprite];
  const rows = map.animations['idle']?.[0] ?? [];

  return bake(`building:${building}`, map.palette, rows);
}

/** Un `<img>` d'icône d'objet, prêt à insérer. */
export function itemIcon(item: ItemId, size = 20): HTMLImageElement {
  const element = document.createElement('img');

  element.className = 'icon';
  element.src = itemIconUrl(item);
  element.alt = ITEMS[item].label;
  element.title = ITEMS[item].label;
  element.width = size;
  element.height = size;
  element.draggable = false;
  return element;
}

/** Un `<img>` de vignette de bâtiment. */
export function buildingIcon(building: BuildingId, size = 40): HTMLImageElement {
  const element = document.createElement('img');

  element.className = 'icon icon-building';
  element.src = buildingIconUrl(building);
  element.alt = BUILDINGS[building].label;
  element.width = size;
  element.height = size;
  element.draggable = false;
  return element;
}

/**
 * Une ligne « icône + quantité », réutilisée par le sac, les coûts du menu
 * et l'avancement d'un chantier. `have` permet d'afficher `3/12` et de
 * colorer selon que la quantité est atteinte.
 */
export function itemAmount(item: ItemId, amount: number, have?: number): HTMLElement {
  const element = document.createElement('span');

  element.className = 'item-amount';
  element.append(itemIcon(item));

  const text = document.createElement('span');

  text.textContent = have === undefined ? String(amount) : `${have}/${amount}`;
  element.append(text);

  if (have !== undefined) element.dataset['done'] = String(have >= amount);
  return element;
}
