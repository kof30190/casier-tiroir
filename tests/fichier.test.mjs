import { test } from "node:test";
import assert from "node:assert/strict";
import { script, fichier, lireFichier } from "../solidcraft.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });
const CROQUIS = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 100, 200), B(0, 200, 100, 205), B(100, 0, 225, 80), B(100, 80, 100, 325), B(200, 80, 125, 100), B(200, 180, 125, 225)] };

test("script : chaque morceau commence par un fond qui cree son corps", () => {
  const { commands } = script(CROQUIS);
  const creations = commands.filter((c) => c.params.operation === "new");
  assert.deepEqual(creations.map((c) => c.params.body_name), [...new Set(creations.map((c) => c.params.body_name))]);
  assert.ok(creations.every((c) => c.command === "solid.box" && c.params.height === TIROIR.epaisseur_fond));
});

test("script : chaque ajout ou retrait ne vise que son morceau", () => {
  const { commands } = script(CROQUIS);
  let courant = null;
  for (const c of commands) {
    if (c.params.operation === "new") courant = c.params.body_name;
    else assert.deepEqual(c.params.targets, [courant], c.params.name);
  }
});

test("script : noms de fonctions uniques", () => {
  const noms = script(CROQUIS).commands.map((c) => c.params.name);
  assert.equal(new Set(noms).size, noms.length);
});

test("fichier : contient consigne, plan, morceaux, script et export", () => {
  const f = fichier(CROQUIS);
  assert.equal(f.version, 1);
  assert.ok(f.consigne.includes("solidcraft-cli"));
  assert.deepEqual(f.tiroir, TIROIR);
  assert.deepEqual(f.boites, CROQUIS.boites);
  assert.ok(f.morceaux.length >= 6 && f.morceaux.every((m) => m.nom && m.volume_mm3 > 0 && !m.ops));
  assert.equal(f.export_3mf.length, f.morceaux.length);
  assert.deepEqual(f.export_3mf[0], { command: "file.export", params: { path: `impression/${f.morceaux[0].nom}.3mf`, bodies: [f.morceaux[0].nom] } });
});

test("lireFichier : relit le plan d'un fichier telecharge", () => {
  assert.deepEqual(lireFichier(JSON.stringify(fichier(CROQUIS))), { plan: CROQUIS });
});

test("lireFichier : texte qui n'est pas du JSON refuse", () => {
  assert.ok(lireFichier("bonjour").erreur);
});

test("lireFichier : autre fichier JSON ou version inconnue refuses", () => {
  assert.ok(lireFichier(JSON.stringify({ nom: "autre" })).erreur);
  assert.ok(lireFichier(JSON.stringify({ ...fichier(CROQUIS), version: 2 })).erreur);
});

test("lireFichier : plan avec boites qui se chevauchent refuse", () => {
  const f = fichier(CROQUIS);
  f.boites[5] = B(190, 180, 135, 225);
  assert.match(lireFichier(JSON.stringify(f)).erreur, /chevauch/);
});
