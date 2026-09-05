/**
 * Synthèse des effets sonores.
 *
 * Aucun fichier audio : chaque son est fabriqué à la volée avec des
 * oscillateurs et du bruit filtré. C'est cohérent avec la direction
 * artistique — des sons de console 16 bits pour du pixel art 16 bits — et ça
 * ne coûte ni téléchargement ni décodage sur un téléphone.
 *
 * Chaque fonction reçoit le contexte, la destination et l'instant de départ,
 * et branche ce qu'il faut. Les nœuds se libèrent seuls à la fin (`stop`).
 */

export type SoundName =
  | 'chop'
  | 'rock'
  | 'deliver'
  | 'build'
  | 'arrow'
  | 'hit'
  | 'die'
  | 'thud'
  | 'collapse'
  | 'alarm'
  | 'baby'
  | 'defeat'
  | 'open';

/** Une seconde de bruit blanc, partagée par tous les sons qui en ont besoin. */
let noiseBuffer: AudioBuffer | null = null;

function noise(ctx: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();

  source.buffer = noiseBuffer;
  return source;
}

interface Env {
  attack?: number;
  decay: number;
  peak?: number;
}

/** Une enveloppe attaque/déclin sur un gain, de `at` à `at + attack + decay`. */
function envelope(ctx: AudioContext, at: number, env: Env): GainNode {
  const gain = ctx.createGain();
  const attack = env.attack ?? 0.005;
  const peak = env.peak ?? 1;

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + env.decay);
  return gain;
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  type: OscillatorType,
  from: number,
  to: number,
  env: Env,
): void {
  const osc = ctx.createOscillator();
  const gain = envelope(ctx, at, env);
  const end = at + (env.attack ?? 0.005) + env.decay;

  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, end);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(end + 0.02);
}

function burst(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  filter: BiquadFilterType,
  from: number,
  to: number,
  env: Env,
): void {
  const source = noise(ctx);
  const biquad = ctx.createBiquadFilter();
  const gain = envelope(ctx, at, env);
  const end = at + (env.attack ?? 0.005) + env.decay;

  biquad.type = filter;
  biquad.Q.value = 1.2;
  biquad.frequency.setValueAtTime(from, at);
  if (to !== from) biquad.frequency.exponentialRampToValueAtTime(to, end);
  source.connect(biquad).connect(gain).connect(out);
  source.start(at);
  source.stop(end + 0.02);
}

/** Variation aléatoire de ±`spread` autour de 1 : deux coups de hache ne sonnent jamais pareil. */
function vary(spread: number): number {
  return 1 + (Math.random() * 2 - 1) * spread;
}

export const SOUNDS: Record<SoundName, (ctx: AudioContext, out: AudioNode, at: number) => void> = {
  /** Hache dans le bois : un claquement mat et une résonance basse. */
  chop(ctx, out, at) {
    const v = vary(0.12);

    burst(ctx, out, at, 'bandpass', 1400 * v, 500 * v, { decay: 0.09, peak: 0.9 });
    tone(ctx, out, at, 'triangle', 150 * v, 70 * v, { decay: 0.14, peak: 0.6 });
  },

  /** Pierre qui casse : plus sec, plus aigu, avec un second éclat. */
  rock(ctx, out, at) {
    const v = vary(0.1);

    burst(ctx, out, at, 'highpass', 2600 * v, 1200 * v, { decay: 0.06, peak: 0.8 });
    burst(ctx, out, at + 0.05, 'bandpass', 3200 * v, 900 * v, { decay: 0.08, peak: 0.5 });
    tone(ctx, out, at, 'square', 220 * v, 90 * v, { decay: 0.05, peak: 0.25 });
  },

  /** Un objet posé sur le chantier. */
  deliver(ctx, out, at) {
    tone(ctx, out, at, 'square', 660, 880, { decay: 0.06, peak: 0.18 });
  },

  /** Chantier achevé : trois notes qui montent. */
  build(ctx, out, at) {
    for (const [i, f] of [523, 659, 784, 1047].entries()) {
      tone(ctx, out, at + i * 0.09, 'triangle', f, f, { decay: 0.18, peak: 0.35 });
    }
  },

  /** Une flèche qui siffle. */
  arrow(ctx, out, at) {
    burst(ctx, out, at, 'bandpass', 2400 * vary(0.1), 700, { attack: 0.01, decay: 0.12, peak: 0.45 });
  },

  /** Flèche dans un mutant. */
  hit(ctx, out, at) {
    tone(ctx, out, at, 'square', 320 * vary(0.1), 160, { decay: 0.07, peak: 0.3 });
    burst(ctx, out, at, 'lowpass', 1800, 400, { decay: 0.08, peak: 0.6 });
  },

  /** Un mutant qui tombe : un râle qui descend. */
  die(ctx, out, at) {
    tone(ctx, out, at, 'sawtooth', 260 * vary(0.08), 55, { attack: 0.02, decay: 0.32, peak: 0.28 });
    burst(ctx, out, at + 0.05, 'lowpass', 900, 200, { decay: 0.25, peak: 0.4 });
  },

  /** Un coup de mutant sur un mur. */
  thud(ctx, out, at) {
    tone(ctx, out, at, 'sine', 90, 45, { decay: 0.18, peak: 0.8 });
    burst(ctx, out, at, 'lowpass', 600, 150, { decay: 0.1, peak: 0.5 });
  },

  /** Un bâtiment qui s'effondre. */
  collapse(ctx, out, at) {
    burst(ctx, out, at, 'lowpass', 1200, 80, { attack: 0.02, decay: 0.7, peak: 1 });
    tone(ctx, out, at, 'triangle', 110, 30, { decay: 0.6, peak: 0.6 });
  },

  /** Une vague approche : deux tons alternés, deux fois. */
  alarm(ctx, out, at) {
    for (let i = 0; i < 4; i += 1) {
      const f = i % 2 === 0 ? 440 : 554;

      tone(ctx, out, at + i * 0.16, 'square', f, f, { attack: 0.01, decay: 0.13, peak: 0.16 });
    }
  },

  /** Une naissance : un carillon doux. */
  baby(ctx, out, at) {
    for (const [i, f] of [659, 880, 1319].entries()) {
      tone(ctx, out, at + i * 0.12, 'sine', f, f, { attack: 0.01, decay: 0.4, peak: 0.3 });
    }
  },

  /** La mairie est tombée. */
  defeat(ctx, out, at) {
    for (const [i, f] of [392, 349, 311, 262].entries()) {
      tone(ctx, out, at + i * 0.28, 'triangle', f, f * 0.98, { attack: 0.02, decay: 0.3, peak: 0.4 });
    }
  },

  /** Une fenêtre qui s'ouvre. */
  open(ctx, out, at) {
    tone(ctx, out, at, 'square', 880, 1320, { decay: 0.05, peak: 0.12 });
  },
};
