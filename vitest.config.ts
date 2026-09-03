import { defineConfig } from 'vitest/config';

/*
 * Les tests tournent en Node, sans canvas ni jsdom : c'est exactement le
 * bénéfice de la règle d'isolation. `world.tick()` s'exécute headless, donc
 * vite, donc en CI sans navigateur.
 *
 * Si un jour un test échoue avec « document is not defined », ce n'est pas la
 * config qu'il faut changer : c'est qu'un import interdit a franchi la
 * frontière de sim/.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/{sim,core,data}/**/*.test.ts'],
  },
});
