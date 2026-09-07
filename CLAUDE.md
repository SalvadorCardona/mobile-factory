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
bâtiments sont solides, on ne les traverse pas. Un tap sur un chantier ouvre
sa fenêtre : « Transférer le sac » y vide d'un coup ce qu'il attend, et
« Construire » l'achève — **un chantier livré ne se termine jamais seul**.

**Ouvriers** — chaque bâtiment déclare `workers` ; la maison des
constructeurs et la ferme en emploient quatre, comptés dans la population
une fois le bâtiment fini. Les porteurs viendront de là.

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
   Modèle par défaut : `google/gemini-3.1-flash-image` (Nano Banana 2) :
   à prompt égal, il respecte la structure lignes × colonnes et n'écrit pas
   de texte, là où `gemini-2.5-flash-image` produit une grille 4×4 légendée.
   Aucun ne rend un vrai fond transparent (damier peint) ni une grille au
   pixel : prévoir `--key` et un recadrage.
4. Enregistrer le résultat brut hors du dépôt (scratchpad), puis le
   normaliser : `npm run sprite:normalize -- <id> <brut.png>`. L'outil
   (`src/tools/`) réduit en `nearest` à la grille, binarise l'alpha,
   quantifie chaque pixel à `PALETTE` et écrit `public/sprites/<id>.png`.
   Il refuse une image dont les dimensions ne sont pas la grille ou un
   multiple entier : recadrer (`--crop x,y,w,h`) ou régénérer, jamais
   étirer. Un fond opaque s'incruste avec `--key RRGGBB`. Le rapport donne
   la « dérive » moyenne : grande, le modèle n'a pas suivi la palette et la
   planche mérite un regard sévère.
5. Regarder l'image (l'ouvrir avec `Read`) : grille respectée, fond
   transparent, ancre cohérente avec `anchorX/anchorY`, palette proche de
   `PALETTE`, pas de texte ni d'anti-aliasing.
6. Seulement alors, renseigner `SPRITES[id].file = '<id>.png'`. Rien d'autre
   ne change : `spriteLibrary` découpe la planche sur la grille déclarée.
7. Lancer `npm run lint && npm run typecheck && npm test` — le test
   `sprites.test.ts` revérifie grille, alpha et palette de tout PNG
   référencé — puis vérifier en jeu avant de committer le PNG.

Cohérence d'une planche à l'autre : c'est la quantification qui garantit la
palette, pas le prompt. Générer d'abord la planche de référence (Adam),
l'itérer jusqu'à satisfaction, ajuster `STYLE_PROMPT` si besoin, et seulement
ensuite les autres, dans la même session et avec le même modèle. Ce qui doit
se ressembler (Adam, Ève, l'enfant) se génère de préférence dans un même lot.

Jamais de style improvisé, jamais d'asset non vérifié, jamais de PNG
référencé sans être passé par ces étapes.

## Icônes et HUD

- Une ressource = une icône : `src/data/icons.ts` est un
  `Record<ItemId, PixelIcon>` (12 × 12 px, palette du jeu). Un objet sans
  icône ne compile pas ; `validatePrototypes()` vérifie taille et palette.
- `src/ui/icons.ts` bake icônes d'objets et vignettes de bâtiments en
  `data:` URL pour le DOM. Le menu de construction est un tiroir derrière un
  seul bouton ; armer un bâtiment passe la carte en mode construction
  (grille + emprises, `render/ghostLayer.ts`).

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
