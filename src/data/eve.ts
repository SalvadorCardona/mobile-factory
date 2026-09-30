/**
 * Ève — contenu pur : quand elle arrive, comment elle bouge, ce qu'elle dit.
 *
 * Ingénieure bricoleuse, taquine, bienveillante. Elle **tutoie** Adam ; le
 * jeu, lui (bulles d'événement, boutons, écrans), **vouvoie** le joueur.
 * Adam ne parle jamais.
 *
 * Avant d'arriver, elle parle par radio : c'est sa voix qui porte les
 * conseils dès la première minute. Elle arrive après la vague
 * `arrivalWave` repoussée, sur son vélo-cargo, puis vit à la mairie, répare
 * le bâti entre les vagues et donne les quêtes (`data/quests.ts`).
 *
 * Répliques courtes : une bulle se lit d'un coup d'œil et ne bloque jamais.
 * Durées en ticks (20 par seconde), vitesses en tuiles par seconde.
 */

export const EVE = {
  /** Ève arrive une fois cette vague repoussée — le dernier mutant abattu. */
  arrivalWave: 3,
  /** Distance, en tuiles, d'où part le vélo-cargo : hors de la vue d'Adam. */
  arrivalDistance: 16,
  /** Vitesse du vélo-cargo. */
  rideSpeed: 3.2,
  /** Vitesse à pied. */
  walkSpeed: 2,
  /** Rayon de flânerie autour de la mairie, en tuiles. */
  homeRange: 3,
  /** Une réparation : `repairAmount` points de vie tous les `repairTicks`. */
  repairTicks: 10,
  repairAmount: 1,
  /** Distance, en pixels monde, entre Ève et un mur qu'elle peut réparer. */
  repairReach: 12,
  /** Ticks entre deux coups d'œil sur l'état du bâti et des quêtes. */
  checkTicks: 20,
  /** Boîte de collision, en pixels monde. */
  halfW: 6,
  halfH: 5,
} as const;

export const EVE_LINES = {
  /** Le conseil sous la quête — le tutoriel, dans sa bouche. Cf. `ui/hint.ts`. */
  hints: {
    bagFull: 'Ton sac déborde, Adam. Va vider tout ça sur le chantier !',
    wood: 'Allô Adam ? Ici Ève. Fonce dans un arbre : il nous faut du bois.',
    stone: 'De la pierre, maintenant. Les rochers roses, ça casse bien.',
    deliver: 'Pose tout ça : marche contre le chantier, ou tape-le.',
    tower: 'Des mutants approchent ! Une tour de guet, vite.',
    bow: 'Reste près d’eux : ton arc tire tout seul.',
    /** Par radio, entre deux vagues, tant qu'elle n'est pas là. `{n}` : vagues restantes. */
    coming: 'Tiens bon : encore {n} vague{s} et j’arrive avec ma machine !',
    /** Une fois la forge débloquée, tant qu'elle n'est pas bâtie : le charbon sert enfin. */
    forge: 'La forge est débloquée ! Fer et charbon dedans, plaques de fer dehors.',
  },
  /** Le petit dialogue d'arrivée, bulle après bulle. */
  arrival: [
    'Adam ! C’est moi, Ève. J’ai suivi la fumée.',
    'Joli, la mairie. Un peu penchée, mais joli.',
    'Je m’installe ici. Je rafistole tout ce qu’ils cassent.',
  ],
  /** Tapée sans quête en cours, ou une fois sur deux : ce qui lui passe par la tête. */
  chatter: [
    'Tu comptes vraiment tout porter à la main ? Courageux.',
    'Ce vélo ? Trois grille-pain et une brouette. De rien.',
    'Les mutants ont un sourire adorable. De loin.',
    'Si ça grince, je répare. Si ça ne grince pas, j’améliore.',
    'Tu parles pas beaucoup, toi. Ça me va, je parle pour deux.',
  ],
  /** Tapée pendant une attaque. */
  busy: 'Pas maintenant, Adam, ils arrivent !',
  /** Toutes les quêtes finies. */
  allDone: 'Plus de plans pour l’instant. Je griffonne la suite !',
} as const;
