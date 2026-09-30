/**
 * Météo — contenu pur.
 *
 * Le monde est joli mais immobile : deux parties sur la même carte se
 * ressemblent minute par minute. La météo casse la routine récolte →
 * livraison sans casser la rejouabilité — elle ne se tire pas au hasard, elle
 * se **lit** dans la seed et le temps de jeu (`sim/weather.ts`). Même seed,
 * même météo au même moment, quoi que fasse le joueur.
 *
 * Le temps est découpé en créneaux de `WEATHER_CALENDAR.slotTicks`. Chaque
 * créneau tire, depuis la seed, une météo (ou le calme) et son heure de
 * début ; elle est annoncée `announceTicks` à l'avance et tient
 * `durationTicks`. Les premiers créneaux restent calmes : le joueur apprend
 * à récolter en paix.
 *
 * Chaque météo a un effet de jeu, en facteurs neutres à 1 (ou 0) :
 * - `playerSpeed` : la vitesse d'Adam — sauf à l'abri près de la mairie ;
 * - `harvestYield` : les objets tirés d'un arbre ou d'un rocher par coup ;
 * - `weaponRange` : la portée des arcs, Adam comme tours ;
 * - `arrowDrift` : la poussée du vent sur une flèche, en pixels par tick² ;
 * - `mutantDownwind` : le bonus de vitesse d'un mutant qui marche dans le vent ;
 * - `corrosion` : les bâtiments abîmés, hors de l'abri, perdent des PV.
 *
 * `harsh` marque une « mauvaise chose » : jamais deux en même temps, les
 * vagues de mutants attendent qu'elle passe (`sim/world.ts`).
 */

export interface WeatherProto {
  label: string;
  /** Ce que dit la bulle d'annonce, après « {label} dans 10 s ». */
  advice: string;
  /** Durée, en ticks. */
  durationTicks: number;
  /** Poids du tirage face aux autres météos et à `WEATHER_CALENDAR.calmWeight`. */
  weight: number;
  harsh: boolean;
  playerSpeed: number;
  harvestYield: number;
  weaponRange: number;
  arrowDrift: number;
  mutantDownwind: number;
  /** Tous les `everyTicks`, un bâtiment abîmé hors de l'abri perd `damage` PV — jamais le dernier. */
  corrosion: { everyTicks: number; damage: number } | null;
}

const CALM = {
  harsh: false,
  playerSpeed: 1,
  harvestYield: 1,
  weaponRange: 1,
  arrowDrift: 0,
  mutantDownwind: 0,
  corrosion: null,
} as const;

export const WEATHER = {
  /** Une minute de pluie vert pâle : elle ronge ce qui est déjà abîmé et alourdit Adam. */
  acidRain: {
    ...CALM,
    label: 'Pluie acide',
    advice: 'abritez-vous près de la mairie',
    durationTicks: 20 * 60,
    weight: 3,
    harsh: true,
    playerSpeed: 0.8,
    corrosion: { everyTicks: 20 * 5, damage: 1 },
  },
  /** Un coup de vent : les flèches partent en arc, les mutants le suivent. */
  wind: {
    ...CALM,
    label: 'Coup de vent',
    advice: 'les flèches dévient, les mutants poussés vont plus vite',
    durationTicks: 20 * 45,
    weight: 3,
    arrowDrift: 1.6,
    mutantDownwind: 0.5,
  },
  /** Un brouillard qui mange l'horizon : les arcs ne voient plus aussi loin. */
  fog: {
    ...CALM,
    label: 'Brouillard',
    advice: 'suivez les repères de bord',
    durationTicks: 20 * 50,
    weight: 3,
    weaponRange: 0.7,
  },
  /** Rare : trente secondes où arbres et rochers donnent le double. */
  rainbow: {
    ...CALM,
    label: 'Arc-en-ciel radioactif',
    advice: 'arbres et rochers donnent le double',
    durationTicks: 20 * 30,
    weight: 1,
    harvestYield: 2,
  },
} as const satisfies Record<string, WeatherProto>;

export type WeatherId = keyof typeof WEATHER;

export const WEATHER_IDS = Object.keys(WEATHER) as WeatherId[];

/** Le calendrier : comment le temps se découpe, et ce qui protège. */
export const WEATHER_CALENDAR = {
  /** Un créneau, en ticks : deux minutes trente. */
  slotTicks: 20 * 150,
  /** Créneaux calmes au début de la partie : cinq minutes de paix. */
  calmSlots: 2,
  /** Poids du calme au tirage, face aux `weight` des météos. */
  calmWeight: 4,
  /** Annonce, en ticks avant le début. */
  announceTicks: 20 * 10,
  /** Rayon de l'abri autour du centre de la mairie, en tuiles. */
  shelterRadius: 6,
  /** Une vague ne part pas moins de tant de ticks avant une météo `harsh` : le temps de la repousser. */
  waveMarginTicks: 20 * 25,
} as const;
