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
  /* La hache de main : manche en bois, fer clair. */
  w: 'beam',
  m: 'metal',
  M: 'metalLight',
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

/*
 * La coupe : deux images, hache levée puis abattue. Le bras armé sort du
 * gabarit du corps, sur la droite ; il empiète sur les lignes de la tête,
 * d'où des blocs tête + torse écrits d'un seul tenant.
 */
const CHOP_DOWN_RAISED = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho.ooo',
  '....ohhhhhhoomMo',
  '....ossssssoomMo',
  '....oseSSeso.ooo',
  '....osssssso.ow.',
  '.....oSSSSo..ow.',
  '......oooo...oso',
  '.....occcco..oso',
  '....occcccco.oco',
  '...oCccccccCoCo.',
  '...ococccccco...',
  '...ocoCccCco....',
  '...osocccco.....',
  '...osoCCCCo.....',
  '....oPPPPPPo....',
];

const CHOP_DOWN_SWUNG = [
  ...HEAD_DOWN,
  '.....occcco.....',
  '....occcccco....',
  '...oCccccccCo...',
  '...ococccccoco..',
  '...ocoCccCcosoo.',
  '...osoccccooswo.',
  '...osoCCCCo.owoo',
  '....oPPPPPPooMmo',
];

const CHOP_UP_RAISED = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho.ooo',
  '....ohhhhhhoomMo',
  '....ohhhhhhoomMo',
  '....ohhhhhho.ooo',
  '....ohhhhhho.ow.',
  '.....oSSSSo..ow.',
  '......oooo...oso',
  ...CHOP_DOWN_RAISED.slice(9),
];

const CHOP_UP_SWUNG = [
  ...HEAD_UP,
  '.....occcco.....',
  '....occcccco....',
  '...oCccccccCo...',
  '...ococccccoco..',
  '...ocoCccCcoso..',
  '...osoccccooso..',
  '...osoCCCCo.wo..',
  '....oPPPPPPowo..',
];

const CHOP_SIDE_RAISED = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho.ooo',
  '....ohhhhhhoomMo',
  '....ohhssso.omMo',
  '....ohhsseo..ooo',
  '....ohsssso..ow.',
  '.....oSSSo...ow.',
  '......ooo....oso',
  '.....occcco..os.',
  '.....occcCco.oo.',
  '.....occcCcooo..',
  '.....occoCco....',
  '.....occoCco....',
  '.....ossoCco....',
  '.....oCCoCCo....',
  '.....oPPPPPo....',
];

const CHOP_SIDE_SWUNG = [
  ...HEAD_SIDE,
  '.....occcco.....',
  '.....occcCco....',
  '.....occcCcoo...',
  '.....occoCcoso..',
  '.....occoCcosoo.',
  '.....ossoCco.owo',
  '.....oCCoCCo.oMo',
  '.....oPPPPPo.oMo',
];

/** Jambes à l'arrêt, avec le fer de la hache qui descend jusqu'aux genoux. */
const LEGS_STAND_AXE = ['....oppooppooMmo', '....oppooppo.ooo', ...LEGS_STAND.slice(2)];
const LEGS_SIDE_STAND_AXE = ['.....oppppo..ooo', ...LEGS_SIDE_STAND.slice(1)];

const ADAM_CHOP_DOWN_A = [...CHOP_DOWN_RAISED, ...LEGS_STAND];
const ADAM_CHOP_DOWN_B = [...CHOP_DOWN_SWUNG, ...LEGS_STAND_AXE];
const ADAM_CHOP_UP_A = [...CHOP_UP_RAISED, ...LEGS_STAND];
const ADAM_CHOP_UP_B = [...CHOP_UP_SWUNG, ...LEGS_STAND];
const ADAM_CHOP_SIDE_A = [...CHOP_SIDE_RAISED, ...LEGS_SIDE_STAND];
const ADAM_CHOP_SIDE_B = [...CHOP_SIDE_SWUNG, ...LEGS_SIDE_STAND_AXE];

