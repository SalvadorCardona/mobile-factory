import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../core/grid.ts';
import { BUILDINGS } from '../data/buildings.ts';
import type { ItemId } from '../data/items.ts';
import { wardrobeErrors } from '../data/validate.ts';
import {
  DEFAULT_LOOK,
  LOOK_SLOTS,
  LOOT_SOURCES,
  PIECES,
  PIECE_IDS,
  WARDROBE_LOOT,
  copyLook,
  isStarter,
  piecesOf,
  type Look,
  type PieceId,
} from '../data/wardrobe.ts';
import { adamLookParts } from '../art/adamLook.ts';
import { decodeSave, encodeSave, serialize } from './save.ts';
import type { EntityId } from './types.ts';
import { lookRejection, owns, readLook, readWardrobe, rollPiece } from './wardrobe.ts';
import { World } from './world.ts';

/** Les pièces à trouver : tout sauf celles du départ. */
const LOCKED = PIECE_IDS.filter((piece) => !isStarter(piece));

/** Une pièce à trouver de l'emplacement `slot`. */
function lockedOf(slot: (typeof LOOK_SLOTS)[number]): PieceId {
  const piece = piecesOf(slot).find((id) => !isStarter(id));

  if (!piece) throw new Error(`aucune pièce à trouver pour ${slot}`);
  return piece;
}

/** Livre le chantier au contact, depuis le sac : le dernier objet livré l'achève. */
function completeSite(world: World, id: EntityId): void {
  const site = world.entities.get(id);

  if (site?.kind !== 'site') throw new Error(`#${id} n'est pas un chantier`);
  for (const [item, amount] of Object.entries(BUILDINGS[site.proto].cost) as [ItemId, number][]) world.player.inventory.add(item, amount);

  const below = { tx: site.tx + Math.floor(site.width / 2), ty: site.ty + site.height };

  world.player.x = (below.tx + 0.5) * TILE_SIZE;
  world.player.y = (below.ty + 0.5) * TILE_SIZE;
  world.push({ type: 'setMoveAxis', x: 0, y: -1 });
  for (let i = 0; i < 400 && world.entities.get(id)?.kind === 'site'; i += 1) world.tick();
  world.push({ type: 'setMoveAxis', x: 0, y: 0 });
  world.tick();
}

describe('catalogue de la garde-robe', () => {
  it('passe la validation des données : pièces du départ, nuanciers, butin, direction artistique', () => {
    expect(wardrobeErrors()).toEqual([]);
  });

  it('chaque emplacement a plusieurs pièces, et au moins une à trouver', () => {
    for (const slot of LOOK_SLOTS) {
      expect(piecesOf(slot).length, slot).toBeGreaterThanOrEqual(3);
      expect(piecesOf(slot).some((piece) => !isStarter(piece)), slot).toBe(true);
    }
  });

  it('les lunettes d’aviateur sont à trouver', () => {
    expect(PIECES.glassesAviator.slot).toBe('glasses');
    expect(isStarter('glassesAviator')).toBe(false);
  });

  it('une pièce change le dessin d’Adam, et seulement les morceaux qu’elle touche', () => {
    const base = adamLookParts(DEFAULT_LOOK);
    const hatted = adamLookParts({ pieces: { ...DEFAULT_LOOK.pieces, hat: 'hatStraw' }, colors: DEFAULT_LOOK.colors });
    const shod = adamLookParts({ pieces: { ...DEFAULT_LOOK.pieces, shoes: 'shoesBunny' }, colors: DEFAULT_LOOK.colors });

    expect(hatted.down).not.toBe(base.down);
    expect(hatted.foot).toBe(base.foot);
    expect(shod.foot).not.toBe(base.foot);
    expect(shod.down).toBe(base.down);
  });

  it('la couleur des yeux se voit de face et de profil, pas de dos', () => {
    const base = adamLookParts(DEFAULT_LOOK);
    const green = adamLookParts({ pieces: DEFAULT_LOOK.pieces, colors: { ...DEFAULT_LOOK.colors, eyes: 'mint' } });

    expect(green.down).not.toBe(base.down);
    expect(green.side).not.toBe(base.side);
    expect(green.up).toBe(base.up);
  });
});

