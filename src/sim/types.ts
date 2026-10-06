/**
 * Entités de la simulation.
 *
 * Une `Map<EntityId, Entity>` avec union discriminée, pas d'ECS. C'est plus
 * lisible et ça reste rentable bien au-delà de ce que ce jeu manipulera avant
 * longtemps. `sim/` étant isolé, le stockage se change sans toucher au rendu.
 *
 * Deux familles :
 * - les **entités** posées sur la grille — chantiers et bâtiments — qui
 *   dorment entre deux réveils du scheduler ;
 * - les **mobiles** — mutants, bêtes, flèches, enfants, Ève, ouvriers, bûcherons, forestiers, butin, patients, caravane — qui bougent à chaque tick.
 *   Ils sont peu nombreux, et c'est ce qui rend le tick par mobile acceptable.
 */

import type { BuildingId } from '../data/buildings.ts';
import type { RareOfferId } from '../data/caravan.ts';
import type { EnemyId, WildlifeId } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import type { ResearchId } from '../data/research.ts';
import type { NeedId } from '../data/needs.ts';
import type { JobPriority, WorkPriority } from '../data/workers.ts';
import type { Housing } from './housing.ts';
import type { Needs } from './needs.ts';
import type { Store } from './store.ts';

export type EntityId = number;

/** Ce que tout bâtiment posé partage : une identité et une emprise. */
interface Placed {
  id: EntityId;
  proto: BuildingId;
  /** Tuile d'origine (coin haut-gauche de l'emprise). */
  tx: number;
  ty: number;
  width: number;
  height: number;
}

/**
 * Un chantier : l'emprise est réservée, le bâtiment n'existe pas encore.
 * Le joueur y apporte le coût du prototype en le heurtant ; au dernier
 * objet livré, le chantier devient le bâtiment, sous le même id.
 */
export interface Site extends Placed {
  kind: 'site';
  /** Ce qui a déjà été livré, par objet. */
  delivered: Partial<Record<ItemId, number>>;
  /**
   * Le travail des bâtisseurs, en ticks de bâtisseur : un chantier dans le
   * rayon d'un poste de construction ne s'achève pas au dernier objet livré,
   * il se bâtit ensuite au marteau jusqu'à `siteWork()` (`sim/jobs.ts`).
   * Reste à 0 partout ailleurs.
   */
  work: number;
}

/** Ce que tout bâtiment fini partage : un coffre et des points de vie. */
interface Built extends Placed {
  /** Coffre interne. */
  store: Store;
  /** Points de vie restants ; le maximum est celui de son niveau (`buildingLevel(proto, level).hp`). */
  hp: number;
  /**
   * Niveau d'amélioration, 1 tel que bâti. Chaque niveau au-delà est une
   * entrée de `BUILDINGS[proto].upgrades` : points de vie, arme, sprite.
   */
  level: number;
  /**
   * En pause (`sim/staffing.ts`) : un producteur ne produit ni ne consomme
   * plus rien, ses ouvriers finissent leur geste puis flânent. Toujours faux
   * pour un bâtiment qui ne produit rien.
   */
  paused: boolean;
  /**
   * Ouvriers voulus, entre `minWorkers` et `workers` du prototype — le
   * maximum à la construction. Les postes réellement occupés se comptent
   * dans la population de la ville (`World.staffing()`).
   */
  staff: number;
  /**
   * Priorité de travail (`sim/staffing.ts`) : quand les ouvriers manquent,
   * Haute se pourvoit d'abord et reprend ceux de Basse. `WORK_PRIORITY.initial`
   * à la construction ; sans effet pour un bâtiment qui n'emploie personne.
   */
  priority: WorkPriority;
}

export interface Drill extends Built {
  kind: 'drill';
  /** Objet extrait par le gisement sous la foreuse, `null` si elle est posée à sec. */
  output: ItemId | null;
  /** Vrai quand la foreuse ne se replanifie plus : coffre plein, ou en pause. */
  blocked: boolean;
}

/**
 * La mairie : le premier toit de la colonie, son entrepôt, et ce que les
 * mutants visent. Son coffre est **le stock de la ville** : Adam y dépose
 * son sac, les porteurs y vident foreuses et fermes, et c'est de là que
 * partent les livraisons des chantiers.
 */
