import { defineConfig } from 'vite';

/*
 * Le jeu est publié en project page GitHub Pages, donc servi sous un
 * sous-chemin — https://cardona.digital/mobile-factory/ — et non à la racine
 * du domaine.
 *
 * Sans cette `base`, Vite écrit des URLs absolues `/assets/…` dans le HTML
 * produit. Elles répondraient 404 une fois en ligne et le jeu s'ouvrirait sur
 * un écran noir, sans la moindre erreur visible à l'œil nu : la page se charge,
 * c'est le canvas qui n'arrive jamais.
 *
 * La base est volontairement la même en développement — Vite redirige `/` vers
 * `/mobile-factory/` — pour qu'un chemin ne puisse pas marcher en local et
 * casser en production.
 *
 * Si le dépôt est renommé, cette valeur doit suivre le nouveau nom.
 *
 * Les tests ne passent pas par ici : `vitest.config.ts` a la priorité.
 */
export default defineConfig({
  base: '/mobile-factory/',
});
