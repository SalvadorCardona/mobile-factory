import { defineConfig } from 'vitest/config';

/*
 * Les tests tournent en Node, sans canvas ni jsdom : c'est exactement le
 * bénéfice de la règle d'isolation. `world.tick()` s'exécute headless, donc
 * vite, donc en CI sans navigateur.
 *
 * Si un jour un test échoue avec « document is not defined », ce n'est pas la
 * config qu'il faut changer : c'est qu'un import interdit a franchi la
 * frontière de sim/.
 *
 * Un test de render/ ne teste que de la logique pure (la profondeur de
 * l'eau, par exemple) : il n'importe de Pixi que des types.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/{sim,core,data,art,input,ui,storage,render,audio}/**/*.test.ts'],
  },
});
