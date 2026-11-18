import { test } from "node:test";
import assert from "node:assert/strict";
import { morceaux, rayons, TENON, ARRONDI } from "../solidcraft.js";

const TIROIR = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const B = (x, y, largeur, longueur) => ({ x, y, largeur, longueur, auto: false });
const plan = (boites, tiroir = TIROIR) => ({ version: 1, tiroir, boites });
const proche = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

// Arrondis de rayon r, calculés à la main. Le long d'une paroi, le congé du bas ajoute autant de matière que
// l'arrondi du haut en retire (même rayon) : seuls les coins comptent. Dans un coin : congé vertical sur la
// hauteur moins r, huitième de boule au fond, et l'arrondi du haut qui tourne autour du congé vertical (Pappus).
const r = ARRONDI;
const k = (1 - Math.PI / 4) * r * r;
const coin = (h, f) => k * (h - f - r) + (1 - Math.PI / 6) * r ** 3 - k * (Math.PI / 2) * (r + ((10 - 3 * Math.PI) / (3 * (4 - Math.PI))) * r);
// matière de l'arrondi du haut entre u = ua et u = ub de la face intérieure, par intégration numérique
const section = (ua, ub) => {
  const a = Math.max(0, ua), b = Math.min(r, ub), n = 20000;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const u = a + ((i + 0.5) * (b - a)) / n;
    s += (r - Math.sqrt(r * r - (r - u) ** 2)) * ((b - a) / n);
  }
  return b > a ? s : 0;
};

test("une boite au coin : un morceau, jeu retire seulement cote voisines", () => {
  const { morceaux: m, alertes } = morceaux(plan([B(0, 0, 100, 150), B(100, 0, 225, 405), B(0, 150, 100, 255)]));
  const m1 = m.find((x) => x.boite === 1);
  assert.equal(m1.nom, "B1-M1");
  assert.deepEqual([m1.x, m1.y, m1.largeur, m1.longueur, m1.hauteur], [0, 0, 99.75, 149.75, 60]);
  assert.deepEqual(alertes, []);
});

test("volume d'une boite simple : fond plus parois", () => {
  const { morceaux: m } = morceaux(plan([B(0, 0, 100, 150), B(100, 0, 225, 405), B(0, 150, 100, 255)]));
  const w = 99.75, l = 149.75, e = 4, f = 3, h = 60;
  proche(m[0].volume_mm3, w * l * f + (w * l - (w - 2 * e) * (l - 2 * e)) * (h - f) + 4 * coin(h, f));
});

test("rayons des arrondis : 2 mm, mais l'arrondi du haut laisse la moitie de la paroi a plat", () => {
  assert.deepEqual(rayons(TIROIR), { bas: 2, haut: 2 });
  assert.deepEqual(rayons({ ...TIROIR, epaisseur: 3 }), { bas: 2, haut: 1.5 });
  assert.deepEqual(rayons({ ...TIROIR, hauteur: 6, epaisseur_fond: 3 }), { bas: 1.5, haut: 1.5 });
});

test("une boite contre tous les bords garde ses cotes", () => {
  const { morceaux: m } = morceaux(plan([B(0, 0, 160, 160)], { ...TIROIR, largeur: 160, longueur: 160 }));
  assert.deepEqual([m.length, m[0].largeur, m[0].longueur], [1, 160, 160]);
});

test("une boite de 405 de long donne 3 morceaux qui tiennent sur le plateau", () => {
  const { morceaux: m } = morceaux(plan([B(0, 0, 100, 405), B(100, 0, 225, 405)]));
  const b1 = m.filter((x) => x.boite === 1);
  assert.deepEqual(b1.map((x) => x.nom), ["B1-M1", "B1-M2", "B1-M3"]);
  for (const x of b1) assert.ok(x.longueur <= TIROIR.plateau - 2 && x.largeur <= TIROIR.plateau - 2, `${x.nom} ${x.longueur}`);
});

test("le morceau avant porte le tenon, le suivant commence apres le jeu", () => {
  const { morceaux: m } = morceaux(plan([B(0, 0, 100, 405), B(100, 0, 225, 405)]));
  const [m1, m2] = m.filter((x) => x.boite === 1);
  proche(m1.longueur, 135 - 0.1 + TENON.longueur + 0.1);
  proche(m2.y, 135 + 0.1);
});

test("deux morceaux : le volume total vaut la boite entiere, moins le jeu, a la matiere pres des tenons", () => {
  const { morceaux: m } = morceaux(plan([B(0, 0, 160, 300)], { ...TIROIR, largeur: 160, longueur: 300 }));
  assert.equal(m.length, 2);
  const e = 4, tt = e / 3, g = TENON.jeu, d = TENON.longueur, h = 60, f = 3;
  const plein = 160 * 300 * f + (160 * 300 - 152 * 292) * (h - f);
  // la fente de jeu retire g sur le fond et les deux parois ; dans chaque paroi, le tenon ajoute tt × (d + g/2)
  // (le jeu puis la fourche) et la fourche retire (tt + 2g) × (d + g/2) au morceau suivant, sur toute la hauteur
  const fente = g * 160 * f + 2 * g * e * (h - f);
  const tenons = 2 * h * (tt * (d + g / 2) - (tt + 2 * g) * (d + g / 2));
  // arrondis : 4 coins ; le dessus de chaque tenon est taillé à l'arrondi sur ce qui dépasse (d + g/2) ;
  // chaque fourche traverse l'arrondi sur d + g/2, matière que l'arrondi avait déjà retirée
  const arrondis = 4 * coin(h, f) - 2 * section(e / 2 - tt / 2, e / 2 + tt / 2) * (d + g / 2) + 2 * section(e / 2 - tt / 2 - g, e / 2 + tt / 2 + g) * (d + g / 2);
  proche(m[0].volume_mm3 + m[1].volume_mm3, plein - fente + tenons + arrondis, 1e-9);
});

test("une boite de 250 x 250 donne 2 x 2 morceaux", () => {
  const { morceaux: m, alertes } = morceaux(plan([B(0, 0, 250, 250), B(250, 0, 75, 405), B(0, 250, 250, 155)]));
  assert.equal(m.filter((x) => x.boite === 1).length, 4);
  assert.deepEqual(alertes, []);
});

test("une boite trop grande dans les deux sens est bloquante", () => {
  const { alertes } = morceaux(plan([B(0, 0, 600, 600)], { ...TIROIR, largeur: 600, longueur: 600 }));
  assert.deepEqual(alertes.map((a) => [a.boite, a.niveau]), [[1, "bloquant"]]);
});

test("parois de 2 mm avec une coupe : joues trop fines signalees", () => {
  const { alertes } = morceaux(plan([B(0, 0, 100, 405), B(100, 0, 225, 405)], { ...TIROIR, epaisseur: 2 }));
  assert.ok(alertes.some((a) => a.boite === 1 && a.niveau === "avertissement" && a.texte.includes("joue")));
});
