import { describe, expect, it } from 'vitest';
import { MENU_BUILDING_IDS, type BuildingId } from '../data/buildings.ts';
import { EN } from '../i18n/en/index.ts';
import { FR } from '../i18n/fr/index.ts';
import type { Messages } from '../i18n/messages.ts';
import { World } from '../sim/world.ts';
import { buildingTerms, foldText, matchesSearch, productsOf, searchKey } from './buildSearch.ts';

/** Les cartes du menu que garde une recherche, dans une langue. */
function found(query: string, text: Messages = FR): BuildingId[] {
  return MENU_BUILDING_IDS.filter((id) => matchesSearch(query, buildingTerms(id, text)));
}

describe('recherche du menu de construction', () => {
  it('« bucheron » ne garde que la cabane de bûcheron', () => {
    expect(found('bucheron')).toEqual(['lumberCamp']);
  });

  it('ni la casse ni les accents ne comptent', () => {
    expect(foldText('Forêt')).toBe('foret');
    expect(found('BÛCHERON')).toEqual(['lumberCamp']);
    expect(found('CARRIERE')).toEqual(['quarry']);
    expect(found('carrière')).toEqual(['quarry']);
  });

  it('un début de mot ou une partie du nom suffit, chaque mot tapé compte', () => {
    expect(found('cab')).toEqual(['lumberCamp']);
    expect(found('guet')).toEqual(['watchtower']);
    expect(found('cab  bûch')).toEqual(['lumberCamp']);
    expect(found('cabane ferme')).toEqual([]);
  });

  it('ce qu’un bâtiment produit le trouve aussi : « bois » la cabane, « pierre » la carrière et la foreuse', () => {
    expect(productsOf('lumberCamp')).toEqual(['wood']);
    expect(found('bois')).toContain('lumberCamp');
    expect(found('pierre')).toEqual(expect.arrayContaining(['quarry', 'drill']));
    expect(found('eau')).toContain('well');
    expect(found('plaque')).toEqual(['forge']);
  });

  it('dans la langue du moment', () => {
    expect(found('wood', EN)).toContain('lumberCamp');
    expect(found('lumber', EN)).toEqual(['lumberCamp']);
    expect(found('bois', EN)).toEqual([]);
  });

  it('une recherche vide garde tout', () => {
    expect(found('')).toEqual(MENU_BUILDING_IDS);
    expect(found('   ')).toEqual(MENU_BUILDING_IDS);
  });

  it('un bâtiment verrouillé ne sort jamais : la recherche ne fait que retirer des cartes du menu', () => {
    const world = new World(1);
    // Ce que montre le tiroir (`BuildMenu.refresh`) : au menu, et gardé par la recherche.
    const shown = (query: string): BuildingId[] => found(query).filter((id) => world.inMenu(id));

    expect(found('forge')).toEqual(['forge']);
    expect(shown('forge')).toEqual([]);
    expect(shown('')).toEqual(MENU_BUILDING_IDS.filter((id) => world.inMenu(id)));
  });
});

describe('touches du champ de recherche', () => {
  it('Entrée choisit la première carte', () => {
    expect(searchKey('Enter', 'ferme')).toBe('pick');
    expect(searchKey('NumpadEnter', '')).toBe('pick');
  });

  it('Échap vide le champ, puis ferme le tiroir', () => {
    expect(searchKey('Escape', 'ferme')).toBe('clear');
    expect(searchKey('Escape', '')).toBe('close');
  });

  it('les lettres écrivent : ni pause, ni sac, ni marche', () => {
    for (const code of ['KeyP', 'KeyI', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowLeft']) {
      expect(searchKey(code, '')).toBeNull();
    }
    expect(searchKey('ArrowDown', '')).toBe('cards');
  });
});