export interface TownHall extends Built {
  kind: 'townHall';
}

/** La nurserie : un enfant toutes les trois minutes, s'il y a de quoi le nourrir. */
export interface Nursery extends Built {
  kind: 'nursery';
  /** Tick de la prochaine naissance — la fenêtre d'inspection affiche le compte à rebours. */
  nextBirthTick: number;
  /** Enfants nés ici, en tout. */
  born: number;
  /**
   * Vrai quand l'heure de naître est passée sans assez de nourriture dans le
   * coffre : la nurserie ne se replanifie plus, c'est la livraison qui la réveille.
   */
  hungry: boolean;
}

/** La tour de guet : un arc automatique, réveillé tant qu'il y a des mutants. */
export interface Tower extends Built {
  kind: 'tower';
  /** Vrai tant qu'un réveil est planifié : évite d'en empiler deux. */
  armed: boolean;
}

/** La maison des constructeurs : elle loge les ouvriers — les porteurs — qui y dorment quand il n'y a rien à porter. */
export interface House extends Built {
  kind: 'house';
}

/** La ferme : ses ouvriers font pousser de la nourriture dans son coffre, à la cadence de la recette. */
export interface Farm extends Built {
  kind: 'farm';
  /** Vrai quand la ferme ne se replanifie plus : coffre plein, en pause, ou sans ouvrier. */
  blocked: boolean;
}

/** La carrière : ses ouvriers taillent de la pierre dans son coffre, à la cadence de la recette, comme une ferme. */
export interface Quarry extends Built {
  kind: 'quarry';
  /** Vrai quand la carrière ne se replanifie plus : coffre plein, en pause, ou sans ouvrier. */
  blocked: boolean;
}

/**
 * La forge : fer et charbon, apportés par Adam, deviennent des plaques de
 * fer dans son coffre, à la cadence de la recette. Le four à charbon est une
 * forge aussi, sur sa propre recette (`recipeOf(proto)`) : le bois y devient
 * du charbon.
 */
export interface Forge extends Built {
  kind: 'forge';
  /** Vrai quand la forge ne se replanifie plus : il manque une entrée, elle est en pause ou sans ouvrier. */
  blocked: boolean;
}

/**
 * La clinique : elle n'a pas d'autre état que ses murs. Ses patients et les
 * ex-mutants qu'elle loge sont des mobiles qui la désignent (`clinicId`,
 * `homeId`) ; ses places se comptent sur eux.
 */
export interface Clinic extends Built {
  kind: 'clinic';
}

/**
 * Le labo de recherche, un seul par colonie. Il mène une recherche à la
 * fois : choisie, elle attend que son coût soit déposé dans le coffre ; payé,
 * le coût est consommé et le compte à rebours tourne jusqu'à `endTick`, où
 * le labo se réveille. Les recherches finies ne sont pas à lui mais à la
 * colonie (`World.researchDone`) : elles survivent au labo.
 *
 * Ce que le coffre contient au-delà du coût de la recherche en cours — le
 * reste d'une recherche abandonnée — repart à la mairie avec les porteurs,
 * ou dans le sac avec « Prendre ».
 */
export interface Lab extends Built {
  kind: 'lab';
  /** La recherche choisie, `null` si le labo attend qu'on en choisisse une. */
  research: ResearchId | null;
  /** Tick de fin du compte à rebours ; 0 tant que le coût n'est pas réuni. */
  endTick: number;
}

/**
 * La cabane de bûcheron : elle loge ses bûcherons, et son coffre reçoit le
 * bois qu'ils rapportent. Les porteurs le vident dans la mairie.
 */
export interface LumberCamp extends Built {
  kind: 'lumberCamp';
}

/**
 * La maison du forestier : elle loge son forestier, qui plante un carré de
 * forêt autour d'elle (`sim/forester.ts`). Les arbres sont à la carte
 * (`ResourceIndex`), pas à elle : elle n'a rien d'autre à retenir.
 */
export interface ForesterHouse extends Built {
  kind: 'foresterHouse';
}

