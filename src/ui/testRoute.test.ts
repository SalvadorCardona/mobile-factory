import { describe, expect, it } from 'vitest';
import { testRoutes, testScenarioOf } from './testRoute.ts';

const BASE = '/mobile-factory/';

describe('testScenarioOf', () => {
  it('ouvre le scénario par défaut sur /test, avec ou sans barre finale', () => {
    expect(testScenarioOf('/mobile-factory/test', BASE)).toBe('base');
    expect(testScenarioOf('/mobile-factory/test/', BASE)).toBe('base');
    expect(testScenarioOf('/mobile-factory/test/index.html', BASE)).toBe('base');
  });

  it('ouvre un scénario nommé sur /test/<id>', () => {
    expect(testScenarioOf('/mobile-factory/test/base', BASE)).toBe('base');
  });

  it('laisse la partie normale partout ailleurs', () => {
    expect(testScenarioOf('/mobile-factory/', BASE)).toBeNull();
    expect(testScenarioOf('/mobile-factory/index.html', BASE)).toBeNull();
    expect(testScenarioOf('/mobile-factory/test/inconnu', BASE)).toBeNull();
    expect(testScenarioOf('/mobile-factory/testeur', BASE)).toBeNull();
    expect(testScenarioOf('/test', BASE)).toBeNull();
  });
});

describe('testRoutes', () => {
  it('pose une page sous chaque route, et chacune se relit', () => {
    const routes = testRoutes();

    expect(routes).toContain('test');
    for (const route of routes) expect(testScenarioOf(`${BASE}${route}/`, BASE)).not.toBeNull();
  });
});
