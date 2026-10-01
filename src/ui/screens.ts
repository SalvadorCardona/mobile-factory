/**
 * Écrans plein cadre : l'écran titre et la pause.
 *
 * L'écran titre n'est pas décoratif. Sur mobile, le son ne peut démarrer
 * qu'après un geste : le bouton « Jouer » est ce geste, et la partie ne
 * commence qu'à ce moment-là — le joueur n'arrive pas au milieu d'une
 * simulation déjà lancée. Derrière le voile, la carte est déjà dessinée : on
 * voit le monde dans lequel on va entrer.
 *
 * Quand une partie est sauvegardée, l'écran titre propose « Continuer » (le
 * choix par défaut) et « Nouvelle partie ». Recommencer efface la colonie :
 * les deux écrans le font confirmer avant.
 *
 * L'écran titre ouvre aussi le jardin des souvenirs (`garden.ts`), où l'on
 * plante les graines des colonies tombées, et rappelle le record : les nuits
 * tenues après le Signal, par la meilleure colonie.
 *
 * Aucun de ces écrans ne touche au monde ni à la sauvegarde : ils disent à
 * `main.ts` de jouer, d'arrêter l'horloge ou de recommencer, et c'est tout.
 */

import { LORE } from '../data/lore.ts';
import type { Garden } from '../sim/garden.ts';
import { GardenPanel, type GardenActions } from './garden.ts';
import { buildingIcon, itemIcon, uiIcon } from './icons.ts';
import { seedLine } from './seed.ts';

export interface TitleOptions {
  /** Une partie sauvegardée attend : « Continuer » et « Nouvelle partie » remplacent « Jouer ». */
  resume: boolean;
  /** Une ligne discrète sous les boutons — une vieille sauvegarde ignorée, par exemple. */
  notice?: string;
  onPlay: () => void;
  /** « Nouvelle partie », confirmée : la sauvegarde est à effacer. */
  onRestart: () => void;
  /** Le jardin des souvenirs, et de quoi y planter. */
  garden: Garden;
  /** Le record « nuits tenues après le Signal » ; 0 tant qu'aucune antenne n'a parlé. */
  record: number;
  gardenActions: GardenActions;
}

export class TitleScreen {
  public readonly root: HTMLElement;

  public constructor({ resume, notice, onPlay, onRestart, garden, gardenActions, record }: TitleOptions) {
    this.root = document.createElement('div');
    this.root.className = 'overlay title-screen';

    const panel = document.createElement('div');

    panel.className = 'title-panel';

    const kicker = document.createElement('div');

    kicker.className = 'title-kicker';
    kicker.textContent = 'Après la fin du monde';

    const title = document.createElement('h1');

    title.className = 'title-logo';
    title.textContent = LORE.title;

    const pitch = document.createElement('p');

    pitch.className = 'title-pitch';
    pitch.textContent = LORE.pitch;

    const play = document.createElement('button');

    play.type = 'button';
    play.className = 'button-primary title-play';
    play.append(uiIcon('play', 26), resume ? 'Continuer' : 'Jouer');
    play.addEventListener('click', () => {
      this.root.dataset['leaving'] = 'true';
      window.setTimeout(() => this.root.remove(), 380);
      onPlay();
    });

    const controls = document.createElement('ul');

    controls.className = 'title-controls';
    for (const [icon, label] of [
      [uiIcon('move', 28), 'Glissez le pouce pour marcher (ZQSD / flèches sur PC)'],
      [itemIcon('wood', 28), 'Passez près des arbres et des rochers pour récolter'],
      [buildingIcon('townHall', 28), 'Foncez dans un chantier pour le livrer'],
    ] as const) {
      const item = document.createElement('li');

      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      item.append(icon, label);
      controls.append(item);
    }

    panel.append(kicker, title, pitch, play);

    if (resume) {
      const confirm = confirmRestart(onRestart, () => {
        confirm.hidden = true;
        panel.hidden = false;
        play.focus();
      });
      const fresh = document.createElement('button');

      confirm.hidden = true;
      fresh.type = 'button';
      fresh.className = 'button-secondary title-new';
      fresh.append(uiIcon('restart', 22), 'Nouvelle partie');
      fresh.addEventListener('click', () => {
        panel.hidden = true;
        confirm.hidden = false;
        confirm.querySelector<HTMLButtonElement>('.button-secondary')?.focus();
      });
      panel.append(fresh);
      this.root.append(confirm);
    }

    const gardenButton = document.createElement('button');
    const gardenPanel = new GardenPanel(
      garden,
      gardenActions,
      ({ seeds, pure }) => {
        gardenButton.replaceChildren(uiIcon('seed', 22), `Jardin · ${seeds}`);
        gardenButton.dataset['pure'] = String(pure);
      },
      () => {
        gardenPanel.root.hidden = true;
        panel.hidden = false;
        gardenButton.focus();
      },
    );

    gardenPanel.root.hidden = true;
    gardenButton.type = 'button';
    gardenButton.className = 'button-secondary title-garden';
    gardenButton.setAttribute('aria-label', 'Jardin des souvenirs');
    gardenButton.addEventListener('click', () => {
      panel.hidden = true;
      gardenPanel.root.hidden = false;
      gardenPanel.root.querySelector<HTMLButtonElement>('.button-secondary')?.focus();
    });
    panel.append(gardenButton);
    this.root.append(gardenPanel.root);

    if (record > 0) {
      const best = document.createElement('p');
      const icon = buildingIcon('antenna', 22);

      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      best.className = 'title-record';
      best.append(icon, `Record après le Signal : ${record} nuit${record > 1 ? 's' : ''} tenue${record > 1 ? 's' : ''}`);
      panel.append(best);
    }

    if (notice) {
      const line = document.createElement('p');

      line.className = 'title-notice';
      line.textContent = notice;
      panel.append(line);
    }

    panel.append(controls);
    this.root.prepend(panel);

    // « Continuer » est le choix par défaut : Entrée ou Espace le prennent.
    window.setTimeout(() => play.focus(), 0);
  }
}

