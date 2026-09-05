/**
 * Le moteur audio : un `AudioContext`, un volume maître, et deux règles.
 *
 * 1. Rien ne joue avant un geste du joueur. Les navigateurs mobiles refusent
 *    de démarrer l'audio sans lui ; `unlock()` est branché sur le premier
 *    `pointerdown` et fait tout partir — la musique comprise.
 * 2. Le moteur ne connaît pas le monde. Il expose `play(name)` ; c'est le
 *    câblage (`main.ts`) qui abonne chaque événement de simulation à un son.
 *
 * Le réglage muet survit au rechargement (`localStorage`) : couper le son
 * dans un jeu mobile est une décision qu'on ne veut pas reprendre à chaque
 * partie.
 */

import { Music } from './music.ts';
import { SOUNDS, type SoundName } from './synth.ts';

const MUTE_KEY = 'mobile-factory:muted';

/** Deux sons identiques à moins de cet intervalle : le second est ignoré. */
const DEDUPE_MS = 35;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: Music | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
  private mutedFlag: boolean;

  public constructor() {
    this.mutedFlag = readMuted();
  }

  public get muted(): boolean {
    return this.mutedFlag;
  }

  /** Vrai une fois le contexte créé et démarré par un geste. */
  public get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Crée et démarre le contexte. À appeler depuis un gestionnaire d'entrée
   * utilisateur ; ailleurs, le navigateur le laissera suspendu.
   */
  public unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;

      if (!Ctor) return;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.mutedFlag ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.8;
      this.sfx.connect(this.master);

      this.music = new Music(this.ctx, this.master);
    }

    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.music?.start();
  }

  public play(name: SoundName): void {
    if (!this.ctx || !this.sfx || this.mutedFlag || this.ctx.state !== 'running') return;

    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;

    if (now - last < DEDUPE_MS) return;
    this.lastPlayed.set(name, now);

    SOUNDS[name](this.ctx, this.sfx, this.ctx.currentTime);
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.mutedFlag);
    return this.mutedFlag;
  }

  public setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    writeMuted(muted);

    if (this.master && this.ctx) {
      // Une rampe courte : couper net fait claquer les haut-parleurs.
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  public destroy(): void {
    this.music?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // Mode privé ou stockage plein : le réglage ne survit pas, tant pis.
  }
}
