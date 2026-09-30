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
 * - les **mobiles** — mutants, bêtes, flèches, enfants, Ève, ouvriers, butin — qui bougent à chaque tick.
 *   Ils sont peu nombreux, et c'est ce qui rend le tick par mobile acceptable.
 */

import type { BuildingId } from '../data/buildings.ts';
import type { EnemyId, WildlifeId } from '../data/enemies.ts';
import type { ItemId } from '../data/items.ts';
import type { JobPriority } from '../data/workers.ts';
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
}

/** Ce que tout bâtiment fini partage : un coffre et des points de vie. */
interface Built extends Placed {
  /** Coffre interne. */
  store: Store;
  /** Points de vie restants ; le maximum est `BUILDINGS[proto].hp`. */
  hp: number;
}

export interface Drill extends Built {
  kind: 'drill';
  /** Objet extrait par le gisement sous la foreuse, `null` si elle est posée à sec. */
  output: ItemId | null;
  /** Vrai quand le coffre est plein : la foreuse ne se replanifie plus. */
  blocked: boolean;
}

/** La mairie : le premier toit de la colonie, son entrepôt, et ce que les mutants visent. */
export interface TownHall extends Built {
  kind: 'townHall';
}

/** La nurserie : un enfant toutes les dix minutes. */
export interface Nursery extends Built {
  kind: 'nursery';
  /** Tick de la prochaine naissance — la fenêtre d'inspection affiche le compte à rebours. */
  nextBirthTick: number;
  /** Enfants nés ici, en tout. */
  born: number;
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
  /** Vrai quand le coffre est plein : la ferme ne se replanifie plus. */
  blocked: boolean;
}

export type Entity = Site | Drill | TownHall | Nursery | Tower | House | Farm;

export type Building = Exclude<Entity, Site>;

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
  /** Ticks depuis le dernier coup reçu : Adam ne récupère qu'au calme. */
  calmTicks: number;
  /** Le sac à dos. */
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
  /** Ticks avant le prochain coup sur le bâtiment heurté. */
  attackCooldown: number;
  /** Ticks restants à sortir de la flaque : immobile, et hors d'atteinte des arcs. */
  emerge: number;
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
  /** La tanière d'où elle vient, et où elle rentre. */
  denId: number;
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
}

/** Un enfant : il joue autour de sa nurserie et n'en va jamais loin. */
export interface Kid extends Moving {
  kind: 'kid';
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
 * Un ouvrier de la maison des constructeurs : un porteur.
 *
 * Il dort chez lui (`inside`) tant qu'il n'y a rien à porter, sort dès qu'un
 * job se présente, et rentre s'y abriter pendant une vague.
 */
export interface Worker extends Moving {
  kind: 'worker';
  /** La maison qui le loge. */
  homeId: EntityId;
  /** Vrai s'il est chez lui : invisible, immobile. */
  inside: boolean;
  job: Job | null;
  /** Ticks avant de chercher à nouveau du travail. */
  searchTicks: number;
}

/** Du butin lâché par un mutant : il attend au sol qu'Adam marche dessus. */
export interface Pickup extends Moving {
  kind: 'pickup';
  item: ItemId;
  /** Ticks avant qu'il ne disparaisse, oublié. */
  ttl: number;
}

export type Mobile = Mutant | Beast | Arrow | Kid | Eve | Worker | Pickup;
