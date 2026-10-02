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

**Mécanique centrale** — Adam n'a pas de bouton d'action. Il récolte **de
proximité** : toutes les 10 ticks, les arbres et rochers à portée (quatre au
plus, du plus proche au plus loin) lâchent une unité (bois, fer, charbon,
pierre), qu'il marche ou non. Il **heurte** le reste : un chantier heurté
reçoit ce qu'il attend ; une foreuse ou une ferme heurtée vide son coffre
dans le sac (« Tout prendre » dans sa fenêtre), ce qui la relance si elle
était bloquée. Une foreuse ne se pose que sur un filon (refus `noOre`) :
armée, elle montre les filons autour d'Adam, rochers compris — on casse le
rocher, puis on pose la foreuse à sa place. Rochers et bâtiments sont solides ; d'un arbre, seul le tronc
l'arrête et il glisse autour — une forêt n'est jamais un mur. Un tap sur un
chantier ouvre sa fenêtre : « Transférer » y vide d'un coup ce qu'il attend
— le sac d'abord, puis le stock de la ville s'il est dans son rayon.
**Le dernier objet livré achève le chantier**, sans bouton de validation
(poussière, rebond, son, « Mairie bâtie ! » qui flotte) — sauf dans le
rayon d'un poste de construction, où ses bâtisseurs le bâtissent ensuite.
« Annuler le chantier » (`cancelSite`, pas la mairie) rend le livré à la
ville, ou le pose au sol sans mairie.
Sous la barre d'un chantier, une rangée d'icônes dit chaque objet du coût
en « livré/requis » (`render/siteNeeds.ts`) : complet, estompé et pastille
menthe ; à sec — la ville n'en a plus, rien en route —, en corail. Elle
s'efface au dézoom et au marteau. Sa fenêtre détaille livré / en route /
en ville ; tout se déduit de `World.siteLedger` (`sim/siteLedger.ts`).
Une nurserie ou une forge heurtée (ou « Transférer » : le sac, puis la ville
dans son rayon) reçoit ce que sa recette consomme ; la forge (débloquée à la nuit 1, `unlockNight`)
fond fer + charbon en plaques de fer, qui renforcent la tour de guet :
sa fenêtre propose « Renforcer » (niveaux d'amélioration, `upgrades` de
`data/buildings.ts`, commande `upgradeBuilding`, payée sac puis ville).
Le **four à charbon** (`charcoalKiln`, débloqué avec la forge, un ouvrier)
est une forge sur sa propre recette (`burnCharcoal` : 3 bois → 1 charbon) :
une forge trouve la sienne par son id (`recipeOf`, une seule par bâtiment).
Les porteurs ravitaillent les forges depuis la ville et rapportent leurs
sorties (plaques, charbon) à la mairie ; leurs entrées restent au four.

**Ville et sac** — deux stocks. Le **sac** (`player.inventory`, plafonné)
est ce qu'Adam porte ; la **ville** est le coffre de la mairie
(`World.townStock()`), rempli par Adam (« Déposer en ville », la zone
d'échange de sa fenêtre, ou en la heurtant) et par les porteurs. La fenêtre
d'un bâtiment à coffre (mairie, producteurs, forge, nurserie) a une **zone
d'échange** (`ui/transferPanel.ts`, logique dans `sim/transfer.ts`, commande
`transferItems`) : coffre et sac en deux bandes, un tap passe un objet de
l'autre côté (1 / 10 / Tout), « Tout prendre » / « Tout déposer » ; le sac ne
prend que ce qui rentre, le réservé reste au coffre, un coffre filtré grise
le reste. Les chantiers
puisent dans les deux, la ville seulement dans son rayon (`logisticRadius`,
`sim/warehouse.ts`, le cercle jaune du mode construction). Le HUD
les montre en deux cartes compactes ; le sac (tap, ou touche I) ouvre
`ui/inventoryPanel.ts`, sans pause, comme la fenêtre d'un bâtiment. Sa
section Ville est un tableau de bord (`sim/flows.ts`, `World.flows`) : débit
net par objet sur deux minutes (anneau d'échantillons, pas sauvegardé) et
deux alertes au plus — pénurie d'une recette, surplus que rien n'utilise —
dont le tap pointe un repère de bord vers le bâtiment en cause. Loin de
la mairie, « Jeter » pose le sac au sol en tas (le mobile `pickup` du
butin, avec `amount`), qu'Adam reprend après s'en être éloigné.
Tant que la mairie n'est pas debout, Adam ne récolte d'un objet que ce
qu'on en attend (`World.wanted` : chantiers, recettes) plus une réserve
(`SPARE_CARRY`) ; au-delà, il n'en prend plus (`harvestRefused`,
signalé). Ensuite la ville prend tout, sauf ce dont elle a déjà assez
(`TOWN_PLENTY`, `data/items.ts`) : cet objet-là, il n'en ramasse plus en
passant que pour un chantier ou une recette. Le conseil ne dit de livrer que si le sac contient ce qu'on attend.

