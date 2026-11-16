import { test } from "node:test";
import assert from "node:assert/strict";
import { tailleMin } from "../logique.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };

test("taille minimale d'une boite : deux parois plus 10 mm", () => {
  assert.equal(tailleMin(TIROIR), 18);
});
