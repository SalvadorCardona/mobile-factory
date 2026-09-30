/**
 * Porteurs — contenu pur.
 *
 * Pas de tapis : de petits humains transportent les matériaux. Les ouvriers
 * de la maison des constructeurs vident les coffres des foreuses et des
 * fermes dans la mairie, et livrent les chantiers depuis la mairie. La
 * rareté n'est plus la bande passante d'un tapis mais le nombre de porteurs
 * et la distance à parcourir.
 */

export const PORTERS = {
  /** Vitesse de marche, en tuiles par seconde — plus lent qu'Adam (4,5). */
  speed: 2.4,
  /** Objets portés en un voyage. */
  carry: 5,
  /** Ticks avant qu'un ouvrier oisif cherche à nouveau du travail : la recherche est le coût à surveiller. */
  retryTicks: 20,
} as const;

/**
 * Un ex-mutant, sorti guéri de la clinique, porte comme un ouvrier — mais
 * pas tout à fait : il a gardé la carrure de sa vie d'avant, pas l'allure.
 * Il porte plus lourd, et marche plus lentement.
 */
export const EX_MUTANT = {
  speed: 1.7,
  carry: 8,
} as const;

/**
 * Priorité d'un job. Un chantier qui attend passe avant tout ; vider un
 * coffre qui a de quoi remplir un voyage vient ensuite ; ramasser les restes
 * d'un coffre ne se fait que si personne n'a mieux à faire.
 */
export const JOB_PRIORITY = {
  /** Livrer un chantier en attente, depuis la mairie. */
  site: 2,
  /** Vider une foreuse ou une ferme qui a un plein voyage à donner. */
  empty: 1,
  /** Rapporter un reste — moins d'un voyage — à la mairie. */
  surplus: 0,
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];
