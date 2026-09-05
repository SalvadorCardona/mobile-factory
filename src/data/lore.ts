/**
 * Pitch et univers — contenu pur, aucune logique.
 *
 * Ce fichier est la référence narrative du projet. Tout texte affiché au
 * joueur, tout prompt de génération d'asset, tout nom de bâtiment ou de
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
        'Homme adulte, robuste, cheveux bruns en bataille, veste olive rapiécée, ' +
        'pantalon gris et bottes de marche. Il porte ce qu’il ramasse sur le dos.',
    },
    eve: {
      name: 'Ève',
      role: 'seconde survivante, rejoindra Adam plus tard',
      description:
        'Femme adulte, cheveux roux courts, manteau de cuir, bottes. Pas encore en jeu.',
    },
    mutant: {
      name: 'Mutant radioactif',
      role: 'humain irradié, hostile, marche droit sur la mairie pour la démolir',
      description:
        'Silhouette humaine déformée, peau grise et verdâtre, lueur radioactive ' +
        'vert acide dans les yeux et les fissures de la peau. Il arrive par vagues ' +
        'dès que la mairie est debout, traverse tout, et ne s’arrête que devant ' +
        'un mur pour le casser.',
    },
    child: {
      name: 'Enfant',
      role: 'né à la nurserie, premier signe que la colonie vit',
      description:
        'Petit survivant en salopette grise et pull olive, cheveux bruns. Il joue ' +
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

  buildings: {
    townHall: {
      name: 'Mairie',
      description:
        'Le premier bâtiment de la colonie. Le jeu commence sur son chantier : ' +
        'il faut y apporter du bois et de la pierre pour l’achever.',
    },
    drill: {
      name: 'Foreuse',
      description: 'Machine de récupération qui extrait le filon sous elle.',
    },
    nursery: {
      name: 'Nurserie',
      description:
        'Un abri chauffé, des couvertures, un berceau. Toutes les dix minutes, ' +
        'un enfant y naît et la colonie grandit d’un survivant.',
    },
    builderHouse: {
      name: 'Maison des constructeurs',
      description:
        'Un dortoir de planches et de tôle pour quatre ouvriers. Ce sont eux ' +
        'qui, bientôt, porteront les ressources à la place d’Adam.',
    },
    farm: {
      name: 'Ferme',
      description:
        'Quelques sillons dans la terre irradiée et une cabane à outils. Quatre ' +
        'ouvriers y font pousser de quoi nourrir la colonie.',
    },
    watchtower: {
      name: 'Tour de guet',
      description:
        'Une plateforme de planches sur quatre poteaux, avec un arc et un carquois. ' +
        'Elle tire seule sur tout mutant qui passe à sa portée.',
    },
  },
} as const;
