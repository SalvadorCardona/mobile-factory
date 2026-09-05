/**
 * Placeholders pixel art — contenu pur.
 *
 * Tant qu'une planche n'a pas été générée (`SPRITES[id].file === null`), le
 * rendu dessine ces cartes de pixels. Elles suivent la direction artistique
 * — palette, contours d'un pixel, 16 px par tuile — pour que le jeu ait
 * déjà la bonne gueule, et pour que les vrais assets n'aient pas à changer
 * l'échelle ni les ancres.
 *
 * Une carte est une liste de lignes ; chaque caractère est un pixel, résolu
 * par une palette locale (`.` = transparent). Le test `pixelmaps.test.ts`
 * vérifie que chaque image a bien la taille annoncée dans `SPRITES`.
 */

import type { PaletteKey } from './artDirection.ts';
import type { SpriteId } from './sprites.ts';

/** Caractère → couleur de la palette ; `.` est toujours transparent. */
export type PixelPalette = Record<string, PaletteKey>;

export interface PixelMap {
  palette: PixelPalette;
  /** Une image par animation, dans l'ordre des frames. */
  animations: Record<string, readonly (readonly string[])[]>;
}

/** Retourne l'image en miroir horizontal. */
export function mirror(rows: readonly string[]): string[] {
  return rows.map((row) => [...row].reverse().join(''));
}

/* ------------------------------------------------------------------- Adam */

const ADAM_PALETTE: PixelPalette = {
  o: 'outline',
  s: 'skin',
  S: 'skinShadow',
  e: 'outline',
  h: 'hair',
  c: 'cloth',
  C: 'clothShadow',
  p: 'pants',
  P: 'pantsShadow',
  b: 'boots',
};

const HEAD_DOWN = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '....osssssso....',
  '....oseSSeso....',
  '....osssssso....',
  '.....oSSSSo.....',
  '......oooo......',
];

const HEAD_UP = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '.....oSSSSo.....',
  '......oooo......',
];

const HEAD_SIDE = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohhhhhho....',
  '....ohhssso.....',
  '....ohhsseo.....',
  '....ohsssso.....',
  '.....oSSSo......',
  '......ooo.......',
];

const TORSO_FRONT = [
  '.....occcco.....',
  '....occcccco....',
  '...oCccccccCo...',
  '...ococcccoco...',
  '...ocoCccCoco...',
  '...osoccccoso...',
  '...osoCCCCoso...',
  '....oPPPPPPo....',
];

const TORSO_SIDE = [
  '.....occcco.....',
  '.....occcCco....',
  '.....occcCco....',
  '.....occoCco....',
  '.....occoCco....',
  '.....ossoCco....',
  '.....oCCoCCo....',
  '.....oPPPPPo....',
];

const LEGS_STAND = [
  '....oppooppo....',
  '....oppooppo....',
  '....oppooppo....',
  '....oPPooPPo....',
  '....obboobbo....',
  '....obboobbo....',
  '....ooo..ooo....',
];

const LEGS_STEP = [
  '....oppooppo....',
  '....oppooppo....',
  '....oppooPPo....',
  '....oPPoobbo....',
  '....obbo.ooo....',
  '....obbo........',
  '....ooo.........',
];

const LEGS_SIDE_STAND = [
  '.....oppppo.....',
  '.....oppppo.....',
  '.....oppppo.....',
  '.....oPPPPo.....',
  '.....obbbbo.....',
  '.....obbbbo.....',
  '.....oooooo.....',
];

const LEGS_SIDE_APART = [
  '.....oppppo.....',
  '....opppoppo....',
  '...opppo.oppo...',
  '...oPPo...oPPo..',
  '..obbbo...obbbo.',
  '..obbo.....obbo.',
  '..oooo.....oooo.',
];

const LEGS_SIDE_CROSS = [
  '.....oppppo.....',
  '.....oppppo.....',
  '.....opppPo.....',
  '.....oPPPPo.....',
  '....obbbbbo.....',
  '....obbobbo.....',
  '....ooooooo.....',
];

function frame(head: readonly string[], torso: readonly string[], legs: readonly string[]): string[] {
  return [...head, ...torso, ...legs];
}

