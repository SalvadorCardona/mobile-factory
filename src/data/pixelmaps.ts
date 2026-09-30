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

import type { PaletteKey } from './legacyPixelArt.ts';
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

/* --------------------------------------------------------------- le monde */

/*
 * Une palette pour tout ce qui est posé sur la carte : bâtiments, arbres,
 * décor. Les mêmes lettres désignent les mêmes briques, les mêmes feuilles
 * et le même bois d'un sprite à l'autre.
 */
const WORLD_PALETTE: PixelPalette = {
  o: 'outline',
  n: 'night',
  p: 'plaster',
  P: 'plasterShadow',
  q: 'plasterLight',
  b: 'brick',
  B: 'brickDark',
  c: 'brickLight',
  r: 'roof',
  R: 'roofDark',
  s: 'roofLight',
  w: 'beam',
  W: 'trunkShadow',
  v: 'beamLight',
  t: 'trunk',
  m: 'metal',
  M: 'metalLight',
  d: 'metalDark',
  u: 'rust',
  a: 'accent',
  i: 'iron',
  I: 'ironLight',
  e: 'dirt',
  g: 'dirtDark',
  y: 'glow',
  x: 'glass',
  f: 'tarp',
  F: 'tarpLight',
  l: 'leaves',
  L: 'leavesDark',
  h: 'leavesLight',
  z: 'moss',
  k: 'blanket',
  K: 'blanketLight',
  j: 'rock',
  J: 'rockDark',
  Z: 'rockLight',
  G: 'radioactive',
  C: 'coal',
  O: 'boots',
  Q: 'rags',
  N: 'bone',
};

/* ------------------------------------------------------------ végétation */

/* Trois essences, tirées par tuile depuis la seed : feuillu, sapin, arbre mort. */

const TREE_FULL = [
  '.....oooooo.....',
  '...oohhhllLoo...',
  '..ohhhllllllLo..',
  '.ohhlllhhlllLLo.',
  '.ohllllhllllLLo.',
  'ohhllllllllLLLLo',
  'ollhhlllllLLlLLo',
  'olllllllLLlLLLLo',
  'oLlllLLLLLLLLLLo',
  '.oLLLLLLLLLLLLo.',
  '..ooLLLLLLLLoo..',
  '....oooWtoooo...',
  '.......Wto......',
  '.......Wto......',
  '.....oWWttoo....',
  '......oooooo....',
];

const TREE_DAMAGED = [
  '................',
  '................',
  '................',
  '.......oooo.....',
  '.....oohllLo....',
  '....ohhllllLo...',
  '....ohlllLLLo...',
  '....olllLLlLo...',
  '....oLLLLLLLo...',
  '.....ooLLLLo....',
  '.......oWto.....',
  '.......oWto.....',
  '.......oWto.....',
  '.....ooWWtto....',
  '......oooooo....',
  '................',
];

const PINE_FULL = [
  '.......oo.......',
  '......ohLo......',
  '......ohLo......',
  '.....ohllLo.....',
  '....ohhlLLLo....',
  '.....ohlLLo.....',
  '....ohllLLLo....',
  '...ohhllLLLLo...',
  '....ohlllLLo....',
  '...ohllllLLLo...',
  '..ohhllllLLLLo..',
  '..oLLLLLLLLLLo..',
  '...ooooWtoooo...',
  '.......Wto......',
  '......oWWto.....',
  '.......ooo......',
];

const PINE_DAMAGED = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oo.......',
  '......ohLo......',
  '.....ohllLo.....',
  '....ohhlLLLo....',
  '.....ohlLLo.....',
  '....ohllLLLo....',
  '....oLLLLLLo....',
  '.....oooWtoo....',
  '.......Wto......',
  '......oWWto.....',
  '.......ooo......',
];

const DEAD_FULL = [
  '................',
  '..o.......o.....',
  '.ovo....o.ovo...',
  '..ovo..ovo.owo..',
  '...owo.owo.owo..',
  '....owoowoowo...',
  '.oo..owwwwwo..o.',
  'ovvo.oWwwwo..ovo',
  '.ooWWowwwWoooWo.',
  '....oowwwWWWWo..',
  '......owwWoo....',
  '......owwWo.....',
  '......owwWo.....',
  '.....owwwWWo....',
  '....ozwWWWWzo...',
  '.....oooooo.....',
];

const DEAD_DAMAGED = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '........o.......',
  '.......ovo......',
  '....o..owo......',
  '...ovoowwo......',
  '....oowwWo......',
  '......owwWo.....',
  '......owwWo.....',
  '.....owwwWWo....',
  '....ozwWWWWzo...',
  '.....oooooo.....',
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

/*
 * Les bâtiments sont vus en 3/4, comme les personnages : la planche est
 * aussi large que l'emprise mais plus haute qu'elle — la façade occupe le
 * bas, le toit et ce qui dépasse (clocher, cheminée, derrick) montent
 * au-dessus des tuiles de derrière. Le bas de l'image est le bas de
 * l'emprise (ancre (0, 1)).
 *
 * Tous partagent une palette : les mêmes briques, tuiles et planches d'un
 * bâtiment à l'autre, c'est ce qui fait qu'une colonie a l'air d'une colonie.
 */