**Routes** — la pierre en trop devient des chemins (`data/roads.ts`,
`sim/roads.ts` : un ensemble de tuiles par chunk, sauvegardé). Carte
« Route » au bas du tiroir : on glisse le doigt de tuile en tuile (40 au
plus), « Poser » pave, une pierre par tuile, sac puis ville dans son rayon,
sans chantier (`paveRoad`, jugé par `World.roadPlan`). Adam, porteurs,
bûcherons et bâtisseurs y vont 1,6 fois plus vite (`onRoad`, lu par
`walkToward` et le pas d'Adam) ; mutants et bêtes, non. « Retirer » (le
marteau, `removeRoad`) rend la pierre ; une route bloque la pose d'un
bâtiment (refus `road`). Dalles raccordées (`art/road.ts`, seize masques)
bakées avec le sol : un pavage rebake le bloc.

**Débouchés** — tout objet entre dans un coût de bâtiment ou une entrée de
recette (`src/data/recipes.ts`) ; `validatePrototypes()` refuse une
ressource qu'on récolterait pour rien.

**Ouvriers** — chaque bâtiment déclare `workers` ; la maison des
constructeurs et la ferme en emploient quatre, comptés dans la population
une fois le bâtiment fini. Ceux de la maison sont des **porteurs** (mobile
`worker`, `src/sim/workers.ts`, `PORTERS` dans `src/data/workers.ts`) : ils
vident foreuses, fermes et cabanes de bûcheron dans la mairie et livrent les chantiers,
la forge et la nurserie depuis la mairie (`sim/consumers.ts` ; une machine en
famine d'abord, `JOB_PRIORITY.starving`). Un job est réservé des deux côtés **à sa création**
(`src/sim/jobs.ts` : `Store.reserveOut`/`reserveIn`, registre des chantiers)
— décider sur `available()`, jamais sur le stock brut. Ligne droite, jamais
à travers l'eau ; à l'abri chez eux pendant une vague. Les réservations ne sont pas sauvegardées : elles se
rejouent depuis les jobs au chargement.
La **cabane de bûcheron** loge deux **bûcherons** (mobile `lumberjack`,
`LUMBERJACKS` dans `src/data/workers.ts`, choix de l'arbre dans
`src/sim/lumberjacks.ts`) : l'arbre le plus proche dans son rayon (cercle
mint au placement et à la sélection), réservé — jamais deux sur le même —,
coupé une unité par coup comme par Adam, le bois rapporté au coffre de la
cabane, que les porteurs vident (priorité d'une foreuse). Coffre plein, ils
attendent devant la porte. Depuis sa fenêtre, un producteur (foreuse,
ferme, forge, nurserie, cabane) se met **en pause** (`pauseBuilding` : il ne
produit ni ne consomme, ses ouvriers finissent leur geste, bulle ⏸ et sprite
pâli sur la carte), et un bâtiment qui emploie règle ses ouvriers entre
`minWorkers` et `workers` (`setWorkers`, sélecteur − / + ; zéro vaut pause) :
`sim/staffing.ts` répartit la population de la ville par id, un poste sans
ouvrier libre reste vide, « ouvrier manquant ».
La **carrière** (`quarry`, trois ouvriers, coût tout en bois) taille la
pierre dans les ruines, sans rocher, comme une ferme sa nourriture (recette
`cutStone`) ; porteurs et logisticiens la vident.
Le **poste de logistique** (`logisticsPost`, kind `depot`) loge quatre
**logisticiens** (des `worker` à `logistician: true`, `LOGISTICIANS` dans
`src/data/workers.ts`, caisse au dos) : ils ne font que vider les
producteurs de son rayon (cercle cyan) dans la mairie, le coffre le plus
rempli d'abord (`Crew` de `JobBoard.assign`). Un producteur couvert par un
poste n'est plus l'affaire des porteurs, qui livrent les chantiers.
Le **poste de construction** (`constructionPost`, kind `yard`) loge quatre
**bâtisseurs** (des `worker` à `builder: true`, `BUILDERS` dans
`src/data/workers.ts`, casque jaune et marteau) : ils livrent depuis la
mairie les chantiers de son rayon (cercle violet), le plus ancien d'abord,
puis, tout reçu, les bâtissent au marteau (`Site.work` jusqu'à
`siteWork()`, `BUILDERS.perSite` ensemble au plus ; `Worker.build`). Un
chantier couvert par un poste qui tourne n'est plus l'affaire des porteurs ;
poste en pause, à zéro ou tombé : ses chantiers prêts s'achèvent aussitôt,
les autres reviennent aux porteurs et à Adam.
Un ouvrier sans travail **flâne** devant chez
lui (`wander()`, hachage de la seed, sans PRNG ni chemin) et ne rentre que
le soir (crépuscule, nuit) ou pendant une vague.
**Âge** (`data/inhabitants.ts`, `sim/inhabitants.ts`) — chacun a un `age`,
sauvegardé, qui prend un an à chaque aube (`ageInhabitants`) ; un adulte
arrivé tout fait a un âge haché de la seed et de son id, son prénom aussi
(`nameOf`, jamais stocké). L'enfant sort de la nurserie à 10 ans et n'est
affecté à rien ; à 14, il devient un porteur `grown` sous le même id, logé à
sa nurserie, hors des postes comme un ex-mutant (toast « Lina a 14 ans… »).
Un ouvrier dehors sans tâche depuis `IDLE.graceTicks` est **inactif**
(`World.isIdle`, compte non sauvegardé) : le rendu le fait glander (assis,
adossé, s'étire, bâille avec bulle « zzz »), le HUD compte au travail /
inactifs / enfants (`World.census`), et un tap sur les inactifs y jette un
coup d'œil, puis le suivant ; un tap sur un habitant montre son infobulle.

**Jour et nuit** — dès que la mairie est debout, le cycle démarre
(`src/data/dayNight.ts`, horloge pure dans `src/sim/dayNight.ts`) : une
journée sans mutant (~3 min), un crépuscule (carte teintée indigo, lampions
allumés, « La nuit tombe — rentrez »), une nuit de trois vagues (~100 s, la première 15 s après la tombée), puis
l'aube : les mutants restants fuient et le butin tombe dans le sac. Le rendu
(`render/nightLayer.ts`) n'applique que la teinte : un quad `multiply` et des
lueurs `add`, pas de filtre. Le HUD l'affiche en **horloge** au bout de la tête
de la quête (`World.dayDial`, `DIAL_ARCS` : aube, jour, crépuscule, nuit à
leurs vraies durées ; cadran `dayDialSvg` de `art/ui.ts`) : l'aiguille porte
le soleil, la lune la nuit, « J2 » à côté (un de plus à chaque aube) ; à
`DAY_DIAL.nightWarning` de la nuit, elle bat en corail ; un tap dit « Jour 2 ·
nuit dans 1:31 » (c'est aussi son `aria-label`).

**Menace** — la nuit, des **mutants** arrivent par
vagues (`src/data/enemies.ts`) et marchent droit sur la cible de leur vague
(`Mutant.target`, sauvegardée) : une fois sur deux le bâtiment de l'usine
fini le plus proche de leur apparition (`WAVES.targets` : foreuse, ferme,
carrière, cabane, forge), sinon la mairie, qui reprend la main si la cible
tombe ; ils traversent tout sauf le bâti, qu'ils cassent. Un bâtiment de
l'usine abattu redevient son chantier, à moitié livré (`RUIN`). Une vague
s'annonce trois secondes avant (bandeau avec sa direction et sa cible, cor grave, léger recul de caméra vers elle —
pas si un bâtiment est armé ou une fenêtre ouverte, et un tap n'ouvre rien
pendant que la carte glisse),
surgit dans le champ d'une flaque vert fluo — un mutant qui émerge
(`WAVES.emergeTicks`) n'est pas visable — et finit sur « Nuit N — vague repoussée ! » ;
tout ennemi abattu (mutant, crabe, loup) lâche au sol le butin de sa table
(`loot`, tirée du PRNG du monde ; `LOOT_DROPS`, `src/sim/loot.ts`) qu'Adam
ramasse en marchant dessus — sac plein, il reste au sol. L'arc d'Adam et la tour de guet
(`src/data/weapons.ts`) tirent seuls. La mairie à zéro = partie perdue.
La courbe est une table, nuit par nuit (`NIGHT_PLAN`) : pic à la nuit 3,
répit après chaque grosse nuit, un **gros mutant** (`brute`) dès la nuit 5 ;
au-delà, les cinq dernières se répètent en plus gros. Aux nuits 10, 15, 20…
la **Reine des flaques** (`queen`, `QUEEN`) mène la dernière vague :
annoncée la veille au crépuscule par Ève, compte à rebours au bandeau
(`World.queenCountdown()`). Phase 1, elle marche sur la mairie et pond des
larves (`larva`) ; sous la moitié de ses PV, elle plonge (`stepQueen`,
`sim/enemies.ts`) et ressort à quatre cases de la tour la plus proche, qu'elle
charge pour la raser — des tours qui se couvrent. Jamais assommée (`stunnable`) ; à
l'aube, elle repart ; abattue, elle lâche un **cœur radioactif** (`radCore`). Adam **répare** un
bâtiment abîmé en le heurtant avec du bois, ou via « Réparer » (sac puis
ville ; `REPAIR`, `src/data/buildings.ts`). Frappée hors écran, la mairie
sonne l'alarme : bord rouge, repère qui clignote, vibration.
`src/sim/defense.test.ts` mesure l'équilibre (Adam immobile, Ève qui répare :
deux tours passent la nuit 9, et celle de la Reine si l'on répare, une seule
tombe aux nuits 8–10 ; l'usine isolée, AFK, y laisse des plumes en six nuits,
deux tours par bâtiment la sauvent ; deux tours de base, la Reine en rase
une ; quatre renforcées, elle tombe avant l'aube).
La **nurserie** fait naître un enfant toutes les trois minutes, contre six
nourritures (recette `raiseChild`) : sans elles, elle attend.

**Clinique** (`src/data/clinic.ts`, débloquée après la vague 1) — tant
qu'elle a une place, un mutant vaincu peut tomber **assommé** (étoiles, pas
de butin) au lieu de s'évaporer : mobile `patient`, ni ennemi ni cible.
Adam le touche, il le suit en boitillant jusqu'à la porte ; après une
« nuit » de soins (deux minutes : pas de cycle jour-nuit), il en ressort
**ex-mutant**, un porteur logé à la clinique, plus fort et plus lent
(`EX_MUTANT`, `src/data/workers.ts`). Ses places comptent patients et
ex-mutants logés : une clinique pleine n'assomme plus personne. Oublié dix
secondes, ou sans clinique, l'assommé s'évapore et lâche son butin.

**Ève** — ingénieure bricoleuse, taquine (`src/data/eve.ts`, `src/sim/eve.ts`).
Elle **tutoie** Adam, qui reste muet ; le jeu (bulles, boutons, écrans)
**vouvoie** le joueur. Les conseils du HUD sont ses répliques, par radio
tant qu'elle n'est pas là. Elle arrive en vélo-cargo une fois la nuit 3
repoussée (population : 2 adultes), vit devant la mairie, répare le bâti
entre les vagues, et se tape pour lui parler (bulle au-dessus d'elle,
jamais bloquante). Elle porte la chaîne de quêtes (`src/data/quests.ts`) :
chaque quête récompense un **plan** (un bâtiment `plan: true` n'entre au
menu qu'une fois donné) ou un **outil**. Seul `questsDone` est de l'état.

**Caravane de troc** (`src/data/caravan.ts`, `src/sim/caravan.ts`) — à
partir du jour 4, un jour sur deux, 30 s après l'aube, une charrette (mobile
`caravan`, sauvegardé) se gare à 8 cases de la mairie pour 90 s. Au
contact, la fenêtre Troc (`ui/caravanPanel.ts`) propose ses échanges, tirés
de la seed et du jour : surplus de la ville → ce qui lui manque (5 pour 1),
butin → plaque de fer, une offre rare plafonnée sur la partie
(`rareTrades`). Commande `trade`, une fois par échange, payée sac puis ville.

**Labo de recherche** (`src/data/research.ts`, `src/sim/research.ts`, un
seul par colonie : `unique`) — on y choisit une recherche, on dépose son coût
(sac, ville dans le rayon, porteurs, ou en le heurtant), puis le compte à
rebours tourne ; une à la fois. Le coût mêle objets communs et **butin
d'ennemis** : gelée de mutant, croc de loup, pince de crabe, objets qu'on ne
récolte nulle part. Un effet est un modificateur additif sur une
statistique, lu en un seul point, `World.bonus(stat)` ; les données ne
bougent pas. `researchDone` est de l'état ; la recherche en cours est celle
du labo. La fenêtre du labo est le panneau Recherche (`ui/researchPanel.ts`).

**Objectifs** — la partie est une chaîne d'objectifs en données
(`src/data/objectives.ts`, jugés par `src/sim/objectives.ts`) : mairie,
3 nuits (Ève arrive), les demandes d'Ève (ses quêtes), foreuse et 20 fer,
premier enfant, 5 nuits de plus → « Acte I terminé » (`banner`), puis
l'**Antenne** → victoire « Le Signal », puis la partie sans fin.

**L'Antenne** (`antenna`, kind `antenna`, unique, 3 × 3) — débloquée par
l'objectif 7 (`unlockObjective`), posée à 8 cases au moins de la mairie,
de centre à centre (`hallDistance`, refus `nearHall`, disque corail du
mode construction). Trois étages : le premier est un chantier ; les deux
autres sont ses `upgrades`, mais **livrés** dans son coffre comme un
chantier — heurt, « Transférer » (`supplyBuilding` : sac puis ville),
porteurs — et l'étage monte quand tout y est (`sim/antenna.ts`, la
commande `upgradeBuilding` refuse : `delivered`). Chaque étage fini fixe
`World.lureNight` : cette nuit-là, toutes les vagues la visent (la Reine
garde la mairie). Abattue au-dessus du premier étage, elle n'en perd qu'un.
Le troisième lance le Signal (`signalSent` : l'émetteur s'allume, ondes
`SIGNAL_WAVES` de `render/signalLayer.ts`, Ève : « Quelqu'un répond ! »),
puis l'écran du Signal. Ensuite, chaque aube, `SURVIVORS` (1 à 3, PRNG du
monde) survivants arrivent : des porteurs `survivor` logés à la mairie. Le
record « nuits tenues après le Signal » (`World.nightsAfterSignal()`) vit
sous sa propre clé (`storage/localRecord.ts`, à côté du jardin) et
s'affiche à l'écran titre.
Le panneau du haut affiche toujours l'objectif courant (la quête d'Ève en
cours dessous) ; le conseil d'Ève retombe sur celui de l'objectif. Chaque
objectif réussi a sa célébration (son, pluie de feuilles, bandeau) et une
récompense concrète (objets, places de sac, réparation de la mairie). Ce
qui est fait en avance compte ; les nuits à « tenir » se comptent depuis
le début de l'objectif. Une condition qui n'attend qu'une horloge (naissance,
nuit à tenir : `goalWait`/`objectiveWait`) affiche son temps restant, ou en
corail ce qui la retient ; Ève enchaîne alors sur de quoi s'occuper
(réparer, une tour, l'objet le plus bas en ville, une recherche).

**Faune** — en plus des mutants, des **crabes** vivent sur le sable et des
**loups** au cœur des forêts (`WILDLIFE`, `src/data/enemies.ts` ;
`src/sim/wildlife.ts`). Leurs tanières se tirent de la seed par chunk ; une
tanière se peuple hors de la vue d'Adam et loin du village, sous un
plafond. Ils ne s'en prennent qu'à Adam (qui a des PV et se réveille à la
mairie s'il tombe) ; l'arc d'Adam vise l'ennemi le plus proche, bête ou
mutant, et le marque (`player.target`) ; les tours ne visent que les mutants.

**Météo** — lue dans la seed et le temps de jeu, jamais stockée
(`src/data/weather.ts`, `src/sim/weather.ts`) : pluie acide (Adam ralenti,
bâtiments abîmés rongés, sauf à l'abri près de la mairie), coup de vent
(flèches en arc, mutants poussés), brouillard (portée des arcs réduite),
arc-en-ciel radioactif (récolte doublée). Annoncée 10 s à l'avance ; une
météo `harsh` ne tombe jamais sur une nuit de vagues (`spoilsNight`). Rendu en `ParticleContainer`
(`render/weatherLayer.ts`).

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
- une teinte dominante par famille, sans collision — vert fluo réservé aux
  mutants (seule exception : la touffe de l'ex-mutant, un humain orange) ;
- personnages lisibles à petite taille (Adam : sac à dos, écharpe, arc ;
  mutants : tête déformée, bras trop long, halo vert).

## Icônes et HUD

- Une ressource = une icône : `src/data/icons.ts` est un
  `Record<ItemId, string>` (un SVG de 24 × 24, helpers de la DA). Un objet
  sans icône ne compile pas ; `validatePrototypes()` vérifie cadre et règles.
- `src/ui/hud.ts` : quête, conseil contextuel (le tutoriel), sac, bulles,
  gains flottants, défaite. `src/ui/screens.ts` : écran titre et pause — la
  simulation ne tourne qu'après « Jouer » et hors pause. Police arrondie :
  Fredoka, embarquée via `@fontsource` (ses chiffres ne se confondent pas).
  L'interface suit les règles des sprites : cartes blanches et capsules,
  trois tons (couleur, « face avant » pleine plus sombre, reflet en capsule),
  aucun contour ; couleurs de `PALETTE` recopiées en variables dans
  `style.css` (`--accent`, `--good`, `--danger`…). Pas d'emoji : les
  pictogrammes sont des SVG de `src/art/ui.ts`. Le panneau de debug ne
  s'affiche qu'avec `?debug` en dev.
- `src/ui/icons.ts` sert icônes d'objets, vignettes de bâtiments et
  pictogrammes (`src/art/ui.ts`) en `data:` URL SVG pour le DOM. Le menu de construction est un tiroir derrière un
  seul bouton, « Bâtir » — aucun autre bouton ne porte ce libellé ; armer un bâtiment passe la carte en mode construction
  (grille + emprises, `render/ghostLayer.ts`).
- La fenêtre d'un bâtiment (`ui/buildingPanel.ts`) laisse voir le jeu : vignette
  et nom en tête, phrase d'ambiance derrière (i), points de vie en une ligne
  (cœur, barre, nombre), ce qui se compte en puces pictogramme + nombre — un
  tap affiche le libellé, aussi en `aria-label` —, le coffre en pictogramme
  au-dessus de ses objets.

## Système de sprites

- **Un sprite = un module de `src/art/`** qui construit son SVG avec les
  helpers de `artDirection.ts`, en **morceaux** (`parts`) du même cadre :
  un corps par direction et un pied pour un personnage ; `site`, `built`,
  `damaged` pour un bâtiment (+ `wheel` pour la foreuse, `crops` pour la
  ferme) ; `full`, `damaged` pour une ressource. Cadre et ancre en pixels
  monde (tuile = 32 px). `src/data/sprites.ts` est le registre ; `art/` est
  soumis à la même frontière que `data/` (ni Pixi ni DOM).
- `src/render/spriteLibrary.ts` rastérise chaque morceau **une fois** au
  chargement, à la résolution de l'écran (`devicePixelRatio`, plafonné à 3),
  dans un atlas (une page de 2048 px de large ; ~100 images tiennent dans
  une texture). Le reste du rendu ne voit que des `Texture`. Le panneau
  `?debug` affiche pages, mégapixels et temps de chargement.
- Animation **par morceaux**, pas par planches : `render/puppet.ts` anime
  Adam, les mutants, les enfants et les ouvriers (pieds qui alternent, rebond, écrasement
  à la frappe, arc qui se tend, grimace au coup reçu, boitillement d'un patient) ; la roue de la foreuse
  tourne, les cultures ondulent ; un mutant mort s'écrase et s'efface ; un
  porteur a sa charge (l'icône de l'objet) sur la tête.
- Les bâtiments sont vus en 3/4 : cadre large comme l'emprise, plus haut
  qu'elle (le toit dépasse), ancré en (0, 1) au pied de l'emprise. Sous la
  moitié de ses points de vie, un bâtiment montre `damaged`.
- Arbres et rochers sont des sprites (`render/resourceLayer.ts`) triés en
  profondeur avec les bâtiments et les personnages : ils montent au-dessus
  de leur tuile, Adam passe derrière. Une ressource peut avoir plusieurs
  sprites (`RESOURCES[id].sprites` : feuillu, sapin, arbre mort), tirés par
  tuile depuis la seed.
- Le sol (`src/art/terrain.ts` : damier d'herbe, sable, eau, roche,
  transitions, coins arrondis) et le décor (`src/data/decor.ts`, sprite
  `decor`, tiré par `decorAt()`) sont bakés par blocs de 16 × 16 tuiles
  (`render/chunkLayer.ts`, résolution plafonnée à 2) et jamais rebakés : ils
  ne changent pas. Le décor ne se heurte pas et n'est jamais de l'état.
  L'eau a trois profondeurs bakées, sans reflet baké ; son écume en bulles
  (le ressac) et ses vaguelettes (des croissants qui naissent, dérivent et se
  résorbent, par la taille) sont des sprites par-dessus (`render/waterLayer.ts`), par blocs, cachés et
  immobiles hors de l'écran, figés sous `prefers-reduced-motion`.
- Ombres portées : capsules pleines dans la teinte foncée du sol sous
  l'objet (`TerrainTiles.shadow`), dans un conteneur sous tout le reste.
- Ressenti (rebond, secousse, tremblement, flash, caméra) : des minuteurs
  de vue côté `render/`, jamais de l'état de simulation.
  Le **zoom** du joueur (`Camera.level`, bornes `ZOOM` : 0,6–1,5) se
  pilote aux trois boutons du bord droit (`ui/zoomControls.ts` : avancer,
  revenir sur Adam, reculer), à la molette sous le curseur et au pinch
  (`input/zoom.ts`, le geste à deux doigts de `PointerDispatch`, qui ne
  prend que des doigts libres ou de tap) ; mémorisé sous
  `mobile-factory:zoom` (`storage/localZoom.ts`), jamais dans la partie.
  `render/indicatorLayer.ts` dessine les repères de bord (mutants, mairie,
  gisement que réclame le conseil — `sim/deposits.ts`), jamais sous le HUD ;
  taper celui de la mairie y jette un coup d'œil (`Camera.peek`).
- L'icône (favicon, PWA) et la bannière du README sont des scènes SVG
  composées avec les sprites (`src/art/brand.ts`) ; `npm run art:brand`
  écrit les pages à rastériser et affiche les commandes Chrome qui
  produisent `public/icon.png`, `public/favicon.png` et `docs/banner.png`.
- Relire un visuel : `npm run art:sheet -- planche.svg`, puis
  `google-chrome --headless --screenshot=planche.png --window-size=L,H planche.svg`
  et ouvrir le PNG avec `Read`.

## Son

Chaque son est un échantillon de `public/audio/sfx/` (`.ogg`, repli `.m4a`) :
jingles acoustiques générés avec Lyria 3, bruitages réels CC0 (sources dans
son `CREDITS.md`). `audio/samples.ts` les charge au premier geste, un par
un, et tient la table des gains et des variantes ; tant qu'un fichier n'est
pas décodé, le son retombe sur sa synthèse Web Audio (`synth.ts`). La
musique de fond est un fichier (`public/audio/music/`,
Ogg Vorbis puis repli `.m4a` pour Safari ; `audio/music.ts`) : préchargée
sans retarder l'écran titre, bouclée par un `AudioBufferSourceNode`, coupée
onglet caché, interrupteur « Musique » dans la pause (`mobile-factory:music`).
Un nouvel effet = une entrée dans `SOUNDS` (`synth.ts`), une dans
`SAMPLES` (`samples.ts`) avec ses fichiers et leur crédit, et une
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
  du joueur (`sim/resources.ts`, entités) sont de l'état. Le départ aussi se
  tire de la seed, avec son foyer : bosquet, filon de pierre (≤ 12 tuiles) et
  de fer (≤ 20) à portée de pas d'Adam — `terrain.test.ts` le vérifie sur
  1 000 seeds — et une clairière qui ouvre sur au moins 400 tuiles (l'eau et
  les rochers ferment, pas les arbres).
- Sauvegarde automatique : `sim/save.ts` sérialise le monde (format versionné
  `{ version, savedAt, state }`, validé à la lecture) ; `storage/localSave.ts`
  est le seul à toucher au `localStorage` (clé `mobile-factory:save`), et tout
  y est dans un try/catch. Un nouvel état de simulation doit entrer dans
  `World.snapshot()` / `restore()` — sinon il se perd au rechargement ; un
  changement incompatible incrémente `SAVE_VERSION`.
- Le **jardin des souvenirs** (graines laissées par chaque colonie tombée,
  bonus plantés, « Partie pure ») n'est pas l'état d'une partie : format
  versionné dans `sim/garden.ts`, clé dédiée `mobile-factory:garden`
  (`storage/localGarden.ts`), jamais effacé par « Recommencer ». Les bonus
  sont de la donnée (`src/data/perks.ts`) et entrent dans la partie par la
  commande `applyPerks`, au départ d'une nouvelle colonie seulement.
- Le contenu est de la donnée (`src/data/*.ts`, `as const satisfies`).
  `validatePrototypes()` tourne au démarrage en dev et dans les tests.
- Pas d'ECS, pas de moteur physique, pas de multijoueur.

## Vérifier avant de pousser

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
