/**
 * Musique de fond : un thème orchestral mélancolique (violoncelle, harpe,
 * cordes), fichier audio servi depuis `public/audio/music/`.
 *
 * Deux encodages de la même boucle : Ogg Vorbis d'abord, AAC (`.m4a`) pour
 * Safari, qui ne décode pas toujours le Vorbis. `trackUrls()` met en tête
 * celui que le navigateur annonce savoir lire ; si le décodage échoue
 * quand même, on passe au suivant.
 *
 * Les octets sont demandés dès le chargement de la page (`prefetchMusic`),
 * sans attendre : l'écran titre ne les attend pas, et ils sont là quand le
 * premier geste crée le contexte audio. Décodé une fois, le buffer reste en
 * cache ; un `start()` après un `stop()` repart sans le recharger.
 *
 * La boucle passe par un `AudioBufferSourceNode` (`loop = true`), pas par un
 * `<audio loop>` qui laisse un blanc au raccord selon les navigateurs.
 *
 * La nuit, la boucle passe derrière un passe-bas qui se ferme et son volume
 * baisse (`setNight`) : on l'entend « de l'autre côté du mur ».
 *
 * Si le chargement ou le décodage échoue, le jeu continue sans musique : les
 * bruitages suffisent, une erreur à l'écran n'aiderait personne.
 */

import { MUSIC_DAY, MUSIC_NIGHT } from './nightMood.ts';

const TRACKS = [
  { url: `${import.meta.env.BASE_URL}audio/music/mobile-factory-melancolique-loop.ogg`, type: 'audio/ogg; codecs="vorbis"' },
  { url: `${import.meta.env.BASE_URL}audio/music/mobile-factory-melancolique-loop.m4a`, type: 'audio/mp4; codecs="mp4a.40.2"' },
] as const;

/**
 * Durée exacte de la boucle : 4 811 751 échantillons à 44,1 kHz. La fin est
 * déjà fondue dans le début ; le Vorbis décodé compte quelques échantillons
 * de plus, et un décodeur AAC peut ajouter son rembourrage : boucler sur la
 * longueur du buffer ferait entendre ce petit trou à chaque tour.
 */
const LOOP_END_S = 4_811_751 / 44_100;

const FADE_IN_S = 1;
const FADE_OUT_S = 0.3;

/** Les encodages à essayer, celui que le navigateur dit savoir lire d'abord. */
function trackUrls(): string[] {
  const probe = typeof document === 'undefined' ? null : document.createElement('audio');
  const playable = TRACKS.filter((track) => probe?.canPlayType(track.type) !== '');

  return [...playable, ...TRACKS.filter((track) => !playable.includes(track))].map((track) => track.url);
}

/** Les octets du premier encodage, demandés une seule fois. */
let prefetched: Promise<ArrayBuffer | null> | null = null;

function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  return fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);
}

/** Lance le téléchargement de la musique en tâche de fond, sans rien attendre. */
export function prefetchMusic(): void {
  const [first] = trackUrls();

  if (first) prefetched ??= fetchBytes(first);
}

export class Music {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  /** Le passe-bas de la nuit, entre les lectures et `out` : grand ouvert le jour. */
  private readonly filter: BiquadFilterNode;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer | null> | null = null;
  /** La lecture en cours et son fondu ; `null` quand rien ne joue. */
  private voice: { source: AudioBufferSourceNode; fade: GainNode } | null = null;
  /** Vrai entre `start()` et `stop()` : le chargement ne joue que si on la veut encore. */
  private wanted = false;

  public constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    // Sous les bruitages, qui portent l'information.
    this.out.gain.value = MUSIC_DAY.volume;
    this.out.connect(destination);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = MUSIC_DAY.cutoff;
    this.filter.connect(this.out);
  }

  /** Ferme (nuit) ou rouvre (jour) le passe-bas et règle le volume, en rampe sur `rampS` secondes. */
  public setNight(on: boolean, rampS: number): void {
    const { cutoff, volume } = on ? MUSIC_NIGHT : MUSIC_DAY;
    const now = this.ctx.currentTime;

    for (const [param, value] of [
      [this.filter.frequency, cutoff],
      [this.out.gain, volume],
    ] as const) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + rampS);
    }
  }

  public start(): void {
    this.wanted = true;
    if (this.voice) return;

    if (this.buffer) {
      this.play(this.buffer);
      return;
    }

    // Un `start()` pendant le chargement attend le même chargement : une
    // seule lecture partira à son arrivée.
    this.loading ??= this.load();
    void this.loading.then((buffer) => {
      if (buffer && this.wanted && !this.voice) this.play(buffer);
    });
  }

  public stop(): void {
    this.wanted = false;
    if (!this.voice) return;

    const { source, fade } = this.voice;
    const now = this.ctx.currentTime;

    // Un fondu court plutôt qu'un arrêt net, qui claquerait.
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    source.stop(now + FADE_OUT_S);
    this.voice = null;
  }

  private async load(): Promise<AudioBuffer | null> {
    prefetchMusic();

    for (const [index, url] of trackUrls().entries()) {
      // Le premier encodage a déjà été demandé ; le préchargement ne sert
      // qu'une fois, un nouvel essai refait la requête.
      const bytes = index === 0 && prefetched ? await prefetched : await fetchBytes(url);

      if (index === 0) prefetched = null;
      if (!bytes) continue;

      try {
        this.buffer = await this.ctx.decodeAudioData(bytes);
        return this.buffer;
      } catch {
        // Encodage annoncé mais pas décodé : le suivant.
      }
    }

    // Pas de musique, pas d'erreur : un prochain `start()` retentera.
    this.loading = null;
    return null;
  }

  private play(buffer: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    const fade = this.ctx.createGain();
    const now = this.ctx.currentTime;

    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(LOOP_END_S, buffer.duration);
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + FADE_IN_S);
    source.connect(fade).connect(this.filter);
    source.start(now);
    this.voice = { source, fade };
  }
}