const TOWN_HALL = [
  '..........o.........oosrrRoo....................',
  '.........oGo......oosrrrrrrRoo..................',
  '.........odo.....osrrrrrrrrrrRo.................',
  '........oodoo...orRRRRRRRRRRRRRo................',
  '.......ommmmmo...oovwWvwWvwWvoo.................',
  '........oodoo.....ovwnnnnnnWvo..................',
  '.........odo......ovwnaaaanWvo..................',
  '........ommmo.....ovwnIaaanWvo.......ooooooo....',
  '.........odo......ovwnaaaanWvo.......oJJJJJo....',
  '.........odo......ovwaaaaaaWvo.......obbbbbo....',
  '.........odo......ovwnnannnWvo.......oBBBBBo....',
  '.........odo......ovwWvwWvwWvo.......obbBcbo....',
  '.........odo......ovwWvwWvwWvo.......obbBbbo....',
  '......oooodoooooooovwWvwWvwWvoooooooooBBBBBo....',
  '.....ossssdsssssssovwWvwWvwWvosssssssocbbbbo....',
  '....osrrrsdrrsrrrsoooooooooooorrrsrrrobcbbbo....',
  '...oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRoBBBBBoo...',
  '..orrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrroooooooro..',
  '.orsrrrsrrrsrrrsrrrsrrrsrrrsrrrsrrrsrrrsrrrsrro.',
  'oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRo',
  'srrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrrrRsrrRrrrRrrR',
  'ssrrrsrrrsrrrsrrrsrrrsrrrsrrrsrrrooooooooorrrsrR',
  'sRRRRRsRRRRRRRRRRRRRRRRRRRRRRRRRRomdMmdMmoRRRRRR',
  'srRrrrRrrrRrrrRrrrRrrrRrrrRrrrRrromdMmdMmoRrrrRR',
  'srrsrrrsrrrsrrrsrrrsrrsssRrsrrrsromuumdMmorsrrrR',
  'sRRRrooooooooRRRRRRRRsrrrrRRRRRRRomuMmdMmoRRRRRR',
  'srrrooFFFFFForrrRrrrsRRRRRRRRrrrRomdMmdMmorrRrrR',
  'ssrrofffffffosrrrsrsrrrrrrrrRsrrrooooooooorrrsrR',
  'sRRRofffffffoRRRRRsrrrrrrrrrrRRRRRRRRRRRRRRRRRRR',
  'srRroffffffforRrrsRRRRvoovRRRRRrrrRrrrRrrrRrrrRR',
  'srrsoffffffoorrssrrrrwwyywwrrrrRrrrsrrrsrrrsrrrR',
  'sRRRooooooooRRRsrrrrvvvoovvvrrrrRRRRRRRRRRRRRRRR',
  'srrrRrrrRrrrRrsRRRRwwwwwwwwwwRRRRRrrRrrrRrrrRrrR',
  'ssrrrsrrrsrrrssrrrvvvvvvvvvvvvrrrRrrrsrrrsrrrsrR',
  'sRRRRRRRRRRRRRsrrwwwwwwwwwwwwwwrrRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRsRRvvvvvvvvvvvvvvRRRRRRRRRRRRRRRRR',
  'oowwwwwwwwwwwwwwPppPpppppppppppPWwwwwwwwwwwwwWoo',
  '.oWWWWWWWWWWWWWwpppppppppppppppPWWWWWWWWWWWWWWo.',
  '.owpppppppppwppwppppppoooopppppPWppwppppppppPWo.',
  '.owpppppppppPPpwpppppoqqqqoppppPWppwpppppPppPWo.',
  '.owpppppppppPPpwPppppoqoqqoppppPWppwppppppppPWo.',
  '.owppoooooopwPPwpppppoqooqoppppPWppwpoooooopPWo.',
  '.owppoaawaopwpPwpppppoqqqqoppppPWppwpvnnnnvpPWo.',
  '.owppoaywyopwpPPppppppooooPppppPWppwpwvnnvwpPWo.',
  '.owppoaywyopwpPwwwwwppppopppwwwwwppwpowvvwopPWo.',
  '.owppowwwwopwppwFffpppoooopppFffWppwponvwnopPWo.',
  '.owppoaywyopwppwFffppovvvvoppFffWppwpovwwvopPWo.',
  '.owppoaywyopwpPwFffpoooooooopFffWppwpvwnnwvpPWo.',
  '.owppoooooopwppwFyfpoWWWoWWopFyfWppwpwoooowpPWo.',
  '.owpvvvvvvvvwppwFyfpovwWowWoPFyfWppwvvvvvvvvPWo.',
  '.owppPPPPPPpwppwFffpovwWowWopFffWppwpPPPPPPpPWo.',
  '.owwwwwwwwwwwwwwFffpovwWowWoPFffWwwwwwwwPPwwPWo.',
  '.ocbbbbBcbbbbBcwFffbovwWowWocFffWbbbbBcbPbbBPWo.',
  '.obbbbbBbbbbbBbwFffbovwWowWobFffWbbbbBPPbbbBPWo.',
  '.oBBBBBBBBBBBBBwFffBovwaoaWoBFffWBBBBBPBBBBBPWo.',
  '.obbBcbbbbBcbbbwbfBcovwWowWobbfcWbBcbboooooboooo',
  '.obbBPPPPbBbbbbwbbBbovwWowWobbBbWbBbbbovvWoddddd',
  '.oBBBeeeeBBBBBBwBBBBovwWowWoBBBBWBBBBBowWwouiuGu',
  '.ocPPggggPPbbBcwcbbbovwWowWoccbbWbbbbBoWwwoddddd',
  '.ozeeeeeeeebzBbwbbbbovwWowWobbbbWzbbbzooooouiuuu',
  'oJJggggggggJJJJJoZZZZZZZZZZZZZZoJJJJJJJJJJoddddd',
  '.ooooooooooooooojjjjjjjjjjjjjjjjooooooooooouiuuu',
  '...............oJJJJJJJJJJJJJJJJo..........ooooo',
  '................oooooooooooooooo................',
];