/**
 * Le poste de logistique : il loge ses logisticiens, qui vident les
 * producteurs de son rayon (`LOGISTICIANS.radius`) dans la mairie. Il n'a
 * rien à lui : la charge en route est dans le job de chaque logisticien.
 */
export interface Depot extends Built {
  kind: 'depot';
}

/**
 * Le poste de construction : il loge ses bâtisseurs, qui livrent les
 * chantiers de son rayon (`BUILDERS.radius`) depuis la mairie, puis les
 * bâtissent. Comme le poste de logistique, il n'a rien à lui.
 */
export interface Yard extends Built {
  kind: 'yard';
}

/**
 * L'Antenne, unique : son premier étage est un chantier comme un autre ;
 * les suivants (`BUILDINGS.antenna.upgrades`) se livrent dans son coffre —
 * le sac, la ville dans son rayon, les porteurs — et l'étage monte dès que
 * tout y est (`sim/antenna.ts`). Son niveau est son étage.
 */
export interface Antenna extends Built {
  kind: 'antenna';
}

export type Entity =
  | Site
  | Drill
  | TownHall
  | Nursery
  | Tower
  | House
  | Farm
  | Quarry
  | Forge
  | Clinic
  | Lab
  | LumberCamp
  | ForesterHouse
  | Depot
  | Yard
  | Antenna;

export type Building = Exclude<Entity, Site>;

/**
 * Une base mutante (`data/enemyBases.ts`) : tirée de la seed autour de la
 * mairie, elle tient une zone où l'on ne bâtit ni ne récolte. Elle n'est ni
 * une entité ni un mobile : elle ne dort pas, ne bouge pas, et seul l'arc
 * d'Adam la touche. Abattue, elle reste dans la liste à zéro point de vie —
 * elle ne revient jamais.
 */
export interface EnemyBase {
  id: number;
  /** Tuile d'origine (coin haut-gauche de l'emprise, `ENEMY_BASE.width × height`). */
  tx: number;
  ty: number;
  /** Son niveau : celui de son anneau, et celui de l'équipement qu'il faut pour l'entamer. */
  level: number;
  /** Points de vie restants ; 0 : détruite. */
  hp: number;
  /** Assaillants en réserve, produits le jour, qui sortiront tous à la nuit : le chiffre du badge. */
  raiders: number;
  /** Ticks de jour accumulés vers le prochain assaillant (`raidTicks`) : sa cadence en cours. */
  brood: number;
  /** Gardiens vivants, sortis devant la base ou rentrés. */
  guards: number;
  /** Ticks de jour accumulés vers le prochain gardien, s'il en manque. */
  mend: number;
}

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Player {
  /** Position en pixels monde, au tick courant — le centre de la boîte de collision. */
  x: number;
  y: number;
  /** Position au tick précédent — le rendu interpole entre les deux. */
  prevX: number;
  prevY: number;
  /** Direction du regard, conservée à l'arrêt : le sprite ne se retourne pas tout seul. */
  facing: Facing;
  /** Vrai si le joueur a effectivement bougé ce tick. Pilote l'animation de marche. */
  moving: boolean;
  /** Vrai si Adam pousse contre un arbre ou un rocher ce tick. Pilote l'animation de coupe. */
  harvesting: boolean;
  /** Ticks avant la prochaine flèche de l'arc. */
  bowCooldown: number;
  /** Ce que l'arc vise ce tick : le rendu y pose un marqueur. `null` si rien n'est à portée. */
  target: MobileId | null;
  /** Points de vie : les crabes pincent, les loups mordent. À zéro, Adam se réveille à la mairie. */
  hp: number;
  /** Niveau de son équipement (`data/gear.ts`) : 0, l'arc de fortune. Il dit quelles bases mutantes il entame. */
  gear: number;
  /** Ticks depuis le dernier coup reçu : Adam ne récupère qu'au calme. */
  calmTicks: number;
  /** Son âge, en années : une de plus à chaque aube (`data/inhabitants.ts`). */
  age: number;
  /**
   * Le sac à dos : ce qu'Adam a récolté ou ramassé et pas encore déposé.
   * Ce n'est pas le stock de la ville — celui-là est le coffre de la mairie
   * (`World.townStock()`).
   */
  inventory: Store;
}