const ADAM_DOWN_STAND = frame(HEAD_DOWN, TORSO_FRONT, LEGS_STAND);
const ADAM_DOWN_A = frame(HEAD_DOWN, TORSO_FRONT, LEGS_STEP);
const ADAM_DOWN_B = frame(HEAD_DOWN, TORSO_FRONT, mirror(LEGS_STEP));
const ADAM_UP_STAND = frame(HEAD_UP, TORSO_FRONT, LEGS_STAND);
const ADAM_UP_A = frame(HEAD_UP, TORSO_FRONT, LEGS_STEP);
const ADAM_UP_B = frame(HEAD_UP, TORSO_FRONT, mirror(LEGS_STEP));
const ADAM_SIDE_STAND = frame(HEAD_SIDE, TORSO_SIDE, LEGS_SIDE_STAND);
const ADAM_SIDE_A = frame(HEAD_SIDE, TORSO_SIDE, LEGS_SIDE_APART);
const ADAM_SIDE_B = frame(HEAD_SIDE, TORSO_SIDE, LEGS_SIDE_CROSS);

/* ------------------------------------------------------------ végétation */

const TREE_PALETTE: PixelPalette = {
  o: 'outline',
  L: 'leaves',
  l: 'leavesLight',
  D: 'leavesDark',
  t: 'trunk',
  T: 'trunkShadow',
};

const TREE_FULL = [
  '......oooo......',
  '....ooLLLLoo....',
  '...oLLlLLLLLo...',
  '..oLlLLLLLlLLo..',
  '..oLLLLlLLLLLo..',
  '.oLLlLLLLLLLlLo.',
  '.oLLLLLLlLLLLLo.',
  '.oDLLLLLLLLLLDo.',
  '..oDDLLLLLLDDo..',
  '..ooDDDLLDDDoo..',
  '....ooDDDDoo....',
  '......otTo......',
  '......otTo......',
  '......otTo......',
  '.....ootTTo.....',
  '......oooo......',
];

const TREE_DAMAGED = [
  '................',
  '................',
  '................',
  '.......ooo......',
  '.....ooLLLoo....',
  '....oLlLLLLLo...',
  '....oLLLLlLLo...',
  '....oDLLLLLDo...',
  '.....oDDLDDo....',
  '......ooDDo.....',
  '.......otTo.....',
  '.......otTo.....',
  '.......otTo.....',
  '......ootTTo....',
  '......oooooo....',
  '................',
];

/* ---------------------------------------------------------------- rochers */

/** `m`/`M` = minerai ; la palette de chaque rocher décide de leur couleur. */
const ROCK_FULL = [
  '................',
  '.....oooo.......',
  '....oRrRRoo.....',
  '...oRrrRRRRo....',
  '..oRrrRRmRRRo...',
  '..oRRRRMmRRRRo..',
  '.oRRmRRRRRRmRo..',
  '.oRMmRRRRRRMmo..',
  '.oRRRRRDRRRRRo..',
  '.oDRRmMDDRRRDo..',
  '.oDDRMRDDRmDDo..',
  '..oDDDDDDDMDo...',
  '..ooDDDDDDDoo...',
  '....ooooooo.....',
  '................',
  '................',
];

const ROCK_DAMAGED = [
  '................',
  '................',
  '................',
  '................',
  '......oooo......',
  '.....oRrRRo.....',
  '....oRrRmRRo....',
  '....oRRMmRRo....',
  '...oRmRRRRRRo...',
  '...oRMDRRmRDo...',
  '...oDDDDRMDDo...',
  '....oDDDDDDo....',
  '.....oooooo.....',
  '................',
  '................',
  '................',
];

function rockPalette(mineral: PaletteKey, mineralLight: PaletteKey): PixelPalette {
  return {
    o: 'outline',
    R: 'rock',
    r: 'rockLight',
    D: 'rockDark',
    m: mineral,
    M: mineralLight,
  };
}

/* ----------------------------------------------------------- bâtiments */

const SITE_PALETTE: PixelPalette = {
  o: 'outline',
  d: 'dirt',
  D: 'dirtDark',
  w: 'beam',
  W: 'trunkShadow',
};

const SITE_TILE = [
  'ddddDddddddDdddd',
  'dDddddddDddddddd',
  'dddddddddddddDdd',
  'ddoooooooooooodd',
  'ddowwwwWwwwwwodd',
  'ddoWWWWWWWWWWodd',
  'ddoooooooooooodd',
  'dDdddddddddddddd',
  'ddddddddDddddddd',
  'ddoooooooooooodd',
  'ddowwwwwwwWwwodd',
  'ddoWWWWWWWWWWodd',
  'ddoooooooooooodd',
  'dddddDddddddddDd',
  'dDddddddddDddddd',
  'dddddddddddddddd',
];

