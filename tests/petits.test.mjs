import { test } from "node:test";
import assert from "node:assert/strict";
import { lireCote } from "../logique.js";
import { lireFichier, nomFichier } from "../solidcraft.js";

test("lireCote : « 5. » et « ,5 » sont acceptes", () => {
  assert.deepEqual(lireCote("5.", { min: 1 }), { valeur: 5 });
  assert.deepEqual(lireCote(",5", { min: 0 }), { valeur: 0.5 });
  assert.deepEqual(lireCote(".5", { min: 0 }), { valeur: 0.5 });
  assert.ok(lireCote(".", { min: 0 }).erreur);
});

test("lireFichier : une version inconnue est annoncee avant la forme", () => {
  assert.match(lireFichier(JSON.stringify({ version: 2, plan: {} })).erreur, /Version de plan inconnue \(2\)/);
});

test("nomFichier : date locale, pas UTC", () => {
  assert.equal(nomFichier(new Date(2026, 10, 17, 0, 30)), "casier-2026-11-17.json");
  assert.equal(nomFichier(new Date(2026, 0, 5, 23, 59)), "casier-2026-01-05.json");
});
