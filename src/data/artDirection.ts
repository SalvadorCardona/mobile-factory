/**
 * Direction artistique — contenu pur, aucune logique.
 *
 * C'est la version exécutable de `docs/art-direction.md`. Toute génération
 * d'asset (MCP OpenRouter, cf. `CLAUDE.md`) préfixe son prompt avec
 * `STYLE_PROMPT`, et le rendu de substitution pioche ses couleurs dans
 * `PALETTE`. Un asset généré à la main, hors de ce préfixe, n'a pas sa place
 * dans le jeu : c'est comme ça qu'on garde une seule direction, pas dix.
 *
 * Choix actuel : pixel art, style heroic fantasy 16 bits, sujet
 * post-apocalyptique. Ça changera peut-être ; ce jour-là, seul ce fichier et
 * le document qui le décrit changent.
 */

/** Taille d'une tuile dans les assets source. Le rendu affiche à 32 px, soit ×2. */
export const ART_PIXELS_PER_TILE = 16;

/** Nom court de la direction, pour les logs et le README. */
export const ART_DIRECTION_NAME = 'Pixel art heroic fantasy, univers post-apocalyptique';

/**
 * Préfixe commun à tous les prompts de génération.
 *
 * Rédigé en anglais : les modèles d'image suivent nettement mieux les
 * consignes techniques dans cette langue. Le sujet de chaque sprite vient de
 * `SPRITES[id].prompt` et s'y ajoute.
 */
export const STYLE_PROMPT =
  '16-bit pixel art, heroic fantasy RPG style (SNES era, chunky clean pixels, ' +
  'strong 1-pixel dark outlines, saturated but earthy colors, painterly ' +
  'dithering kept minimal). Subject matter is post-apocalyptic: ruins, rust, ' +
  'scavenged materials, overgrown nature, a faint acid-green radioactive glow ' +
  'on anything mutated. Top-down 3/4 view (JRPG camera), consistent light from ' +
  'the top-left. Flat, fully transparent background. No text, no watermark, ' +
  'no blur, no anti-aliasing, no gradients.';

/** Consignes pour les planches animées, ajoutées après le sujet. */
export const SHEET_PROMPT =
  'Output a single sprite sheet laid out on a strict grid: one animation per ' +
  'row, one frame per column, every frame exactly the same size, aligned to ' +
  'the grid with no gutters. Same character/object in every frame, same ' +
  'proportions, same palette.';

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
} as const;

export type PaletteKey = keyof typeof PALETTE;