const DRILL_PALETTE: PixelPalette = {
  o: 'outline',
  m: 'metal',
  M: 'metalLight',
  d: 'metalDark',
  r: 'rust',
  a: 'accent',
  A: 'rust',
  g: 'rockDark',
};

const DRILL_IDLE = [
  '................................',
  '..oooooooooooooooooooooooooooo..',
  '.oddddddddddddddddddddddddddddo.',
  '.odmmmmmmmmmmmmmmmmmmmmmmmmmmdo.',
  '.odmMMMMMMMMMMMMMMMMMMMMMMMMmdo.',
  '.odmMmmmmmmmmmmmmmmmmmmmmmmMmdo.',
  '.odmMmoooooooooooooooooooomMmdo.',
  '.odmMmoaaaaaaaaaaaaaaaaaaomMmdo.',
  '.odmMmoaAAAAAAAAAAAAAAAAaomMmdo.',
  '.odmMmoaAaaaaaaaaaaaaaaAaomMmdo.',
  '.odmMmoaAaaaaaoooooaaaaAaomMmdo.',
  '.odmMmoaAaaaaoMMMMMoaaaAaomMmdo.',
  '.odmMmoaAaaaaoMmmmMoaaaAaomMmdo.',
  '.odmMmoaAaaaaoMmdmMoaaaAaomMmdo.',
  '.odmMmoaAaaaaoMmmmMoaaaAaomMmdo.',
  '.odmMmoaAaaaaoMMMMMoaaaAaomMmdo.',
  '.odmMmoaAaaaaaoooooaaaaAaomMmdo.',
  '.odmMmoaAaaaaaaoMoaaaaaAaomMmdo.',
  '.odmMmoaAaaaaaaoMoaaaaaAaomMmdo.',
  '.odmMmoaAAAAAAAoMoAAAAAAaomMmdo.',
  '.odmMmoaaaaaaaaoMoaaaaaaaomMmdo.',
  '.odmMmooooooooooMooooooooomMmdo.',
  '.odmMmmmmmmmmmmoMommmmmmmmmMmdo.',
  '.odmMMMMMMMMMMMoMoMMMMMMMMMMmdo.',
  '.odmmmmmmmmmmmmodommmmmmmmmmmdo.',
  '.oddddddddddddddddddddddddddddo.',
  '.orrrrrrrrrrrrrrrrrrrrrrrrrrrro.',
  '.oggggggggggggggggggggggggggggo.',
  '..oooooooooooooooooooooooooooo..',
  '................................',
  '................................',
  '................................',
];

/** Cadre de travail : la mèche descend d'un cran. */
const DRILL_WORK_A = DRILL_IDLE.map((row, index) =>
  index >= 17 && index <= 23 ? row.replace('oMo', 'oao') : row,
);
const DRILL_WORK_B = DRILL_IDLE.map((row, index) =>
  index >= 17 && index <= 23 ? row.replace('oMo', 'odo') : row,
);

const TOWN_HALL_PALETTE: PixelPalette = {
  o: 'outline',
  p: 'plaster',
  P: 'plasterShadow',
  b: 'brick',
  r: 'roof',
  R: 'roofDark',
  w: 'beam',
  W: 'trunkShadow',
  m: 'metal',
  M: 'metalLight',
  a: 'accent',
  g: 'dirtDark',
  n: 'night',
};

/** Une ligne de mur de la mairie : contour, 42 pixels d'intérieur, contour. */
function wall(interior: string): string {
  return `..o${interior}o..`;
}

const TH_WINDOW_TOP = wall(`pppp${'oooooo'}${'p'.repeat(22)}${'oooooo'}pppp`);
const TH_WINDOW = wall(`pppp${'oannao'}${'p'.repeat(22)}${'oannao'}pppp`);
const TH_WINDOW_BAR = wall(`pppp${'oaaaao'}${'p'.repeat(22)}${'oaaaao'}pppp`);
const TH_PLASTER = wall('p'.repeat(42));
const TH_SHADOW = wall('P'.repeat(42));
const TH_DOOR_TOP = wall(`${'p'.repeat(17)}${'oooooooo'}${'p'.repeat(17)}`);
const TH_DOOR_LINTEL = wall(`${'o'.repeat(17)}${'owwwwwwo'}${'o'.repeat(17)}`);
const TH_BRICK_A = wall(`${'bbPbbPbbPbbPbbPbb'}${'oWwwwwwo'}${'bbPbbPbbPbbPbbPbb'}`);
const TH_BRICK_B = wall(`${'PbbPbbPbbPbbPbbPb'}${'oWwwwwwo'}${'PbbPbbPbbPbbPbbPb'}`);
const TH_BRICK_HANDLE = wall(`${'bbPbbPbbPbbPbbPbb'}${'oWwwawwo'}${'bbPbbPbbPbbPbbPbb'}`);
const TH_OUTLINE = wall('o'.repeat(42));
const TH_GROUND = wall('g'.repeat(42));
const TH_EMPTY = '.'.repeat(48);