describe('apparence jugée', () => {
  it('l’Adam par défaut se porte sans rien avoir trouvé', () => {
    expect(lookRejection(DEFAULT_LOOK, [])).toBeNull();
  });

  it('refuse une pièce pas encore trouvée, hors de son emplacement, ou une couleur hors nuancier', () => {
    const locked = lockedOf('glasses');

    expect(lookRejection({ ...DEFAULT_LOOK, pieces: { ...DEFAULT_LOOK.pieces, glasses: locked } }, [])).toBe('locked');
    expect(lookRejection({ ...DEFAULT_LOOK, pieces: { ...DEFAULT_LOOK.pieces, glasses: locked } }, [locked])).toBeNull();
    expect(lookRejection({ ...DEFAULT_LOOK, pieces: { ...DEFAULT_LOOK.pieces, hat: 'beardShort' } }, [])).toBe('slot');
    expect(lookRejection({ ...DEFAULT_LOOK, pieces: { ...DEFAULT_LOOK.pieces, hat: 'hatTophat' as PieceId } }, [])).toBe('unknown');
    expect(lookRejection({ pieces: DEFAULT_LOOK.pieces, colors: { ...DEFAULT_LOOK.colors, eyes: 'toxic' } }, [])).toBe('color');
  });
});

describe('commande dressAdam', () => {
  it('habille Adam et l’annonce au rendu', () => {
    const world = new World(7);
    const seen: Look[] = [];
    const look: Look = { pieces: { ...DEFAULT_LOOK.pieces, beard: 'beardNone', hat: 'hatBandana' }, colors: { ...DEFAULT_LOOK.colors, eyes: 'cyan' } };

    world.events.on('lookChanged', ({ look: changed }) => seen.push(changed));
    world.push({ type: 'dressAdam', look });
    world.tick();

    expect(world.player.look).toEqual(look);
    expect(seen).toEqual([look]);
  });

  it('refuse une pièce pas trouvée : Adam garde sa tenue', () => {
    const world = new World(7);
    const reasons: string[] = [];

    world.events.on('lookRejected', ({ reason }) => reasons.push(reason));
    world.push({ type: 'dressAdam', look: { pieces: { ...DEFAULT_LOOK.pieces, shoes: 'shoesBunny' }, colors: DEFAULT_LOOK.colors } });
    world.tick();

    expect(reasons).toEqual(['locked']);
    expect(world.player.look).toEqual(DEFAULT_LOOK);
  });

  it('la tenue est une copie : changer l’objet de la commande après coup n’habille pas Adam', () => {
    const world = new World(7);
    const look = copyLook(DEFAULT_LOOK);

    look.pieces.hat = 'hatBandana';
    world.push({ type: 'dressAdam', look });
    world.tick();
    look.pieces.hat = 'hatNone';

    expect(world.player.look.pieces.hat).toBe('hatBandana');
  });
});

