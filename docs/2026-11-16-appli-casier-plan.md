# Appli « Casier de tiroir » — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page web où l'on dessine à la souris le plan des boîtes d'un tiroir, et qui télécharge un fichier autonome que n'importe quel Claude Code avec SolidCraft peut construire.

**Architecture:** page statique sans dépendance ni étape de build, hébergée sur GitHub Pages. La géométrie est dans deux modules JavaScript purs, testés avec `node --test` ; l'interface (SVG) ne fait qu'appeler ces modules. Le fichier téléchargé contient le plan, les morceaux attendus et le script SolidCraft.

**Tech Stack:** HTML, CSS, JavaScript (modules ES, sans bibliothèque), Node ≥ 20 pour les tests, Python 3 + `solidcraft-cli` 0.28 pour la vérification de bout en bout.

**Spec:** `docs/2026-11-16-appli-casier-design.md`

## Global Constraints

- Aucune dépendance externe, aucun appel réseau : la page fonctionne hors ligne une fois chargée.
- Toutes les cotes du plan sont des millimètres entiers ; le jeu et les tenons sont calculés à la construction.
- Textes de l'interface en français.
- Valeurs par défaut : jeu 0,5 mm ; plateau 180 mm ; morceau ≤ plateau − 12 mm ; tenon 10 mm de long, un tiers de la paroi, jeu 0,2 mm ; collage à 5 mm ; boîte ≥ 2 × paroi + 10 mm.
- Repère : X = largeur, Y = longueur, origine au coin avant gauche, Z vers le haut.
- Commandes SolidCraft utilisées : `solid.box` uniquement (`operation` new/join/cut, `targets`, `body_name`).
- Chaque morceau est un corps nommé `B<n>-M<m>` (boîte n, morceau m), construit directement, sans découpe de corps.

## Review Focus

1. **Cotes du tiroir modifiées après avoir posé des boîtes** — les boîtes collées au bord qui bouge suivent ce bord ; celles qui sortent du tiroir sont rognées ou supprimées, avec un message ; jamais de boîte hors tiroir. (Tâche 2)
2. **Saisie invalide** — vide, 0, négatif, texte, virgule française (« 0,5 ») : la virgule est acceptée, le reste est refusé avec un message et l'ancienne valeur est gardée. (Tâche 6)
3. **Vide trop étroit au remplissage** — signalé avec sa position ; la validation est bloquée tant qu'il existe. (Tâche 3)
4. **Fichier rouvert invalide** (autre fichier JSON, version inconnue, boîtes qui se chevauchent) — message clair, le plan en cours est conservé. (Tâche 6)
5. **Boîte trop grande dans les deux sens** (plus de 2 morceaux dans chaque sens) et **parois trop fines pour l'enfourchement** (joue < 0,8 mm) — signalées sur la boîte ; la première bloque la validation, la seconde avertit. (Tâche 4)

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | structure de la page |
| `style.css` | apparence |
| `app.js` | interface : dessin SVG, souris, panneaux, annuler/rétablir, mémoire du navigateur, fichier |
| `logique.js` | le plan : collage, rognage, zones libres, bandes, coupe, redimension, remplissage, contrôles |
| `solidcraft.js` | du plan aux morceaux, au script SolidCraft et au fichier téléchargé |
| `tests/logique.test.mjs`, `tests/solidcraft.test.mjs` | tests automatiques |
| `tests/verif_solidcraft.py` | exécute le script dans `solidcraft-cli` et compare chaque corps à un calcul indépendant |
| `tests/plans/*.json` | plans d'essai, dont le croquis du 16 novembre |

Types communs : `Rect = {x, y, largeur, longueur}` ; `Tiroir = {largeur, longueur, hauteur, epaisseur, epaisseur_fond, jeu, plateau}` ; `Boite = Rect & {auto: boolean}` ; `Plan = {version: 1, tiroir, boites}`.

### Task 1 : dépôt et squelette