const TOWN_HALL = [
  TH_EMPTY,
  '.....................oooooo.....................',
  '....................oMmmmmMo....................',
  '....................omoaaomo....................',
  '.....................ooooo......................',
  '..................oooooooooooo..................',
  '...............ooorrrrrrrrrrrrooo...............',
  '............ooorrrrrrrrrrrrrrrrrrooo............',
  '.........ooorrrrrrrrrrrrrrrrrrrrrrrrooo.........',
  '......ooorrrrrrrrrrrrRRrrrrrrrrrrrrrrrrooo......',
  '...ooorrrrrrrrrmmmmmmRRrrrrrrrrrrrrrrrrrrrooo...',
  '..orrrrrrrrrrrrmMMMMmRRrrrrrrrrrrrmmmmmmrrrrro..',
  '..orrrrrrrrrrrrmMmmMmRRrrrrrrrrrrrmMMMMmrrrrro..',
  '..oRRRRRRRRRRRRmmmmmmRRRRRRRRRRRRRmmmmmmRRRRRo..',
  '..oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRo..',
  '..oooooooooooooooooooooooooooooooooooooooooooo..',
  '..owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo..',
  '..oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo..',
  TH_PLASTER,
  TH_WINDOW_TOP,
  TH_WINDOW,
  TH_WINDOW,
  TH_WINDOW_BAR,
  TH_WINDOW,
  TH_WINDOW,
  TH_WINDOW_TOP,
  TH_PLASTER,
  TH_SHADOW,
  TH_DOOR_TOP,
  TH_DOOR_LINTEL,
  TH_BRICK_A,
  TH_BRICK_B,
  TH_BRICK_A,
  TH_BRICK_B,
  TH_BRICK_HANDLE,
  TH_BRICK_B,
  TH_BRICK_A,
  TH_BRICK_B,
  TH_BRICK_A,
  TH_BRICK_B,
  TH_OUTLINE,
  TH_GROUND,
  TH_GROUND,
  TH_OUTLINE,
  TH_EMPTY,
  TH_EMPTY,
  TH_EMPTY,
  TH_EMPTY,
];

/* ---------------------------------------------------------------- export */

export const PIXEL_MAPS: Record<SpriteId, PixelMap> = {
  adam: {
    palette: ADAM_PALETTE,
    animations: {
      idleDown: [ADAM_DOWN_STAND],
      walkDown: [ADAM_DOWN_STAND, ADAM_DOWN_A, ADAM_DOWN_STAND, ADAM_DOWN_B],
      idleUp: [ADAM_UP_STAND],
      walkUp: [ADAM_UP_STAND, ADAM_UP_A, ADAM_UP_STAND, ADAM_UP_B],
      idleSide: [ADAM_SIDE_STAND],
      walkSide: [ADAM_SIDE_STAND, ADAM_SIDE_A, ADAM_SIDE_STAND, ADAM_SIDE_B],
    },
  },
  tree: {
    palette: TREE_PALETTE,
    animations: { full: [TREE_FULL], damaged: [TREE_DAMAGED] },
  },
  rockIron: {
    palette: rockPalette('iron', 'ironLight'),
    animations: { full: [ROCK_FULL], damaged: [ROCK_DAMAGED] },
  },
  rockCoal: {
    palette: rockPalette('coal', 'coalLight'),
    animations: { full: [ROCK_FULL], damaged: [ROCK_DAMAGED] },
  },
  rockStone: {
    palette: rockPalette('rockDark', 'rockLight'),
    animations: { full: [ROCK_FULL], damaged: [ROCK_DAMAGED] },
  },
  site: {
    palette: SITE_PALETTE,
    animations: { idle: [SITE_TILE] },
  },
  drill: {
    palette: DRILL_PALETTE,
    animations: { idle: [DRILL_IDLE], work: [DRILL_WORK_A, DRILL_WORK_B] },
  },
  townHall: {
    palette: TOWN_HALL_PALETTE,
    animations: { idle: [TOWN_HALL] },
  },
};
