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
  /** Ravitailler depuis la mairie une forge ou une nurserie à qui il manque de quoi tourner. */
  starving: 2,
  /** Vider une foreuse ou une ferme qui a un plein voyage à donner. */
  empty: 1,
  /** Compléter depuis la mairie le coffre d'une forge ou d'une nurserie qui tourne encore. */
  refill: 1,
  /** Rapporter un reste — moins d'un voyage — à la mairie. */
  surplus: 0,
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

/**
 * Bûcherons — les ouvriers de la cabane de bûcheron (`BUILDINGS.lumberCamp`).
 *
 * En boucle : sortir, marcher jusqu'à l'arbre intact le plus proche dans le
 * rayon de la cabane, le couper à coups de hache — une unité de bois par
 * coup, comme Adam la récolte —, rapporter le bois au coffre de la cabane.
 * Les porteurs le vident ensuite dans la mairie, comme une foreuse.
 */
export const LUMBERJACKS = {
  /** Rayon de coupe, en tuiles, depuis le centre de la cabane : c'est le cercle affiché. */
  radius: 7,
  /** Vitesse de marche, en tuiles par seconde. */
  speed: 2.2,
  /** Ticks entre deux coups de hache ; chaque coup détache une unité de bois. */
  chopTicks: 16,
  /** Bois porté en un voyage : un arbre entier. */
  carry: 5,
  /** Ticks avant qu'un bûcheron sans arbre ni place au coffre réessaie. */
  retryTicks: 40,
} as const;

/**
 * Logisticiens — les ouvriers du poste de logistique (`BUILDINGS.logisticsPost`).
 *
 * En boucle : choisir, parmi les producteurs (foreuses, fermes, cabanes de
 * bûcheron) dans le rayon du poste, le coffre le plus rempli, en charger un
 * voyage, le livrer à la mairie, revenir. Les producteurs qu'un poste
 * couvre sont à lui : les porteurs de la maison des constructeurs ne les
 * vident plus, ils livrent les chantiers.
 */
export const LOGISTICIANS = {
  /** Rayon d'action, en tuiles, du centre du poste au centre du producteur : c'est le cercle affiché. */
  radius: 10,
  /** Vitesse de marche, en tuiles par seconde : celle d'un porteur. */
  speed: 2.4,
  /** Objets portés en un voyage : un peu plus qu'un porteur (5), c'est leur métier. */
  carry: 7,
} as const;

/**
 * La flânerie d'un ouvrier sans travail : de petits trajets en ligne droite
 * autour de sa porte, entrecoupés de pauses. Aucun chemin à calculer — un
 * point tiré, une ligne vérifiée hors de l'eau, et c'est tout.
 */
export const WANDER = {
  /** Rayon de flânerie autour de la porte, en tuiles. */
  radius: 3,
  /** Allure d'un ouvrier qui flâne, en part de sa vitesse de marche. */
  pace: 0.55,
  /** Pause entre deux trajets, en ticks : un minimum, plus une part tirée au hasard. */
  pauseTicks: 30,
  pauseJitter: 90,
} as const;
