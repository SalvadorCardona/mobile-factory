/**
 * Musique de fond : une boucle lofi, fichier audio servi depuis `public/`.
 *
 * Rhodes, pad, basse ronde, batterie boom-bap et craquements de vinyle,
 * 78 BPM en la mineur — c'est l'après, mais on s'y installe.
 *
 * Le fichier n'est demandé qu'au premier `start()`, donc au premier geste :
 * il ne retarde ni l'écran titre ni le début de partie, et la musique entre
 * en fondu quand il arrive. Décodé une fois, le buffer reste en cache ; un
 * `start()` après un `stop()` repart sans le recharger.
 *
 * Si le chargement ou le décodage échoue, le jeu continue sans musique : les
 * bruitages suffisent, une erreur à l'écran n'aiderait personne.
 */

const TRACK_URL = `${import.meta.env.BASE_URL}audio/lofi-loop.mp3`;

/**
 * Durée exacte de la boucle : 32 mesures à 78 BPM. Le MP3 est un peu plus
 * long (98,496 s) à cause du rembourrage de l'encodeur ; boucler sur la
 * longueur du buffer décodé ferait entendre ce silence à chaque tour. La
 * queue de réverbération est déjà repliée sur le début : la fin enchaîne
 * sans couture à cet instant précis.
 */
const LOOP_END_S = 98.461538;

/** Volume de la musique : sous les bruitages, qui portent l'information. */
const VOLUME = 0.35;
const FADE_IN_S = 1.5;
const FADE_OUT_S = 0.3;

export class Music {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private buffer: AudioBuffer | null = null;
  private loading: Promise<AudioBuffer | null> | null = null;
  /** La lecture en cours et son fondu ; `null` quand rien ne joue. */
  private voice: { source: AudioBufferSourceNode; fade: GainNode } | null = null;
  /** Vrai entre `start()` et `stop()` : le chargement ne joue que si on la veut encore. */
  private wanted = false;

  public constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = VOLUME;
    this.out.connect(destination);
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
    try {
      const response = await fetch(TRACK_URL);

      if (!response.ok) throw new Error(`${response.status}`);

      this.buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      return this.buffer;
    } catch {
      // Pas de musique, pas d'erreur : un prochain `start()` retentera.
      this.loading = null;
      return null;
    }
  }

  private play(buffer: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    const fade = this.ctx.createGain();
    const now = this.ctx.currentTime;

    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = LOOP_END_S;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + FADE_IN_S);
    source.connect(fade).connect(this.out);
    source.start(now);
    this.voice = { source, fade };
  }
}