/** La tuile contre laquelle le joueur pousse ce tick, s'il y en a une. */
export interface Contact {
  tx: number;
  ty: number;
}

/* ---------------------------------------------------------------- mobiles */

export type MobileId = number;

/** Ce que tout mobile partage : une position interpolable et un regard. */
interface Moving {
  id: MobileId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  facing: Facing;
  moving: boolean;
}

/** Un mutant : il marche sur la mairie et casse ce qui le bloque. */
export interface Mutant extends Moving {
  kind: 'mutant';
  proto: EnemyId;
  hp: number;
  /** En années : tiré à l'apparition (`foeAge`), un an de plus à chaque aube. */
  age: number;
  /** Ticks avant le prochain coup sur le bâtiment heurté. */
  attackCooldown: number;
  /** Ticks restants à sortir de la flaque : immobile, et hors d'atteinte des arcs. */
  emerge: number;
  /**
   * Le bâtiment que vise sa vague (`WAVES.targets`). Absent — ou tombé
   * entre-temps — : la mairie.
   */
  target?: EntityId;
  /** Ce que seule la Reine des flaques retient (`QUEEN`) ; absent pour tout autre mutant. */
  queen?: QueenState;
}

/**
 * La Reine, phase par phase. Sous terre, elle est un mutant qui « émerge »
 * (`emerge`) : immobile, invisible, hors d'atteinte des arcs.
 */
export interface QueenState {
  /** 1 : elle marche sur la mairie et pond ; 2 : sous la moitié de ses points de vie, elle chasse les tours. */
  phase: 1 | 2;
  /** Ticks avant la prochaine ponte, en phase 1. */
  layTicks: number;
  /** La tour qu'elle chasse, en phase 2 ; `null` : plus aucune tour, elle marche sur la mairie. */
  prey: EntityId | null;
}

/**
 * Ce que fait une bête sauvage :
 * - `roam` : elle flâne autour de sa tanière, sans quitter son habitat ;
 * - `chase` : Adam est entré dans son rayon, elle le charge ;
 * - `return` : il s'est éloigné, ou elle s'est trop écartée — elle rentre,
 *   sans se retourner, jusqu'à sa tanière.
 */
export type BeastState = 'roam' | 'chase' | 'return';

/** Une bête sauvage : un crabe sur la plage, un loup en forêt. */
export interface Beast extends Moving {
  kind: 'beast';
  proto: WildlifeId;
  hp: number;
  /** En années, comme un mutant. */
  age: number;
  /** La tanière d'où elle vient, et où elle rentre ; 0 pour un gardien. */
  denId: number;
  /** Le gardien d'une base mutante (`WILDLIFE.guardian`) : l'id de sa base, qui le loge et le refait. */
  guardOf?: number;
  homeX: number;
  homeY: number;
  state: BeastState;
  /** Direction de la flânerie courante, nulle à l'arrêt. */
  dirX: number;
  dirY: number;
  /** Ticks avant de changer d'idée. */
  wanderTicks: number;
  /** Ticks avant le prochain coup sur Adam. */
  attackCooldown: number;
}

/** Ce que les arcs peuvent viser : un mutant ou une bête. */
export type Foe = Mutant | Beast;

/** Une flèche : une ligne droite, une durée de vie, et le premier mutant touché. */
export interface Arrow extends Moving {
  kind: 'arrow';
  /** Vitesse en pixels par tick. */
  vx: number;
  vy: number;
  /** Ticks de vol restants ; à zéro, la flèche se perd. */
  ttl: number;
  damage: number;
  /** La base mutante visée : la flèche la frappe en traversant son emprise. Absent : elle ne vise que les ennemis. */
  baseId?: number;
}

/**
 * Ce que tout habitant — enfant, ouvrier, bûcheron — porte de ses besoins
 * (`data/needs.ts`) : ses jauges, et le repas qu'il est allé chercher.
 */
export interface Needful {
  /** Une jauge par besoin, de 0 (à bout) à 1 (comblé). */
  needs: Needs;
  /**
   * Le besoin qu'il est allé combler à la mairie, `null` sinon. Sa part du
   * stock de la ville lui est réservée au départ ; la réservation, qui n'est
   * pas sauvegardée, se rejoue au chargement — comme les jobs.
   */
  meal: NeedId | null;
}