const NURSERY = [
  '......................oZoZo.....',
  '.....................oooZoZo....',
  '.....................odddddo....',
  '.....................ooMmdoo....',
  '......................oMmdo.....',
  '......................oMmdo.....',
  '......................oMmdo.....',
  '......................oMmdo.....',
  '......oooooooooooooooooMmdo.....',
  '.....ossssssrrrRssssssoMmdo.....',
  '....orsrrrsrrrrrRrsrrroMmdoo....',
  '...oRRRRRsrrrrrrrRRRRRoMmdoRo...',
  '..oRrrrRsrrrrrrrrrRRrroooooRro..',
  '.orrsrrrsoooooooorrrsrrrsrrrsro.',
  'osRRRRRsRopoooopoRRRRRRRRRRRRRRo',
  'osrrrRrrropoaaopoRrrrRrrrRrrrRRo',
  'ossrrrsrropoayoporsooooooosrrrRo',
  'osRRRRRRRopoooopoRRomdMmdoRRRRRo',
  'osrRrrrRrovPPPPvorromdMmdorRrrRo',
  'osrrsrrrsooPPPPoorromdMmdorrsrRo',
  'osRRRRRRRRRRRRRRRRRoooooooRRRRRo',
  'osrrrRrrrRrrrRrrrRrrrRrrrRrrrRRo',
  'ossrrrsrrrsrrrsrrrsrrrsrrrsrrrRo',
  'osRRRRRRRRRRRRRRRRRRRRRRRRRRRRRo',
  'osrRrrrRrrrRrrrRrrrRrrrRrrrRrrRo',
  'oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRo',
  '.ooqqqqqqqqqqqqqqqqqqPqqqqqqPoo.',
  '..oqpppppPpppppppppppppppppPPo..',
  '..oqpppppppppppKpkpPpppppppPPo..',
  '..oqpppooooppppkkkppppoooooPPo..',
  '..oqppoaawyoppppkPppppoKwkoPPo..',
  '..oqppoaywyopppoooppppoKwkoPPo..',
  '..oqppowwwwopoowwwooppoKwkoPPo..',
  '..oqppoyywyopoWWWWWoppoKwkoPPo..',
  '..oqpppooooppovwWvwoppoooooPPo..',
  '..oqppKhylKlpovwWvwopvvvvvvvPo..',
  '..oqpvvvvvvvvovwWvwoppPPPPPPPo..',
  '...ooooowwwwwovwWvwopppppppPPo..',
  '..oqKkkkoqFooovwWvwopppppppPPo..',
  '..oqKkkkpFFppovwWawopppppppPPo..',
  '..oqKKkkpFFppovwWvwoppooooooo...',
  '..ojKkkkJjjjJovwWvwoJjojKKKKJo..',
  '..ohhkKkZZhZZovwWvwoZZovvvvvvo..',
  '..ozzJJJJJzJJovwWvwoJzowwwwwwo..',
  '.oJJJJJJJJJJJJJJJJJJJJowwwwwwo..',
  '..ooooooooooooooooooooodoooodo..',
  '.......................o....o...',
  '................................',
];

const BUILDER_HOUSE = [
  '........................oZo.....',
  '.......................oZoo.....',
  '......................ooooZoo...',
  '......................oJJJJJo...',
  '......................obbbbbo...',
  '......................oBBBBBo...',
  '......................obbBcbo...',
  'ooooooooooooooooooooooobbBbboooo',
  'MMMMMMMMMMMMMMMMMMMMMMoBBBBBoMMM',
  'MmuumdMmdMmdMmdMmdMmdMocbbbbodMm',
  'MmMooooooooooooomuumdMooooooodMm',
  'MmoFffFffFffFffomuMmdMmdMmdMmdMm',
  'MmoFffFffFffFffomdMmdMmdMmdMmdMm',
  'MmoFffFZjFffFffomdMmdMmdMmdMmdMm',
  'MmoFffFjjFffFffomdMmdMuuuudMmdMm',
  'MmoFffFffFffFffouuMmdMudumdMmdMm',
  'MmoFffFffFffFffoudMmdMmdMmdMmdMm',
  'MmoFffFffFffFffomdMmdMmdMmdMmdMm',
  'MmoFffFffFffFffoudMmdMmdMmdMmdMm',
  'MmooooooooooooodmdMmdMmdMmdMmdMm',
  'MwdMmdMmdMmdMmdMwdMmdMmdMmdMmdMm',
  'MmdMmdMmdMmdMmdMmdMmdMmdMmdMmdMm',
  'MmdMmdMmdMmdMmdMmdMmdMmdMmdMmdMm',
  'dddddddddddddddddddddddddddddddd',
  'oooooooooooooooooooooooooooooooo',
  '.obbbbbovvvvvvvvvvoBbowwwwwwwWo.',
  '.oBBBBBovvMdvvWMvvoBBoWWWWWWWWo.',
  '.obbBcbovvvvWWvvvvobbovvWvvvvWo.',
  '.obbBbbovvWWvvddvvobbowwwwWwwWo.',
  '.oBooooowwwwwwwwwwoBBoWoooooWWo.',
  '.ocoawaooooooooooooBcovoFwxovWo.',
  '.oboawyoboooooooobbBbowoFwxowWo.',
  '.oMmmwwoBoMMMMMMoBBwBoWowwwoWWo.',
  '.oboammmmoMmdMmdocbwbovoxwxovWo.',
  '.oboowooboMmdMmdobbwbowooooowWo.',
  '.ovvvwvvvoMmdMmdoBBwBovvvvvvvWo.',
  '.ocPPwPPcoMmdMmdobbwcovPPPPPvWo.',
  '.obbbwbBboMmdMmdobbwbowwwwWwwWo.',
  '.oBBBwBBBoMmdMadoBBwBoWWWWWWWWo.',
  '.obbBwbbboMuuMmdocbwbovvWvvvvWo.',
  '.obbBwbbboMudMmdobbwboooooowwWo.',
  '.oBBBwBBBoMmdMmdoBMmmoovvWoWWWo.',
  'ooooooooooMmdMmdohmmmoowWoooooo.',
  'ovvvvvvvozddzddzzzmmmooWwovvWoo.',
  'owwwwwwwoJJJJJJJJJJJJJoooowWwoJo',
  'oWWWWWWWooooooooooooooooooWwwoo.',
  'ooooooooo................ooooo..',
  '................................',
];

