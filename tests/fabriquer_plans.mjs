// Écrit les fichiers d'essai de tests/plans/ tels que l'appli les télécharge.
import { writeFileSync, mkdirSync } from "node:fs";
import { fichier } from "../solidcraft.js";
import { remplir } from "../logique.js";

const T = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });
const complet = (tiroir, boites) => ({ version: 1, tiroir, boites: [...boites, ...remplir(boites, tiroir).ajoutees] });

const PLANS = {
  croquis: complet(T, [B(0, 0, 100, 200), B(0, 200, 100, 205), B(100, 0, 225, 80), B(100, 80, 100, 325), B(200, 80, 125, 100), B(200, 180, 125, 225)]),
  une_boite: complet({ ...T, largeur: 150, longueur: 120, hauteur: 40 }, []),
  deux_sur_deux: complet(T, [B(0, 0, 250, 250)]),
  longues: complet({ ...T, epaisseur: 3 }, [B(0, 0, 80, 405), B(80, 0, 80, 405)]),
  rempli_auto: complet(T, [B(0, 0, 100, 100), B(225, 305, 100, 100)]),
};
mkdirSync(new URL("./plans/", import.meta.url), { recursive: true });
for (const [nom, plan] of Object.entries(PLANS)) {
  writeFileSync(new URL(`./plans/${nom}.json`, import.meta.url), JSON.stringify(fichier(plan), null, 1));
}
console.log(Object.keys(PLANS).join(" "));
