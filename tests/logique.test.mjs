import { test } from "node:test";
import assert from "node:assert/strict";
import { tailleMin, coller, rogner, zoneLibre, bande, couper, redimensionner, changerTiroir } from "../logique.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });

test("taille minimale d'une boite : deux parois plus 10 mm", () => {
  assert.equal(tailleMin(TIROIR), 18);
});

test("coller : un bord a 3 mm du tiroir s'y colle", () => {
  assert.deepEqual(coller({ x: 3, y: 2, largeur: 90, longueur: 100 }, [], TIROIR), { x: 0, y: 0, largeur: 93, longueur: 102 });
});

test("coller : un bord a 7 mm du tiroir ne bouge pas", () => {
  assert.deepEqual(coller({ x: 7, y: 50, largeur: 90, longueur: 100 }, [], TIROIR), { x: 7, y: 50, largeur: 90, longueur: 100 });
});

test("coller : un bord a 4 mm d'une boite s'y colle", () => {
  const r = coller({ x: 104, y: 50, largeur: 60, longueur: 100 }, [B(0, 0, 100, 405)], TIROIR);
  assert.deepEqual(r, { x: 100, y: 50, largeur: 64, longueur: 100 });
});

test("coller : le bord droit colle au bord du tiroir", () => {
  const r = coller({ x: 200, y: 0, largeur: 122, longueur: 100 }, [], TIROIR);
  assert.equal(r.x + r.largeur, 325);
});

test("rogner : un trace qui mord une boite s'arrete a son bord", () => {
  const r = rogner({ x: 0, y: 0, largeur: 200, longueur: 100 }, { x: 0, y: 0 }, [B(150, 0, 175, 405)], TIROIR);
  assert.deepEqual(r, { x: 0, y: 0, largeur: 150, longueur: 100 });
});

test("rogner : depart dans une boite donne null", () => {
  assert.equal(rogner({ x: 10, y: 10, largeur: 50, longueur: 50 }, { x: 10, y: 10 }, [B(0, 0, 100, 100)], TIROIR), null);
});

test("rogner : resultat trop petit donne null", () => {
  assert.equal(rogner({ x: 0, y: 0, largeur: 10, longueur: 100 }, { x: 0, y: 0 }, [], TIROIR), null);
});

test("rogner : un trace qui sort du tiroir est ramene dedans", () => {
  assert.deepEqual(rogner({ x: 300, y: 0, largeur: 100, longueur: 100 }, { x: 300, y: 0 }, [], TIROIR), { x: 300, y: 0, largeur: 25, longueur: 100 });
});

test("zoneLibre : tiroir vide donne tout le tiroir", () => {
  assert.deepEqual(zoneLibre({ x: 50, y: 50 }, [], TIROIR), { x: 0, y: 0, largeur: 325, longueur: 405 });
});

test("zoneLibre : colonne de gauche posee donne le reste", () => {
  assert.deepEqual(zoneLibre({ x: 200, y: 50 }, [B(0, 0, 100, 405)], TIROIR), { x: 100, y: 0, largeur: 225, longueur: 405 });
});

test("zoneLibre : point dans une boite donne null", () => {
  assert.equal(zoneLibre({ x: 50, y: 50 }, [B(0, 0, 100, 405)], TIROIR), null);
});

test("zoneLibre : croquis, la rangee basse ne prend que les deux colonnes de droite", () => {
  const zone = zoneLibre({ x: 200, y: 40 }, [B(0, 0, 100, 200), B(0, 200, 100, 205)], TIROIR);
  assert.deepEqual(zone, { x: 100, y: 0, largeur: 225, longueur: 405 });
});

test("bande : colonne gauche de 100 dans une zone", () => {
  const zone = { x: 100, y: 0, largeur: 225, longueur: 405 };
  assert.deepEqual(bande(zone, "colonne", "gauche", 100), { x: 100, y: 0, largeur: 100, longueur: 405 });
});

test("bande : rangee haute et colonne droite", () => {
  const zone = { x: 100, y: 0, largeur: 225, longueur: 405 };
  assert.deepEqual(bande(zone, "rangee", "haut", 80), { x: 100, y: 325, largeur: 225, longueur: 80 });
  assert.deepEqual(bande(zone, "colonne", "droite", 120), { x: 205, y: 0, largeur: 120, longueur: 405 });
});

test("bande : cote plus grande que la zone donne toute la zone", () => {
  const zone = { x: 100, y: 0, largeur: 225, longueur: 405 };
  assert.deepEqual(bande(zone, "colonne", "gauche", 500), zone);
});

test("couper : 3 parts egales de 405", () => {
  const parts = couper(B(0, 0, 100, 405), "y", { parts: 3 }, TIROIR);
  assert.deepEqual(parts.map((p) => [p.y, p.longueur]), [[0, 135], [135, 135], [270, 135]]);
});

test("couper : 4 parts de 405, le reste a la derniere", () => {
  const parts = couper(B(0, 0, 100, 405), "y", { parts: 4 }, TIROIR);
  assert.deepEqual(parts.map((p) => p.longueur), [101, 101, 101, 102]);
});

test("couper : une premiere boite de 100 puis le reste, en largeur", () => {
  const parts = couper(B(0, 0, 325, 80), "x", { premiere: 100 }, TIROIR);
  assert.deepEqual(parts.map((p) => [p.x, p.largeur, p.longueur]), [[0, 100, 80], [100, 225, 80]]);
});

test("couper : une part trop petite est refusee", () => {
  assert.ok(couper(B(0, 0, 100, 405), "y", { premiere: 400 }, TIROIR).erreur);
  assert.ok(couper(B(0, 0, 30, 405), "x", { parts: 2 }, TIROIR).erreur);
});

test("redimensionner : tirer un bord sur une voisine est refuse", () => {
  const r = redimensionner([B(0, 0, 100, 405), B(100, 0, 100, 405)], 0, "droite", 150, TIROIR);
  assert.ok(r.erreur);
});

test("redimensionner : un bord tire a 3 mm du tiroir s'y colle", () => {
  const r = redimensionner([B(0, 0, 100, 405)], 0, "droite", 322, TIROIR);
  assert.equal(r[0].largeur, 325);
});

test("redimensionner : sous la taille minimale est refuse", () => {
  assert.ok(redimensionner([B(0, 0, 100, 405)], 0, "droite", 10, TIROIR).erreur);
});

test("changerTiroir : une boite collee a droite suit le bord", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 100, 405), B(100, 0, 225, 405)] };
  const { plan: p, messages } = changerTiroir(plan, { ...TIROIR, largeur: 300 });
  assert.deepEqual(p.boites[1], B(100, 0, 200, 405));
  assert.deepEqual(messages, []);
});

test("changerTiroir : une boite hors du nouveau tiroir est supprimee avec un message", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 100, 405), B(250, 0, 75, 100), B(250, 100, 75, 305)] };
  const { plan: p, messages } = changerTiroir(plan, { ...TIROIR, largeur: 240 });
  assert.equal(p.boites.length, 1);
  assert.equal(messages.length, 2);
});

test("changerTiroir : une boite coupee par le nouveau bord est rognee", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 200, 405)] };
  const { plan: p } = changerTiroir(plan, { ...TIROIR, largeur: 150 });
  assert.deepEqual(p.boites[0], B(0, 0, 150, 405));
});

test("changerTiroir : agrandir le tiroir allonge les boites collees au bord haut", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 325, 200), B(0, 200, 325, 205)] };
  const { plan: p } = changerTiroir(plan, { ...TIROIR, longueur: 450 });
  assert.deepEqual(p.boites[1], B(0, 200, 325, 250));
});