const WATCHTOWER = [
  '.............ooowoo.............',
  '............omdMmdMo............',
  '...........oMmdMmdMmo...........',
  '.........oodMmdMmdMmdoo.........',
  '........oMmdMmdMmdumdMmo........',
  '...o..oodMmdMmdMmdMudMmdoo..o...',
  '..oWooMmdMmdMmdMmdMmdMmdMmooWo..',
  '..oWodMmdMmdMmdMmdMmdMmdMmdoWo..',
  '..oWmdMmdMudMmdMmdMmdMmdMmdMWo..',
  '.odMmdMmdMmuMmdMmdMmdMudMmdMmdo.',
  'omdMmdMmdMmdMmdMmdMmdMmdMmdMmdMo',
  'oddddddddddddddddddddddddddddddo',
  '.ovvvOOOvvvvvvvovvvvvvvvqvvwvvo.',
  '.ovwWvwWvwWvwooooowWvwWvqWvwWvo.',
  '.ovwWvwWvwWvwoyyyowWvwWvwWvwWvo.',
  '.ovwWvwWvnnnwoyqyowWnnnvwWvwWvo.',
  '.ovwWvwWvnnnwoyyyowWnnnvwWvwWvo.',
  '.ovwWvwWvwWvwooooowWvwWvwWvwWvo.',
  '.ovwWvwWvwWvwWvwWvwWvwWvwWvwWvo.',
  '.ovwWvwWvwWvwWvwWvwWvwWvwWvwWvo.',
  'ovvvvvvvWvvvvvvvvvvvvvvvvvvvvvvo',
  'owwwwwwwwwwwwwwwwwwwwwWwwwwwwwwo',
  'oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo',
  'ovvvvvvvvvvvvvWvvvvvvvvvvvvvvvvo',
  'oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo',
  '.ooovwwWWoooovoooowooooWWwwWooo.',
  '...ovwwtWo..ovvvvvwo..oWtwwWo...',
  '...ovwwWtoo.ovoooowo.ootWwwWo...',
  '...ovwwWWttoovoooowoottWWwwWo...',
  '...ovwwWWWWtovvvvvwotWWWWwwWo...',
  '...ovwwWWooWtvoooowtWooWWwwWo...',
  '...ovwwWWo.oWvoooowWo.oWWwwWo...',
  '...ovwwWWo..ovvvvvwo..oWWwwWo...',
  '...ovwwWWo..ovWttWwo..oWWwwWo...',
  '...ovwwWWo..ovtWWtwo..oWWwwWo...',
  '...ovwwWWo..ovvvvvwo..oWWwwWo...',
  '...ovwwWWo.otvoooowto.oWWwwWo...',
  '...ovwwWWootWvoooowWtooWWwwWo...',
  '...ovwwWWttWovvvvvwoWttWWwwWo...',
  '...ovwwWtWWoovoooowooWWtWwwWo...',
  '...ovwwwwwwwwvwwwwwwwwwwwwwWo...',
  '...ovwwWWWWWWvvvvvwWWWWWWwwWo...',
  '...ovwwWWttoovoooowoottWWwwWo...',
  '...ovwwWWWWtovoooowotWWWWwwWo...',
  '...ovwwWWooWtvvvvvwtWooWWwwWo...',
  '...ovwwWWo.oWvoooowWo.oWWwwWo...',
  '...ovwwWWo..ovtootwo..oWWwwWo...',
  '...ovwwWWo..ovvvvvwo..oWWwwWo...',
  '...ovwwWWo..ovtWWtwo..oWWwwWo...',
  '...ovwwWWo..ovWooWwo..oWWwwWo...',
  '...ovwwWWo.otvvvvvwto.oWWwwWo...',
  '...ovwwWWootWvoooowWtooWWwwWo...',
  '...ovwwWWttWovoooowoWttWWwwWo...',
  '...ovwwWtWWoovvvvvwooWWtWwwWo...',
  '...ovwwtWoo.ovoooowo.ooWtwwWo...',
  '...ovwwWWo..ovoooowo..oWWwwWo...',
  '...ovwwoo...ovvvvvwo...oowwWo...',
  '...ovwwo....ovoooowo....owwWo...',
  'oooovwwo....ovoooowo....owwWoooo',
  'PPPPPwwo....ovvvvvwo....owwPPPPP',
  'eeeeeoo......oooooo......ooeeeee',
  'gggggo....................oggggg',
  'ooooo......................ooooo',
  '................................',
];

