import { test } from "node:test";
import assert from "node:assert/strict";
import { remplir, controler } from "../logique.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });
// Croquis du 16 novembre : colonne de gauche coupée en deux, rangée basse sur les deux colonnes de droite,
// colonne du milieu, et la colonne de droite coupée en une grande et une petite boîte.
const CROQUIS = [B(0, 0, 100, 200), B(0, 200, 100, 205), B(100, 0, 225, 80), B(100, 80, 100, 325), B(200, 80, 125, 100), B(200, 180, 125, 225)];
const aire = (bs) => bs.reduce((s, b) => s + b.largeur * b.longueur, 0);

test("remplir : tiroir vide donne une seule boite", () => {
  const { ajoutees, trop_etroits } = remplir([], TIROIR);
  assert.deepEqual(ajoutees, [{ x: 0, y: 0, largeur: 325, longueur: 405, auto: true }]);
  assert.deepEqual(trop_etroits, []);
});

test("remplir : croquis sans une boite redonne exactement cette boite", () => {
  const { ajoutees } = remplir(CROQUIS.slice(0, 5), TIROIR);
  assert.deepEqual(ajoutees, [{ ...CROQUIS[5], auto: true }]);
});

test("remplir : un vide en L donne deux rectangles qui le couvrent", () => {
  const { ajoutees } = remplir([B(0, 0, 200, 300)], TIROIR);
  assert.equal(ajoutees.length, 2);
  assert.equal(aire(ajoutees), 325 * 405 - 200 * 300);
  assert.deepEqual(controler({ version: 1, tiroir: TIROIR, boites: [B(0, 0, 200, 300), ...ajoutees] }), []);
});

test("remplir : un vide de 6 mm est signale, pas rempli", () => {
  const { ajoutees, trop_etroits } = remplir([B(0, 0, 319, 405)], TIROIR);
  assert.deepEqual(ajoutees, []);
  assert.deepEqual(trop_etroits, [{ x: 319, y: 0, largeur: 6, longueur: 405 }]);
});

test("controler : le croquis complet est correct", () => {
  assert.deepEqual(controler({ version: 1, tiroir: TIROIR, boites: CROQUIS }), []);
});

test("controler : chevauchement signale", () => {
  const m = controler({ version: 1, tiroir: TIROIR, boites: [...CROQUIS.slice(0, 5), B(190, 180, 135, 225)] });
  assert.ok(m.some((t) => t.includes("chevauch")));
});

test("controler : trou signale", () => {
  const m = controler({ version: 1, tiroir: TIROIR, boites: CROQUIS.slice(0, 5) });
  assert.ok(m.some((t) => t.includes("vide")));
});

test("controler : boite hors du tiroir signalee", () => {
  const m = controler({ version: 1, tiroir: TIROIR, boites: [B(0, 0, 325, 405), B(325, 0, 20, 20)] });
  assert.ok(m.some((t) => t.includes("sort")));
});
