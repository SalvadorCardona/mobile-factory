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

**Vectoriel « post-apo joyeux » : la vie reprend ses droits sur la ruine.**
Ruines arrondies envahies de lianes, fleurs, drapeaux, échelles, grues,
antennes ; les mutants sont drôles plus qu'effrayants.

**Charger le skill `art-direction` (`.claude/skills/art-direction/`) avant
toute création ou modification de visuel.** Référence :
`docs/art-direction.md` (règles, palette chiffrée, construction, maquette et
dessins de l'illustrateur dans `docs/art-direction/`) ; version exécutable :
`src/data/artDirection.ts` (`PALETTE`, `GROUND`, `RADIUS`, `STROKE`, `LIGHT`,
`FAMILY_TONES`, helpers SVG, `auditSvg`).

**Tout nouveau visuel est un SVG construit avec les helpers de
`artDirection.ts`.** Pas de couleur tapée à la main (le type `Color` la
refuse), pas d'image générée par un modèle, pas de pixel art.

Les règles, en résumé :

- formes pures (capsules, rectangles très arrondis, cercles), **aucun contour** ;
- trois tons par objet : base, ombre de même teinte tirée vers le violet/bleu
  (jamais gris, noir ni transparent), reflet en capsule ; lumière en haut à gauche ;
- palette courte et saturée ; l'**indigo** remplace le noir et le marron ;
- traits réservés aux petits détails, **une seule épaisseur**, bouts ronds ;
- arbres en coussins de feuillage empilés sur un tronc indigo, pas en boules ;
- des détails qui racontent une vie plutôt que de la texture ;
- ombres portées pleines, teinte foncée du sol ;
- vue de dessus 3/4, grille lisible ;
- une teinte dominante par famille, sans collision — vert fluo réservé aux mutants ;
- personnages lisibles à petite taille (Adam : sac à dos, écharpe, arc ;
  mutants : tête déformée, bras trop long, halo vert).

## Icônes et HUD

- Une ressource = une icône : `src/data/icons.ts` est un
  `Record<ItemId, PixelIcon>` (12 × 12 px, palette du jeu). Un objet sans
  icône ne compile pas ; `validatePrototypes()` vérifie taille et palette.
- `src/ui/hud.ts` : quête, conseil contextuel (le tutoriel), sac, bulles,
  gains flottants, défaite. `src/ui/screens.ts` : écran titre et pause — la
  simulation ne tourne qu'après « Jouer » et hors pause. Police : Jersey 15,
  embarquée via `@fontsource` (ses chiffres ne se confondent pas).
  Couleurs de l'UI : `--accent`, `--good`, `--danger` dans `style.css`, tirées
  de `PALETTE`. Le panneau de debug ne s'affiche qu'avec `?debug` en dev.
- `src/ui/icons.ts` bake icônes d'objets et vignettes de bâtiments en
  `data:` URL pour le DOM. Le menu de construction est un tiroir derrière un
  seul bouton ; armer un bâtiment passe la carte en mode construction
  (grille + emprises, `render/ghostLayer.ts`).

## Système de sprites

> Transitoire : le rendu affiche encore les placeholders pixel art de
> `pixelmaps.ts` (palette de `legacyPixelArt.ts`) le temps de leur
> migration en SVG. Aucun nouveau visuel ne s'y ajoute.

- `src/data/sprites.ts` : une planche = une grille, une animation par ligne,
  une image par colonne, taille d'image fixe, ancre, cadence.
- `src/render/spriteLibrary.ts` : charge la planche PNG ou bake le
  placeholder, et sert `Texture[]` par animation. Le reste du rendu ne sait
  pas d'où viennent les textures.
- `src/render/entityLayer.ts` : Adam (`AnimatedSprite`, direction + marche,
  profil gauche = miroir du profil droit), chantiers, bâtiments animés.
- Les bâtiments sont vus en 3/4 : planche large comme l'emprise, plus haute
  qu'elle (le toit dépasse), ancrée en (0, 1) au pied de l'emprise.
- Les ressources de surface sont bakées dans la RenderTexture du chunk
  (`chunkLayer.ts`) et rebakées quand la simulation salit le chunk. Une
  ressource peut avoir plusieurs planches (`RESOURCES[id].sprites` : feuillu,
  sapin, arbre mort), tirées par tuile depuis la seed.
- Le décor (`src/data/decor.ts`, planche `decor`) est tiré par `decorAt()`
  (`sim/terrain.ts`) sur les tuiles nues et baké avec le terrain. Il ne se
  heurte pas et n'est jamais de l'état.
- Le sol vient de `render/terrainTiles.ts` : un tileset procédural seedé
  (variantes, transitions entre terrains, ombres portées), dessiné à 16 px
  source comme les sprites.
- Ressenti (rebond, secousse, flash, tremblement de caméra) : des minuteurs
  de vue côté `render/`, jamais de l'état de simulation.
  `render/indicatorLayer.ts` dessine les flèches de bord (mutants, mairie).

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