/**
 * Ce que tout ouvrier adulte — porteur, bûcheron, forestier — retient de ses
 * nuits (`data/housing.ts`) : son bonheur, son lit, et s'il dort dehors.
 * Le lit attribué n'est qu'une préférence stable : il se revoit au
 * chargement et à chaque attribution (`sim/housing.ts`).
 */
export type Housed = Housing;

/**
 * Un enfant : il joue autour de sa nurserie et n'en va jamais loin. Il en
 * sort à `AGES.nursery` ans ; à `AGES.work`, il devient ouvrier — un
 * porteur logé à sa nurserie, sous le même id.
 */
export interface Kid extends Moving, Needful {
  kind: 'kid';
  /** Son âge, en années : une de plus à chaque aube. */
  age: number;
  /** La nurserie qui l'a vu naître, et le point autour duquel il flâne. */
  homeId: EntityId;
  homeX: number;
  homeY: number;
  /** Direction de la flânerie courante, nulle à l'arrêt. */
  dirX: number;
  dirY: number;
  /** Ticks avant de changer d'idée. */
  wanderTicks: number;
}

/**
 * Ce que fait Ève :
 * - `arriving` : elle arrive sur son vélo-cargo, en ligne droite, jusqu'à la mairie ;
 * - `idle` : elle flâne près de la mairie ;
 * - `repair` : entre deux vagues, elle va réparer le bâtiment `targetId`.
 */
export type EveState = 'arriving' | 'idle' | 'repair';

/** Ève : elle rejoint Adam après la troisième vague, vit à la mairie et répare. */
export interface Eve extends Moving {
  kind: 'eve';
  /** Son âge, en années : une de plus à chaque aube. */
  age: number;
  state: EveState;
  /** Là où elle vit : la tuile libre devant la mairie. */
  homeX: number;
  homeY: number;
  /** Le bâtiment qu'elle répare, `null` si aucun. */
  targetId: EntityId | null;
  /** Vrai si elle tape sur un mur ce tick. Pilote l'animation de frappe. */
  working: boolean;
  /** Ticks avant le prochain coup de clé à molette. */
  repairCooldown: number;
  /** Flânerie, comme un enfant. */
  dirX: number;
  dirY: number;
  wanderTicks: number;
}

/**
 * Un transport : `amount` objets `item`, de `from` vers `to`.
 *
 * Il est couvert des deux côtés dès sa création : le stock est marqué
 * sortant à la source, la place réservée à l'arrivée (`sim/jobs.ts`). Un
 * second job ne peut plus voir ni ce stock ni cette place.
 */
export interface Job {
  from: EntityId;
  to: EntityId;
  item: ItemId;
  amount: number;
  priority: JobPriority;
  /** Vrai une fois la charge ramassée : seule la réservation d'arrivée tient encore. */
  carried: boolean;
}

/**
 * Ce qu'un ouvrier sans travail garde de sa flânerie (`sim/workers.ts`) :
 * le point où il va, et la pause qu'il s'accorde une fois arrivé.
 */
export interface Wandering {
  wanderX: number;
  wanderY: number;
  /** Ticks de pause restants ; à zéro, il marche vers son point. */
  wanderTicks: number;
}

/**
 * Un ouvrier de la maison des constructeurs : un porteur.
 *
 * Sans rien à porter, il flâne devant chez lui ; il rentre dormir
 * (`inside`) la nuit, et s'y abriter pendant une vague.
 *
 * Un ex-mutant sorti de la clinique est un ouvrier comme les autres, logé à
 * la clinique ; il porte plus lourd et marche plus lentement (`EX_MUTANT`).
 * Un enfant de la colonie, à 14 ans, devient un ouvrier libre (`free`).
 *
 * Un logisticien est un ouvrier logé au poste de logistique : même vie, mais
 * il ne fait qu'un travail — vider les producteurs du rayon de son poste
 * dans la mairie — et porte un peu plus (`LOGISTICIANS`).
 *
 * Un bâtisseur est un ouvrier logé au poste de construction : il livre les
 * chantiers du rayon de son poste depuis la mairie, puis les bâtit (`build`).
 */
