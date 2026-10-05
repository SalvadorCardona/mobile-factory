/**
 * Le menu des réglages, derrière le bouton engrenage du HUD : la langue, les
 * sons, la musique, les pancartes des bâtiments. Rien qui touche à la partie — ce sont des préférences de
 * l'appareil, gardées hors de la sauvegarde.
 *
 * Ouvert, il arrête l'horloge (`main.ts` lit `open`) ; il se ferme par sa
 * croix, par un tap sur le voile autour, ou par Échap (`escape.ts`).
 *
 * Il ne décide de rien : il dit à `main.ts` la langue choisie, ou qu'il faut
 * basculer le son, la musique ou les pancartes, et `main.ts` lui renvoie l'état réel.
 */

import { LOCALES, messagesOf, onLocale, t, type Locale } from '../i18n/locale.ts';
import { uiIcon } from './icons.ts';

export interface SettingsActions {
  setLocale(locale: Locale): void;
  toggleSound(): void;
  toggleMusic(): void;
  toggleSigns(): void;
  /** Ouvert ou fermé : l'horloge s'arrête, le son de fenêtre joue. */
  onToggle(open: boolean): void;
}

export class SettingsPanel {
  public readonly root: HTMLElement;

  private readonly panel: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly languages = new Map<Locale, HTMLButtonElement>();
  private readonly soundButton: HTMLButtonElement;
  private readonly musicButton: HTMLButtonElement;
  private readonly signsButton: HTMLButtonElement;
  private readonly actions: SettingsActions;
  private sound = true;
  private music = true;
  private signs = true;

  public constructor(actions: SettingsActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'overlay settings-screen';
    this.root.hidden = true;
    // Un tap sur le voile, hors du panneau, ferme le menu.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'panel overlay-panel settings-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');

    const head = document.createElement('div');
    const title = document.createElement('h2');

    head.className = 'settings-head';
    title.className = 'overlay-title';
    title.id = 'settings-title';
    this.panel.setAttribute('aria-labelledby', title.id);

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'building-panel-close';
    this.closeButton.append(uiIcon('close'));
    this.closeButton.addEventListener('click', () => this.close());
    head.append(title, this.closeButton);

    const languageLabel = document.createElement('h3');
    const languages = document.createElement('div');

    languageLabel.className = 'settings-label';
    languages.className = 'settings-languages';
    languages.setAttribute('role', 'radiogroup');
    for (const locale of LOCALES) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'button-secondary settings-language';
      button.setAttribute('role', 'radio');
      button.lang = locale;
      // Chaque langue se nomme dans la sienne : on retrouve la sienne même sans lire l'autre.
      button.textContent = messagesOf(locale).settings.languageName;
      button.addEventListener('click', () => actions.setLocale(locale));
      this.languages.set(locale, button);
      languages.append(button);
    }

    this.soundButton = document.createElement('button');
    this.soundButton.type = 'button';
    this.soundButton.className = 'button-secondary settings-toggle';
    this.soundButton.addEventListener('click', () => actions.toggleSound());

    this.musicButton = document.createElement('button');
    this.musicButton.type = 'button';
    this.musicButton.className = 'button-secondary settings-toggle';
    this.musicButton.addEventListener('click', () => actions.toggleMusic());

    this.signsButton = document.createElement('button');
    this.signsButton.type = 'button';
    this.signsButton.className = 'button-secondary settings-toggle';
    this.signsButton.addEventListener('click', () => actions.toggleSigns());

    this.panel.append(head, languageLabel, languages, this.soundButton, this.musicButton, this.signsButton);
    this.root.append(this.panel);

    onLocale((current) => {
      const text = t().settings;

      title.textContent = text.title;
      languageLabel.textContent = text.language;
      this.closeButton.setAttribute('aria-label', t().common.close);
      for (const [locale, button] of this.languages) button.setAttribute('aria-checked', String(locale === current));
      this.setSound(this.sound);
      this.setMusic(this.music);
      this.setSigns(this.signs);
    });
  }

  public get open(): boolean {
    return !this.root.hidden;
  }

  public show(): void {
    if (this.open) return;
    this.root.hidden = false;
    this.actions.onToggle(true);
    this.closeButton.focus();
  }

  public close(): void {
    if (!this.open) return;
    this.root.hidden = true;
    this.actions.onToggle(false);
  }

  public toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  /** Le libellé et l'icône suivent le réglage du moteur audio. */
  public setSound(on: boolean): void {
    this.sound = on;
    toggleLabel(this.soundButton, on, uiIcon(on ? 'soundOn' : 'soundOff', 22), t().settings.sound);
  }

  public setMusic(on: boolean): void {
    this.music = on;
    toggleLabel(this.musicButton, on, uiIcon(on ? 'musicOn' : 'musicOff', 22), t().settings.music);
  }

  public setSigns(on: boolean): void {
    this.signs = on;
    toggleLabel(this.signsButton, on, uiIcon(on ? 'signOn' : 'signOff', 22), t().settings.signs);
  }
}

/** « Musique : oui » : l'icône, le nom du réglage, son état ; `aria-pressed` pour les lecteurs d'écran. */
function toggleLabel(button: HTMLButtonElement, on: boolean, icon: HTMLElement, name: string): void {
  button.replaceChildren(icon, t().settings.toggle(name, on));
  button.setAttribute('aria-pressed', String(on));
}