export class PauseScreen {
  public readonly root: HTMLElement;
  /** L'interrupteur de la musique de fond ; le câblage l'abonne au moteur audio. */
  public readonly musicButton: HTMLButtonElement;

  private readonly panel: HTMLElement;
  private readonly confirm: HTMLElement;

  public constructor(seed: number, onResume: () => void, onRestart: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay pause-screen';
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'panel overlay-panel';

    const title = document.createElement('h2');

    title.className = 'overlay-title';
    title.textContent = 'Pause';

    const text = document.createElement('p');

    text.className = 'overlay-text';
    text.textContent = 'Les mutants attendent, eux aussi.';

    const resume = document.createElement('button');

    resume.type = 'button';
    resume.className = 'button-primary';
    resume.textContent = 'Reprendre';
    resume.addEventListener('click', onResume);

    const restart = document.createElement('button');

    restart.type = 'button';
    restart.className = 'button-secondary';
    restart.append(uiIcon('restart', 22), 'Recommencer');
    restart.addEventListener('click', () => this.asking(true));

    this.musicButton = document.createElement('button');
    this.musicButton.type = 'button';
    this.musicButton.className = 'button-secondary pause-music';

    this.confirm = confirmRestart(onRestart, () => this.asking(false));
    this.panel.append(title, text, resume, this.musicButton, restart, seedLine(seed));
    this.root.append(this.panel, this.confirm);
    this.asking(false);
  }

  public set visible(visible: boolean) {
    this.root.hidden = !visible;
    // Rouvrir la pause, c'est retrouver la pause, pas une question laissée en plan.
    if (visible) this.asking(false);
  }

  /** Le libellé et l'icône suivent le réglage du moteur audio. */
  public setMusic(on: boolean): void {
    this.musicButton.replaceChildren(uiIcon(on ? 'musicOn' : 'musicOff', 22), on ? 'Musique : oui' : 'Musique : non');
    this.musicButton.setAttribute('aria-pressed', String(on));
  }

  private asking(asking: boolean): void {
    this.panel.hidden = asking;
    this.confirm.hidden = !asking;
    if (asking) this.confirm.querySelector<HTMLButtonElement>('.button-secondary')?.focus();
  }
}

/**
 * « Ta colonie sera perdue » : la question avant d'effacer la partie. Le
 * bouton corail recommence, le blanc annule — et c'est lui qui a le focus,
 * pour qu'un Entrée distrait ne coûte pas une colonie.
 */
function confirmRestart(onConfirm: () => void, onCancel: () => void): HTMLElement {
  const panel = document.createElement('div');

  panel.className = 'panel overlay-panel confirm-panel';
  panel.setAttribute('role', 'alertdialog');

  const title = document.createElement('h2');

  title.className = 'overlay-title';
  title.textContent = 'Recommencer ?';

  const text = document.createElement('p');

  text.className = 'overlay-text';
  text.textContent = 'Ta colonie sera perdue : la mairie, le sac, les enfants, tout.';

  const confirm = document.createElement('button');

  confirm.type = 'button';
  confirm.className = 'button-primary';
  confirm.append(uiIcon('restartLight', 22), 'Recommencer');
  confirm.addEventListener('click', onConfirm);

  const cancel = document.createElement('button');

  cancel.type = 'button';
  cancel.className = 'button-secondary';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', onCancel);

  panel.append(title, text, confirm, cancel);
  return panel;
}