export interface Worker extends Moving, Wandering, Needful, Housed {
  kind: 'worker';
  /** Son âge, en années : une de plus à chaque aube. */
  age: number;
  /** La maison qui le loge — la clinique, pour un ex-mutant. */
  homeId: EntityId;
  /** Vrai pour un ex-mutant : plus fort, plus lent. */
  exMutant: boolean;
  /**
   * Vrai pour un enfant devenu ouvrier dans une sauvegarde d'avant `colonists` :
   * un porteur logé à sa nurserie, qui ne prend le poste de personne — comme
   * un ex-mutant. Aujourd'hui, l'enfant devenu grand rejoint `World.colonists`.
   */
  grown: boolean;
  /** Vrai pour un logisticien du poste de logistique. */
  logistician: boolean;
  /** Vrai pour un bâtisseur du poste de construction. */
  builder: boolean;
  /**
   * Vrai pour un ouvrier libre de la colonie : sans poste, logé nulle part,
   * il flâne devant la mairie (`homeId`) jusqu'à ce qu'un bâtiment qui
   * emploie le prenne — le plus proche d'abord.
   */
  free: boolean;
  /**
   * Vrai pour un survivant venu à l'appel de l'antenne : un porteur logé à
   * la mairie, toujours au travail comme un ex-mutant, de force ordinaire.
   */
  survivor: boolean;
  /** Le chantier qu'un bâtisseur est allé bâtir, `null` sinon. Jamais en même temps qu'un job. */
  build: EntityId | null;
  /** Vrai s'il est chez lui : invisible, immobile. */
  inside: boolean;
  job: Job | null;
  /** Ticks avant de chercher à nouveau du travail. */
  searchTicks: number;
}

/**
 * Ce que fait un bûcheron :
 * - `idle` : rien — il flâne devant la cabane, ou y dort la nuit ;
 * - `toTree` : il marche vers l'arbre qu'il a réservé ;
 * - `chop` : il le coupe, un coup de hache toutes les `LUMBERJACKS.chopTicks` ;
 * - `toCamp` : il rapporte le bois à la cabane ;
 * - `wait` : le coffre est plein — il attend devant la porte qu'un porteur le vide.
 */
export type LumberjackState = 'idle' | 'toTree' | 'chop' | 'toCamp' | 'wait';

/**
 * Un bûcheron de la cabane. Deux bûcherons ne visent jamais le même arbre :
 * `tree` est réservé dès qu'il est choisi, et la réservation, qui n'est pas
 * sauvegardée, se rejoue depuis les bûcherons au chargement — comme les jobs.
 */
export interface Lumberjack extends Moving, Wandering, Needful, Housed {
  kind: 'lumberjack';
  /** Son âge, en années : une de plus à chaque aube. */
  age: number;
  /** La cabane qui le loge, et dont le coffre reçoit son bois. */
  homeId: EntityId;
  /** Vrai s'il est chez lui : invisible, immobile. */
  inside: boolean;
  state: LumberjackState;
  /** L'arbre visé, `null` hors d'un voyage de coupe. */
  tree: { tx: number; ty: number } | null;
  /** Ticks avant le prochain coup de hache. */
  chopTicks: number;
  /** Bois dans les bras. */
  load: number;
  /** Ticks avant de chercher à nouveau un arbre. */
  searchTicks: number;
}

/**
 * Ce que fait un forestier :
 * - `idle` : rien — il flâne devant sa maison, ou y dort la nuit ;
 * - `toPlot` : il marche vers la case qu'il va planter ;
 * - `plant` : il y plante une pousse, `FORESTERS.plantTicks` durant.
 */
export type ForesterState = 'idle' | 'toPlot' | 'plant';

/**
 * Le forestier de la maison du forestier. Il plante les cases libres de son
 * carré l'une après l'autre, dans l'ordre (`plotTiles`), sans repasser chez
 * lui entre deux : rien à rapporter.
 */