const DRILL_IDLE = [
  '............oooooooo............',
  '............oddddddo............',
  '............odMmmmdo............',
  '............odmmmmdo............',
  '............oddddddo............',
  '............oooooooo............',
  '...........oMmodoomdo...........',
  '..........oMmoodooomdo..........',
  '..........oMmodoodomdo..........',
  '..........oMmdo.oodmdo..........',
  '..........oMdo..o.oddo..........',
  '.........oMdooooooooddo.........',
  '.........oMdmmmmommmddo.........',
  '.........oMmddooooddmdo.........',
  '.........oMmoodoodoomdo.........',
  '.........oMmo.odoooomdo.........',
  '........oMmo.oddoddoomdo........',
  '........oMmoodooooodomdo........',
  '.oooo...oMmddo..o..odddo........',
  '.omdo...oMdoooooooooomdo........',
  '.oddo...oMdmmmmmommmmmddo.......',
  '.oddo..oMmodooooooooddmdo.......',
  '.oddo..oMmoooMMMMMMooomdo.......',
  '.oddo..oMmo.oddddddo.omdo.......',
  'oooooooooooooddddddooomdo.......',
  'oIIIIIIIIIIuoddddddodoomdo......',
  'oIaaaaaaadauoddddddooddmdo......',
  'oIaaaaaaaaauoooooooooooddo......',
  'oIadudududauomoMmommmmdddoooo...',
  'oIauuuuuuuauoooMmoooddoodddddo..',
  'oIaaaaaaaaauddodModdoo.ouiuGuo..',
  'oIauuuuuuuauooodMooo...odddddo..',
  'oIauuuuuuuauodoMmodooo.ouiuuuo..',
  'oIaaaaoaaaauoooMmoodddoodddddo..',
  'oIaaaoaoaaauo.odMo.ooodouiuuuo..',
  'ouuuuuuuuuuuooodMooooooooooooo..',
  'oooooooooooooZoMmoZZZZZZZZZZZZo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJnnnnnnjjjJjjjjiijo.',
  '.oJjjjjJjjjjJnnnnnnjjjJJjjIiijo.',
  '.oJJJJJJJJJJJJJJJJJJJJJJJJJIjjo.',
  '.JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ.',
  '..ooooooooooooooooooooooooooooo.',
  '................................',
  '................................',
];

const DRILL_WORK_A = [
  '............oooooooo............',
  '............oddddddo............',
  '............odMmmmdo............',
  '............odmmmmdo............',
  '............oddddddo............',
  '............oooooooo............',
  '...........oMmodoomdo...........',
  '..........oMmoodooomdo..........',
  '..........oMmodoodomdo..........',
  '..........oMmdo.oodmdo..........',
  '..........oMdo..o.oddo..........',
  '.........oMdooooooooddo.........',
  '.........oMdmmmmommmddo.........',
  '.........oMmddooooddmdo.........',
  '.........oMmoodoodoomdo.........',
  '...Z.....oMmo.odoooomdo.........',
  '..Z.....oMmo.oddoddoomdo........',
  '........oMmoodooooodomdo........',
  '.oooo...oMmddo..o..odddo........',
  '.omdo...oMdoooooooooomdo........',
  '.oddo...oMdmmmmmommmmmddo.......',
  '.oddo..oMmodooooooooddmdo.......',
  '.oddo..oMmoooMMMMMMooomdo.......',
  '.oddo..oMmo.oddddddo.omdo.......',
  'oooooooooooooddddddooomdo.......',
  'oIIIIIIIIIIuoddddddodoomdo......',
  'oIaaaaaaaGauoddddddooddmdo......',
  'oIaaaaaaaaauoooooooooooddo......',
  'oIadudududauomoMmommmmdddoooo...',
  'oIauuuuuuuauooodMoooddoodddddo..',
  'oIaaaaaaaaauddodModdoo.ouiuGuo..',
  'oIauuuuuuuauoooMmooo...odddddo..',
  'oIauuuuuuuauodoMmodooo.ouiuuuo..',
  'oIaaaaoaaaauooodMoodddoodddddo..',
  'oIaaaoaoaaauo.odMo.ooodouiuuuo..',
  'ouuuuuuuuuuuoooMmooooooooooooo..',
  'oooooooooooooZoMmoZZZZZZZZZZZZo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJnnnnnnijjJjjjjiijo.',
  '.oJjjjjJjjjjJZnnnnnjjjJJjjIiijo.',
  '.oJJJJJJJJJJJJJJJJJJJJJJJJJIjjo.',
  '.JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ.',
  '..ooooooooooooooooooooooooooooo.',
  '................................',
  '................................',
];

