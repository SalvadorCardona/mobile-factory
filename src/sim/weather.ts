/**
 * Le calendrier météo : une fonction de la seed et du tick, rien d'autre.
 *
 * Aucune météo n'est de l'état. Le créneau `slot` tire sa météo, son heure et
 * la direction de son vent de `hash3(seed, slot, …)` ; le monde n'a qu'à
 * demander « quel temps fait-il au tick t ? ». Rien à sauvegarder, rien qui
 * dérive d'une partie à l'autre : même seed, même météo au même moment.
 * Seule exception, lue elle aussi dans l'horloge et non stockée : une météo
 * `harsh` qui tomberait sur une nuit est effacée (`spoilsNight`).
 *
 * Une météo tient dans son créneau, avec la marge de l'annonce de chaque
 * côté : deux météos ne se chevauchent jamais, et chacune est annoncée.
 */

import { hash3 } from '../core/rng.ts';
import { DAY_CYCLE } from '../data/dayNight.ts';
import { WEATHER, WEATHER_CALENDAR, WEATHER_IDS, type WeatherId } from '../data/weather.ts';
import { CYCLE_TICKS } from './dayNight.ts';

/** Une météo au calendrier : laquelle, de quand à quand, et d'où souffle le vent. */
export interface WeatherSpell {
  id: WeatherId;
  /** Premier tick où elle s'applique, et premier tick où elle ne s'applique plus. */
  start: number;
  end: number;
  /** Direction du vent, unitaire — toutes les météos en ont une, seul le vent s'en sert. */
  windX: number;
  windY: number;
}

/** Sels du hachage : un tirage par question, pour qu'ils ne se ressemblent pas. */
const SALT_KIND = 0x3e7a;
const SALT_START = 0x51a7;
const SALT_WIND = 0x77d1;

/** La météo du créneau `slot`, ou `null` s'il reste calme. */
export function weatherOfSlot(seed: number, slot: number): WeatherSpell | null {
  if (slot < WEATHER_CALENDAR.calmSlots) return null;

  const id = pick(unit(seed, slot, SALT_KIND));

  if (!id) return null;

  const { slotTicks, announceTicks } = WEATHER_CALENDAR;
  const duration = WEATHER[id].durationTicks;
  const room = Math.max(0, slotTicks - duration - announceTicks * 2);
  const start = slot * slotTicks + announceTicks + Math.floor(unit(seed, slot, SALT_START) * room);
  const angle = unit(seed, slot, SALT_WIND) * Math.PI * 2;

  return { id, start, end: start + duration, windX: Math.cos(angle), windY: Math.sin(angle) };
}

/** La météo en cours au tick `tick`, ou `null` par temps calme. */
export function weatherAt(seed: number, tick: number): WeatherSpell | null {
  const spell = weatherOfSlot(seed, Math.floor(tick / WEATHER_CALENDAR.slotTicks));

  return spell && tick >= spell.start && tick < spell.end ? spell : null;
}

/** La prochaine météo qui commence strictement après `tick`, ou `null` si aucune dans les deux créneaux qui suivent. */
export function nextWeather(seed: number, tick: number): WeatherSpell | null {
  const slot = Math.floor(tick / WEATHER_CALENDAR.slotTicks);

  for (let next = slot; next <= slot + 2; next += 1) {
    const spell = weatherOfSlot(seed, next);

    if (spell && spell.start > tick) return spell;
  }
  return null;
}

/**
 * Vrai si cette météo `harsh` gâcherait une nuit : elle tomberait, annonce
 * comprise, pendant une nuit (aube comprise) ou dans les `margin` ticks qui
 * précèdent sa tombée. Le monde l'efface alors du ciel — jamais deux
 * mauvaises choses en même temps, et les vagues gardent leur heure.
 *
 * `cycleStart` est le lever du premier jour (0 tant que la mairie est en
 * chantier : aucune nuit à gâcher). Il ne bouge plus une fois posé, et une
 * météo annoncée avant lui s'achève bien avant la première nuit : une météo
 * annoncée n'est jamais effacée.
 */
export function spoilsNight(spell: WeatherSpell, cycleStart: number, margin: number): boolean {
  if (!WEATHER[spell.id].harsh || cycleStart === 0) return false;

  const from = spell.start - WEATHER_CALENDAR.announceTicks - cycleStart;
  const to = spell.end - cycleStart;
  const nightOffset = DAY_CYCLE.day + DAY_CYCLE.dusk;

  for (let cycle = Math.floor(from / CYCLE_TICKS) - 1; cycle <= Math.floor(to / CYCLE_TICKS) + 1; cycle += 1) {
    const nightFrom = cycle * CYCLE_TICKS + nightOffset - margin;
    const nightTo = (cycle + 1) * CYCLE_TICKS;

    if (cycle >= 0 && from < nightTo && to > nightFrom) return true;
  }
  return false;
}

/** Dans [0, 1), depuis la seed, le créneau et un sel. */
function unit(seed: number, slot: number, salt: number): number {
  return hash3(seed, slot, salt) / 4294967296;
}

/** Le tirage pondéré : le calme d'abord, puis les météos dans l'ordre de `WEATHER`. */
function pick(roll: number): WeatherId | null {
  const total = WEATHER_CALENDAR.calmWeight + WEATHER_IDS.reduce((sum, id) => sum + WEATHER[id].weight, 0);
  let cursor = roll * total - WEATHER_CALENDAR.calmWeight;

  if (cursor < 0) return null;

  for (const id of WEATHER_IDS) {
    cursor -= WEATHER[id].weight;
    if (cursor < 0) return id;
  }
  return null;
}
