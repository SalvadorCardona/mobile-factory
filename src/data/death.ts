/**
 * Mort d'Adam — contenu pur.
 *
 * À zéro point de vie, Adam tombe et ne revient qu'au bout de
 * `respawnSeconds` : le monde continue de tourner pendant ce temps — la
 * production, les mutants, les bases — et la colonie reste sans défenseur.
 * C'est la durée à ajuster pour rendre la mort plus ou moins punitive.
 */

export const DEATH = {
  /** Secondes de jeu passées à terre avant la réapparition à la mairie. */
  respawnSeconds: 30,
} as const;