/* ---------------------------------------------------------------- mutant */

/**
 * Le mutant partage le gabarit d'Adam (16 × 24, mêmes jambes) : même échelle,
 * même ancre, et les cycles de marche sont réutilisés tels quels. Ce qui
 * change est la palette — peau grise, haillons, pieds nus — et la tête, où
 * les yeux et les fissures luisent en vert acide.
 */
const MUTANT_PALETTE: PixelPalette = {
  o: 'outline',
  s: 'mutantSkin',
  S: 'mutantSkinShadow',
  g: 'radioactive',
  c: 'rags',
  C: 'ragsShadow',
  p: 'rags',
  P: 'ragsShadow',
  b: 'mutantSkinShadow',
};

const MUTANT_HEAD_DOWN = [
  '......oooo......',
  '.....ossSso.....',
  '....osssSsso....',
  '....oSsgssSo....',
  '....osssssso....',
  '....osgSSgso....',
  '....ossssgso....',
  '.....oSSSSo.....',
  '......oooo......',
];

const MUTANT_HEAD_UP = [
  '......oooo......',
  '.....ossSso.....',
  '....osssssso....',
  '....ossgssso....',
  '....oSsssgso....',
  '....osssssso....',
  '....ossSssso....',
  '.....oSSSSo.....',
  '......oooo......',
];

const MUTANT_HEAD_SIDE = [
  '......oooo......',
  '.....ossSso.....',
  '....osssssso....',
  '....ossgssso....',
  '....ossssso.....',
  '....osssgso.....',
  '....oSssso......',
  '.....oSSSo......',
  '......ooo.......',
];

const MUTANT_TORSO_FRONT = [
  '.....occCco.....',
  '....ocCcccCo....',
  '...oCcgcccCCo...',
  '...ococcCcoco...',
  '...osoCcccoso...',
  '...osocgccoso...',
  '...oSoCCCCoSo...',
  '....oPPPPPPo....',
];

const MUTANT_TORSO_SIDE = [
  '.....occcco.....',
  '.....occCCco....',
  '.....occcCco....',
  '.....ocgoCco....',
  '.....occoCco....',
  '.....ossoCco....',
  '.....oCCoCCo....',
  '.....oPPPPPo....',
];

const MUTANT_DOWN_STAND = frame(MUTANT_HEAD_DOWN, MUTANT_TORSO_FRONT, LEGS_STAND);
const MUTANT_DOWN_A = frame(MUTANT_HEAD_DOWN, MUTANT_TORSO_FRONT, LEGS_STEP);
const MUTANT_DOWN_B = frame(MUTANT_HEAD_DOWN, MUTANT_TORSO_FRONT, mirror(LEGS_STEP));
const MUTANT_UP_STAND = frame(MUTANT_HEAD_UP, MUTANT_TORSO_FRONT, LEGS_STAND);
const MUTANT_UP_A = frame(MUTANT_HEAD_UP, MUTANT_TORSO_FRONT, LEGS_STEP);
const MUTANT_UP_B = frame(MUTANT_HEAD_UP, MUTANT_TORSO_FRONT, mirror(LEGS_STEP));
const MUTANT_SIDE_STAND = frame(MUTANT_HEAD_SIDE, MUTANT_TORSO_SIDE, LEGS_SIDE_STAND);
const MUTANT_SIDE_A = frame(MUTANT_HEAD_SIDE, MUTANT_TORSO_SIDE, LEGS_SIDE_APART);
const MUTANT_SIDE_B = frame(MUTANT_HEAD_SIDE, MUTANT_TORSO_SIDE, LEGS_SIDE_CROSS);

/* ---------------------------------------------------------------- enfant */