const DRILL_WORK_B = [
  '............oooooooo............',
  '............oddddddo............',
  '............odMmmmdo............',
  '............odmmmmdo............',
  '............oddddddo............',
  '............oooooooo............',
  '...........oMmodoomdo...........',
  '..........oMmoodooomdo..........',
  '..........oMmodoodomdo..........',
  '..........oMmdo.oodmdo..........',
  '..........oMdo..o.oddo..........',
  '.........oMdooooooooddo.........',
  '....Z....oMdmmmmommmddo.........',
  '..Z......oMmddooooddmdo.........',
  '...Z.....oMmoodoodoomdo.........',
  '.........oMmo.odoooomdo.........',
  '........oMmo.oddoddoomdo........',
  '........oMmoodooooodomdo........',
  '.oooo...oMmddo..o..odddo........',
  '.omdo...oMdoooooooooomdo........',
  '.oddo...oMdmmmmmommmmmddo.......',
  '.oddo..oMmodooooooooddmdo.......',
  '.oddo..oMmoooMMMMMMooomdo.......',
  '.oddo..oMmo.oddddddo.omdo.......',
  'oooooooooooooddddddooomdo.......',
  'oIIIIIIIIIIuoddddddodoomdo......',
  'oIaaaaaaaGauoddddddooddmdo......',
  'oIaaaaaaaaauoooooooooooddo......',
  'oIadudududauomodMommmmdddoooo...',
  'oIauuuuuuuauoooMmoooddoodddddo..',
  'oIaaaaaaaaauddoMmoddoo.ouiuGuo..',
  'oIauuuuuuuauooodMooo...odddddo..',
  'oIauuuuuuuauododModooo.ouiuuuo..',
  'oIaaaaoaaaauoooMmoodddoodddddo..',
  'oIaaaoaoaaauo.oMmo.ooodouiuuuo..',
  'ouuuuuuuuuuuooodMooooooooooooo..',
  'oooooooooooooZodMoZZZZZZZZZZZZo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjoMmojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjJjodMojjjjJjjjjJjjo.',
  '.oJjjjjJjjjjInnnnnnjjjJjjjjiijo.',
  '.oJjjjjJjjjjJnnnnnZjjjJJjjIiijo.',
  '.oJJJJJJJJJJJJJJJJJJJJJJJJJIjjo.',
  '.JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ.',
  '..ooooooooooooooooooooooooooooo.',
  '................................',
  '................................',
];

const FARM_IDLE = [
  '................................',
  'oooooooooooooo...........oooooo.',
  'oMMMMMMMMMMMMo..........oddddddo',
  'omdMmdMmdMmdMo..........oFfffffo',
  'omduudMmdMmdMo..........oFfffffo',
  'omdumdMmdMmdMo..........oddddddo',
  'oddddddddddddo..........oFfffffo',
  'oooooooooooooo..........oFfffffo',
  '.owwoooooowwo......ooooooddddddo',
  '.oWWonnnnoWWo......oMmmooFfffffo',
  'oovWonnnnovvo..o..oommmooFfffffo',
  'woWwonnnnowwooovoovommmooooooooo',
  'woWWonnnnoWWovvvvvvooooovvvvvvvW',
  'woWvoooooovvooooooo.owoowoowoowW',
  'wWWWWWWWWWWWWotttttoWWWWWWWWWWWW',
  'weeeheeeheeeooOOOOOooeeeheeeheeW',
  'weeleeeleeeoOOOOOOOOOoeleeeleeeW',
  'wgggggggggggoopeeeeooggggggggggW',
  'wPPPPPPPPPPPPopxexeoPPPPPPPPPPPW',
  'weeeheeeheeehopedeeoeeeeheeeheeW',
  'weeleeeleeeleopemeeoeeeCaeeleeeW',
  'wgggggggggoooFffffffooCggggggggW',
  'wPPPPPPPPovvvFffffffvvvoPPPPPPPW',
  'weeeheeehowwwFffffffwwwoheeeheeW',
  'weeleeeleopooFffffffoopoeeeleeeW',
  'wgggggggggogoFOOOOOfogoggggggggW',
  'wPPPPPPPPPPPoFffffffoPPPPPPPPPPW',
  'weeeheeeheeeoFffffffoeeeheeeheeW',
  'weeleeeleeeloFffffffoeeleeeleeeW',
  'wggggggggggggofofofogggggggggggW',
  'wPPPPPPPPPPPPPoowooPPPPPPPPPPPPW',
  'weeeheeeheeeheeowoeeeeeeheeeheeW',
  'weeleeeleeeleeeowoeeeeeleeeleeeW',
  'wggggggggggggggowogggggggggggggW',
  'wPPPPPPPPPPPPPPPoPPPPPPPPPPPPPPW',
  'weeeheeeheeeheeeheeeheeeheeeheeW',
  'weeleeeleeeleeeleeeleeeleeeleeeW',
  'wggvggvggvggvggvggvggvggvggvggvW',
  'wvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvW',
  'woowoowoowoowoowoowoowoowoowoowW',
];

