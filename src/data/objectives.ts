/**
 * Objectifs — contenu pur.
 *
 * La partie est une chaîne d'objectifs, dans l'ordre de la liste. Le panneau
 * du haut affiche toujours le courant ; quand toutes ses conditions tiennent
 * en même temps, il est réussi, sa récompense tombe, et le suivant prend sa
 * place. Le sixième clôt l'acte I — la colonie vivra ; l'acte II est
 * l'Antenne, et son dernier étage lance le Signal : c'est la victoire, et la
 * partie continue sans fin, des survivants à chaque aube.
 *
 * Ajouter un objectif = ajouter une entrée ici. Aucune logique à écrire tant
 * que ses conditions (`Goal`) et sa récompense (`Reward`) existent déjà.
 *
 * Les conditions restent larges (« tenir 5 nuits ») : elles disent où
 * aller, pas comment. Et elles regardent l'état, pas l'ordre des gestes : une
 * tour posée avant qu'on la demande compte, l'objectif tombe dès qu'il arrive.
 *
 * Les quêtes d'Ève (`data/quests.ts`) sont une étape de la chaîne : l'objectif
 * « ses demandes » les compte, et chacune garde sa récompense à elle (un plan,
 * un outil). Le conseil est une réplique d'Ève : elle tutoie Adam.
 */

import type { BuildingId } from './buildings.ts';
import type { ItemId } from './items.ts';
import { LORE } from './lore.ts';
import { QUEST_IDS } from './quests.ts';

/**
 * Une condition, lue dans l'état de la simulation :
 * - `build` : au moins `count` bâtiments `building` finis et debout, montés
 *   au moins au niveau `level` s'il est donné — l'étage d'une antenne ;
 * - `nights` : `count` nuits survécues **pendant l'objectif** (l'aube levée,
 *   la mairie debout) — « tenir », c'est à partir de maintenant ;
 * - `produce` : `count` objets `item` sortis des machines depuis le début ;
 * - `births` : `count` enfants nés à la nurserie depuis le début ;
 * - `quests` : `count` quêtes d'Ève finies ;
 * - `happiness` : un Bonheur de la ville (`World.happiness`) d'au moins `count`.
 */
export type Goal =
  | { type: 'build'; building: BuildingId; count: number; level?: number }
  | { type: 'nights'; count: number }
  | { type: 'produce'; item: ItemId; count: number }
  | { type: 'births'; count: number }
  | { type: 'quests'; count: number }
  | { type: 'happiness'; count: number };

/**
 * Ce que rapporte un objectif réussi. Tout est concret : rien qui annonce un
 * effet que le jeu n'a pas encore.
 * - `items` : déposés dans le sac ; ce qui n'y tient pas va à la mairie ;
 * - `bag` : places ajoutées au sac, pour la suite de la partie ;
 * - `repair` : la mairie retrouve tous ses points de vie.
 */
export interface Reward {
  items?: Partial<Record<ItemId, number>>;
  bag?: number;
  repair?: boolean;
}

export interface ObjectiveProto {
  /** Ce que dit le panneau du haut, à l'infinitif. */
  title: string;
  /** Le conseil sous la quête, tant que l'objectif court — une réplique d'Ève. */
  hint: string;
  /** Toutes vraies en même temps. Une jauge par condition dans le panneau. */
  goals: readonly Goal[];
  reward: Reward;
  /** La phrase de la célébration : ce que la récompense change. */
  celebration: string;
  /** Le titre du bandeau, quand ce n'est pas « Objectif réussi ! » : la fin d'un acte. */
  banner?: string;
}

const { townHall, drill, nursery, antenna } = LORE.buildings;
const eve = LORE.characters.eve.name;

export const OBJECTIVES = [
  {
    title: `Bâtir la ${townHall.name}`,
    hint: 'Du bois et de la pierre au chantier, Adam.',
    goals: [{ type: 'build', building: 'townHall', count: 1 }],
    // Elle se récompense elle-même : son coffre devient le stock de la ville.
    reward: {},
    celebration: 'Le premier toit tient debout : la mairie devient l’entrepôt de la ville.',
  },
  {
    title: 'Survivre à 3 nuits',
    hint: 'La nuit, reste près de la mairie : ton arc tire tout seul. J’arrive après la troisième !',
    goals: [{ type: 'nights', count: 3 }],
    reward: { bag: 20 },
    celebration: `${eve} arrive en vélo-cargo, avec un sac de rechange : +20 places.`,
  },
  {
    title: `Répondre aux demandes d’${eve}`,
    hint: 'Tape-moi pour savoir ce qu’il me faut. Chaque demande tenue, un plan ou un outil !',
    goals: [{ type: 'quests', count: QUEST_IDS.length }],
    reward: { repair: true },
    celebration: `Toutes les demandes d’${eve} tenues : elle remet la mairie à neuf.`,
  },
  {
    title: 'Extraire 20 minerais de fer',
    hint: `Une ${drill.name.toLowerCase()} près des rochers bleus : c’est là que dort le fer.`,
    goals: [
      { type: 'build', building: 'drill', count: 1 },
      { type: 'produce', item: 'ironOre', count: 20 },
    ],
    reward: { items: { wood: 14, stone: 6 } },
    celebration: 'La foreuse tourne. De quoi bâtir une nurserie : +14 bois, +6 pierre.',
  },
  {
    title: 'Voir naître le premier enfant',
    hint: `Une ${nursery.name.toLowerCase()}, et six nourritures de la ferme dedans : un bébé !`,
    goals: [
      { type: 'build', building: 'nursery', count: 1 },
      { type: 'births', count: 1 },
    ],
    reward: { repair: true, bag: 20 },
    celebration: 'Un enfant est né : la colonie a un avenir. Mairie réparée, +20 places dans le sac.',
  },
  {
    title: 'Tenir 5 nuits',
    hint: 'Des tours tout autour de la mairie, et toi au milieu. Cinq nuits, et on tient, Adam !',
    goals: [{ type: 'nights', count: 5 }],
    reward: {},
    celebration: `La colonie vivra. ${eve} a une idée : une ${antenna.name.toLowerCase()} pour appeler d’autres survivants.`,
    banner: LORE.signal.actOne,
  },
  {
    title: `Bâtir l’${antenna.name}`,
    hint: 'Une antenne à 8 cases de la mairie, trois étages : il faudra des cœurs de la Reine, et la défendre !',
    goals: [{ type: 'build', building: 'antenna', count: 1, level: 3 }],
    reward: {},
    celebration: LORE.signal.answer,
  },
] as const satisfies readonly ObjectiveProto[];

/** Places ajoutées au sac par les `done` premiers objectifs : la capacité se relit, elle ne se sauvegarde pas. */
export function objectiveBagBonus(done: number): number {
  let bonus = 0;

  for (const objective of OBJECTIVES.slice(0, done) as readonly ObjectiveProto[]) {
    bonus += objective.reward.bag ?? 0;
  }
  return bonus;
}