const KID_PALETTE: PixelPalette = {
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

const KID_HEAD_DOWN = [
  '................',
  '......oooo......',
  '.....ohhhho.....',
  '.....ohhhho.....',
  '.....osssso.....',
  '.....oseeso.....',
  '......oSSo......',
];

const KID_HEAD_UP = [
  '................',
  '......oooo......',
  '.....ohhhho.....',
  '.....ohhhho.....',
  '.....ohhhho.....',
  '.....ohhhho.....',
  '......oSSo......',
];

const KID_HEAD_SIDE = [
  '................',
  '......oooo......',
  '.....ohhhho.....',
  '.....ohhhho.....',
  '.....ohhsso.....',
  '.....ohseo......',
  '......oSo.......',
];

const KID_BODY_FRONT = ['.....occcco.....', '....osccccso....', '.....oCCCCo.....'];
const KID_BODY_SIDE = ['.....occcco.....', '.....occCco.....', '.....oCCCCo.....'];

const KID_LEGS_STAND = [
  '.....oppppo.....',
  '.....opoopo.....',
  '.....obo.obo....',
  '.....ooo.ooo....',
  '................',
  '................',
];

const KID_LEGS_APART = [
  '.....oppppo.....',
  '....opo..opo....',
  '....obo..obo....',
  '....ooo..ooo....',
  '................',
  '................',
];

const KID_LEGS_SIDE_STAND = [
  '.....oppppo.....',
  '.....oppppo.....',
  '.....obbbbo.....',
  '.....oooooo.....',
  '................',
  '................',
];

const KID_LEGS_SIDE_APART = [
  '.....oppppo.....',
  '....oppoppo.....',
  '...obbo.obbo....',
  '...oooo.oooo....',
  '................',
  '................',
];

const KID_DOWN_STAND = frame(KID_HEAD_DOWN, KID_BODY_FRONT, KID_LEGS_STAND);
const KID_DOWN_STEP = frame(KID_HEAD_DOWN, KID_BODY_FRONT, KID_LEGS_APART);
const KID_UP_STAND = frame(KID_HEAD_UP, KID_BODY_FRONT, KID_LEGS_STAND);
const KID_UP_STEP = frame(KID_HEAD_UP, KID_BODY_FRONT, KID_LEGS_APART);
const KID_SIDE_STAND = frame(KID_HEAD_SIDE, KID_BODY_SIDE, KID_LEGS_SIDE_STAND);
const KID_SIDE_STEP = frame(KID_HEAD_SIDE, KID_BODY_SIDE, KID_LEGS_SIDE_APART);

/* ---------------------------------------------------------------- flèche */

const ARROW_PALETTE: PixelPalette = {
  o: 'outline',
  w: 'beam',
  M: 'metalLight',
  f: 'plaster',
};

const ARROW_EMPTY = '.'.repeat(16);

/** Pointée vers la droite ; `render/` la tourne dans le sens du vol. */
const ARROW = [
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  '.f...........M..',
  '.ffwwwwwwwwwwMMo',
  '.f...........M..',
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
  ARROW_EMPTY,
];

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

const NURSERY_PALETTE: PixelPalette = {
  o: 'outline',
  p: 'plaster',
  P: 'plasterShadow',
  r: 'roof',
  R: 'roofDark',
  w: 'beam',
  W: 'trunkShadow',
  m: 'metal',
  M: 'metalLight',
  k: 'blanket',
  K: 'blanketLight',
  a: 'accent',
  n: 'night',
  g: 'dirtDark',
};

/** Une ligne de mur de la nurserie : contour, 26 pixels d'intérieur, contour. */
function hut(interior: string): string {
  return `..o${interior}o..`;
}

const NU_EMPTY = '.'.repeat(32);
const NU_WINDOW_FRAME = hut(`pp${'oooooo'}${'p'.repeat(10)}${'oooooo'}pp`);
const NU_DOOR = (leaf: string): string => hut(`${'p'.repeat(10)}${leaf}${'p'.repeat(10)}`);

const NURSERY = [
  NU_EMPTY,
  '..........oo....................',
  '.........omMo...................',
  '.........omMo...................',
  '......oooooooooooooooooooo......',
  '....oorrrrrrrrrrrrrrrrrrrroo....',
  '..oorrrrrrrrrrrrrrrrrrrrrrrroo..',
  '.orrrrrrrrrrrrrrrrrrrrrrrrrrrro.',
  '.orrrrrrrmmmmrrrrrrrrrrrrrrrrro.',
  '.oRRRRRRRmmmmRRRRRRRRRRRRRRRRRo.',
  '.oRRRRRRRRRRRRRRRRRRRRRRRRRRRRo.',
  '.oooooooooooooooooooooooooooooo.',
  hut('w'.repeat(26)),
  hut('W'.repeat(26)),
  hut('p'.repeat(26)),
  NU_WINDOW_FRAME,
  hut(`pp${'oannao'}${'p'.repeat(10)}${'okKKko'}pp`),
  hut(`pp${'oannao'}${'p'.repeat(10)}${'okkKko'}pp`),
  hut(`pp${'oannao'}${'p'.repeat(10)}${'oKkkko'}pp`),
  NU_WINDOW_FRAME,
  hut('p'.repeat(26)),
  hut('P'.repeat(26)),
  NU_DOOR('oooooo'),
  NU_DOOR('owwwwo'),
  NU_DOOR('oWwwWo'),
  NU_DOOR('oWawWo'),
  NU_DOOR('oWwwWo'),
  hut(`${'P'.repeat(10)}${'oWWWWo'}${'P'.repeat(10)}`),
  hut('o'.repeat(26)),
  hut('g'.repeat(26)),
  NU_EMPTY,
  NU_EMPTY,
];

const WATCHTOWER_PALETTE: PixelPalette = {
  o: 'outline',
  w: 'beam',
  W: 'trunkShadow',
  m: 'metal',
  M: 'metalLight',
  d: 'metalDark',
  a: 'accent',
  s: 'plaster',
  g: 'dirtDark',
};

/** Une ligne de la tour : 4 pixels de marge, 24 d'intérieur, 4 de marge. */
function tower(interior: string): string {
  return `....${interior}....`;
}

const TW_POST = tower('.oWo......owwo......oWo.');
const TW_POST_SHADOW = tower('.oWo......oWWo......oWo.');

const WATCHTOWER = [
  NU_EMPTY,
  tower('.oooooooooooooooooooooo.'),
  tower('oMMMMMMMMMMMMMMMMMMMMMMo'),
  tower('ommmmmmmmmmmmmmmmmmmmmmo'),
  tower('oddddddddddddddddddddddo'),
  tower('oooooooooooooooooooooooo'),
  tower('oWo..................oWo'),
  tower('oWo...oaao....oso....oWo'),
  tower('oooooooooooooooooooooooo'),
  tower('owowowowowowowowowowowwo'),
  tower('owowowowowowowowowowowwo'),
  tower('oooooooooooooooooooooooo'),
  tower('owwwwwwwwwwwwwwwwwwwwwwo'),
  tower('oWWWWWWWWWWWWWWWWWWWWWWo'),
  tower('oooooooooooooooooooooooo'),
  TW_POST,
  TW_POST_SHADOW,
  TW_POST,
  TW_POST_SHADOW,
  TW_POST,
  TW_POST_SHADOW,
  TW_POST,
  TW_POST_SHADOW,
  TW_POST,
  TW_POST_SHADOW,
  TW_POST,
  TW_POST_SHADOW,
  tower('.ooo......oooo......ooo.'),
  tower('gggggggggggggggggggggggg'),
  NU_EMPTY,
  NU_EMPTY,
  NU_EMPTY,
];

/* ------------------------------------------------ maison des constructeurs */

const HOUSE_PALETTE: PixelPalette = {
  o: 'outline',
  b: 'brick',
  p: 'plaster',
  P: 'plasterShadow',
  m: 'metal',
  M: 'metalLight',
  d: 'metalDark',
  w: 'beam',
  W: 'trunkShadow',
  n: 'night',
  a: 'accent',
  g: 'dirtDark',
  u: 'rust',
};

/** Une ligne de mur : contour, 28 pixels d'intérieur, contour. */
function bunk(interior: string): string {
  return `.o${interior}o.`;
}

const HO_EMPTY = '.'.repeat(32);
const HO_WINDOW = (glass: string): string => bunk(`bbb${'o' + glass + 'o'}${'b'.repeat(12)}${'o' + glass + 'o'}bbb`);

const BUILDER_HOUSE = [
  HO_EMPTY,
  HO_EMPTY,
  '.....oo.........................',
  '.....oMo........................',
  '.oooooMooooooooooooooooooooooo..',
  '.oMMMMMMMMMMMMMMMMMMMMMMMMMMMMo.',
  '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
  '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmo.',
  '.oddddddddddddddddddddddddddddo.',
  '.oooooooooooooooooooooooooooooo.',
  bunk('w'.repeat(28)),
  bunk('W'.repeat(28)),
  bunk('b'.repeat(28)),
  bunk(`bbb${'ooooo'}${'b'.repeat(12)}${'ooooo'}bbb`),
  HO_WINDOW('nna'),
  HO_WINDOW('nan'),
  HO_WINDOW('ann'),
  bunk(`bbb${'ooooo'}${'b'.repeat(12)}${'ooooo'}bbb`),
  bunk('b'.repeat(28)),
  bunk('b'.repeat(28)),
  bunk(`${'b'.repeat(11)}oooooo${'b'.repeat(11)}`),
  bunk(`${'b'.repeat(11)}owwwwo${'b'.repeat(11)}`),
  bunk(`${'b'.repeat(11)}owwwwo${'b'.repeat(6)}uu${'b'.repeat(3)}`),
  bunk(`${'b'.repeat(11)}owwawo${'b'.repeat(6)}um${'b'.repeat(3)}`),
  bunk(`${'b'.repeat(11)}owwwwo${'b'.repeat(6)}um${'b'.repeat(3)}`),
  bunk(`${'b'.repeat(11)}owwwwo${'b'.repeat(6)}uw${'b'.repeat(3)}`),
  bunk(`${'b'.repeat(11)}oWWWWo${'b'.repeat(6)}uw${'b'.repeat(3)}`),
  bunk(`${'P'.repeat(11)}oWWWWo${'P'.repeat(6)}uw${'P'.repeat(3)}`),
  '.oooooooooooooooooooooooooooooo.',
  '..gggggggggggggggggggggggggggg..',
  HO_EMPTY,
  HO_EMPTY,
];

/* ----------------------------------------------------------------- ferme */

const FARM_PALETTE: PixelPalette = {
  o: 'outline',
  d: 'dirt',
  D: 'dirtDark',
  g: 'leaves',
  G: 'leavesLight',
  k: 'leavesDark',
  w: 'beam',
  W: 'trunkShadow',
  m: 'metal',
  M: 'metalLight',
  p: 'plaster',
};

/** Une ligne de sillon : terre claire et sombre en alternance. */
function furrow(pattern: string): string {
  return `.o${pattern.repeat(14)}o.`;
}

/** Deux sillons de terre : creux sombre, crête claire. */
const FA_RIDGE = furrow('dd');
const FA_TROUGH = furrow('DD');

/** Une ligne de jeunes pousses sur la crête, plus ou moins hautes. */
function sprouts(top: string, tall: boolean): string {
  const plant = tall ? `${top}G` : `${top}g`;

  return `.o${plant.padEnd(4, 'd').slice(0, 4).repeat(7)}o.`;
}

const FA_SHED_TOP = '.oooooooooooo...................';
const FA_SHED_ROOF_L = '.oMMMMMMMMMMo...................';
const FA_SHED_ROOF = '.ommmmmmmmmmo...................';
const FA_SHED_WALL = '.owwwwwwwwwwo...................';
const FA_SHED_DOOR = '.owwwoooowwwo...................';
const FA_SHED_DOOR_IN = '.owwwoWWowwwo...................';
const FA_SHED_BASE = '.oWWWoWWoWWWo...................';

const FARM_IDLE = [
  '.'.repeat(32),
  FA_SHED_TOP,
  FA_SHED_ROOF_L,
  FA_SHED_ROOF,
  FA_SHED_ROOF,
  '.ooooooooooooooooooooooooooooooo',
  FA_SHED_WALL.slice(0, 13) + FA_RIDGE.slice(13),
  FA_SHED_DOOR.slice(0, 13) + FA_TROUGH.slice(13),
  FA_SHED_DOOR_IN.slice(0, 13) + sprouts('dg', false).slice(13),
  FA_SHED_BASE.slice(0, 13) + FA_TROUGH.slice(13),
  '.oooooooooooo' + FA_RIDGE.slice(13),
  FA_TROUGH,
  sprouts('dg', false),
  FA_TROUGH,
  FA_RIDGE,
  FA_TROUGH,
  sprouts('dg', false),
  FA_TROUGH,
  FA_RIDGE,
  FA_TROUGH,
  sprouts('dg', false),
  FA_TROUGH,
  FA_RIDGE,
  FA_TROUGH,
  sprouts('dg', false),
  FA_TROUGH,
  FA_RIDGE,
  FA_TROUGH,
  FA_RIDGE,
  FA_RIDGE,
  '.oooooooooooooooooooooooooooooo.',
  '.'.repeat(32),
];

const FARM_GROW_A = FARM_IDLE.map((row) => row.replace(/dg/g, 'gg'));
const FARM_GROW_B = FARM_IDLE.map((row) => row.replace(/dg/g, 'gG').replace(/DD(?=gG)/g, 'Dk'));

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
      chopDown: [ADAM_CHOP_DOWN_A, ADAM_CHOP_DOWN_B],
      chopUp: [ADAM_CHOP_UP_A, ADAM_CHOP_UP_B],
      chopSide: [ADAM_CHOP_SIDE_A, ADAM_CHOP_SIDE_B],
    },
  },
  mutant: {
    palette: MUTANT_PALETTE,
    animations: {
      idleDown: [MUTANT_DOWN_STAND],
      walkDown: [MUTANT_DOWN_STAND, MUTANT_DOWN_A, MUTANT_DOWN_STAND, MUTANT_DOWN_B],
      idleUp: [MUTANT_UP_STAND],
      walkUp: [MUTANT_UP_STAND, MUTANT_UP_A, MUTANT_UP_STAND, MUTANT_UP_B],
      idleSide: [MUTANT_SIDE_STAND],
      walkSide: [MUTANT_SIDE_STAND, MUTANT_SIDE_A, MUTANT_SIDE_STAND, MUTANT_SIDE_B],
    },
  },
  kid: {
    palette: KID_PALETTE,
    animations: {
      idleDown: [KID_DOWN_STAND],
      walkDown: [KID_DOWN_STEP, KID_DOWN_STAND],
      idleUp: [KID_UP_STAND],
      walkUp: [KID_UP_STEP, KID_UP_STAND],
      idleSide: [KID_SIDE_STAND],
      walkSide: [KID_SIDE_STEP, KID_SIDE_STAND],
    },
  },
  arrow: {
    palette: ARROW_PALETTE,
    animations: { fly: [ARROW] },
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
  nursery: {
    palette: NURSERY_PALETTE,
    animations: { idle: [NURSERY] },
  },
  builderHouse: {
    palette: HOUSE_PALETTE,
    animations: { idle: [BUILDER_HOUSE] },
  },
  farm: {
    palette: FARM_PALETTE,
    animations: { idle: [FARM_IDLE], grow: [FARM_GROW_A, FARM_GROW_B] },
  },
  watchtower: {
    palette: WATCHTOWER_PALETTE,
    animations: { idle: [WATCHTOWER] },
  },
  townHall: {
    palette: TOWN_HALL_PALETTE,
    animations: { idle: [TOWN_HALL] },
  },
};
