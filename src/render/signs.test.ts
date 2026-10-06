import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_IDS } from '../data/buildings.ts';
import { JOB_ICONS } from '../data/jobIcons.ts';
import { SPRITES } from '../data/sprites.ts';
import { FR } from '../i18n/fr/index.ts';
import { EN } from '../i18n/en/index.ts';
import { ZOOM } from './camera.ts';
import { SIGN_ZOOM, signItem, signMode } from './signs.ts';

describe('signItem', () => {
  it('montre le filon d’une foreuse, et rien posée à sec', () => {
    expect(signItem('drill', 'coal')).toBe('coal');
    expect(signItem('drill', null)).toBeNull();
  });

  it('laisse le métier parler seul pour les autres bâtiments', () => {
    expect(signItem('farm', null)).toBeNull();
    expect(signItem('lumberCamp', null)).toBeNull();
    expect(signItem('townHall', null)).toBeNull();
  });
});

describe('signMode', () => {
  it('lit le nom au zoom par défaut, le médaillon seul en reculant, puis plus rien', () => {
    expect(signMode(ZOOM.default)).toBe('full');
    expect(signMode(0.8)).toBe('icon');
    expect(signMode(ZOOM.min)).toBe('none');
    expect(SIGN_ZOOM.icon).toBeGreaterThan(ZOOM.min);
  });
});

describe('médaillons de métier', () => {
  it('chaque bâtiment a le sien, et deux bâtiments ne partagent jamais le même', () => {
    for (const id of BUILDING_IDS) expect(JOB_ICONS[id]).toContain('<svg');
    expect(new Set(BUILDING_IDS.map((id) => JOB_ICONS[id])).size).toBe(BUILDING_IDS.length);
  });

  it('a un morceau par bâtiment dans l’atlas, pour la pancarte', () => {
    expect(Object.keys(SPRITES.jobs.parts).sort()).toEqual([...BUILDING_IDS].sort());
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
