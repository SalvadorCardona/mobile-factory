/**
 * Section `panel` du dictionnaire français : la fenêtre d'un bâtiment
 * (`ui/buildingPanel.ts`), sa zone d'échange (`transfer`, `ui/transferPanel.ts`)
 * et les motifs d'un refus de pose (`placement`, `ui/placementReason.ts`).
 *
 * Un nom d'objet glissé dans une phrase arrive tel qu'au dictionnaire
 * (« Bois ») : c'est la phrase qui choisit sa casse et son article.
 */

/** Le pluriel français : 0 et 1 au singulier. */
const s = (count: number): string => (count > 1 ? 's' : '');

export const panel = {
  /** Le bouton (i) qui déplie la phrase d'ambiance. */
  about: 'À propos',
  /** Une foreuse, une ferme ou une forge qui attend qu'on la vide. */
  blocked: 'Bloquée : coffre plein — heurtez-la ou appuyez sur Tout prendre.',
  paused: 'En pause : plus rien ne sort ni n’entre en production — appuyez sur Reprendre.',
  /** Le bouton qui verse dans un chantier ou un consommateur : le sac, puis la ville. */
  transferButton: 'Transférer',
  /** Le même, hors du rayon de la ville. */
  transferBag: 'Transférer le sac',
  cancelSite: 'Annuler le chantier',
  /** Le second tap d'« Annuler le chantier ». */
  cancelConfirm: 'Vraiment annuler ?',
  pause: 'Pause',
  resume: 'Reprendre',
  maxLevel: 'Niveau max',
  hp: (value: string): string => `Points de vie : ${value}`,

  /** Les onglets de la fenêtre, sous le titre. */
  tabs: {
    label: 'Onglets de la fenêtre',
    building: 'Bâtiment',
    inventory: 'Inventaire',
  },

  site: {
    allDelivered: 'Tout est livré : les bâtisseurs arrivent pour le bâtir.',
    building: (builders: number, percent: number): string => `${builders} bâtisseur${s(builders)} au marteau — ${percent} %`,
    byYard: 'Les bâtisseurs du poste de construction le livrent depuis la mairie, puis le bâtiront.',
    comeCloser: 'Chantier en cours — rapprochez-vous pour livrer.',
    transferOrBump: 'Chantier en cours — transférez le sac, ou heurtez-le.',
    workers: (count: number): string => `Ouvriers qu’il emploiera : ${count}`,
    /** Ce que « Transférer » ferait, selon d'où vient la matière (`SiteCoverage`). */
    coverage: {
      bag: 'Votre sac suffit : transférez pour l’achever.',
      town: 'Le stock de la ville couvre le reste : transférez pour l’achever.',
      both: 'Sac et ville couvrent le reste : transférez pour l’achever.',
      short: 'Chantier en cours — transférez le sac et la ville, ou heurtez-le.',
    },
    /** Le libellé d'une ligne du registre : « Pierre : 0/8 livrés, 2 en route, 5 en ville ». */
    needDone: (item: string, delivered: number, needed: number): string => `${item} : ${delivered}/${needed}, tout est livré`,
    needDelivered: (item: string, delivered: number, needed: number): string => `${item} : ${delivered}/${needed} livrés`,
    needIncoming: (count: number): string => `${count} en route`,
    needTownEmpty: 'plus rien en ville',
    needInTown: (count: number): string => `${count} en ville`,
  },

  repair: {
    /** Abîmé, sans bois nulle part. */
    noStock: (item: string, hp: number): string => `Abîmé — rapportez du ${item.toLowerCase()} pour le réparer (1 = ${hp} PV).`,
    damaged: (item: string, hp: number): string =>
      `Abîmé — réparez-le, ou heurtez-le avec du ${item.toLowerCase()} dans le sac (1 = ${hp} PV).`,
    button: (amount: number, item: string): string => `Réparer (${amount} ${item.toLowerCase()})`,
  },

  chest: {
    town: 'Coffre de la ville',
    plain: 'Coffre',
    /** « Coffre 12/40 », ou « Coffre 12 » sans plafond. */
    label: (count: string): string => `Coffre ${count}`,
    /** Le libellé d'un coffre vide. */
    emptyLabel: (label: string): string => `${label} : vide`,
    /** Le compte au pied du pictogramme d'un coffre vide. */
    empty: 'vide',
  },

  townHall: {
    adults: (count: number): string => `Adultes : ${count}`,
    children: (count: number): string => `Enfants : ${count}`,
    workers: (count: number): string => `Ouvriers : ${count}`,
    nights: (count: number): string => `Nuits affrontées : ${count}`,
    radius: (tiles: number): string => `Rayon d’approvisionnement : les chantiers à ${tiles} cases puisent dans son coffre`,
  },

  drill: {
    extracts: (item: string): string => `Extrait : ${item}`,
    dry: 'Posée à sec : aucun gisement dessous.',
    running: 'En marche.',
  },

  nursery: {
    /** `recipe` : « 6 nourriture ». */
    perBirth: (recipe: string): string => `Chaque naissance mange ${recipe}.`,
    /** `why` : d'où vient la famine (`starved`). */
    hungry: (why: string): string => `En attente d’un repas. ${why}`,
    next: (time: string): string => `Prochain enfant dans ${time}`,
    full: 'Pleine : le prochain enfant attend qu’un grand parte travailler.',
    /** `time` : jusqu'à l'aube où le plus âgé a l'âge de travailler. */
    nextAdult: (time: string): string => `Prochain ouvrier dans ${time}`,
    noKids: 'Aucun enfant ici pour l’instant.',
    kids: (count: number, capacity: number): string => `Enfants à la nurserie : ${count} sur ${capacity}`,
    born: (count: number): string => `Enfants nés ici : ${count}`,
  },

  forge: {
    noOne: 'À l’arrêt : personne au four — ajoutez un ouvrier.',
    /** `why` : d'où vient la famine (`starved`). */
    starved: (why: string): string => `À l’arrêt. ${why}`,
    heating: 'Le four chauffe.',
  },

  tower: {
    range: (weapon: string, tiles: number): string => `${weapon} — portée : ${tiles} cases`,
    alert: 'En alerte : des mutants approchent.',
    idle: 'En veille.',
  },

  farm: {
    noOne: 'À l’arrêt : personne aux champs — ajoutez un ouvrier.',
    growing: 'Les sillons poussent.',
  },

  quarry: {
    noOne: 'À l’arrêt : personne à la taille — ajoutez un ouvrier.',
    working: 'Les pioches entament la ruine.',
  },

  house: {
    sleeping: 'Les ouvriers dorment ici entre deux journées.',
  },

  lumberCamp: {
    radius: (tiles: number): string => `Rayon : les bûcherons coupent les arbres à ${tiles} cases`,
    paused: 'En pause : les bûcherons rapportent leur bois, puis flânent.',
    noOne: 'À l’arrêt : aucun bûcheron — ajoutez un ouvrier.',
    noTrees: 'Plus d’arbres à portée.',
    full: 'Coffre plein : les bûcherons attendent qu’on le vide.',
    working: 'Les haches résonnent.',
  },

  depot: {
    radius: (tiles: number): string => `Rayon : les logisticiens vident les producteurs à ${tiles} cases`,
    none: 'Aucun producteur à portée : ils flânent.',
    served: (count: number): string => `${count} producteur${s(count)} à portée : leur production part à la mairie.`,
  },

  yard: {
    radius: (tiles: number): string => `Rayon : les bâtisseurs livrent et bâtissent les chantiers à ${tiles} cases`,
    paused: 'En pause : ses chantiers reviennent aux porteurs et à vous.',
    noOne: 'À l’arrêt : aucun bâtisseur — ajoutez un ouvrier.',
    none: 'Aucun chantier à portée : ils flânent.',
    served: (count: number): string => `${count} chantier${s(count)} à portée : les bâtisseurs s’en chargent.`,
  },

  antenna: {
    floor: (level: number, max: number): string => `Étage ${level}/${max}`,
    nextFloor: 'L’étage suivant se livre comme un chantier : transférez, heurtez-la, ou laissez faire les porteurs.',
    signalSent: 'Le Signal est lancé : des survivants arrivent à chaque aube.',
    lureNight: (night: number): string => `La nuit ${night}, toutes les vagues marcheront sur elle.`,
    lureTonight: 'Cette nuit, toutes les vagues marchent sur elle.',
  },

  clinic: {
    beds: (used: number, beds: number): string => `Places occupées : ${used}/${beds}`,
    full: 'Complète : les mutants vaincus ne tombent plus assommés pour elle.',
    open: 'Un mutant vaincu peut tomber assommé — touchez-le, il vous suivra jusqu’ici.',
  },

  crew: {
    less: 'Un ouvrier de moins',
    more: 'Un ouvrier de plus',
    missing: (count: number): string =>
      `${count} ouvrier${s(count)} manquant${s(count)} : le poste se remplira dès qu’un ouvrier sera libre.`,
    none: 'Aucun ouvrier : le bâtiment est à l’arrêt.',
    /** `returned` : les postes fermés, rendus à la ville (0 : on n'en parle pas). */
    assigned: (filled: number, returned: number): string =>
      `${filled} ouvrier${s(filled)} affecté${s(filled)}` + (returned > 0 ? `, ${returned} rendu${s(returned)} à la ville.` : '.'),
  },

  upgrade: {
    /** « Renforcer : PV 60 → 90… ». */
    effect: (action: string, effect: string): string => `${action} : ${effect}`,
    comeCloser: ' — rapprochez-vous.',
    lacking: (count: number): string => `manque ${count}`,
    hp: (from: number, to: number): string => `PV ${from} → ${to}`,
    range: (from: number, to: number): string => `portée ${from} → ${to}`,
    /** Le gain de cadence de tir, en pour cent. */
    rate: (percent: number): string => `cadence ${percent > 0 ? '+' : ''}${percent} %`,
  },

  /** D'où vient la famine d'une forge ou d'une nurserie. */
  starved: {
    coming: (item: string): string => `${item} : les porteurs l’apportent.`,
    inTown: (item: string, count: number): string => `${item} en ville : ${count} — les porteurs arrivent.`,
    /** `inRange` : la ville peut la servir — on transfère ; sinon, on apporte. */
    noPorter: (item: string, count: number, inRange: boolean): string =>
      `${item} en ville : ${count} — aucun porteur : ${inRange ? 'transférez-le' : 'apportez-le'}.`,
    inBag: (item: string): string => `${item} dans le sac — heurtez-la ou transférez.`,
    nowhere: (item: string): string => `Plus de ${item.toLowerCase()} nulle part — récoltez-en.`,
  },

  /** Une quantité de recette : « 2 minerai de fer ». */
  recipeAmount: (amount: number, item: string): string => `${amount} ${item.toLowerCase()}`,
  /** Un compte à rebours : « 9 min 32 s », ou « 32 s ». */
  duration: (minutes: number, seconds: number): string =>
    minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, '0')} s` : `${seconds} s`,

  /** La zone d'échange sac ⇄ coffre. */
  transfer: {
    quantity: 'Quantité par tap',
    all: 'Tout',
    bag: 'Sac d’Adam',
    takeAll: 'Tout prendre',
    depositAll: 'Tout déposer',
    empty: 'Vide',
    reserved: (count: number): string => `dont ${count} réservé${s(count)}`,
    comeCloser: 'Rapprochez-vous du bâtiment pour échanger.',
    bagFull: 'Sac plein : déposez avant de prendre.',
    nothingFits: 'Rien de votre sac n’entre dans ce coffre pour l’instant.',
  },

  /**
   * Pourquoi « Poser » est grisé : le motif (`text`) et, s'il y en a un, le
   * remède (`remedy`, '' sinon).
   */
  placement: {
    locked: 'Il vous manque le plan',
    terrain: 'Pas sur l’eau',
    occupied: 'Case occupée',
    onPlayer: 'Vous êtes sur l’emplacement',
    outOfReach: 'Trop loin — rapprochez-vous',
    unique: 'Un seul par colonie',
    noOre: { text: 'Aucun filon ici', remedy: 'Cassez un rocher, puis posez la foreuse à sa place' },
    road: { text: 'Une route passe ici', remedy: 'Retirez-la d’abord : Bâtir › Route › Retirer' },
    nearHall: { text: 'Trop près de la mairie', remedy: 'Éloignez-vous, hors du cercle autour d’elle' },
    treesAndRocks: { text: 'Des arbres et des rochers gênent', remedy: 'Adam peut les récolter' },
    rocks: { text: 'Des rochers gênent', remedy: 'Adam peut les casser' },
    rock: { text: 'Un rocher gêne', remedy: 'Adam peut le casser' },
    trees: { text: 'Des arbres gênent', remedy: 'Adam peut les couper' },
    tree: { text: 'Un arbre gêne', remedy: 'Adam peut le couper' },
    /** Ce qu'une foreuse posée là extraira. */
    extracts: (item: string): string => `Extraira : ${item}`,
    /** Pourquoi une partie d'un tracé de route ne sera pas pavée. */
    roads: {
      noStone: { text: 'Plus de pierre pour la suite', remedy: 'Cassez des rochers, ou tracez dans le rayon de la mairie' },
      terrain: { text: 'Pas sur l’eau', remedy: '' },
      occupied: { text: 'Un bâtiment est sur le tracé', remedy: '' },
      resource: { text: 'Un arbre ou un rocher gêne', remedy: 'Adam peut le récolter' },
    },
  },
};
