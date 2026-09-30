import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId } from '../data/buildings.ts';
import { World } from '../sim/world.ts';
import { panelDescription } from './buildingPanel.ts';

describe('panelDescription', () => {
  it('chaque bâtiment a deux textes distincts, chantier et bâtiment fini', () => {
    for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
      const { siteDescription, description } = BUILDINGS[id];

      expect(siteDescription, id).not.toBe('');
      expect(description, id).not.toBe(siteDescription);
    }
  });

  it('le chantier de la mairie parle de son chantier', () => {
    const world = new World(1);
    const hall = world.entities.get(world.townHallId);

    if (!hall) throw new Error('pas de mairie');
    expect(panelDescription(hall)).toBe(BUILDINGS.townHall.siteDescription);
  });

  it('la mairie finie n’utilise jamais la description de chantier', () => {
    const world = new World(1);
    const site = world.entities.get(world.townHallId);

    if (site?.kind !== 'site') throw new Error('la partie ne commence plus sur le chantier de la mairie');
    site.delivered = { ...BUILDINGS[site.proto].cost };
    world.push({ type: 'buildSite', id: site.id });
    world.tick();

    const hall = world.entities.get(world.townHallId);

    expect(hall?.kind).toBe('townHall');
    if (!hall) return;
    expect(panelDescription(hall)).toBe(BUILDINGS.townHall.description);
    expect(panelDescription(hall)).not.toBe(BUILDINGS.townHall.siteDescription);
  });
});
