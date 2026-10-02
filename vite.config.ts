import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { testRoutes } from './src/ui/testRoute.ts';

/*
 * Les parties de test s'ouvrent par un chemin — `…/mobile-factory/test`.
 * GitHub Pages ne connaît pas de page de repli : un chemin sans fichier y
 * répond 404. Le build pose donc une copie d'`index.html` sous chaque route
 * (`test/index.html`), que Pages sert pour `/test` comme pour `/test/`. Les
 * URLs du HTML sont absolues (`/mobile-factory/assets/…`) : la copie les
 * trouve telle quelle. En développement, Vite renvoie déjà `index.html` sur
 * un chemin inconnu ; rien à faire.
 */
function testPages(): Plugin {
  let outDir = 'dist';

  return {
    name: 'mobile-factory:test-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      for (const route of testRoutes()) {
        mkdirSync(join(outDir, route), { recursive: true });
        copyFileSync(join(outDir, 'index.html'), join(outDir, route, 'index.html'));
      }
    },
  };
}

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
  plugins: [testPages()],
});
