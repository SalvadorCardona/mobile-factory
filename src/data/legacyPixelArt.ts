/**
 * Palette pixel art de l'ancienne direction — **transitoire**.
 *
 * La direction artistique est désormais vectorielle (`artDirection.ts`). Ce
 * fichier ne garde que ce dont les placeholders pixel art ont encore besoin
 * pour s'afficher le temps de leur migration en SVG ; il disparaît avec eux.
 * N'y ajoutez rien.
 */

/** Taille d'une tuile dans les assets source. Le rendu affiche à 32 px, soit ×2. */
export const ART_PIXELS_PER_TILE = 16;

/**
 * Palette de référence. Les placeholders et l'UI l'utilisent telle quelle ;
 * les assets générés doivent s'en approcher.
 */
export const PALETTE = {
  outline: 0x1b1523,
  night: 0x11161d,

  skin: 0xe8b48a,
  skinShadow: 0xb87c5a,
  hair: 0x3b2a22,

  cloth: 0x6b8a3d,
  clothShadow: 0x475c2a,
  pants: 0x4d4f5c,
  pantsShadow: 0x30313b,
  boots: 0x4b3225,

  trunk: 0x6b4a2b,
  trunkShadow: 0x4a3220,
  leaves: 0x4a8a3c,
  leavesDark: 0x2f5f2a,
  leavesLight: 0x74b054,

  rock: 0x7d7f86,
  rockLight: 0xa6a8ae,
  rockDark: 0x55575f,
  iron: 0xc96a3a,
  ironLight: 0xe89a5c,
  coal: 0x232229,
  coalLight: 0x45444d,

  metal: 0x8a8f99,
  metalDark: 0x565b66,
  metalLight: 0xb8bcc4,
  rust: 0xa5502c,
  accent: 0xd98b3a,

  plaster: 0xd9cbb0,
  plasterShadow: 0xb39f80,
  brick: 0x9a5a3f,
  roof: 0x7a3b3b,
  roofDark: 0x552828,
  beam: 0x8b6a3f,
  dirt: 0x8a6a48,
  dirtDark: 0x6a4f34,

  radioactive: 0x9ef01a,
  /* Mutants : peau grise-verdâtre et haillons. */
  mutantSkin: 0x8a9a7a,
  mutantSkinShadow: 0x5f6e54,
  rags: 0x6a5a4a,
  ragsShadow: 0x463b30,
  /* Tissus de la nurserie. */
  blanket: 0xc46a7a,
  blanketLight: 0xe09aa6,

  /* Bâtiments en volume : faces éclairées, tuiles, lumière aux fenêtres. */
  plasterLight: 0xefe4cc,
  brickDark: 0x6e3d2c,
  brickLight: 0xbd7a55,
  roofLight: 0xa3524a,
  beamLight: 0xb08a55,
  glow: 0xf4d06f,
  glass: 0x4f7488,
  /* Bâches de récupération, mousse sur les ruines, os blanchis. */
  tarp: 0x3f6f7a,
  tarpLight: 0x5f96a0,
  moss: 0x5f7f35,
  bone: 0xe6dcc2,
} as const;

export type PaletteKey = keyof typeof PALETTE;
