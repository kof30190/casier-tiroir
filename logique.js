// Règles du plan de boîtes : tout est en millimètres, repère au coin avant gauche du tiroir
// (X = largeur, Y = longueur). Fonctions pures, testées dans tests/logique.test.mjs.

export function tailleMin(tiroir) {
  return 2 * tiroir.epaisseur + 10;
}