**Files:** Create `index.html`, `style.css`, `app.js`, `logique.js`, `solidcraft.js`, `package.json` (`"type": "module"`, script `test: node --test tests/`), `README.md`.

- [ ] Créer le dépôt local, `index.html` avec les trois zones (tiroir, plan, liste) vides.
- [ ] Un test trivial dans `tests/logique.test.mjs` ; `npm test` passe.
- [ ] Commit.

### Task 2 : le plan (`logique.js`)

**Produces:**
- `tailleMin(tiroir) → number`
- `coller(rect, boites, tiroir, tol = 5) → Rect`
- `rogner(rect, ancre, boites, tiroir) → Rect | null` (plus grand rectangle sans chevauchement qui contient le coin `ancre` ; `null` si trop petit)
- `zoneLibre(point, boites, tiroir) → Rect | null` (plus grand rectangle libre contenant le point)
- `bande(zone, sens: 'colonne'|'rangee', cote: 'gauche'|'droite'|'bas'|'haut', mm) → Rect`
- `couper(boite, sens, {parts} | {premiere}) → Rect[]`
- `redimensionner(boites, index, bord, valeur, tiroir) → Boite[] | {erreur}`
- `changerTiroir(plan, nouveauTiroir) → {plan, messages}`

Tests (écrits d'abord, un par ligne) :
- [ ] `coller` : bord à 3 mm du tiroir → 0 ; à 7 mm → inchangé ; bord à 4 mm d'une boîte → collé.
- [ ] `rogner` : tracé qui mord une boîte → s'arrête à son bord ; ancre dans une boîte → `null` ; résultat sous la taille minimale → `null`.
- [ ] `zoneLibre` : tiroir vide → tout le tiroir ; colonne de gauche posée → le reste ; point dans une boîte → `null`.
- [ ] `bande` : colonne gauche de 100 dans une zone 225 × 405 → `{x: zone.x, largeur: 100, longueur: 405}` ; cote plus grande que la zone → toute la zone.
- [ ] `couper` : 3 parts d'une boîte de 405 → 135, 135, 135 ; 4 parts de 405 → 101, 101, 101, 102 (le reste à la dernière) ; `premiere: 100` → 100 puis 305 ; part sous la taille minimale → erreur.
- [ ] `redimensionner` : tirer un bord sur une voisine → refusé ; bord tiré à 3 mm du tiroir → collé.
- [ ] `changerTiroir` (Review Focus 1) : largeur 325 → 300, boîte collée à droite → suit ; boîte entièrement hors tiroir → supprimée avec message.
- [ ] Implémenter, tests verts, commit.

### Task 3 : remplissage et contrôle du plan (`logique.js`)

**Produces:** `remplir(boites, tiroir) → {ajoutees: Boite[], trop_etroits: Rect[]}` ; `controler(plan) → string[]` (vide = plan correct : boîtes dans le tiroir, sans chevauchement, couvrant tout).

- [ ] Tests : tiroir vide → une boîte ; plan du croquis moins une boîte → exactement la boîte manquante ; vide en L → deux rectangles ; vide de 6 mm de large → dans `trop_etroits`, pas de boîte (Review Focus 3) ; `controler` détecte un chevauchement et un trou.
- [ ] Implémenter : grille des coordonnées distinctes, puis rectangles gloutons (étendre en X puis Y, et l'inverse ; garder le plus grand). Tests verts, commit.

### Task 4 : les morceaux (`solidcraft.js`)

**Produces:** `morceaux(plan) → {morceaux: Morceau[], alertes: {boite, niveau: 'bloquant'|'avertissement', texte}[]}` avec `Morceau = {nom, boite, x, y, largeur, longueur, hauteur, volume_mm3, tenons: [...], fourches: [...]}`.

Règles : contour = zone rétrécie de `jeu / 2` sur chaque côté qui ne touche pas le bord du tiroir ; `n = max(1, ceil(cote / (plateau − 12)))` morceaux égaux par sens ; à chaque coupe, tenon sur le morceau de coordonnée basse et fourche sur l'autre, sur chaque paroi traversée ; `largeur`/`longueur` du morceau incluent le tenon.

- [ ] Tests : boîte 100 × 150 au coin → 1 morceau, contour 99,75 × 149,75 ; boîte de 405 de long → 3 morceaux, le plus long ≤ 168 ; volume d'une boîte simple = formule fond + parois ; boîte 250 × 250 → 2 × 2 morceaux ; boîte 400 × 400 → alerte bloquante (Review Focus 5) ; paroi de 2 mm avec une coupe → avertissement « joue trop fine ».
- [ ] Implémenter, tests verts, commit.

### Task 5 : script SolidCraft et fichier (`solidcraft.js`, `tests/verif_solidcraft.py`)

**Produces:** `script(plan) → {commands: [...]}` ; `fichier(plan) → objet` au format de la spec (`version`, `consigne`, `tiroir`, `boites`, `morceaux`, `script_solidcraft`) ; `lireFichier(texte) → {plan} | {erreur}`.

Construction d'un morceau : `solid.box` du fond (`body_name` = nom) ; `solid.box` `join` pour chaque paroi présente et chaque tenon (`targets: [nom]`) ; `solid.box` `cut` pour chaque fourche (`targets: [nom]`).

- [ ] Tests JS : `lireFichier(JSON.stringify(fichier(plan)))` redonne le plan ; fichier d'une autre nature ou version 2 → `erreur` (Review Focus 4) ; chaque commande ne vise que son morceau.
- [ ] `verif_solidcraft.py <fichier>` : extrait le script, `solidcraft-cli eval`, compare chaque corps (nom, boîte englobante, volume, fermé) au champ `morceaux` **et** à un calcul indépendant par empreinte (repris de la vérification déjà utilisée pour `casier-boites.sc`).
- [ ] Le lancer sur 5 plans de `tests/plans/` : croquis du 16 novembre, une seule boîte, boîte 2 × 2, boîtes longues à 3 morceaux, plan rempli automatiquement. Tous verts, commit.

### Task 6 : l'interface (`index.html`, `style.css`, `app.js`)

- [ ] Panneau tiroir : champs avec virgule acceptée, refus des valeurs invalides avec message (Review Focus 2).
- [ ] Plan SVG à l'échelle, grille 1 mm / 10 mm, zoom molette, cotes affichées.
- [ ] Tracer une boîte (cotes en direct, collage, rognage) ; bande rapide sur une zone libre.
- [ ] Sélection : couper (parts égales, première cote, clic), redimensionner (bord ou cote tapée), supprimer.
- [ ] Coupes d'impression en pointillé, alertes sur les boîtes, liste à droite.
- [ ] Annuler / rétablir ; mémoire du navigateur ; rouvrir un fichier (Review Focus 4).
- [ ] Valider : remplissage montré dans une autre couleur, confirmation, téléchargement de `casier-AAAA-MM-JJ.json` ; bloqué tant qu'une alerte bloquante ou un vide trop étroit existe.
- [ ] Commit par fonction.

### Task 7 : essai dans le navigateur

- [ ] Refaire le croquis du 16 novembre en 5 gestes, valider, passer le fichier dans `verif_solidcraft.py`.
- [ ] Essais des cas de Review Focus à la main ; affichage en fenêtre étroite ; thème clair et sombre.

### Task 8 : mise en ligne et essai « poste vierge »

- [ ] Pousser sur `kof30190/casier-tiroir`, activer GitHub Pages sur la branche `main`, vérifier `https://kof30190.github.io/casier-tiroir/`.
- [ ] Donner un fichier téléchargé à un Claude sans contexte, dans un dossier vide : il doit construire, contrôler et exporter un 3MF par morceau en ne lisant que le fichier.
- [ ] Ouvrir un 3MF exporté dans Bambu Studio en ligne de commande pour confirmer qu'il se tranche sur l'A1 mini.
