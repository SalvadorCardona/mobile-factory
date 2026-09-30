/**
 * Icônes du HUD : un SVG → une `data:` URL.
 *
 * Le HUD est du DOM, pas du Pixi : ses images sont des `<img>`. Comme tout
 * visuel du jeu est déjà un SVG, il n'y a rien à baker : le navigateur le
 * dessine lui-même, net à toutes les densités d'écran.
 *
 * Trois sources : les icônes d'objets (`data/icons.ts`, une par objet,
 * garanti par le type), le bâtiment fini de chaque sprite, pour que le menu
 * de construction montre ce qu'on va poser, et les pictogrammes de
 * l'interface (`art/ui.ts`).
 */

import { UI_ICONS, type UiIcon } from '../art/ui.ts';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { ITEM_ICONS } from '../data/icons.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { PERKS, type PerkId } from '../data/perks.ts';
import { SPRITES } from '../data/sprites.ts';

const cache = new Map<string, string>();

function url(key: string, svg: string): string {
  const cached = cache.get(key);

  if (cached) return cached;

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  cache.set(key, encoded);
  return encoded;
}

/** URL de l'icône d'un objet. */
export function itemIconUrl(item: ItemId): string {
  return url(`item:${item}`, ITEM_ICONS[item]);
}

/** URL de la vignette d'un bâtiment : son morceau `built`. */
export function buildingIconUrl(building: BuildingId): string {
  return url(`building:${building}`, SPRITES[BUILDINGS[building].sprite].parts.built);
}

/** Un `<img>` d'icône d'objet, prêt à insérer. */
export function itemIcon(item: ItemId, size = 20): HTMLImageElement {
  const element = image(itemIconUrl(item), 'icon', size, size);

  element.alt = ITEMS[item].label;
  element.title = ITEMS[item].label;
  return element;
}

/** Un `<img>` de vignette de bâtiment. */
export function buildingIcon(building: BuildingId, size = 40): HTMLImageElement {
  const element = image(buildingIconUrl(building), 'icon icon-building', size, size);

  element.alt = BUILDINGS[building].label;
  return element;
}

/** Un pictogramme d'interface (pause, son, marteau…), décoratif : le bouton porte déjà son libellé. */
export function uiIcon(name: UiIcon, size = 24): HTMLImageElement {
  const element = image(url(`ui:${name}`, UI_ICONS[name]), 'icon icon-ui', size, size);

  element.alt = '';
  element.setAttribute('aria-hidden', 'true');
  return element;
}

/** L'icône d'un bonus du jardin, décorative : la ligne porte déjà son nom. */
export function perkIcon(perk: PerkId, size = 32): HTMLImageElement {
  const { icon } = PERKS[perk];
  const element =
    'item' in icon ? itemIcon(icon.item, size) : 'building' in icon ? buildingIcon(icon.building, size) : uiIcon(icon.ui, size);

  element.alt = '';
  element.removeAttribute('title');
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function image(src: string, className: string, width: number, height: number): HTMLImageElement {
  const element = document.createElement('img');

  element.className = className;
  element.src = src;
  element.width = width;
  element.height = height;
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
