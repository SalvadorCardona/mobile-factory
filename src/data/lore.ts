/**
 * Pitch et univers — contenu pur, aucune logique.
 *
 * Ce fichier est la référence narrative du projet. Tout texte affiché au
 * joueur, toute description d'un sprite, tout nom de bâtiment ou de
 * personnage part d'ici. Si l'univers évolue, c'est ce fichier qui change en
 * premier ; le reste suit.
 */

export const LORE = {
  /** Nom du jeu, tel qu'affiché. */
  title: 'Mobile Factory',

  /**
   * Le pitch, en une respiration.
   *
   * Nous sommes dans un futur apocalyptique. Il ne reste que quelques
   * survivants. Le héros s'appelle Adam ; Ève viendra sûrement le rejoindre.
   * Dehors, des humains mutants radioactifs rôdent. Reconstruire une colonie
   * commence par une mairie, et par ramasser de ses mains ce qu'il faut pour
   * la bâtir.
   */
  pitch:
    'Un futur apocalyptique. Quelques survivants. Adam, seul au milieu des ' +
    'ruines, ramasse du bois et du minerai à mains nues pour bâtir une mairie ' +
    '— le premier toit de la colonie. Ève arrivera ensuite. Et avec elle, ' +
    'les mutants radioactifs qui rôdent au-delà de la clairière.',

  /** Époque : futur post-apocalyptique, après une catastrophe nucléaire. */
  era: 'futur post-apocalyptique, longtemps après une catastrophe nucléaire',

  characters: {
    adam: {
      name: 'Adam',
      role: 'héros, premier survivant, celui que le joueur incarne',
      description:
        'Homme adulte, cheveux indigo, tunique orange, écharpe corail au vent, ' +
        'sac à dos violet où il porte ce qu’il ramasse, et son arc de fortune à la main.',
    },
    eve: {
      name: 'Ève',
      role:
        'seconde survivante, ingénieure bricoleuse ; arrive après la troisième nuit, ' +
        'vit à la mairie, répare le bâti et donne les quêtes',
      description:
        'Femme adulte, taquine et bienveillante, création originale comme Adam. ' +
        'Chignon rond et carré court indigo, bandeau jaune, salopette cyan sur une ' +
        'chemise orange, clé à molette à la main. Elle arrive sur un vélo-cargo de ' +
        'récup à caisse jaune fleurie. Elle tutoie Adam, qui ne parle pas.',
    },
    mutant: {
      name: 'Mutant radioactif',
      role: 'humain irradié, hostile, marche droit sur la mairie pour la démolir',
      description:
        'Drôle plus qu’effrayant : tête bosselée, un œil énorme et un tout petit, ' +
        'sourire idiot, un bras trop long qui traîne au sol, peau vert fluo et ' +
        'halo radioactif. Il arrive par vagues ' +
        'dès que la mairie est debout, traverse tout, et ne s’arrête que devant ' +
        'un mur pour le casser.',
    },
    child: {
      name: 'Enfant',
      role: 'né à la nurserie, premier signe que la colonie vit',
      description:
        'Petit survivant en tunique orange et casquette jaune, écharpe corail. Il joue ' +
        'autour de la nurserie et n’en va jamais loin.',
    },
  },

  /**
   * Adam n'a pas de bouton d'action, mais il n'est pas sans défense : un
   * petit arc de fortune tire tout seul sur le mutant le plus proche.
   */
  weapons: {
    bow: {
      name: 'Arc de fortune',
      description:
        'Une branche courbée et un fil récupéré. Il tire de lui-même sur le ' +
        'mutant le plus proche dès qu’il entre à portée.',
    },
  },

  /**
   * Chaque bâtiment a trois textes : `site` pour son chantier, `description`
   * pour le bâtiment fini, `effect` pour sa carte du menu de construction —
   * une ligne, ce qu'il fait vraiment aujourd'hui. Un bâtiment debout ne
   * parle jamais de son chantier ; un bâtiment qui ne fait encore rien le dit.
   */
  buildings: {
    townHall: {
      name: 'Mairie',
      site:
        'Le premier bâtiment de la colonie. Le jeu commence sur son chantier : ' +
        'il faut y apporter du bois et de la pierre pour l’achever.',
      description: 'Le cœur de la colonie : si elle tombe, tout est perdu.',
      effect: 'Le cœur de la colonie : si elle tombe, tout est perdu.',
    },
    drill: {
      name: 'Foreuse',
      site: 'Un bâti de pierre qui attend son fer. Posée sur un filon, elle l’extraira seule.',
      description: 'Machine de récupération qui extrait le filon sous elle.',
      effect: 'Extrait seule le minerai du filon sous elle.',
    },
    nursery: {
      name: 'Nurserie',
      site: 'Des murs à monter avant d’y installer le berceau. Il lui faut du bois et de la pierre.',
      description:
        'Un abri chauffé, des couvertures, un berceau. Toutes les dix minutes, ' +
        'un enfant y naît et la colonie grandit d’un survivant — s’il y a de ' +
        'quoi le nourrir : chaque naissance mange quatre nourritures de la ferme.',
      effect: '+1 enfant toutes les 10 min, contre 4 nourritures.',
    },
    builderHouse: {
      name: 'Maison des constructeurs',
      site: 'Le dortoir de quatre ouvriers, encore à l’état de planches et de tôle empilées.',
      description:
        'Un dortoir de planches et de tôle pour quatre ouvriers. Ce sont eux ' +
        'qui, bientôt, porteront les ressources à la place d’Adam.',
      effect: 'Loge 4 ouvriers. Pas encore d’autre effet.',
    },
    farm: {
      name: 'Ferme',
      site: 'Une cabane à outils à monter avant de retourner la terre. Quatre ouvriers y travailleront.',
      description:
        'Quelques sillons dans la terre irradiée et une cabane à outils. Quatre ' +
        'ouvriers y font pousser de quoi nourrir la colonie.',
      effect: 'Cultive la nourriture de la nurserie.',
    },
    watchtower: {
      name: 'Tour de guet',
      site: 'Quatre poteaux plantés, une plateforme à clouer dessus. L’arc viendra ensuite.',
      description:
        'Une plateforme de planches sur quatre poteaux, avec un arc et un carquois. ' +
        'Elle tire seule sur tout mutant qui passe à sa portée.',
      effect: 'Tire sur les mutants à 8 cases.',
    },
    forge: {
      name: 'Forge',
      site: 'Un four de pierre et sa cheminée, encore sans feu. Il lui faut du minerai de fer pour l’armer.',
      description:
        'Un four de pierre, une cheminée qui fume et une enclume. Deux minerais de fer ' +
        'et un charbon y deviennent une plaque de fer.',
      effect: '2 fer + 1 charbon → 1 plaque de fer.',
    },
    reinforcedTower: {
      name: 'Tour de guet renforcée',
      site: 'Les pilotis d’une tour, et des plaques de fer à visser sur la plateforme.',
      description:
        'Une tour de guet blindée de plaques de fer. Son arc porte plus loin ' +
        'et tire plus vite que celui d’une tour de planches.',
      effect: 'Tire sur les mutants à 10 cases, 30 % plus vite.',
    },
  },
} as const;
