import { test } from "node:test";
import assert from "node:assert/strict";
import { lireCote } from "../logique.js";

test("lireCote : nombre simple et virgule francaise", () => {
  assert.deepEqual(lireCote("325", { min: 50 }), { valeur: 325 });
  assert.deepEqual(lireCote(" 0,5 ", { min: 0 }), { valeur: 0.5 });
  assert.deepEqual(lireCote("12.5 mm", { min: 1 }), { valeur: 12.5 });
});

test("lireCote : vide, texte, zero et negatif refuses", () => {
  assert.ok(lireCote("", { min: 1 }).erreur);
  assert.ok(lireCote("abc", { min: 1 }).erreur);
  assert.ok(lireCote("0", { min: 1 }).erreur);
  assert.ok(lireCote("-5", { min: 0 }).erreur);
});

test("lireCote : arrondi au millimetre quand demande, et maximum", () => {
  assert.deepEqual(lireCote("325,6", { min: 50, entier: true }), { valeur: 326 });
  assert.ok(lireCote("2000", { min: 50, max: 1500 }).erreur);
});
