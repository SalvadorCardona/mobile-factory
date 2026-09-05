/**
 * Musique de fond : une boucle chiptune séquencée à la volée.
 *
 * Pas de fichier, pas de décodage : une basse en triangle, une mélodie en
 * carré à faible volume, et un souffle de charleston en bruit filtré. La
 * boucle fait huit mesures en la mineur, lente et un peu creuse — c'est
 * l'après, pas la fête.
 *
 * Séquencement par anticipation : un minuteur regarde toutes les 100 ms
 * jusqu'où la boucle est planifiée et pousse les notes des 250 ms à venir
 * sur l'horloge audio, qui est la seule fiable. C'est le schéma classique
 * pour qu'un onglet mobile qui bégaie ne fasse pas dérailler le tempo.
 */

const BPM = 92;
const BEAT = 60 / BPM;
/** Une croche, l'unité de la partition. */
const STEP = BEAT / 2;

const LOOKAHEAD_S = 0.25;
const TIMER_MS = 100;

/** Fréquence d'une note MIDI. */
function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/* Notes MIDI : A2 = 45, A3 = 57, A4 = 69. `0` = silence. */

/** Basse : une note par temps, une mesure par accord — Am, F, C, G, Am, F, E, E. */
const BASS: readonly number[] = [
  45, 45, 45, 45, 41, 41, 41, 41, 48, 48, 48, 48, 43, 43, 43, 43,
  45, 45, 45, 45, 41, 41, 41, 41, 40, 40, 40, 40, 40, 40, 43, 43,
];

/** Mélodie : une case par croche, 64 cases pour huit mesures. */
const LEAD: readonly number[] = [
  69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 0, 0, 65, 0, 0, 0,
  64, 0, 67, 0, 72, 0, 67, 0, 71, 0, 0, 0, 67, 0, 0, 0,
  69, 0, 72, 0, 76, 0, 72, 0, 77, 0, 76, 0, 72, 0, 0, 0,
  71, 0, 0, 0, 68, 0, 0, 0, 64, 0, 0, 0, 0, 0, 0, 0,
];

/** Charleston : une case par croche, `1` = coup fermé, `2` = coup ouvert. */
const HAT: readonly number[] = [
  1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0,
];

export class Music {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private timer = 0;
  /** Index de la prochaine croche à planifier, et son instant sur l'horloge audio. */
  private step = 0;
  private nextTime = 0;
  private noise: AudioBuffer | null = null;

  public constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(destination);
  }

  public start(): void {
    if (this.timer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TIMER_MS);
    this.schedule();
  }

  public stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private schedule(): void {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.play(this.step, this.nextTime);
      this.step = (this.step + 1) % LEAD.length;
      this.nextTime += STEP;
    }
  }

  private play(step: number, at: number): void {
    const bass = step % 2 === 0 ? BASS[step / 2]! : 0;
    const lead = LEAD[step]!;
    const hat = HAT[step % HAT.length]!;

    if (bass) this.tone('triangle', hz(bass), at, BEAT * 0.9, 0.5);
    if (lead) this.tone('square', hz(lead), at, STEP * 1.8, 0.07);
    if (hat) this.hat(at, hat === 2 ? 0.12 : 0.04);
  }

  private tone(type: OscillatorType, frequency: number, at: number, duration: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.out);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private hat(at: number, duration: number): void {
    if (!this.noise) {
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate / 4, this.ctx.sampleRate);

      const data = this.noise.getChannelData(0);

      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    source.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(0.06, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.out);
    source.start(at);
    source.stop(at + duration + 0.02);
  }
}
