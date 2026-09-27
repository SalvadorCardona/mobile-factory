/**
 * Écrans plein cadre : l'écran titre et la pause.
 *
 * L'écran titre n'est pas décoratif. Sur mobile, le son ne peut démarrer
 * qu'après un geste : le bouton « Jouer » est ce geste, et la partie ne
 * commence qu'à ce moment-là — le joueur n'arrive pas au milieu d'une
 * simulation déjà lancée. Derrière le voile, la carte est déjà dessinée : on
 * voit le monde dans lequel on va entrer.
 *
 * Aucun de ces écrans ne touche au monde : ils disent à `main.ts` de jouer
 * ou d'arrêter l'horloge, et c'est tout.
 */

import { LORE } from '../data/lore.ts';

export class TitleScreen {
  public readonly root: HTMLElement;

  public constructor(onPlay: () => void) {
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
    play.textContent = 'Jouer';
    play.addEventListener('click', () => {
      this.root.dataset['leaving'] = 'true';
      window.setTimeout(() => this.root.remove(), 380);
      onPlay();
    });

    const controls = document.createElement('ul');

    controls.className = 'title-controls';
    for (const [key, label] of [
      ['👆', 'Glissez le pouce pour marcher (ZQSD / flèches sur PC)'],
      ['🪓', 'Foncez dans un arbre ou un rocher pour récolter'],
      ['🏠', 'Foncez dans un chantier pour le livrer'],
    ] as const) {
      const item = document.createElement('li');
      const icon = document.createElement('span');

      icon.textContent = key;
      icon.setAttribute('aria-hidden', 'true');
      item.append(icon, label);
      controls.append(item);
    }

    panel.append(kicker, title, pitch, play, controls);
    this.root.append(panel);
  }
}

export class PauseScreen {
  public readonly root: HTMLElement;

  public constructor(onResume: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay pause-screen';
    this.root.hidden = true;

    const panel = document.createElement('div');

    panel.className = 'panel overlay-panel';

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
    restart.textContent = 'Nouvelle partie';
    restart.addEventListener('click', () => {
      // Nouvelle carte : on retire la seed de l'URL, s'il y en avait une.
      const url = new URL(window.location.href);

      url.searchParams.delete('seed');
      window.location.href = url.toString();
    });

    panel.append(title, text, resume, restart);
    this.root.append(panel);
  }

  public set visible(visible: boolean) {
    this.root.hidden = !visible;
  }
}
