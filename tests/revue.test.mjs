import { test } from "node:test";
import assert from "node:assert/strict";
import { redimensionner, changerTiroir, controler, texteVide } from "../logique.js";
import { morceaux, fichier, lireFichier, CONSIGNE } from "../solidcraft.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });

test("revue 1 : un morceau ne depasse jamais plateau - 12, tenon compris", () => {
  for (const [w, l] of [[100, 330], [300, 300], [160, 169], [100, 405]]) {
    const t = { ...TIROIR, largeur: Math.max(w, 100), longueur: Math.max(l, 100) };
    const { morceaux: m, alertes } = morceaux({ version: 1, tiroir: t, boites: [B(0, 0, w, l)] });
    assert.deepEqual(alertes, []);
    for (const p of m) assert.ok(p.largeur <= t.plateau - 12 && p.longueur <= t.plateau - 12, `${w}x${l} ${p.nom} ${p.largeur} x ${p.longueur}`);
  }
});

test("revue 1 : 336 x 336 demande 3 x 3 morceaux une fois le tenon compte, donc bloquant", () => {
  const t = { ...TIROIR, largeur: 336, longueur: 336 };
  const { alertes } = morceaux({ version: 1, tiroir: t, boites: [B(0, 0, 336, 336)] });
  assert.deepEqual(alertes.map((a) => a.niveau), ["bloquant"]);
});

test("revue 2 : une cote tapee n'est pas collee a un bord voisin", () => {
  const boites = [B(0, 0, 50, 100), B(0, 100, 100, 50)];
  const r = redimensionner(boites, 0, "droite", 103, TIROIR, 0);
  assert.equal(r[0].largeur, 103);
});

test("revue 3 : une boite rognee par le tiroir est signalee", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 300, 405)] };
  const { plan: p, messages } = changerTiroir(plan, { ...TIROIR, largeur: 250 });
  assert.equal(p.boites[0].largeur, 250);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /rognée/);
});

test("revue 3 : une boite devenue trop petite par des parois plus epaisses le dit", () => {
  const plan = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 20, 405), B(20, 0, 305, 405)] };
  const { messages } = changerTiroir(plan, { ...TIROIR, epaisseur: 6 });
  assert.match(messages[0], /trop petite/);
});

test("revue 4 : la consigne demande le controle du plateau et nomme la liste d'export", () => {
  assert.match(CONSIGNE, /plateau/);
  assert.match(CONSIGNE, /champ `export_3mf` de ce fichier/);
});

test("revue 5 : un vide est decrit avec sa position", () => {
  assert.equal(texteVide({ x: 319, y: 0, largeur: 6, longueur: 405 }), "6 × 405 mm en (319, 0)");
  assert.ok(controler({ version: 1, tiroir: TIROIR, boites: [B(0, 0, 319, 405)] }).some((m) => m.includes("6 × 405 mm en (319, 0)")));
});

test("revue 7 : un fichier avec une boite vide est refuse sans planter", () => {
  const f = fichier({ version: 1, tiroir: TIROIR, boites: [B(0, 0, 325, 405)] });
  f.boites = [null];
  assert.ok(lireFichier(JSON.stringify(f)).erreur);
});

test("revue 7 : des cotes de tiroir absurdes sont refusees", () => {
  const f = fichier({ version: 1, tiroir: TIROIR, boites: [B(0, 0, 325, 405)] });
  for (const t of [{ plateau: -5 }, { epaisseur: 0 }, { hauteur: 2 }]) {
    assert.ok(lireFichier(JSON.stringify({ ...f, tiroir: { ...TIROIR, ...t } })).erreur, JSON.stringify(t));
  }
});
