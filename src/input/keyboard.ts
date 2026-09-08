/**
 * Déplacement au clavier, pour jouer sur PC.
 *
 * Le joystick reste l'entrée de référence sur téléphone ; ici on produit le
 * même axe dans [-1, 1] à partir des touches enfoncées, et `main.ts` en fait
 * la même commande `setMoveAxis`. La simulation ne sait pas d'où vient l'axe.
 *
 * Les touches sont lues par **position physique** (`KeyboardEvent.code`),
 * jamais par caractère (`event.key`). C'est ce qui rend le jeu jouable sans
 * réglage sur toutes les dispositions : la touche en haut à gauche du bloc
 * de lettres s'appelle `KeyW` quelle que soit la lettre gravée dessus — Z sur
 * un clavier AZERTY, W sur un QWERTY. Le joueur pose la main au même endroit
 * dans les deux cas, ZQSD ou WASD, et les flèches marchent partout.
 *
 * Sortie **numérique** : une touche vaut 1 ; deux touches en diagonale sont
 * normalisées pour qu'Adam n'aille pas plus vite en diagonale. Deux touches
 * opposées s'annulent.
 *
 * Aucun import Pixi ici : ce fichier ne produit qu'un état, comme le joystick.
 */

/** Position physique → composante d'axe. Une touche par ligne, pas de doublon possible. */
const AXES: Readonly<Record<string, { x: number; y: number }>> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export interface KeyboardState {
  /** Au moins une touche de déplacement est enfoncée. */
  active: boolean;
  /** Sortie normalisée, chaque composante dans [-1, 1]. */
  axisX: number;
  axisY: number;
}

export class Keyboard {
  public readonly state: KeyboardState = { active: false, axisX: 0, axisY: 0 };

  private readonly held = new Set<string>();
  private readonly detach: () => void;

  public constructor() {
    const down = (event: KeyboardEvent) => this.handleDown(event);
    const up = (event: KeyboardEvent) => this.handleUp(event);
    // Une touche encore enfoncée quand la fenêtre perd le focus n'enverra
    // jamais son `keyup` : sans ce relâchement, Adam continuerait tout seul.
    const release = () => this.releaseAll();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);

    this.detach = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }

  private handleDown(event: KeyboardEvent): void {
    if (!(event.code in AXES) || isTyping(event.target)) return;

    // Les flèches feraient défiler la page ; la répétition automatique du
    // système n'apporte rien à une touche déjà tenue.
    event.preventDefault();

    if (event.repeat) return;

    this.held.add(event.code);
    this.recompute();
  }

  private handleUp(event: KeyboardEvent): void {
    if (!this.held.delete(event.code)) return;
    this.recompute();
  }

  private releaseAll(): void {
    if (this.held.size === 0) return;
    this.held.clear();
    this.recompute();
  }

  private recompute(): void {
    let x = 0;
    let y = 0;

    for (const code of this.held) {
      const axis = AXES[code];

      if (axis) {
        x += axis.x;
        y += axis.y;
      }
    }

    const length = Math.hypot(x, y);

    this.state.active = this.held.size > 0;
    this.state.axisX = length > 0 ? x / length : 0;
    this.state.axisY = length > 0 ? y / length : 0;
  }

  public destroy(): void {
    this.detach();
    this.held.clear();
  }
}

/** Le clavier appartient au champ de saisie quand il y en a un sous le focus. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
  );
}
