# Appli « Casier de tiroir » — description validée

Date : 16 novembre 2026

## But

Dessiner très simplement, à la souris, le plan des boîtes d'un tiroir de cuisine, puis faire
construire ces boîtes dans SolidCraft, découpées si besoin pour tenir sur la Bambu Lab A1 mini
(plateau de 180 mm). Les boîtes sont indépendantes et s'impriment une par une.

L'appli doit être simple et ludique : on voit le tiroir, on trace, on valide.

## Ce que l'appli n'est pas (première version)

- Pas de boîtes non rectangulaires (en L).
- Une seule hauteur pour toutes les boîtes.
- Pas de vue 3D dans la page.
- Pas de lien automatique avec SolidCraft : c'est Claude qui construit, à partir du fichier téléchargé.

## Où tourne l'appli

L'appli est une page hébergée sur les pages GitHub de l'utilisateur : elle s'ouvre depuis n'importe
quel ordinateur (maison, bureau), sans installation. Tout le calcul se fait dans la page ; rien
n'est envoyé à un serveur.

Dans le dépôt :

- `index.html` : l'appli.
- `logique.js` : les calculs (collage, chevauchement, remplissage, découpe, génération du script
  SolidCraft), séparés pour être testés.
- `tests/` : les tests automatiques de `logique.js`.

## L'écran

- **À gauche, le tiroir :** largeur, longueur, hauteur, épaisseur des parois, épaisseur du fond,
  jeu entre boîtes (0,5 mm par défaut), côté du plateau (180 mm par défaut).
- **Au centre, le plan :** le tiroir vu de dessus, à l'échelle, grille au millimètre (traits forts
  tous les 10 mm), zoom à la molette. Les cotes d'une boîte s'affichent dessus.
- **À droite, la liste des boîtes :** numéro, dimensions extérieures, nombre de morceaux.

## Créer des boîtes

Deux méthodes, qui se mélangent librement :

1. **Tracer :** on glisse la souris sur une zone libre ; le rectangle devient une boîte. Les cotes
   s'affichent pendant le tracé.
2. **Bande rapide :** on clique une zone libre, puis « Colonne » ou « Rangée », le côté (gauche,
   droite, haut, bas) et la cote. La bande ne prend que la place libre de cette zone.

## Modifier une boîte

On clique une boîte, puis :

- **Couper :** en parts égales (2, 3, 4…) ou « une boîte de X mm, puis le reste », dans un sens
  ou dans l'autre. On peut aussi cliquer directement à l'endroit de la coupe.
- **Redimensionner :** en tirant un bord, ou en tapant la cote exacte.
- **Supprimer :** la zone redevient libre.
- **Annuler / rétablir** la dernière action.

## Règles automatiques

- **Collage :** un bord tracé à moins de 5 mm d'un bord du tiroir ou d'une autre boîte s'y colle.
  Il ne reste jamais un vide de quelques millimètres.
- **Pas de chevauchement :** un tracé qui mord sur une boîte existante est rogné.
- **Jeu :** les boîtes du plan se touchent ; le jeu réel est retiré à la construction, moitié sur
  chaque boîte voisine. Contre un bord du tiroir, rien n'est retiré.
- **Taille minimale :** une boîte fait au moins 2 × l'épaisseur des parois + 10 mm de côté.
  En dessous, le tracé est refusé avec un message.

## Découpe pour l'imprimante

- Toute boîte plus longue que le plateau est coupée en morceaux égaux, chacun au plus de
  plateau − 12 mm, tenon compris (168 mm pour l'A1 mini).
- Assemblage : enfourchement simple dans l'épaisseur des parois (tenon de 10 mm, un tiers de la
  paroi, jeu de 0,2 mm). Rien ne dépasse des parois. Les fonds se touchent bord à bord.
- Une boîte trop grande dans les deux sens est coupée dans les deux sens, tant que chaque morceau
  garde au moins une paroi (2 morceaux au plus dans l'un des deux sens). Au-delà, l'appli le
  signale et demande de couper la boîte.
- Le plan montre les coupes en pointillé et le nombre de morceaux de chaque boîte.

## Arrondis intérieurs (ajout du 2026-11-18)

- Rayon 2 mm : congé entre le fond et les parois, congé dans les coins verticaux, arrondi de
  l'arête du haut côté intérieur. L'arrondi du haut laisse au moins la moitié de la paroi à plat
  (rayon au plus épaisseur / 2) ; les deux se partagent la hauteur intérieure.
- Les arrondis sont faits avant les tenons et les fourches : ils se suivent d'un morceau à l'autre,
  et la fourche est taillée dans le bord déjà arrondi.
- Le dessus de chaque tenon est taillé au profil de l'arrondi du haut (outil boîte moins cylindre,
  absorbé aussitôt), pour un bord continu une fois emboîté. Faire l'arrondi après les tenons échoue
  dans SolidCraft (constaté sur 0.41).
