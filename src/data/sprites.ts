/**
 * Planches de sprites — contenu pur.
 *
 * Une planche est une grille : une animation par ligne, une image par
 * colonne, toutes les images de la même taille. C'est la convention que la
 * génération (MCP OpenRouter, cf. `CLAUDE.md`) demande au modèle et que
 * `render/spriteLibrary.ts` découpe. Un asset qui ne la respecte pas ne rentre pas.
 *
 * `file: null` signifie « pas encore généré » : le rendu se rabat alors sur
 * le placeholder pixel art de `data/pixelmaps.ts`. Générer une planche, la
 * vérifier, mettre son nom ici — et rien d'autre ne change.
 *
 * Les tailles sont en pixels **source** (16 px par tuile, cf. `artDirection`).
 */

export interface AnimationProto {
  /** Ligne de la grille. */
  row: number;
  /** Nombre d'images, lues de gauche à droite. */
  frames: number;
  /** Images par seconde. Ignoré si `frames` vaut 1. */
  fps: number;
  loop: boolean;
}

export interface SpriteProto {
  /** Fichier dans `public/sprites/`, ou `null` tant que la planche n'existe pas. */
  file: string | null;
  frameWidth: number;
  frameHeight: number;
  /** Ancre dans [0, 1] : (0.5, 1) = les pieds au point de position. */
  anchorX: number;
  anchorY: number;
  animations: Record<string, AnimationProto>;
  /** Sujet du prompt de génération ; le style commun s'y ajoute devant. */
  prompt: string;
}

const STILL = { row: 0, frames: 1, fps: 1, loop: false } as const;