const FARM_GROW_A = [
  '................................',
  'oooooooooooooo...........oooooo.',
  'oMMMMMMMMMMMMo..........oddddddo',
  'omdMmdMmdMmdMo..........oFfffffo',
  'omduudMmdMmdMo..........oFfffffo',
  'omdumdMmdMmdMo..........oddddddo',
  'oddddddddddddo..........oFfffffo',
  'oooooooooooooo..........oFfffffo',
  '.owwoooooowwo......ooooooddddddo',
  '.oWWonnnnoWWo......oMmmooFfffffo',
  'oovWonnnnovvo..o..oommmooFfffffo',
  'woWwonnnnowwooovoovommmooooooooo',
  'woWWonnnnoWWovvvvvvooooovvvvvvvW',
  'woWvoooooovvooooooo.owoowoowoowW',
  'wWWWWWWWWWWWWotttttoWWWWWWWWWWWW',
  'weehleehleehooOOOOOooeehleehleeW',
  'weelLeelLeeoOOOOOOOOOoelLeelLeeW',
  'wgggggggggggoopeeeeooggggggggggW',
  'wPPPPPPPPPPPPopxexeoPPPPPPPPPPPW',
  'weehleehleehlopedeeoeeehleehleeW',
  'weelLeelaCelLopemeeoeeelLeelLeeW',
  'wgggggggggCooFffffffoooggggggggW',
  'wPPPPPPPPovvvFffffffvvvoPPPPPPPW',
  'weehleehlowwwFffffffwwwoleehleeW',
  'weelLeelLopooFffffffoopoLeelLeeW',
  'wgggggggggogoFOOOOOfogoggggggggW',
  'wPPPPPPPPPPPoFffffffoPPPPPPPPPPW',
  'weehleehleehoFffffffoeehleehleeW',
  'weelLeelLeeloFffffffoeelLeelLeeW',
  'wggggggggggggofofofogggggggggggW',
  'wPPPPPPPPPPPPPoowooPPPPPPPPPPPPW',
  'weehleehleehleeowoeeeeehleehleeW',
  'weelLeelLeelLeeowoeeeeelLeelLeeW',
  'wggggggggggggggowogggggggggggggW',
  'wPPPPPPPPPPPPPPPoPPPPPPPPPPPPPPW',
  'weehleehleehleehleehleehleehleeW',
  'weelLeelLeelLeelLeelLeelLeelLeeW',
  'wggvggvggvggvggvggvggvggvggvggvW',
  'wvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvW',
  'woowoowoowoowoowoowoowoowoowoowW',
];

const FARM_GROW_B = [
  '................................',
  'oooooooooooooo...........oooooo.',
  'oMMMMMMMMMMMMo..........oddddddo',
  'omdMmdMmdMmdMo..........oFfffffo',
  'omduudMmdMmdMo..........oFfffffo',
  'omdumdMmdMmdMo..........oddddddo',
  'oddddddddddddo..........oFfffffo',
  'oooooooooooooo..........oFfffffo',
  '.owwoooooowwo......ooooooddddddo',
  '.oWWonnnnoWWo......oMmmooFfffffo',
  'oovWonnnnovvo..o..oommmooFfffffo',
  'woWwonnnnowwooovoovommmooooooooo',
  'woWWonnnnoWWovvvvvvooooovvvvvvvW',
  'woWvoooooovvooooooo.owoowoowoowW',
  'wWWhWWWhWWWhWotttttoWWWhWWWhWWWW',
  'wehklehylehlooOOOOOooehllehkleeW',
  'wellLellLeloOOOOOOOOOollLellLeeW',
  'wgggggggggggoopeeeeooggggggggggW',
  'wPPhPPPhPPPhPopxexeoPPPhPPPhPPPW',
  'wehylehllehklopedeeoeehklehyleeW',
  'wellLellLellLopemeeoeelCaellLeeW',
  'wgggggggggoooFffffffooCggggggggW',
  'wPPhPPPhPovvvFffffffvvvoPPPhPPPW',
  'wehllehklowwwFffffffwwwolehlleeW',
  'wellLellLopooFffffffoopoLellLeeW',
  'wgggggggggogoFOOOOOfogoggggggggW',
  'wPPhPPPhPPPhoFffffffoPPhPPPhPPPW',
  'wehklehylehloFffffffoehllehkleeW',
  'wellLellLelloFffffffoellLellLeeW',
  'wggggggggggggofofofogggggggggggW',
  'wPPhPPPhPPPhPPoowooPPPPhPPPhPPPW',
  'wehylehllehkleeowoeeeehklehyleeW',
  'wellLellLellLeeowoeeeellLellLeeW',
  'wggggggggggggggowogggggggggggggW',
  'wPPhPPPhPPPhPPPhoPPhPPPhPPPhPPPW',
  'wehllehklehylehllehklehylehlleeW',
  'wellLellLellLellLellLellLellLeeW',
  'wggvggvggvggvggvggvggvggvggvggvW',
  'wvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvW',
  'woowoowoowoowoowoowoowoowoowoowW',
];

const SITE_TILE = [
  'eeeeeeeeeegeeeee',
  'eeeeePeeeeeeeeee',
  'eeeeeeeeeeeeeeme',
  'evvwvvvvvveeeeee',
  'ewwwwwwwwweeeeee',
  'PWWWWWWWWWeeeeee',
  'ePeeeeeePeeeeeeP',
  'eeeeeeeeeeeeeeee',
  'eeeeeePeejJeveee',
  'eeeeeeeeeppppeee',
  'eeeppppppeeeweee',
  'pppePeeeeeeeweee',
  'eeeeZjeeeeeeweee',
  'eeeejJeeeePeoeee',
  'eeeePeemeeeeeeeP',
  'eeeeeeeeeeeeeeee',
];

/* ------------------------------------------------------------------ décor */

/*
 * Le décor ne se heurte pas et ne se récolte pas : il dit seulement où l'on
 * est. Fleurs et herbes sur la prairie, os et pneus dans le sable, gravats
 * et fûts sur la roche — le monde d'avant, en morceaux.
 */

const DECOR_FLOWERS = [
  '................',
  '................',
  '..o.............',
  '.oyo......o.....',
  '..o.h....oKo....',
  '...h......o.....',
  '...h.h....h..o..',
  '....hh...hh.oyo.',
  '..........h..o..',
  '.....o.......h..',
  '....oko.....hh..',
  '.....o..........',
  '.....h..........',
  '....hh..........',
  '................',
  '................',
];

