/**
 * Section `hud` du dictionnaire français : la quête, le conseil, l'horloge,
 * les bulles, les bandeaux, les écrans de victoire et de défaite. Le jeu
 * vouvoie le joueur ; les répliques d'Ève sont dans `content.eve`.
 *
 * Un nom d'objet, de bâtiment ou de météo glissé dans une phrase arrive tel
 * que le dictionnaire le donne (`t().items[id]`, avec sa majuscule) : c'est
 * ici qu'on le met en minuscules au milieu d'une phrase, avec l'article et
 * l'accord.
 */

import { BUILDINGS } from '../../data/buildings.ts';
import { LORE } from '../../data/lore.ts';

const HALL = LORE.buildings.townHall.name;
const NURSERY = LORE.buildings.nursery.name.toLowerCase();

/** « s » au pluriel : en français, 0 et 1 sont au singulier. */
const s = (n: number): string => (n > 1 ? 's' : '');

/** Un nom tel qu'on le lit au milieu d'une phrase : « Bois » → « bois ». */
const lower = (name: string): string => String(name).toLowerCase();

export const hud = {
  /** Pourquoi un bâtiment armé ne se pose pas (`PlacementRejection`). */
  rejection: {
    occupied: 'Emplacement déjà occupé',
    road: 'Une route passe ici — retirez-la d’abord',
    terrain: 'Terrain non constructible',
    outOfReach: 'Trop loin — rapprochez-vous',
    resource: 'Dégagez d’abord les arbres et rochers',
    onPlayer: 'Vous êtes sur l’emplacement',
    noOre: 'Aucun filon ici — une foreuse se pose sur un filon',
    locked: 'Pas encore débloqué — il faut son plan, ou tenir encore une nuit',
    unique: 'Un seul par colonie — il y en a déjà un',
    nearHall: `Trop près de la mairie — l’antenne se dresse à ${BUILDINGS.antenna.hallDistance} cases au moins`,
  },
  /** Ce que dit la bulle quand un tracé de route n'a pas été pavé en entier. */
  road: {
    /** `paved` tuiles l'ont été avant que la pierre manque. */
    noStone: (paved: number): string => `Plus de pierre : route arrêtée après ${paved} tuile${s(paved)}`,
    noStoneAtAll: 'Pas de pierre pour paver — ni dans le sac, ni en ville à portée',
    terrain: 'Pas de route sur l’eau',
    occupied: 'Une route ne passe pas sous un bâtiment',
    resource: 'Arbres et rochers sautés : dégagez-les pour paver',
  },
  /** Pourquoi une réparation n'a pas eu lieu (`RepairRejection`, hors `missing`). */
  repair: {
    outOfReach: 'Trop loin — rapprochez-vous',
    intact: 'Rien à réparer',
    noMaterial: 'Il faut du bois pour réparer — ni dans le sac, ni en ville',
  },
  /** D'où vient une vague, dit comme on le dirait. */
  from: {
    north: 'par le nord',
    northEast: 'par le nord-est',
    east: 'par l’est',
    southEast: 'par le sud-est',
    south: 'par le sud',
    southWest: 'par le sud-ouest',
    west: 'par l’ouest',
    northWest: 'par le nord-ouest',
  },
  /** Les bulles empilées des événements. */
  toast: {
    depositFar: 'Trop loin de la mairie — rapprochez-vous pour déposer',
    depositNoTown: 'Pas encore de ville : bâtissez d’abord la mairie',
    siteNothing: 'Rien dans le sac que ce chantier attende',
    supplyNothing: 'Rien dans le sac ni en ville que ce bâtiment attende',
    nurseryHungry: 'La nurserie attend de la nourriture pour le prochain enfant',
    chestEmpty: 'Le coffre est vide',
    bagFullTake: 'Sac plein — rien à prendre de plus',
    bagFullTown: 'Sac plein — allez déposer en ville',
    bagFullSite: 'Sac plein — allez livrer le chantier',
    bagFullDrop: 'Sac plein — tapez le sac, puis « Jeter »',
    upgradeMissing: 'Il manque de quoi payer — ni dans le sac, ni en ville',
    /** `item` : le nom de l'objet, avec sa majuscule. */
    repairedFromTown: (amount: number, item: string): string => `Réparé avec ${amount} ${lower(item)} de la ville`,
    /** Ève prévient de la Reine alors qu'elle n'est pas encore arrivée. */
    eveRadio: (line: string): string => `Ève, par radio : ${line}`,
    dusk: 'La nuit tombe — rentrez !',
    dawn: (night: number): string => `L’aube ! Nuit ${night} survécue`,
    destroyed: (building: string): string => `${building} détruite`,
    /** `building` : le nom du bâtiment, avec sa majuscule. */
    siteCancelled: (building: string, toTown: boolean): string =>
      `Chantier annulé : ${building} — ${toTown ? 'le livré retourne en ville' : 'le livré reste au sol'}`,
    childBorn: 'Un enfant est né à la nurserie !',
    mutantStunned: 'Un mutant assommé ! Touchez-le pour l’emmener à la clinique',
    patientFollowing: 'Il vous suit en boitillant — direction la clinique',
    patientAdmitted: 'Admis à la clinique : une nuit de soins',
    mutantHealed: 'Un ex-mutant sort de la clinique : un porteur de plus !',
    kidGrewUp: (name: string): string => `${name} a 14 ans, un ouvrier de plus`,
    /** `weather` : le nom de la météo, avec sa majuscule ; `advice` : son conseil. */
    weatherSoon: (weather: string, seconds: number, advice: string): string => `${weather} dans ${seconds} s — ${advice}`,
    weatherEnded: (weather: string): string => `Fin : ${lower(weather)}`,
    knockedOut: 'Adam s’est évanoui — il se réveille à la mairie',
    eveArriving: 'Quelqu’un arrive à vélo…',
    eveArrived: 'Ève a rejoint la colonie !',
    caravanArriving: 'Une caravane de troc arrive au bord de la clairière',
    caravanLeaving: 'La caravane repart',
    /** Un objet de la liste de `storedAtHall` : « 3 bois » ; `item` avec sa majuscule. */
    storedItem: (amount: number, item: string): string => `${amount} ${lower(item)}`,
    /** `list` : « 3 bois, 2 pierre », ce qui n'est pas entré dans le sac. */
    storedAtHall: (list: string): string => `Sac plein : ${list} attend à la mairie`,
    tradeFar: 'Approchez-vous de la charrette',
    tradeMissing: 'Il manque de quoi payer cet échange',
    tradeDone: 'Cet échange est déjà fait',
    tradeGone: 'La caravane est repartie',
    planReceived: (building: string): string => `Plan reçu : ${building}`,
    toolReceived: (tool: string): string => `Outil reçu : ${tool}`,
    researchStarted: (research: string): string => `${research} : la recherche commence`,
    researchCompleted: (effect: string): string => `Recherche terminée — ${effect}`,
    /** `labels` : les bâtiments entrés au menu, déjà joints. */
    buildingsUnlocked: (n: number, labels: string): string =>
      n > 1 ? `Nouveaux bâtiments débloqués : ${labels}` : `Nouveau bâtiment débloqué : ${labels}`,
    researchBusy: 'Une recherche tourne déjà — une seule à la fois',
    researchLocked: 'Il manque une recherche avant celle-ci',
    researchNothing: 'Rien dans le sac ni en ville que cette recherche attende',
    antennaRaised: (floor: number, night: number): string =>
      `Étage ${floor} debout ! La nuit ${night}, toutes les vagues marcheront sur l’antenne.`,
    antennaFell: (floor: number): string => `L’antenne a perdu un étage — elle retombe à l’étage ${floor}`,
    survivors: (count: number): string =>
      count > 1
        ? `${count} survivants arrivent à l’appel de l’antenne : ${count} porteurs de plus`
        : 'Un survivant arrive à l’appel de l’antenne : un porteur de plus',
  },
  /** Ce qui monte du toit d'un bâtiment achevé, ou de la tête d'Adam. */
  float: {
    built: (building: string): string => `${building} bâtie !`,
    /** Un niveau atteint : son nom, tel quel. */
    upgraded: (level: string): string => `${level} !`,
    /** L'objet refusé à la récolte : il en a assez. */
    enough: 'assez',
  },
  /** Le bandeau des vagues et de la Reine. */
  wave: {
    night: (night: number): string => `Nuit ${night}`,
    reinforcements: 'Renforts',
    /** `from` : « par le nord » (`from`). */
    queen: (from: string): string => `La Reine des flaques sort ${from} !`,
    /** `target` : le nom du bâtiment visé, avec sa majuscule — tous ceux que vise une vague sont féminins. */
    boss: (from: string, target: string): string => `Un gros mutant mène la charge ${from} : il vise la ${lower(target)} !`,
    mutants: (count: number, from: string, target: string): string =>
      count > 1
        ? `${count} mutants arrivent ${from} : ils visent la ${lower(target)} !`
        : `${count} mutant arrive ${from} : il vise la ${lower(target)} !`,
    cleared: (night: number): string => `Nuit ${night} — vague repoussée !`,
    clearedText: 'Ramassez ce que les mutants ont lâché',
    queenSlain: 'La Reine des flaques est tombée !',
    queenSlainText: (night: number): string => `Nuit ${night} — son cœur radioactif est au sol`,
    queenNight: (night: number): string => `Nuit ${night} — la Reine des flaques`,
    /** `time` : « 1:05 ». */
    queenIn: (time: string): string => `Elle sort dans ${time}`,
  },
  /** La quête en haut de l'écran. */
  quest: {
    objective: (index: number, total: number): string => `Objectif ${index}/${total}`,
    afterSignal: 'Après le Signal',
    buildHall: `Bâtir la ${HALL}`,
    defeat: 'Défaite',
    hallFallen: `La ${HALL.toLowerCase()} est tombée.`,
    attack: 'Attaque !',
    endless: 'Tenir le plus longtemps possible',
    /** La ligne de l'attaque : « Nuit 3 · 4 mutants ». */
    status: (night: number, mutants: number): string => `Nuit ${night} · ${mutants} mutant${s(mutants)}`,
    inhabitants: 'Habitants',
    kills: 'Mutants abattus',
    crew: (total: number): string => `${total} ouvrier${s(total)} — voir le détail`,
    noCrew: 'Aucun ouvrier pour l’instant.',
    assigned: 'Affectés',
    free: 'Libres',
    emptyPosts: 'Postes vides',
    portersBusy: 'Porteurs occupés',
    portersIdle: 'Porteurs en attente',
    /** La ligne repliée d'une naissance retenue ou attendue. */
    stripPaused: 'en pause',
    /** `item` : le nom de l'objet qui manque, avec sa majuscule. */
    stripMissing: (missing: number, item: string): string => `${missing} ${lower(item)}${s(missing)}`,
    stripBaby: (time: string): string => `bébé ${time}`,
    stripNight: (time: string): string => `nuit ${time}`,
    nurseryPaused: `la ${NURSERY} est en pause`,
    nurseryWaits: (missing: number, item: string): string => `la ${NURSERY} attend ${missing} ${lower(item)}${s(missing)}`,
    babyIn: (time: string): string => `bébé dans ${time}`,
  },
  /** L'horloge du jour et de la nuit. */
  clock: {
    /** `left` : « 1:31 ». */
    night: (day: number, left: string): string => `Nuit ${day} · aube dans ${left}`,
    day: (day: number, left: string): string => `Jour ${day} · nuit dans ${left}`,
    /** Le numéro du jour, à côté du cadran. */
    short: (day: number): string => `J${day}`,
  },
  /** La météo en capsule, sous la quête. */
  weather: {
    /** `weather` : son nom, avec sa majuscule. */
    soon: (weather: string, seconds: number): string => `${weather} dans ${seconds} s`,
  },
  /** La population : au travail, inactifs, enfants. */
  people: {
    working: (n: number): string => `${n} au travail`,
    idle: (n: number): string => `${n} inactif${s(n)}${n > 0 ? ' — taper pour en voir un' : ''}`,
    children: (n: number): string => `${n} enfant${s(n)}`,
  },
  /** Le sac et la ville, en version compacte. */
  stock: {
    bag: 'Sac',
    bagLabel: (total: number, capacity: number): string => `Ouvrir le sac : ${total} objets sur ${capacity}`,
    bagLabelTown: (total: number, capacity: number, town: number): string =>
      `Ouvrir le sac : ${total} objets sur ${capacity}, ${town} en ville`,
    town: 'Ville',
    toBuild: 'à bâtir',
    townTitle: 'Stock de la ville : ce qui paie les constructions',
  },
  hintBulb: 'Afficher le conseil',
  pause: 'Pause',
  /** Le bandeau d'un objectif réussi sans bandeau à lui. */
  objectiveDone: 'Objectif réussi !',
  victory: {
    endless: 'Continuer sans fin',
    nights: 'Nuits tenues',
    kills: 'Mutants abattus',
    inhabitants: 'Habitants',
    buildings: 'Bâtiments',
    playTime: 'Temps de jeu',
  },
  defeat: {
    title: `La ${HALL.toLowerCase()} est tombée`,
    text: 'Les mutants ont eu raison du premier toit de la colonie.',
    replay: 'Rejouer cette carte',
    fresh: 'Nouvelle carte',
    seeds: (seeds: number): string => `+${seeds} graine${s(seeds)}`,
    seedsHint: 'À planter au jardin des souvenirs, sur l’écran titre.',
    nights: 'Nuits survécues',
    kills: 'Mutants abattus',
    time: 'Temps tenu',
  },
  /** Ce que `hint.ts` écrit lui-même ; les répliques d'Ève sont dans `content.eve.hints`. */
  hint: {
    /** `item` : le nom de l'objet, avec sa majuscule. */
    harvestPlenty: (item: string): string => `La ville a assez de ${lower(item)} — Adam n’en ramasse plus en passant`,
    harvestDeliver: (item: string): string => `Assez de ${lower(item)} dans le sac pour les chantiers — allez les livrer`,
    harvestNone: (item: string): string => `Assez de ${lower(item)} : aucun chantier n’en attend plus`,
    /** Un nom glissé dans une réplique d'Ève (`{item}`, `{building}`) : « bois », « mairie ». */
    inSentence: (name: string): string => lower(name),
    /** Le temps d'une attente, glissé dans `{time}`. */
    lessThanMinute: 'moins d’une minute',
    minutes: (minutes: number): string => `${minutes} minute${s(minutes)}`,
  },
  /** L'infobulle d'un habitant : « Lina, 12 ans · enfant, travaille dans 2 jours ». */
  person: {
    line: (name: string, age: number, occupation: string): string => `${name}, ${age} ans · ${occupation}`,
    child: 'enfant',
    childDays: (days: number): string => `enfant, travaille dans ${days} jour${s(days)}`,
    working: 'au travail',
    workingAt: (building: string): string => `au travail : ${building}`,
    idle: 'sans travail',
    home: 'à la maison',
  },
};
