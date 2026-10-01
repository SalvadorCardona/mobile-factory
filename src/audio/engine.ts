/**
 * Le moteur audio : un `AudioContext`, un volume maître, et deux règles.
 *
 * 1. Rien ne joue avant un geste du joueur. Les navigateurs mobiles refusent
 *    de démarrer l'audio sans lui ; `unlock()` est branché sur le premier
 *    `pointerdown` et fait tout partir — la musique comprise.
 * 2. Le moteur ne connaît pas le monde. Il expose `play(name)` ; c'est le
 *    câblage (`main.ts`) qui abonne chaque événement de simulation à un son.
 *
 * La nuit a sa propre humeur (`nightMood.ts`) : le moteur la tient même
 * avant le premier geste, et l'applique dès qu'il a un contexte — passe-bas
 * sur la musique, couche de tension (`nightLayer.ts`) si le son est activé.
 *
 * Le réglage muet et celui de la musique survivent au rechargement
 * (`localStorage`) : couper le son dans un jeu mobile est une décision
 * qu'on ne veut pas reprendre à chaque partie. Couper la musique laisse les
 * bruitages.
 *
 * Onglet caché, le contexte est suspendu (`setHidden`) : plus de musique en
 * arrière-plan, et elle reprend où elle en était au retour.
 */

import { Music } from './music.ts';
import { NightLayer } from './nightLayer.ts';
import { DAWN_RAMP_S, DAY_MOOD, DUSK_RAMP_S, TENSION_FADE_S, nightLevels, nightMood, type NightMoment } from './nightMood.ts';
import { SOUNDS, type SoundName } from './synth.ts';

const MUTE_KEY = 'mobile-factory:muted';
const MUSIC_KEY = 'mobile-factory:music';

/** Deux sons identiques à moins de cet intervalle : le second est ignoré. */
const DEDUPE_MS = 35;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: Music | null = null;
  private mood = DAY_MOOD;
  /** La couche de tension : elle n'existe que la nuit, son activé. */
  private tension: NightLayer | null = null;
  private readonly lastPlayed = new Map<SoundName, number>();
  private mutedFlag: boolean;
  private musicFlag: boolean;
  private hidden = false;

  public constructor() {
    this.mutedFlag = readFlag(MUTE_KEY, false);
    this.musicFlag = readFlag(MUSIC_KEY, true);
  }

  public get muted(): boolean {
    return this.mutedFlag;
  }

  /** Vrai si la musique de fond est voulue (réglage du joueur, indépendant du muet). */
  public get musicOn(): boolean {
    return this.musicFlag;
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
      // Une partie rechargée en pleine nuit : la nuit est déjà là, sans rampe.
      this.music.setNight(this.mood.night, 0);
      this.syncTension(DUSK_RAMP_S);
    }

    if (this.hidden) return;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (this.musicFlag) this.music?.start();
  }

  /** L'onglet passe en arrière-plan ou en revient : tout se suspend, puis reprend où il en était. */
  public setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  public toggleMusic(): boolean {
    this.musicFlag = !this.musicFlag;
    writeFlag(MUSIC_KEY, this.musicFlag);
    if (this.musicFlag) this.music?.start();
    else this.music?.stop();
    return this.musicFlag;
  }

  public play(name: SoundName): void {
    if (!this.ctx || !this.sfx || this.mutedFlag || this.ctx.state !== 'running') return;

    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;

    if (now - last < DEDUPE_MS) return;
    this.lastPlayed.set(name, now);

    SOUNDS[name](this.ctx, this.sfx, this.ctx.currentTime);
  }

  /** Un moment de la nuit : crépuscule, vague, vague repoussée, aube. */
  public night(moment: NightMoment): void {
    const wasNight = this.mood.night;

    this.mood = nightMood(this.mood, moment, this.ctx?.currentTime ?? 0);
    if (this.mood.night === wasNight) return;

    this.music?.setNight(this.mood.night, this.mood.night ? DUSK_RAMP_S : DAWN_RAMP_S);
    this.syncTension(this.mood.night ? DUSK_RAMP_S : TENSION_FADE_S);
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.mutedFlag);
    return this.mutedFlag;
  }

  public setMuted(muted: boolean): void {
    this.mutedFlag = muted;
    writeFlag(MUTE_KEY, muted);

    if (this.master && this.ctx) {
      // Une rampe courte : couper net fait claquer les haut-parleurs.
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    this.syncTension(muted ? TENSION_FADE_S : DUSK_RAMP_S);
  }

  /** Crée la couche de tension s'il fait nuit et que le son est activé, l'éteint sinon. */
  private syncTension(fadeS: number): void {
    const wanted = this.mood.night && !this.mutedFlag && this.ctx !== null && this.master !== null;

    if (wanted && !this.tension && this.ctx && this.master) {
      this.tension = new NightLayer(this.ctx, this.master, (now) => nightLevels(this.mood, now));
      this.tension.start(fadeS);
    } else if (!wanted && this.tension) {
      this.tension.stop(fadeS);
      this.tension = null;
    }
  }

  public destroy(): void {
    this.music?.stop();
    this.tension?.stop(0);
    this.tension = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);

    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Mode privé ou stockage plein : le réglage ne survit pas, tant pis.
  }
}