- Les volumes annoncés comptent les arrondis exactement : coins par la boule et par Pappus, et la
  matière que tenon et fourche partagent avec l'arrondi du haut.

## Valider

1. On clique « Valider ».
2. Les espaces vides sont comblés par des boîtes rectangulaires, le moins nombreuses possible,
   affichées dans une autre couleur. Un vide trop étroit pour une boîte est signalé : il faut
   agrandir une boîte voisine.
3. On confirme. La page télécharge un seul fichier, `casier-AAAA-MM-JJ.json`, à ranger où l'on veut.
4. Sur n'importe quel poste qui a Claude Code et SolidCraft, on donne ce fichier à Claude
   (« construis ce casier »). Aucun autre fichier ni souvenir de conversation n'est nécessaire.

L'appli mémorise le plan en cours dans le navigateur et le rouvre tel quel. On peut aussi y
rouvrir un fichier `casier-….json` pour le modifier, sur un autre poste par exemple.

## Le fichier téléchargé : autonome

Il contient tout ce qu'il faut pour construire, dans cet ordre :

```json
{
  "version": 1,
  "consigne": "Texte en clair pour Claude : ce qu'est ce fichier, les étapes à suivre, les contrôles à faire.",
  "tiroir": { "largeur": 325, "longueur": 405, "hauteur": 60, "epaisseur": 4,
              "epaisseur_fond": 3, "jeu": 0.5, "plateau": 180 },
  "boites": [ { "x": 0, "y": 0, "largeur": 100, "longueur": 200, "auto": false } ],
  "morceaux": [ { "nom": "B1-M1", "x": 0, "y": 0, "largeur": 99.75, "longueur": 115,
                  "volume_mm3": 91517.3 } ],
  "script_solidcraft": { "commands": [ "…les commandes qui construisent tous les morceaux…" ] }
}
```

- `boites` : le plan tel que dessiné. `x`, `y` : coin de la boîte depuis le coin avant gauche du
  tiroir, en mm. Les boîtes couvrent tout le tiroir sans se chevaucher. `auto` : boîte ajoutée par
  le remplissage. C'est ce que l'appli relit pour modifier le plan.
- `morceaux` : chaque pièce à imprimer, avec sa position, sa taille et son volume attendus. Ils
  servent de contrôle après construction.
- `script_solidcraft` : les commandes prêtes à exécuter. C'est la page qui calcule la géométrie
  (jeu, découpes, enfourchements) ; Claude n'a rien à recalculer.

## Construction dans SolidCraft (par Claude, sur n'importe quel poste)

La `consigne` du fichier demande à Claude de :

1. Extraire `script_solidcraft` et l'exécuter (`solidcraft-cli run … --save casier.sc`, ou les
   outils SolidCraft si le serveur MCP est installé).
2. Mesurer chaque corps et le comparer à `morceaux` : même nombre, mêmes positions, tailles et
   volumes, tous fermés, aucun plus grand que le plateau. Signaler tout écart au lieu d'exporter.
3. Enregistrer le modèle et exporter un fichier 3MF par morceau, dans un dossier `impression/`
   à côté du fichier.
4. Rendre compte : nombre de morceaux, plus grand morceau, écarts éventuels.

Les dimensions se règlent dans l'appli, plus dans les paramètres de SolidCraft : pour changer une
boîte, on rouvre le fichier dans l'appli, on modifie, on revalide. `casier-boites.sc` reste tel quel.

## Vérifications prévues

- Les calculs de `logique.js` (collage, rognage, remplissage, découpe) testés automatiquement.
- L'appli essayée dans le navigateur avec le croquis du 16 novembre (6 boîtes, dont une rangée
  basse sur deux colonnes).
- Le script généré par la page exécuté dans SolidCraft sur plusieurs plans, et chaque morceau
  comparé à un calcul indépendant (pas seulement aux valeurs du fichier, qui viennent du même code).
- Un essai « poste vierge » : construire à partir du seul fichier, par un Claude sans le contexte
  de cette conversation.
