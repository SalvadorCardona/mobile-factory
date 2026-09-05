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
      role: 'humain irradié, hostile, erre en dehors de la colonie',
      description:
        'Silhouette humaine déformée, peau grise et verdâtre, lueur radioactive ' +
        'vert acide dans les yeux et les fissures de la peau. Pas encore en jeu.',
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
  },
} as const;
