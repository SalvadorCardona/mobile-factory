/**
 * Le jardin des souvenirs, sur l'écran titre.
 *
 * On y voit les graines laissées par les colonies tombées, on les plante
 * pour débloquer les bonus de `data/perks.ts`, et on bascule « Partie pure »
 * pour partir sans eux. Comme les autres écrans, il ne touche à rien : il
 * demande à `main.ts` de planter ou de basculer, et redessine le jardin
 * qu'on lui rend.
 */

import { PERKS, PERK_IDS, type PerkId } from '../data/perks.ts';
import { onLocale, t } from '../i18n/locale.ts';
import { canPlant, type Garden } from '../sim/garden.ts';
import { perkIcon, uiIcon } from './icons.ts';

export interface GardenActions {
  /** Planter un bonus ; renvoie le jardin après coup. */
  plant: (perk: PerkId) => Garden;
  /** Basculer « Partie pure » ; renvoie le jardin après coup. */
  setPure: (pure: boolean) => Garden;
}

export class GardenPanel {
  public readonly root: HTMLElement;

  private readonly seeds: HTMLElement;
  private readonly perks: HTMLElement;
  private readonly pure: HTMLButtonElement;
  private readonly actions: GardenActions;
  private readonly onChange: (garden: Garden) => void;
  private garden: Garden;

  /** `onChange` : le jardin a changé — l'écran titre met à jour son bouton. `onClose` : « Retour ». */
  public constructor(garden: Garden, actions: GardenActions, onChange: (garden: Garden) => void, onClose: () => void) {
    this.garden = garden;
    this.actions = actions;
    this.onChange = onChange;

    this.root = document.createElement('div');
    this.root.className = 'panel overlay-panel garden-panel';
    this.root.setAttribute('role', 'dialog');

    const title = document.createElement('h2');

    title.className = 'overlay-title';

    const text = document.createElement('p');

    text.className = 'overlay-text';

    this.seeds = document.createElement('div');
    this.seeds.className = 'garden-seeds';

    this.perks = document.createElement('ul');
    this.perks.className = 'garden-perks';

    this.pure = document.createElement('button');
    this.pure.type = 'button';
    this.pure.className = 'garden-pure';
    this.pure.setAttribute('role', 'switch');
    this.pure.addEventListener('click', () => this.render(this.actions.setPure(!this.garden.pure)));

    const back = document.createElement('button');

    back.type = 'button';
    back.className = 'button-secondary';
    back.addEventListener('click', onClose);

    this.root.append(title, text, this.seeds, this.perks, this.pure, back);
    onLocale(() => {
      const { garden: words } = t().screens;

      this.root.setAttribute('aria-label', words.title);
      title.textContent = words.title;
      text.textContent = words.text;
      back.textContent = words.back;
      this.render(this.garden);
    });
  }

  private render(garden: Garden): void {
    this.garden = garden;
    this.onChange(garden);

    const words = t().screens.garden;

    this.seeds.replaceChildren(uiIcon('seed', 26), words.seeds(garden.seeds));

    this.perks.replaceChildren(
      ...PERK_IDS.map((id) => {
        const perk = PERKS[id];
        const text = t().perks[id];
        const row = document.createElement('li');
        const label = document.createElement('div');
        const name = document.createElement('strong');
        const description = document.createElement('span');

        row.className = 'garden-perk';
        label.className = 'garden-perk-text';
        name.textContent = text.label;
        description.textContent = text.description;
        label.append(name, description);

        const planted = garden.planted.includes(id);

        row.dataset['planted'] = String(planted);

        if (planted) {
          const badge = document.createElement('span');

          badge.className = 'garden-planted';
          badge.textContent = words.planted;
          row.append(perkIcon(id), label, badge);
          return row;
        }

        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'garden-plant';
        button.disabled = !canPlant(garden, id);
        button.setAttribute('aria-label', words.plant(text.label, perk.cost));
        button.append(uiIcon('seed', 18), String(perk.cost));
        button.addEventListener('click', () => this.render(this.actions.plant(id)));
        row.append(perkIcon(id), label, button);
        return row;
      }),
    );

    this.pure.setAttribute('aria-checked', String(garden.pure));
    this.pure.replaceChildren(
      Object.assign(document.createElement('span'), { className: 'garden-switch' }),
      words.pure,
    );
  }
}
