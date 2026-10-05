import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_IDS } from '../data/buildings.ts';
import { FR } from '../i18n/fr/index.ts';
import { EN } from '../i18n/en/index.ts';
import { ZOOM } from './camera.ts';
import { SIGN_ZOOM, signItem, signMode } from './signs.ts';

describe('signItem', () => {
  it('dit ce que produit le bâtiment, sinon ce qu’il consomme', () => {
    expect(signItem('farm', 'farm', null)).toBe('food');
    expect(signItem('quarry', 'quarry', null)).toBe('stone');
    expect(signItem('forge', 'forge', null)).toBe('ironPlate');
    expect(signItem('charcoalKiln', 'forge', null)).toBe('coal');
    expect(signItem('nursery', 'nursery', null)).toBe('food');
    expect(signItem('lumberCamp', 'lumberCamp', null)).toBe('wood');
  });

  it('montre le filon d’une foreuse, et rien posée à sec', () => {
    expect(signItem('drill', 'drill', 'coal')).toBe('coal');
    expect(signItem('drill', 'drill', null)).toBeNull();
  });

  it('laisse sans icône un bâtiment qui ne produit rien', () => {
    expect(signItem('townHall', 'townHall', null)).toBeNull();
    expect(signItem('watchtower', 'tower', null)).toBeNull();
    expect(signItem('lab', 'lab', null)).toBeNull();
  });
});

describe('signMode', () => {
  it('lit le nom au zoom par défaut, l’icône seule en reculant, puis plus rien', () => {
    expect(signMode(ZOOM.default, 'wood')).toBe('full');
    expect(signMode(ZOOM.default, null)).toBe('full');
    expect(signMode(0.8, 'wood')).toBe('icon');
    expect(signMode(0.8, null)).toBe('none');
    expect(signMode(ZOOM.min, 'wood')).toBe('none');
    expect(SIGN_ZOOM.icon).toBeGreaterThan(ZOOM.min);
  });
});

describe('noms de pancarte', () => {
  it('chaque bâtiment a un nom court, dans chaque langue', () => {
    for (const id of BUILDING_IDS) {
      expect(BUILDINGS[id].sign.length).toBeGreaterThan(0);
      expect(BUILDINGS[id].sign.length).toBeLessThanOrEqual(BUILDINGS[id].label.length);
      expect(FR.buildings[id].sign).toBe(BUILDINGS[id].sign);
      expect(EN.buildings[id].sign.length).toBeGreaterThan(0);
    }
  });
});
