/**
 * Les boutons de zoom : une colonne de trois petits disques blancs sur le
 * bord droit, à mi-hauteur — loin du joystick (bas gauche), du bouton
 * « Bâtir » (bas droite) et de la colonne du sac (haut droite). Avancer,
 * revenir sur Adam au zoom par défaut, reculer.
 *
 * Ils ne touchent pas à la caméra : chacun appelle son rappel, et `update`
 * les grise en butée (et le bouton du milieu quand on est déjà chez soi).
 */

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
    this.zoomIn = button('zoomIn', 'Zoomer', actions.zoomIn);
    this.recenter = button('recenter', 'Revenir sur Adam', actions.recenter);
    this.zoomOut = button('zoomOut', 'Dézoomer', actions.zoomOut);
    this.root.append(this.zoomIn, this.recenter, this.zoomOut);
  }

  public update({ canZoomIn, canZoomOut, atHome }: ZoomLimits): void {
    if (this.zoomIn.disabled === canZoomIn) this.zoomIn.disabled = !canZoomIn;
    if (this.zoomOut.disabled === canZoomOut) this.zoomOut.disabled = !canZoomOut;
    if (this.recenter.disabled !== atHome) this.recenter.disabled = atHome;
  }
}

function button(icon: 'zoomIn' | 'zoomOut' | 'recenter', label: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');

  node.type = 'button';
  node.className = 'hud-button hud-zoom-button';
  node.setAttribute('aria-label', label);
  node.title = label;
  node.append(uiIcon(icon, 20));
  node.addEventListener('click', onClick);
  return node;
}