describe('pièces trouvées', () => {
  it('le tirage est déterministe et ne donne jamais une pièce qu’Adam a déjà', () => {
    for (const source of LOOT_SOURCES) {
      for (let key = 0; key < 40; key += 1) {
        const piece = rollPiece(3, source, key, []);

        expect(rollPiece(3, source, key, [])).toBe(piece);
        if (piece) {
          expect(isStarter(piece)).toBe(false);
          expect(WARDROBE_LOOT[source].weights).toHaveProperty(PIECES[piece].rarity);
        }
      }
    }
  });

  it('un objectif donne toujours une pièce tant qu’il en reste, puis plus rien', () => {
    const found: PieceId[] = [];

    for (let key = 0; found.length < LOCKED.length && key < 500; key += 1) {
      const piece = rollPiece(11, 'objective', key, found);

      if (piece === null) break;
      expect(found).not.toContain(piece);
      found.push(piece);
    }
    // L'objectif ne donne ni épique ni rien hors de ses raretés : il s'arrête quand elles sont épuisées.
    const reachable = LOCKED.filter((piece) => PIECES[piece].rarity in WARDROBE_LOOT.objective.weights);

    expect(new Set(found)).toEqual(new Set(reachable));
    expect(rollPiece(11, 'objective', 999, found)).toBeNull();
  });

  it('une bête n’en donne que de temps en temps', () => {
    const drops = Array.from({ length: 2000 }, (_, key) => rollPiece(5, 'beast', key, [])).filter((piece) => piece !== null);

    expect(drops.length).toBeGreaterThan(40);
    expect(drops.length).toBeLessThan(200);
  });

  it('bâtir la mairie, premier objectif, fait trouver une pièce — sans toucher au PRNG du monde', () => {
    const world = new World(42);
    const twin = new World(42);
    const found: PieceId[] = [];

    world.events.on('pieceFound', ({ piece, source }) => {
      expect(source).toBe('objective');
      found.push(piece);
    });
    completeSite(world, world.townHallId);
    completeSite(twin, twin.townHallId);

    expect(world.objective).toBeGreaterThan(0);
    expect(found).toHaveLength(1);
    expect(world.player.wardrobe).toEqual(found);
    expect(owns(world.player.wardrobe, found[0]!)).toBe(true);
    // Le même monde sans écouteur tire la même pièce, et son PRNG est au même point.
    expect(twin.player.wardrobe).toEqual(found);
    expect(world.snapshot().rng).toBe(twin.snapshot().rng);
  });
});

describe('sauvegarde de la garde-robe', () => {
  it('l’apparence et les pièces trouvées survivent à un rechargement', () => {
    const world = new World(9);
    const aviator: PieceId = 'glassesAviator';
    const look: Look = { pieces: { ...DEFAULT_LOOK.pieces, glasses: aviator, hair: 'hairBuzz' }, colors: { eyes: 'violet', hair: 'orange', top: 'cyan' } };

    world.player.wardrobe.push(aviator);
    world.push({ type: 'dressAdam', look });
    world.tick();

    const loaded = decodeSave(encodeSave(world, 0));

    if (!loaded.ok) throw new Error(loaded.reason);
    expect(loaded.world.player.look).toEqual(look);
    expect(loaded.world.player.wardrobe).toEqual([aviator]);
    // Une copie : le monde rechargé ne partage rien avec la sauvegarde.
    expect(serialize(loaded.world).player.look).not.toBe(loaded.world.player.look);
  });

  it('une sauvegarde d’avant la garde-robe se lit : Adam par défaut, rien de trouvé', () => {
    const world = new World(9);
    const file = JSON.parse(encodeSave(world, 0)) as { state: { player: Record<string, unknown> } };

    delete file.state.player['look'];
    delete file.state.player['wardrobe'];

    const loaded = decodeSave(JSON.stringify(file));

    if (!loaded.ok) throw new Error(loaded.reason);
    expect(loaded.world.player.look).toEqual(DEFAULT_LOOK);
    expect(loaded.world.player.wardrobe).toEqual([]);
  });

  it('une pièce inconnue, pas trouvée ou hors de sa place reprend la valeur par défaut de son emplacement', () => {
    const look = readLook(
      { pieces: { ...DEFAULT_LOOK.pieces, hat: 'hatTophat', shoes: 'shoesBunny', glasses: 'beardFull' }, colors: { eyes: 'toxic', hair: 'coral', top: 42 } },
      [],
    );

    expect(look.pieces.hat).toBe(DEFAULT_LOOK.pieces.hat);
    expect(look.pieces.shoes).toBe(DEFAULT_LOOK.pieces.shoes);
    expect(look.pieces.glasses).toBe(DEFAULT_LOOK.pieces.glasses);
    expect(look.colors).toEqual({ ...DEFAULT_LOOK.colors, hair: 'coral' });
    expect(readWardrobe(['glassesAviator', 'glassesAviator', 'hatNone', 'nope', 3])).toEqual(['glassesAviator']);
  });
});
