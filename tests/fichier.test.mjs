import { test } from "node:test";
import assert from "node:assert/strict";
import { script, fichier, lireFichier } from "../solidcraft.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });
const CROQUIS = { version: 1, tiroir: TIROIR, boites: [B(0, 0, 100, 200), B(0, 200, 100, 205), B(100, 0, 225, 80), B(100, 80, 100, 325), B(200, 80, 125, 100), B(200, 180, 125, 225)] };

const outil = (c) => c.params.operation === "new" && c.params.body_name.includes(" outil ");

test("script : chaque morceau commence par un fond qui cree son corps", () => {
  const { commands } = script(CROQUIS);
  const creations = commands.filter((c) => c.params.operation === "new" && !outil(c));
  assert.deepEqual(creations.map((c) => c.params.body_name), [...new Set(creations.map((c) => c.params.body_name))]);
  assert.ok(creations.every((c) => c.command === "solid.box" && c.params.height === TIROIR.epaisseur_fond));
});

test("script : chaque ajout ou retrait ne vise que son morceau", () => {
  const { commands } = script(CROQUIS);
  let courant = null;
  let enCours = null;
  for (const c of commands) {
    if (outil(c)) enCours = c.params.body_name;
    else if (c.params.operation === "new") courant = c.params.body_name;
    else if (c.command === "solid.fillet") assert.equal(c.params.body, courant, c.params.name);
    else if (c.command === "solid.combine") {
      assert.deepEqual([c.params.target, c.params.tools, c.params.operation], [courant, [enCours], "cut"], c.params.name);
      enCours = null;
    } else assert.deepEqual(c.params.targets, [enCours ?? courant], c.params.name);
  }
  assert.equal(enCours, null);
});

test("script : arrondis apres les parois, avant tenons et fourches ; chaque outil est absorbe aussitot", () => {
  const { commands } = script(CROQUIS);
  const n = (c) => c.params.name;
  for (const nom of new Set(commands.filter((c) => c.params.operation === "new" && !outil(c)).map((c) => c.params.body_name))) {
    const siens = commands.filter((c) => n(c).startsWith(nom + " ")); // toutes les fonctions d'un morceau portent son nom
    const i = (f) => siens.findIndex(f);
    const conges = i((c) => n(c) === `${nom} congés`);
    const haut = i((c) => n(c) === `${nom} arrondi haut`);
    assert.ok(conges > 0 && haut === conges + 1, nom);
    assert.ok(siens.slice(0, conges).every((c) => c.command === "solid.box" && c.params.operation !== "cut"), nom);
    const outils = commands.filter((c) => outil(c) && c.params.body_name.startsWith(nom + " "));
    assert.equal(outils.length, commands.filter((c) => c.command === "solid.combine" && c.params.target === nom).length, nom);
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
