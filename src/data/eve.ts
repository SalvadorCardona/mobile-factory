/**
 * Ève — contenu pur : quand elle arrive, comment elle bouge, ce qu'elle dit.
 *
 * Ingénieure bricoleuse, taquine, bienveillante. Elle **tutoie** Adam ; le
 * jeu, lui (bulles d'événement, boutons, écrans), **vouvoie** le joueur.
 * Adam ne parle jamais.
 *
 * Avant d'arriver, elle parle par radio : c'est sa voix qui porte les
 * conseils dès la première minute. Elle arrive à l'aube de la nuit
 * `arrivalNight` repoussée, sur son vélo-cargo, puis vit à la mairie, répare
 * le bâti entre les vagues et donne les quêtes (`data/quests.ts`).
 *
 * Répliques courtes : une bulle se lit d'un coup d'œil et ne bloque jamais.
 * Durées en ticks (20 par seconde), vitesses en tuiles par seconde.
 */

export const EVE = {
  /** Ève arrive une fois cette nuit repoussée — à l'aube, ou le dernier mutant abattu hors de la nuit. */
  arrivalNight: 3,
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
    /** Sac plein d'un objet dont aucun chantier ne veut : livrer ne servirait à rien. `{item}` : l'objet. */
    bagUseless: 'Ton sac est plein de {item}, Adam : pose un chantier qui en a besoin, ou tape le sac puis « Jeter ».',
    wood: 'Allô Adam ? Ici Ève. Passe près des arbres : il nous faut du bois.',
    stone: 'De la pierre, maintenant. Approche-toi des rochers roses.',
    deliver: 'Pose tout ça : marche contre le chantier, ou tape-le.',
    tower: 'Les mutants sortent la nuit ! Une tour de guet, vite.',
    bow: 'Reste près d’eux : ton arc tire tout seul.',
    /** Entre deux nuits, la mairie entamée et Ève pas encore là : Adam apprend à la réparer, bois sous la main ou pas. */
    repair: 'La mairie est abîmée ! Fonce dedans avec du bois, ou tape-la puis « Réparer ».',
    repairFetch: 'La mairie est abîmée ! Rapporte du bois et fonce dedans : ça la répare.',
    /** Plus de pierre en ville et pas de carrière : la source qui ne s'épuise pas. */
    quarry: 'Plus de pierre en ville ? Pose une carrière : ses ouvriers la taillent dans les ruines.',
    /** Par radio, entre deux nuits, tant qu'elle n'est pas là. `{n}` : nuits restantes. */
    coming: 'Tiens bon : encore {n} nuit{s} et j’arrive avec ma machine !',
    /** Une fois la forge débloquée, tant qu'elle n'est pas bâtie : le charbon sert enfin. */
    forge: 'La forge est débloquée ! Fer et charbon dedans, plaques de fer dehors.',
    /** La forge bâtie, plus de charbon en ville et pas de four à charbon : le bois en trop s'y change en charbon. */
    kiln: 'Ta forge a faim de charbon ? Un four à charbon cuit ton bois en trop : trois bûches, un charbon.',
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
  /** Une caravane de troc arrive au bord de la clairière (`data/caravan.ts`). */
  caravan: 'Une caravane ! Va voir ce qu’il propose.',
  /** Tapée pendant une attaque. */
  busy: 'Pas maintenant, Adam, ils arrivent !',
  /** Toutes les quêtes finies. */
  allDone: 'Plus de plans pour l’instant. Je griffonne la suite !',
} as const;