export interface Forester extends Moving, Wandering, Needful, Housed {
  kind: 'forester';
  /** Son âge, en années : une de plus à chaque aube. */
  age: number;
  /** La maison qui le loge, et dont il plante le carré. */
  homeId: EntityId;
  /** Vrai s'il est chez lui : invisible, immobile. */
  inside: boolean;
  state: ForesterState;
  /** La case visée, `null` hors d'une plantation. */
  plot: { tx: number; ty: number } | null;
  /** Ticks avant que la pousse soit en terre. */
  plantTicks: number;
  /** Ticks avant de chercher à nouveau une case libre. */
  searchTicks: number;
}

/**
 * Un tas au sol : du butin lâché par un ennemi abattu, ou ce qu'Adam a jeté
 * de son sac. Il attend qu'Adam marche dessus.
 */
export interface Pickup extends Moving {
  kind: 'pickup';
  item: ItemId;
  /** Combien d'exemplaires : un pour le butin, tout ce qu'Adam a jeté d'un objet pour un tas. */
  amount: number;
  /**
   * Vrai pour un tas qu'Adam vient de jeter à ses pieds : il ne le reprend
   * qu'après s'en être éloigné — sinon le sac l'avalerait aussitôt.
   */
  waitForLeave: boolean;
  /** Ticks avant qu'il ne disparaisse, oublié. */
  ttl: number;
}

/**
 * Ce qui arrive à un mutant vaincu qu'une clinique peut accueillir :
 * - `stunned` : assommé, des étoiles plein la tête ; Adam n'a qu'à le toucher ;
 * - `following` : il suit Adam en boitillant, jusqu'à la porte de la clinique ;
 * - `care` : il y est soigné, invisible, jusqu'à devenir ex-mutant.
 */
export type PatientState = 'stunned' | 'following' | 'care';

/** Un mutant vaincu mais pas perdu : ni ennemi, ni cible. Sa place à la clinique lui est gardée. */
export interface Patient extends Moving {
  kind: 'patient';
  state: PatientState;
  /** La clinique qui lui garde une place. */
  clinicId: EntityId;
  /** Ticks restants : avant de se réveiller (`stunned`), avant d'être guéri (`care`). */
  ticks: number;
}

/**
 * Un échange de la caravane, tiré à son arrivée (`sim/caravan.ts`) :
 * ce qu'il coûte, ce qu'il rapporte — objets ou places de sac —, et s'il a
 * déjà été fait. Chaque échange ne se fait qu'une fois.
 */
export interface TradeOffer {
  kind: 'surplus' | 'loot' | 'rare';
  cost: Partial<Record<ItemId, number>>;
  items: Partial<Record<ItemId, number>>;
  bag: number;
  /** L'offre rare d'où il vient, comptée sur la partie ; `null` pour les autres. */
  rare: RareOfferId | null;
  done: boolean;
}

/**
 * Ce que fait la caravane :
 * - `arriving` : la charrette roule jusqu'au bord de la clairière ;
 * - `parked` : elle attend les échanges, jusqu'à `leaveTick` ;
 * - `leaving` : elle repart par où elle est venue, et disparaît.
 */
export type CaravanState = 'arriving' | 'parked' | 'leaving';

/** La caravane de troc : une charrette tirée par un survivant, un jour sur deux. */
export interface Caravan extends Moving {
  kind: 'caravan';
  state: CaravanState;
  /** Le jour de son passage : il fixe ses tirages. */
  day: number;
  /** Où elle se gare, et d'où elle vient — où elle repart. */
  parkX: number;
  parkY: number;
  fromX: number;
  fromY: number;
  /** Tick du départ, une fois garée ; 0 avant. */
  leaveTick: number;
  offers: TradeOffer[];
  /** Vrai tant qu'Adam est au contact : la fenêtre Troc ne s'ouvre qu'en arrivant. */
  met: boolean;
}

export type Mobile = Mutant | Beast | Arrow | Kid | Eve | Worker | Lumberjack | Forester | Pickup | Patient | Caravan;

/**
 * Les compteurs de la partie, que les objectifs lisent. Ils ne font que
 * monter : un bâtiment détruit ne défait pas une nuit survécue.
 */
export interface WorldStats {
  /** Nuits survécues : l'aube venue, la mairie debout. */
  nightsSurvived: number;
  /** Enfants nés, toutes nurseries confondues. */
  births: number;
  /** Objets sortis des machines — foreuses, fermes et forges. */
  produced: Partial<Record<ItemId, number>>;
}
