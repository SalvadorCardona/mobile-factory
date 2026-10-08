/** Section `resourcePanel` du dictionnaire français : le panneau des ressources avancées, ouvert depuis le bandeau de la ville. */

export const resourcePanel = {
  title: 'Ressources',
  /** L'`aria-label` et l'infobulle du bouton au bout du bandeau de la ville. */
  open: 'Ouvrir le détail des ressources',
  /** Sous le titre : ce que les chiffres mesurent. */
  window: 'Ville, sur les deux dernières minutes de jeu',
  empty: 'Rien en ville pour l’instant.',
  trend: { up: 'en hausse', flat: 'stable', down: 'en baisse' },
  /** Les trois chiffres d'une ligne, déjà formatés. */
  produced: 'Entrées',
  consumed: 'Sorties',
  net: 'Solde',
  /** Un débit par minute, déjà signé ou non. */
  perMinute: (rate: string): string => `${rate}/min`,
  /** Le temps avant épuisement, au solde actuel. */
  runsOut: (minutes: number): string => (minutes < 1 ? 'à sec dans moins d’une minute' : `à sec dans ~${minutes} min`),
  /** L'`aria-label` de la mini-courbe. */
  history: (item: string, from: number, to: number): string => `${item} : de ${from} à ${to} en deux minutes`,
  /** La ligne entière, lue par un lecteur d'écran. */
  rowLabel: (item: string, stock: number, trend: string): string => `${item} — ${stock} en ville, ${trend}`,
};
