# Casier de tiroir

Dessinez à la souris les boîtes d'un tiroir, puis faites-les construire dans SolidCraft pour les imprimer en 3D, une pièce à la fois.

**Appli : https://kof30190.github.io/casier-tiroir/**

## Utilisation

1. Entrez les cotes du tiroir (largeur, longueur, hauteur, parois, fond, jeu, plateau de l'imprimante).
2. Tracez les boîtes à la souris, ou cliquez une zone libre pour y poser une colonne ou une rangée. Cliquez une boîte pour la couper, la redimensionner ou la supprimer.
3. Cliquez « Valider » : les vides sont comblés, puis un fichier `casier-AAAA-MM-JJ.json` est téléchargé.
4. Sur n'importe quel poste qui a Claude Code et SolidCraft (`solidcraft-cli`), donnez ce fichier à Claude : « construis ce casier ». Le fichier contient sa propre consigne ; Claude construit les pièces, les contrôle et exporte un 3MF par pièce dans `impression/`.

Les boîtes plus longues que le plateau sont coupées en morceaux assemblés par enfourchement (tenon d'un tiers de la paroi, 10 mm, jeu de 0,2 mm). Rien ne dépasse des parois.

## Développement

- `npm test` : tests des règles du plan, des morceaux et du fichier (Node 20 ou plus).
- `npm run verif` : construit cinq plans d'essai dans `solidcraft-cli` et compare chaque pièce à un calcul indépendant.

Description et plan : `docs/`.