const DECOR_TUFT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......h........',
  '....h..h..h.....',
  '....hl.hl.l.....',
  '.....l.l.lh.....',
  '...h.lllll......',
  '....lLlLlL......',
  '.....LLLL.......',
  '................',
  '................',
  '................',
  '................',
];

const DECOR_DEAD_BUSH = [
  '................',
  '................',
  '................',
  '................',
  '...o......o.....',
  '..ovo..o.ovo....',
  '...ovo.ovovo.o..',
  '....ovoovwo.ovo.',
  '..o..owwwoovwo..',
  '.ovooowwwwwoo...',
  '..owwwwWwWo.....',
  '...ooWWWWo......',
  '.....oooo.......',
  '................',
  '................',
  '................',
];

const DECOR_BONES = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooo.......',
  '....oNNNNo......',
  '....oNoNoPo.....',
  '....oNNNNPo.....',
  '.....oNoNo..oo..',
  '......ooo..oNNo.',
  '..oo......oNPo..',
  '.oNNooooooNPo...',
  '..oPNNNNNNPo....',
  '...oooooooo.....',
  '................',
];

const DECOR_RUBBLE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oooo.....',
  '......ocbbBo....',
  '...oooobbBBo....',
  '..oZjjJoooo.oo..',
  '..ojjjJJo..obBo.',
  '...oJJJo.oooBo..',
  '....ooooqpPo....',
  '........oPPo....',
  '.........oo.....',
  '................',
];

const DECOR_BARREL = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....oddddddo....',
  '....oIuuuuuo....',
  '....oIuGGuuo....',
  '....oddddddo....',
  '....oIuuuuuo....',
  '....oIuuuuuo....',
  '....oddddddo....',
  '....oIuuuuuo....',
  '.....oooooo.....',
  '..........oGo...',
  '...........o....',
  '................',
];

const DECOR_TIRE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '...ooCCCCCCoo...',
  '..oCCooooooCCo..',
  '..oCo......oCo..',
  '..oCCooooooCCo..',
  '...ooCCCCCCoo...',
  '.....oooooo.....',
  '................',
  '................',
  '................',
];

const DECOR_SIGN = [
  '................',
  '.......ooo......',
  '......oaaao.....',
  '.....oaoooao....',
  '.....oaouoao....',
  '.....oaoooao....',
  '......oauao.....',
  '.......ooo......',
  '.......odo......',
  '.......odo......',
  '........odo.....',
  '........odo.....',
  '........odo.....',
  '.......oddo.....',
  '.......JJJo.....',
  '........ooo.....',
];

const DECOR_PUDDLE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '...ooGGhGGGoo...',
  '..oGGhGGGGGGGo..',
  '..oGGGGGGhGGGo..',
  '...ooGGGGGGoo...',
  '.....oooooo.....',
  '................',
  '................',
  '................',
  '................',
];

const DECOR_MUSHROOMS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.........oo.....',
  '....ooo.oGGo....',
  '...oGGGooGGGo...',
  '..oGhGGGooppo...',
  '..ooooooo.op....',
  '....opo...op....',
  '....opo..ohh....',
  '...hopoh........',
  '................',
  '................',
];

const DECOR_RUIN = [
  '................',
  '..oooo..........',
  '..obbo..........',
  '..obBoooo.......',
  '..obbbbcboo.....',
  '..oBbcbbBbBo....',
  '..obbBbbbbbo....',
  '..oqpppqppPo....',
  '..oppPpppPPoo...',
  '..ozppppPPPzo...',
  '..ozzpppPPzzoo..',
  '.oooozzzzzooJo..',
  '.oJjo.ooooojjo..',
  '..oo.......oo...',
  '................',
  '................',
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
    palette: WORLD_PALETTE,
    animations: { full: [TREE_FULL], damaged: [TREE_DAMAGED] },
  },
  treePine: {
    palette: WORLD_PALETTE,
    animations: { full: [PINE_FULL], damaged: [PINE_DAMAGED] },
  },
  treeDead: {
    palette: WORLD_PALETTE,
    animations: { full: [DEAD_FULL], damaged: [DEAD_DAMAGED] },
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
    palette: WORLD_PALETTE,
    animations: { idle: [SITE_TILE] },
  },
  drill: {
    palette: WORLD_PALETTE,
    animations: { idle: [DRILL_IDLE], work: [DRILL_WORK_A, DRILL_WORK_B] },
  },
  nursery: {
    palette: WORLD_PALETTE,
    animations: { idle: [NURSERY] },
  },
  builderHouse: {
    palette: WORLD_PALETTE,
    animations: { idle: [BUILDER_HOUSE] },
  },
  farm: {
    palette: WORLD_PALETTE,
    animations: { idle: [FARM_IDLE], grow: [FARM_GROW_A, FARM_GROW_B] },
  },
  watchtower: {
    palette: WORLD_PALETTE,
    animations: { idle: [WATCHTOWER] },
  },
  townHall: {
    palette: WORLD_PALETTE,
    animations: { idle: [TOWN_HALL] },
  },
  decor: {
    palette: WORLD_PALETTE,
    animations: {
      flowers: [DECOR_FLOWERS],
      tuft: [DECOR_TUFT],
      deadBush: [DECOR_DEAD_BUSH],
      bones: [DECOR_BONES],
      rubble: [DECOR_RUBBLE],
      barrel: [DECOR_BARREL],
      tire: [DECOR_TIRE],
      sign: [DECOR_SIGN],
      puddle: [DECOR_PUDDLE],
      mushrooms: [DECOR_MUSHROOMS],
      ruin: [DECOR_RUIN],
    },
  },
};
