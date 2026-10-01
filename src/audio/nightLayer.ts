/**
 * La couche de tension de la nuit : un bourdon grave et une grosse caisse
 * synthétique, sous la musique.
 *
 * Elle n'existe que pendant la nuit, son activé : `start()` crée les nœuds,
 * `stop()` les éteint en fondu puis les libère. Son coupé, le moteur ne la
 * crée pas du tout.
 *
 * La grosse caisse est programmée un peu en avance sur l'horloge du
 * contexte, coup par coup : à chaque coup, la cadence est relue dans
 * `levels()` (noire, ou double croche pendant une vague). Un onglet en
 * arrière-plan ralentit le minuteur ; au retour, les coups manqués ne sont
 * pas rattrapés en rafale, la pulsation repart simplement.
 */

import { DRONE, NIGHT_BPM, type NightLevels } from './nightMood.ts';

/** Le minuteur passe toutes les 25 ms et programme les coups des 100 ms à venir. */
const SCHEDULE_MS = 25;
const LOOKAHEAD_S = 0.1;

export class NightLayer {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly drone: GainNode;
  private readonly oscillators: OscillatorNode[] = [];
  private readonly levels: (now: number) => NightLevels;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextKick: number;

  public constructor(ctx: AudioContext, destination: AudioNode, levels: (now: number) => NightLevels) {
    this.ctx = ctx;
    this.levels = levels;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(destination);
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    this.drone.connect(this.out);
    this.nextKick = ctx.currentTime;
  }

  /** Le bourdon entre en fondu sur `fadeS` secondes, la pulsation part au temps suivant. */
  public start(fadeS: number): void {
    const now = this.ctx.currentTime;

    for (const frequency of DRONE.notes) {
      const osc = this.ctx.createOscillator();

      osc.type = 'triangle';
      osc.frequency.value = frequency;
      osc.connect(this.drone);
      osc.start(now);
      this.oscillators.push(osc);
    }

    this.drone.gain.setValueAtTime(0, now);
    this.drone.gain.linearRampToValueAtTime(this.levels(now).drone, now + fadeS);
    this.nextKick = now + 60 / NIGHT_BPM;
    this.timer = setInterval(() => this.schedule(), SCHEDULE_MS);
  }

  /** Tout s'éteint en fondu sur `fadeS` secondes ; les nœuds se libèrent ensuite. */
  public stop(fadeS: number): void {
    const now = this.ctx.currentTime;
    const end = now + fadeS;

    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, end);
    for (const osc of this.oscillators) osc.stop(end + 0.05);
    setTimeout(() => this.out.disconnect(), (fadeS + 0.2) * 1000);
  }

  private schedule(): void {
    const now = this.ctx.currentTime;

    // Le minuteur a dormi (onglet caché) : on repart d'ici, sans rafale.
    if (this.nextKick < now) this.nextKick = now + 0.01;

    while (this.nextKick < now + LOOKAHEAD_S) {
      const levels = this.levels(this.nextKick);

      this.kick(this.nextKick, levels.pulse);
      this.nextKick += 60 / NIGHT_BPM / levels.stepsPerBeat;
    }
  }

  /** Une grosse caisse : un sinus qui tombe de 120 à 45 Hz, attaque en rampe pour ne pas claquer. */
  private kick(at: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const end = at + 0.28;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(45, end);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.005);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(this.out);
    osc.start(at);
    osc.stop(end + 0.02);
  }
}
