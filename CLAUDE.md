# Mobile Factory — contexte du projet

Ce fichier est lu au début de chaque session. Il dit ce qui ne doit pas se
perdre d'une session à l'autre : le pitch, la direction artistique, et les
règles d'architecture. Le détail est dans les fichiers qu'il désigne — les
lire avant de toucher au domaine concerné.

## Le jeu

Jeu d'usine 2D pour navigateur mobile (TypeScript, PixiJS v8, Vite).

**Pitch** — `src/data/lore.ts` fait foi. Un futur apocalyptique, quelques
survivants. Le héros est **Adam** ; **Ève** le rejoindra ; des **humains
mutants radioactifs** rôdent. La partie commence sur le chantier de la
**mairie**, qu'Adam doit remplir de bois et de pierre.

**Mécanique centrale** — Adam n'a pas de bouton d'action. Il **heurte** les
choses : un arbre ou un rocher heurté se récolte (bois, fer, charbon,
pierre) ; un chantier heurté reçoit ce qu'il attend. Les ressources et les
bâtiments sont solides, on ne les traverse pas.

**Menace** — dès que la mairie est debout, des **mutants** arrivent par
vagues (`src/data/enemies.ts`) et marchent droit sur elle ; ils traversent
tout sauf le bâti, qu'ils cassent. L'arc d'Adam et la tour de guet
(`src/data/weapons.ts`) tirent seuls. La mairie à zéro = partie perdue.
La **nurserie** fait naître un enfant toutes les dix minutes.

## Direction artistique

**Pixel art heroic fantasy 16 bits, sujet post-apocalyptique.**
Référence : `docs/art-direction.md` ; version exécutable :
`src/data/artDirection.ts` (`STYLE_PROMPT`, `SHEET_PROMPT`, `PALETTE`).

- 16 px par tuile en source, affiché ×2 en `nearest`. Jamais de lissage.
- Tout prompt de génération commence par `STYLE_PROMPT`. Ne jamais retaper
  le style à la main : c'est ce préfixe qui garantit la cohérence.
- Tant que `file` est `null`, le placeholder pixel art de
  `src/data/pixelmaps.ts` est affiché. Un nouveau sprite a **toujours** un
  placeholder — la validation des prototypes l'exige.

### Générer un asset avec le MCP OpenRouter

Les assets se génèrent avec le **MCP OpenRouter** (génération d'image), pas
avec un script du dépôt. Procédure, à suivre telle quelle :

1. Lire `src/data/artDirection.ts` (`STYLE_PROMPT`, `SHEET_PROMPT`) et
   l'entrée `SPRITES[id]` de `src/data/sprites.ts` (taille d'image,
   animations, `prompt`). Pour un nouveau sprite, déclarer d'abord l'entrée
   et son placeholder dans `src/data/pixelmaps.ts`.
2. Composer le prompt, dans cet ordre et sans rien reformuler :
   `STYLE_PROMPT` + `SPRITES[id].prompt` + `SHEET_PROMPT` + la grille
   chiffrée : « Grid: R row(s) × C column(s); each frame W×H pixels; total
   image exactly (C×W)×(R×H) pixels; row 1: "<animation>", N frame(s); … ;
   unused cells stay fully transparent. » `sheetGrid(SPRITES[id])` donne R
   et C.
3. Appeler l'outil de génération d'image du MCP OpenRouter avec ce prompt.
   Modèle par défaut : `google/gemini-2.5-flash-image` (Nano Banana) ;
   demander une image PNG à fond transparent.
4. Enregistrer le résultat dans `public/sprites/<id>.png` et vérifier ses
   dimensions : elles doivent valoir exactement la grille, ou un multiple
   entier (auquel cas réduire en `nearest` d'abord). Une planche hors grille
   donne des images décalées à l'écran : recadrer ou régénérer, jamais
   référencer.
5. Regarder l'image (l'ouvrir avec `Read`) : grille respectée, fond
   transparent, ancre cohérente avec `anchorX/anchorY`, palette proche de
   `PALETTE`, pas de texte ni d'anti-aliasing.
6. Seulement alors, renseigner `SPRITES[id].file = '<id>.png'`. Rien d'autre
   ne change : `spriteLibrary` découpe la planche sur la grille déclarée.
7. Lancer `npm run lint && npm run typecheck && npm test`, puis vérifier en
   jeu avant de committer le PNG.

Jamais de style improvisé, jamais d'asset non vérifié, jamais de PNG
référencé sans être passé par ces étapes.

## Système de sprites

- `src/data/sprites.ts` : une planche = une grille, une animation par ligne,
  une image par colonne, taille d'image fixe, ancre, cadence.
- `src/render/spriteLibrary.ts` : charge la planche PNG ou bake le
  placeholder, et sert `Texture[]` par animation. Le reste du rendu ne sait
  pas d'où viennent les textures.
- `src/render/entityLayer.ts` : Adam (`AnimatedSprite`, direction + marche,
  profil gauche = miroir du profil droit), chantiers, bâtiments animés.
- Les ressources de surface sont bakées dans la RenderTexture du chunk
  (`chunkLayer.ts`) et rebakées quand la simulation salit le chunk.

## Son

Tout est synthétisé en Web Audio (`src/audio/`) : pas de fichier audio dans
le dépôt. Un nouvel effet = une entrée dans `SOUNDS` (`synth.ts`) et une
ligne dans `wireAudio()` (`main.ts`), qui est la seule table événement → son.
Rien ne joue avant un geste du joueur.

## Règles d'architecture

- **`sim/` et `data/` n'importent jamais `pixi.js`, `render/`, `ui/` ni le
  DOM.** Appliqué par ESLint. Les tests tournent headless en Node.
- L'UI ne modifie jamais l'état : elle pousse une commande (`sim/commands.ts`),
  le tick la consomme. Seed + journal de commandes = partie rejouable. Le
  hasard des vagues et des enfants vient du PRNG du monde, jamais de
  `Math.random()` côté `sim/`.
- La carte n'est jamais stockée : terrain, filons et ressources de surface
  sont régénérés depuis la seed (`sim/terrain.ts`). Seules les modifications
  du joueur (`sim/resources.ts`, entités) sont de l'état.
- Le contenu est de la donnée (`src/data/*.ts`, `as const satisfies`).
  `validatePrototypes()` tourne au démarrage en dev et dans les tests.
- Pas d'ECS, pas de moteur physique, pas de multijoueur.

## Vérifier avant de pousser

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
