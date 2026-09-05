# Direction artistique

Ce document est la référence visuelle du projet. Sa version exécutable est
`src/data/artDirection.ts` : la génération d'assets y lit le préfixe de
prompt, le rendu de substitution y lit la palette. **Si ce document et ce
fichier ne disent pas la même chose, c'est le fichier qui a raison, et ce
document qu'il faut corriger.**

## En une phrase

**Pixel art heroic fantasy 16 bits, sur un sujet post-apocalyptique.**

Le rendu est celui d'un JRPG de l'ère SNES : pixels francs, contours d'un
pixel sombre, couleurs saturées mais terreuses, très peu de dithering. Le
sujet, lui, est l'après : ruines, rouille, matériaux récupérés, nature qui
reprend ses droits, et une lueur vert acide sur tout ce qui a muté.

C'est un point de départ volontairement simple. Il changera peut-être. Ce
jour-là, on change `STYLE_PROMPT`, `PALETTE`, ce document — et on régénère.

## Univers

Le pitch est dans `src/data/lore.ts` et fait foi :

> Un futur apocalyptique. Quelques survivants. Adam, seul au milieu des
> ruines, ramasse du bois et du minerai à mains nues pour bâtir une mairie —
> le premier toit de la colonie. Ève arrivera ensuite. Et avec elle, les
> mutants radioactifs qui rôdent au-delà de la clairière.

Personnages : **Adam** (le héros, jouable), **Ève** (à venir), les **mutants
radioactifs** (en jeu, par vagues), les **enfants** (nés à la nurserie). Leur
description physique est dans `lore.ts`, et c'est de là que partent les
prompts.

## Règles techniques

| Règle | Valeur | Pourquoi |
| --- | --- | --- |
| Pixels par tuile (source) | 16 | Le rendu affiche ×2 : 32 px écran par tuile |
| Agrandissement | ×2, `nearest` | Jamais de lissage, jamais de demi-pixel |
| Caméra | vue 3/4 de dessus (JRPG) | Le joueur voit les façades et les toits |
| Lumière | haut-gauche | Une seule direction pour toute la carte |
| Contours | 1 px, `PALETTE.outline` | Lisibilité sur téléphone |
| Fond | transparent | Les sprites se posent sur le terrain baké |
| Anti-aliasing, flou, dégradés, texte | interdits | Ce n'est plus du pixel art |

Un personnage adulte — Adam, un mutant — tient dans 16 × 24 px, ancre aux
pieds (0.5, 0.8) ; un enfant dans 16 × 16 px. Un bâtiment occupe exactement
son emprise : 32 × 32 px pour 2 × 2 tuiles, 48 × 48 px pour 3 × 3. Une
ressource de surface et une flèche tiennent dans une tuile de 16 × 16 px.

## Palette

La palette de référence est `PALETTE` dans `artDirection.ts`. Les
placeholders l'utilisent telle quelle ; les planches générées doivent s'en
approcher — pas à la valeur près, mais dans les mêmes familles : peaux
chaudes, tissus olive et gris, bois brun, roche grise, fer rouillé, charbon
noir, métal froid avec un accent orange, plâtre et brique pour le bâti, et
un unique vert acide (`radioactive`) réservé à ce qui a muté.

## Planches de sprites

Une planche est une **grille** : une animation par ligne, une image par
colonne, toutes les images de la même taille, aucune gouttière. C'est la
convention que `src/data/sprites.ts` décrit, que la génération demande au modèle
et que `render/spriteLibrary.ts` découpe.

Ajouter un sprite :

1. déclarer la planche dans `SPRITES` : taille d'image, ancre, animations
   (ligne, nombre d'images, cadence), et le **sujet** du prompt ;
2. dessiner son placeholder dans `src/data/pixelmaps.ts` — le test de
   validation impose qu'il ait exactement la taille annoncée ;
3. générer avec le MCP OpenRouter, en suivant la procédure de `CLAUDE.md`
   (prompt = `STYLE_PROMPT` + sujet + `SHEET_PROMPT` + grille chiffrée) ;
4. regarder le PNG. Vraiment. Vérifier la grille, l'ancre, le fond ;
5. renseigner `SPRITES[id].file`. Rien d'autre ne change.

Tant que `file` est `null`, le jeu affiche le placeholder. Il n'y a pas de
troisième état : pas d'asset à moitié intégré.

## Génération

La génération passe par le **MCP OpenRouter**, piloté par Claude depuis
Claude Code — il n'y a pas de script dans le dépôt. La procédure complète
est dans `CLAUDE.md` ; son principe : **chaque** prompt commence par
`STYLE_PROMPT`, puis vient le sujet de la planche, `SHEET_PROMPT` et la
grille chiffrée. C'est ce qui garantit une seule direction artistique quel
que soit le jour, la session ou la personne qui génère : le style n'est
jamais retapé à la main.

Modèle par défaut : `google/gemini-2.5-flash-image`. Les modèles d'image
respectent imparfaitement une grille au pixel près : les dimensions du PNG
se vérifient contre la grille (`sheetGrid()` dans `sprites.ts`), et un
recadrage ou une régénération reste un geste conscient, jamais automatique.
