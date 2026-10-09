/**
 * Le réglage « Alertes de vague », sur l'appareil : une notification du
 * système quand une vague s'annonce (`waveAnnounced`) et que la fenêtre du
 * jeu n'a pas le focus. Une préférence, comme les pancartes — ni sauvegarde
 * ni journal de commandes. Éteint tant qu'on ne l'a pas allumé : c'est
 * l'allumer qui demande la permission au navigateur. Chaque accès au
 * stockage peut lever, et aucun ne doit empêcher de jouer.
 */

import type { SaveStorage } from './localSave.ts';

/** La clé des alertes — distincte de celles de la sauvegarde, du jardin, du record, du zoom et des pancartes. */
export const WAVE_ALERTS_KEY = 'mobile-factory:wave-alerts';

export class LocalWaveAlerts {
  private readonly storage: SaveStorage | null;

  public constructor(storage: SaveStorage | null) {
    this.storage = storage;
  }

  /** Le `localStorage` du navigateur, s'il est joignable. */
  public static browser(): LocalWaveAlerts {
    try {
      return new LocalWaveAlerts(globalThis.localStorage ?? null);
    } catch {
      return new LocalWaveAlerts(null);
    }
  }

  /** Les alertes sont-elles voulues ? Non tant qu'on ne les a pas allumées. */
  public load(): boolean {
    try {
      return this.storage?.getItem(WAVE_ALERTS_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public save(on: boolean): void {
    try {
      this.storage?.setItem(WAVE_ALERTS_KEY, String(on));
    } catch {
      // Mode privé ou stockage plein : le réglage ne survit pas, tant pis.
    }
  }
}