export const SPRITES = {
  adam: {
    file: null,
    frameWidth: 16,
    frameHeight: 24,
    anchorX: 0.5,
    anchorY: 0.8,
    animations: {
      idleDown: { row: 0, frames: 1, fps: 1, loop: false },
      walkDown: { row: 1, frames: 4, fps: 8, loop: true },
      idleUp: { row: 2, frames: 1, fps: 1, loop: false },
      walkUp: { row: 3, frames: 4, fps: 8, loop: true },
      idleSide: { row: 4, frames: 1, fps: 1, loop: false },
      walkSide: { row: 5, frames: 4, fps: 8, loop: true },
      /** Adam frappe ce qu'il heurte : hache levée, hache abattue. */
      chopDown: { row: 6, frames: 2, fps: 6, loop: true },
      chopUp: { row: 7, frames: 2, fps: 6, loop: true },
      chopSide: { row: 8, frames: 2, fps: 6, loop: true },
    },
    prompt:
      'Adam, the hero: a sturdy adult man with messy brown hair, patched olive ' +
      'jacket, grey trousers and walking boots, carrying a scavenger backpack. ' +
      'Rows: idle facing down, walk cycle facing down (4 frames), idle facing ' +
      'up, walk up (4 frames), idle facing right, walk right (4 frames), ' +
      'chopping with a hand axe facing down (2 frames: axe raised, axe swung), ' +
      'chopping facing up (2 frames), chopping facing right (2 frames). ' +
      'Each frame 16x24 pixels.',
  },

  mutant: {
    file: null,
    frameWidth: 16,
    frameHeight: 24,
    anchorX: 0.5,
    anchorY: 0.8,
    animations: {
      idleDown: { row: 0, frames: 1, fps: 1, loop: false },
      walkDown: { row: 1, frames: 4, fps: 6, loop: true },
      idleUp: { row: 2, frames: 1, fps: 1, loop: false },
      walkUp: { row: 3, frames: 4, fps: 6, loop: true },
      idleSide: { row: 4, frames: 1, fps: 1, loop: false },
      walkSide: { row: 5, frames: 4, fps: 6, loop: true },
    },
    prompt:
      'A radioactive mutant: a deformed, hunched human with grey-green skin, ' +
      'bald cracked scalp, acid-green glowing eyes and glowing cracks on the ' +
      'skin, torn brown rags, barefoot. Rows: idle facing down, shambling walk ' +
      'facing down (4 frames), idle facing up, walk up (4 frames), idle facing ' +
      'right, walk right (4 frames). Each frame 16x24 pixels.',
  },

  kid: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0.5,
    anchorY: 0.875,
    animations: {
      idleDown: { row: 0, frames: 1, fps: 1, loop: false },
      walkDown: { row: 1, frames: 2, fps: 6, loop: true },
      idleUp: { row: 2, frames: 1, fps: 1, loop: false },
      walkUp: { row: 3, frames: 2, fps: 6, loop: true },
      idleSide: { row: 4, frames: 1, fps: 1, loop: false },
      walkSide: { row: 5, frames: 2, fps: 6, loop: true },
    },
    prompt:
      'A small survivor child, brown messy hair, olive sweater, grey dungarees, ' +
      'boots. Rows: idle facing down, walk down (2 frames), idle facing up, ' +
      'walk up (2 frames), idle facing right, walk right (2 frames). ' +
      'Each frame 16x16 pixels, the child is about 12 pixels tall.',
  },

  /** Une flèche pointée vers la droite ; le rendu la tourne dans sa direction. */
  arrow: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0.5,
    anchorY: 0.5,
    animations: { fly: STILL },
    prompt:
      'A crude wooden arrow seen from above, pointing right: a straight shaft, ' +
      'a scrap-metal head, two small pale feather fletchings. 16x16 pixels, ' +
      'the arrow spans nearly the full width, centered vertically.',
  },

  tree: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0,
    anchorY: 0,
    animations: { full: STILL, damaged: { row: 1, frames: 1, fps: 1, loop: false } },
    prompt:
      'A gnarled post-apocalyptic tree seen from above, dense dark-green canopy, ' +
      'thick trunk. Row 1: healthy tree. Row 2: the same tree half chopped, ' +
      'thinner canopy. Each frame 16x16 pixels, fits inside one tile.',
  },

  rockIron: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0,
    anchorY: 0,
    animations: { full: STILL, damaged: { row: 1, frames: 1, fps: 1, loop: false } },
    prompt:
      'A boulder of grey rock veined with rusty orange iron ore. Row 1: whole ' +
      'boulder. Row 2: the same boulder half broken, smaller. 16x16 pixels per frame.',
  },

  rockCoal: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0,
    anchorY: 0,
    animations: { full: STILL, damaged: { row: 1, frames: 1, fps: 1, loop: false } },
    prompt:
      'A boulder of grey rock studded with glossy black coal. Row 1: whole ' +
      'boulder. Row 2: the same boulder half broken, smaller. 16x16 pixels per frame.',
  },

  rockStone: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0,
    anchorY: 0,
    animations: { full: STILL, damaged: { row: 1, frames: 1, fps: 1, loop: false } },
    prompt:
      'A plain grey stone boulder with a few cracks. Row 1: whole boulder. ' +
      'Row 2: the same boulder half broken, smaller. 16x16 pixels per frame.',
  },

  /** Une tuile de chantier ; le rendu la répète sur toute l'emprise. */
  site: {
    file: null,
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 0,
    anchorY: 0,
    animations: { idle: STILL },
    prompt:
      'A construction site ground tile: packed dirt, a few wooden planks and ' +
      'pegs with string, seamless when tiled. 16x16 pixels.',
  },

  /*
   * Bâtiments : vus en 3/4, plus hauts que leur emprise. La largeur est celle
   * de l'emprise ; la hauteur en plus porte le toit et ce qui dépasse. Ancre
   * (0, 1) : le coin bas gauche de l'image est le coin bas gauche de l'emprise.
   */
  drill: {
    file: null,
    frameWidth: 32,
    frameHeight: 48,
    anchorX: 0,
    anchorY: 1,
    animations: {
      idle: STILL,
      work: { row: 1, frames: 2, fps: 6, loop: true },
    },
    prompt:
      'A scavenged mining derrick on a 2x2 tile base, seen in 3/4 view: a ' +
      'tapering steel lattice tower with a pulley on top rising well above the ' +
      'base, a stone slab foundation, an orange-painted motor housing with an ' +
      'exhaust pipe on the left, a rusty barrel and a heap of ore on the right, ' +
      'a drill rod plunging into a dark hole. Row 1: stopped. Row 2: 2 frames ' +
      'of the rod spinning, a green indicator light on, a puff of exhaust ' +
      'smoke. 32x48 pixels per frame, the bottom 32x32 is the footprint.',
  },

  nursery: {
    file: null,
    frameWidth: 32,
    frameHeight: 48,
    anchorX: 0,
    anchorY: 1,
    animations: { idle: STILL },
    prompt:
      'A survivor colony nursery on a 2x2 tile base, seen in 3/4 view: a ' +
      'small cosy cottage with cream plaster walls on a stone footing, a red ' +
      'tiled roof patched with sheet metal, a dormer window, a metal stove ' +
      'pipe with a wisp of smoke, a round warmly lit window with a flower box, ' +
      'an arched wooden door with a pink heart above it, a pink blanket drying ' +
      'on a line and a small wooden cradle by the wall. 32x48 pixels, the ' +
      'bottom 32x32 is the footprint.',
  },

  builderHouse: {
    file: null,
    frameWidth: 32,
    frameHeight: 48,
    anchorX: 0,
    anchorY: 1,
    animations: { idle: STILL },
    prompt:
      'A survivor colony bunkhouse for builders on a 2x2 tile base, seen in ' +
      '3/4 view: brick walls with one side rebuilt in planks, a corrugated ' +
      'sheet-metal roof half covered by a teal tarp weighed down with stones, ' +
      'a brick chimney, a metal door under a plank sign with a crossed hammer, ' +
      'a shovel and a pickaxe leaning on the wall, crates and a stack of ' +
      'planks at its foot. 32x48 pixels, the bottom 32x32 is the footprint.',
  },

  farm: {
    file: null,
    frameWidth: 32,
    frameHeight: 40,
    anchorX: 0,
    anchorY: 1,
    animations: {
      idle: STILL,
      grow: { row: 1, frames: 2, fps: 1, loop: true },
    },
    prompt:
      'A small post-apocalyptic farm plot on a 2x2 tile base, seen in 3/4 ' +
      'view: rows of tilled soil inside a wooden picket fence, a tiny plank ' +
      'tool shed with a sheet-metal roof in the top-left corner, a teal water ' +
      'barrel and a watering can in the top-right corner, a scarecrow in the ' +
      'middle wearing a gas mask, a hat and a teal tarp coat, a black crow. ' +
      'Row 1: young sprouts. Row 2: 2 frames of the crops growing into leafy ' +
      'plants with pink and yellow flowers. 32x40 pixels per frame, the ' +
      'bottom 32x32 is the footprint.',
  },

  watchtower: {
    file: null,
    frameWidth: 32,
    frameHeight: 64,
    anchorX: 0,
    anchorY: 1,
    animations: { idle: STILL },
    prompt:
      'A tall wooden watchtower on a 2x2 tile base, seen in 3/4 view: four ' +
      'rough log posts with cross braces, a ladder up the front, a plank ' +
      'lookout platform with a plank parapet and arrow slits, a pointed ' +
      'corrugated sheet-metal roof, a glowing lantern hanging under the roof, ' +
      'sandbags at the feet of the posts. 32x64 pixels, the bottom 32x32 is ' +
      'the footprint.',
  },

  townHall: {
    file: null,
    frameWidth: 48,
    frameHeight: 64,
    anchorX: 0,
    anchorY: 1,
    animations: { idle: STILL },
    prompt:
      'The town hall of a survivor colony on a 3x3 tile base, seen in 3/4 ' +
      'view: a large half-timbered house of cream plaster over a brick base, ' +
      'a big red tiled roof with a teal tarp over a hole and a sheet-metal ' +
      'patch, a brick chimney, a small wooden bell tower with a brass bell on ' +
      'the ridge, a jury-rigged radio antenna, a front porch with a gable, a ' +
      'stopped round clock and a wooden double door flanked by two teal ' +
      'banners with a yellow sun, one warmly lit window and one boarded-up ' +
      'window, stone steps, sandbags, a crate and a rusty barrel at its foot. ' +
      '48x64 pixels, the bottom 48x48 is the footprint.',
  },
} as const satisfies Record<string, SpriteProto>;

export type SpriteId = keyof typeof SPRITES;

export const SPRITE_IDS = Object.keys(SPRITES) as SpriteId[];

/** Noms d'animation valides pour une planche donnée. */
export type AnimationOf<S extends SpriteId> = keyof (typeof SPRITES)[S]['animations'] & string;

/** Nombre de lignes et de colonnes de la grille, pour vérifier une planche générée. */
export function sheetGrid(proto: SpriteProto): { rows: number; columns: number } {
  let rows = 0;
  let columns = 0;

  for (const animation of Object.values(proto.animations)) {
    rows = Math.max(rows, animation.row + 1);
    columns = Math.max(columns, animation.frames);
  }
  return { rows, columns };
}
