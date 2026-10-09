/**
 * Les boutons de zoom : une rangée de disques blancs en haut à droite, sous
 * la barre du haut. Pause, Réglages et la carte du monde s'y posent en tête
 * (`main.ts`), puis avancer, revenir sur Adam au zoom par défaut, reculer.
 *
 * Ils ne touchent pas à la caméra : chacun appelle son rappel, et `update`
 * les grise en butée (et le bouton du milieu quand on est déjà chez soi).
 */

import { onLocale, t } from '../i18n/locale.ts';
import { uiIcon } from './icons.ts';

export interface ZoomActions {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
}

export interface ZoomLimits {
  canZoomIn: boolean;
  canZoomOut: boolean;
  atHome: boolean;
}

export class ZoomControls {
  public readonly root: HTMLElement;

  private readonly zoomIn: HTMLButtonElement;
  private readonly zoomOut: HTMLButtonElement;
  private readonly recenter: HTMLButtonElement;

  public constructor(actions: ZoomActions) {
    this.root = document.createElement('div');
    this.root.className = 'hud-zoom';
    this.zoomIn = button('zoomIn', actions.zoomIn);
    this.recenter = button('recenter', actions.recenter);
    this.zoomOut = button('zoomOut', actions.zoomOut);
    this.root.append(this.zoomIn, this.recenter, this.zoomOut);
    onLocale(() => {
      for (const node of [this.zoomIn, this.recenter, this.zoomOut]) {
        const label = t().screens.zoom[node.dataset['icon'] as 'zoomIn' | 'zoomOut' | 'recenter'];

        node.setAttribute('aria-label', label);
        node.title = label;
      }
    });
  }

  public update({ canZoomIn, canZoomOut, atHome }: ZoomLimits): void {
    if (this.zoomIn.disabled === canZoomIn) this.zoomIn.disabled = !canZoomIn;
    if (this.zoomOut.disabled === canZoomOut) this.zoomOut.disabled = !canZoomOut;
    if (this.recenter.disabled !== atHome) this.recenter.disabled = atHome;
  }
}

function button(icon: 'zoomIn' | 'zoomOut' | 'recenter', onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');

  node.type = 'button';
  node.className = 'hud-button';
  node.dataset['icon'] = icon;
  node.append(uiIcon(icon));
  node.addEventListener('click', onClick);
  return node;
}
