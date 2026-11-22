// Règles du plan de boîtes : tout est en millimètres, repère au coin avant gauche du tiroir
// (X = largeur, Y = longueur). Fonctions pures, testées dans tests/logique.test.mjs.

export const COLLAGE_MM = 5;

// Valeurs admises pour les cotes du tiroir (saisie dans la page et fichiers rouverts).
export const LIMITES_TIROIR = {
  largeur: { min: 50, max: 2000, entier: true },
  longueur: { min: 50, max: 2000, entier: true },
  hauteur: { min: 10, max: 500 },
  epaisseur: { min: 0.8, max: 20 },
  epaisseur_fond: { min: 0.6, max: 20 },
  jeu: { min: 0, max: 5 },
  plateau: { min: 50, max: 1000 },
};

export function tailleMin(tiroir) {
  return 2 * tiroir.epaisseur + 10;
}

const droite = (r) => r.x + r.largeur;
const haut = (r) => r.y + r.longueur;
const rect = (x1, y1, x2, y2) => ({ x: x1, y: y1, largeur: x2 - x1, longueur: y2 - y1 });

export function seChevauchent(a, b) {
  return a.x < droite(b) && b.x < droite(a) && a.y < haut(b) && b.y < haut(a);
}

export function contient(r, p) {
  return p.x >= r.x && p.x < droite(r) && p.y >= r.y && p.y < haut(r);
}

function bords(boites, tiroir, axe) {
  const out = axe === "x" ? [0, tiroir.largeur] : [0, tiroir.longueur];
  for (const b of boites) out.push(...(axe === "x" ? [b.x, droite(b)] : [b.y, haut(b)]));
  return out;
}

function aimanter(valeur, candidats, tol) {
  let meilleur = valeur;
  let ecart = tol + 1;
  for (const c of candidats) {
    const d = Math.abs(c - valeur);
    if (d <= tol && d < ecart) {
      meilleur = c;
      ecart = d;
    }
  }
  return meilleur;
}

// Colle chaque bord du rectangle au bord du tiroir ou d'une boîte le plus proche, à `tol` mm près.
export function coller(r, boites, tiroir, tol = COLLAGE_MM) {
  const bx = bords(boites, tiroir, "x");
  const by = bords(boites, tiroir, "y");
  const x1 = aimanter(Math.round(r.x), bx, tol);
  const x2 = aimanter(Math.round(droite(r)), bx, tol);
  const y1 = aimanter(Math.round(r.y), by, tol);
  const y2 = aimanter(Math.round(haut(r)), by, tol);
  return rect(x1, y1, x2, y2);
}

// Ramène un tracé dans le tiroir et le raccourcit pour qu'il ne morde aucune boîte, en gardant
// le coin de départ `ancre`. Rend null si le départ est dans une boîte ou si le reste est trop petit.
export function rogner(r, ancre, boites, tiroir) {
  if (boites.some((b) => contient(b, ancre))) return null;
  let x1 = Math.max(0, r.x);
  let y1 = Math.max(0, r.y);
  let x2 = Math.min(tiroir.largeur, droite(r));
  let y2 = Math.min(tiroir.longueur, haut(r));
  for (let tour = 0; tour < boites.length + 1; tour++) {
    const gene = boites.find((b) => seChevauchent(b, rect(x1, y1, x2, y2)));
    if (!gene) break;
    const options = [];
    if (gene.x >= ancre.x) options.push([x1, y1, Math.min(x2, gene.x), y2]);
    if (droite(gene) <= ancre.x) options.push([Math.max(x1, droite(gene)), y1, x2, y2]);
    if (gene.y >= ancre.y) options.push([x1, y1, x2, Math.min(y2, gene.y)]);
    if (haut(gene) <= ancre.y) options.push([x1, Math.max(y1, haut(gene)), x2, y2]);
    if (!options.length) return null;
    options.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]));
    [x1, y1, x2, y2] = options[0];
  }
  const out = rect(x1, y1, x2, y2);
  if (boites.some((b) => seChevauchent(b, out))) return null;
  const min = tailleMin(tiroir);
  return out.largeur >= min && out.longueur >= min ? out : null;
}

// Grille des cellules délimitées par tous les bords, avec l'occupation de chaque cellule.
export function grille(boites, tiroir) {
  const xs = [...new Set(bords(boites, tiroir, "x").filter((v) => v >= 0 && v <= tiroir.largeur))].sort((a, b) => a - b);
  const ys = [...new Set(bords(boites, tiroir, "y").filter((v) => v >= 0 && v <= tiroir.longueur))].sort((a, b) => a - b);
  const occupe = xs.slice(0, -1).map((x, i) =>
    ys.slice(0, -1).map((y, j) => {
      const centre = { x: (x + xs[i + 1]) / 2, y: (y + ys[j + 1]) / 2 };
      return boites.some((b) => contient(b, centre));
    }));
  return { xs, ys, occupe };
}

// Le plus grand rectangle libre qui contient le point, ou null si le point est dans une boîte.
export function zoneLibre(point, boites, tiroir) {
  if (point.x < 0 || point.y < 0 || point.x >= tiroir.largeur || point.y >= tiroir.longueur) return null;
  if (boites.some((b) => contient(b, point))) return null;
  const { xs, ys, occupe } = grille(boites, tiroir);
  const ci = xs.findIndex((x, i) => i < xs.length - 1 && point.x >= x && point.x < xs[i + 1]);
  const cj = ys.findIndex((y, j) => j < ys.length - 1 && point.y >= y && point.y < ys[j + 1]);
  const libre = (i1, i2, j1, j2) => {
    for (let i = i1; i <= i2; i++) for (let j = j1; j <= j2; j++) if (occupe[i][j]) return false;
    return true;
  };
  let best = null;
  for (let i1 = ci; i1 >= 0; i1--) {
    if (!libre(i1, ci, cj, cj)) break;
    for (let i2 = ci; i2 < xs.length - 1; i2++) {
      if (!libre(i1, i2, cj, cj)) break;
      let j1 = cj;
      while (j1 > 0 && libre(i1, i2, j1 - 1, j1 - 1)) j1--;
      let j2 = cj;
      while (j2 < ys.length - 2 && libre(i1, i2, j2 + 1, j2 + 1)) j2++;
      const r = rect(xs[i1], ys[j1], xs[i2 + 1], ys[j2 + 1]);
      if (!best || r.largeur * r.longueur > best.largeur * best.longueur) best = r;
    }
  }
  return best;
}

// Une bande de `mm` contre un côté de la zone : colonne (gauche/droite) ou rangée (bas/haut).
export function bande(zone, sens, cote, mm) {
  if (sens === "colonne") {
    const l = Math.min(mm, zone.largeur);
    const x = cote === "droite" ? droite(zone) - l : zone.x;
    return { x, y: zone.y, largeur: l, longueur: zone.longueur };
  }
  const l = Math.min(mm, zone.longueur);
  const y = cote === "haut" ? haut(zone) - l : zone.y;
  return { x: zone.x, y, largeur: zone.largeur, longueur: l };
}

// Coupe une boîte le long de X ("x" : boîtes côte à côte) ou de Y ("y" : boîtes l'une après l'autre),
// en `parts` égales (le reste va à la dernière) ou en une `premiere` de N mm puis le reste.
export function couper(boite, axe, choix, tiroir) {
  const total = axe === "x" ? boite.largeur : boite.longueur;
  let tailles;
  if (choix.premiere !== undefined) {
    tailles = [Math.round(choix.premiere), total - Math.round(choix.premiere)];
  } else {
    const n = Math.max(2, Math.round(choix.parts));
    const base = Math.floor(total / n);
    tailles = Array.from({ length: n }, (_, k) => (k === n - 1 ? total - base * (n - 1) : base));
  }
  const min = tailleMin(tiroir);
  if (tailles.some((t) => t < min)) return { erreur: `Chaque part doit faire au moins ${min} mm.` };
  let pos = axe === "x" ? boite.x : boite.y;
  return tailles.map((t) => {
    const part = axe === "x" ? { ...boite, x: pos, largeur: t } : { ...boite, y: pos, longueur: t };
    pos += t;
    return { ...part, auto: false };
  });
}

// Déplace un bord d'une boîte à la coordonnée `valeur` (collée aux bords proches).
// `tol` = 0 pour une cote tapée au clavier, qui doit rester exacte.
export function redimensionner(boites, index, bord, valeur, tiroir, tol = COLLAGE_MM) {
  const b = boites[index];
  const autres = boites.filter((_, k) => k !== index);
  const axe = bord === "gauche" || bord === "droite" ? "x" : "y";
  const v = aimanter(Math.round(valeur), bords(autres, tiroir, axe), tol);
  let [x1, y1, x2, y2] = [b.x, b.y, droite(b), haut(b)];
  if (bord === "gauche") x1 = v;
  if (bord === "droite") x2 = v;
  if (bord === "bas") y1 = v;
  if (bord === "haut") y2 = v;
  const r = rect(x1, y1, x2, y2);
  const min = tailleMin(tiroir);
  if (r.largeur < min || r.longueur < min) return { erreur: `Une boîte fait au moins ${min} mm de côté.` };
  if (x1 < 0 || y1 < 0 || x2 > tiroir.largeur || y2 > tiroir.longueur) return { erreur: "La boîte sortirait du tiroir." };
  if (autres.some((o) => seChevauchent(o, r))) return { erreur: "La boîte mordrait sur une voisine." };
  return boites.map((o, k) => (k === index ? { ...o, ...r } : o));
}

// Déplace une boîte (taille inchangée) vers le coin avant gauche `cible`, depuis sa place actuelle.
// Butée sur les bords du tiroir ; contre une voisine, la boîte s'arrête à son bord et glisse le long
// (on avance en X puis en Y, ou en Y puis en X, et on garde la place la plus proche de la cible) :
// elle ne traverse jamais une boîte. Les bords se collent aux bords proches, à `tol` mm près.
export function deplacer(boites, index, cible, tiroir, tol = COLLAGE_MM) {
  const b = boites[index];
  const autres = boites.filter((_, k) => k !== index);
  const w = b.largeur;
  const h = b.longueur;
  const borne = (v, maxi) => Math.min(Math.max(v, 0), Math.max(maxi, 0));
  const aimanterAxe = (v, taille, axe) => {
    const candidats = bords(autres, tiroir, axe);
    if (candidats.includes(v) || candidats.includes(v + taille)) return v; // déjà calée contre un bord
    const debut = aimanter(v, candidats, tol);
    const fin = aimanter(v + taille, candidats, tol) - taille;
    // seuls les bords réellement collés comptent ; si les deux le sont, le plus proche l'emporte
    const colles = [debut, fin].filter((c) => c !== v);
    if (!colles.length) return v;
    return colles.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a));
  };
  let tx = borne(Math.round(cible.x), tiroir.largeur - w);
  let ty = borne(Math.round(cible.y), tiroir.longueur - h);
  tx = borne(aimanterAxe(tx, w, "x"), tiroir.largeur - w);
  ty = borne(aimanterAxe(ty, h, "y"), tiroir.longueur - h);

  // avance le long d'un axe en s'arrêtant à la première voisine rencontrée
  const avancerX = (x, y, vers) => {
    let fin = vers;
    for (const o of autres) {
      if (!(o.y < y + h && y < haut(o))) continue;
      if (vers > x && o.x >= x + w) fin = Math.min(fin, o.x - w);
      if (vers < x && droite(o) <= x) fin = Math.max(fin, droite(o));
    }
    return fin;
  };
  const avancerY = (x, y, vers) => {
    let fin = vers;
    for (const o of autres) {
      if (!(o.x < x + w && x < droite(o))) continue;
      if (vers > y && o.y >= y + h) fin = Math.min(fin, o.y - h);
      if (vers < y && haut(o) <= y) fin = Math.max(fin, haut(o));
    }
    return fin;
  };
  const xd = avancerX(b.x, b.y, tx);
  const parX = { x: xd, y: avancerY(xd, b.y, ty) };
  const yd = avancerY(b.x, b.y, ty);
  const parY = { x: avancerX(b.x, yd, tx), y: yd };
  const ecart = (p) => Math.hypot(p.x - tx, p.y - ty);
  const choix = [parX, parY].sort((p, q) => ecart(p) - ecart(q));
  for (const p of choix) {
    const r = { x: p.x, y: p.y, largeur: w, longueur: h };
    const dedans = r.x >= 0 && r.y >= 0 && droite(r) <= tiroir.largeur && haut(r) <= tiroir.longueur;
    if (dedans && !autres.some((o) => seChevauchent(o, r))) return boites.map((o, k) => (k === index ? { ...o, x: r.x, y: r.y } : o));
  }
  return boites;
}

// Applique de nouvelles cotes de tiroir : les boîtes collées au bord droit ou haut le suivent,
// celles qui dépassent sont rognées, celles qui sortent ou deviennent trop petites sont retirées.
export function changerTiroir(plan, nouveau) {
  const ancien = plan.tiroir;
  const min = tailleMin(nouveau);
  const messages = [];
  const boites = [];
  plan.boites.forEach((b, k) => {
    const suitX = droite(b) === ancien.largeur;
    const suitY = haut(b) === ancien.longueur;
    const x2 = suitX ? nouveau.largeur : Math.min(droite(b), nouveau.largeur);
    const y2 = suitY ? nouveau.longueur : Math.min(haut(b), nouveau.longueur);
    if (b.x >= nouveau.largeur || b.y >= nouveau.longueur) {
      messages.push(`Boîte ${k + 1} retirée : elle est hors du nouveau tiroir.`);
      return;
    }
    if (x2 - b.x < min || y2 - b.y < min) {
      messages.push(`Boîte ${k + 1} retirée : elle serait trop petite (${min} mm de côté au moins).`);
      return;
    }
    const r = rect(b.x, b.y, x2, y2);
    if ((!suitX && x2 !== droite(b)) || (!suitY && y2 !== haut(b))) {
      messages.push(`Boîte ${k + 1} rognée à ${r.largeur} × ${r.longueur} mm.`);
    }
    boites.push({ ...b, ...r });
  });
  return { plan: { ...plan, tiroir: nouveau, boites }, messages };
}

// Rectangles qui couvrent tout l'espace libre, le moins nombreux possible (choix glouton : pour chaque
// cellule libre, on étend d'abord en X ou d'abord en Y et on garde le plus grand). Ceux dont un côté est
// sous la taille minimale ne deviennent pas des boîtes : ils sont rendus dans `trop_etroits`.
export function remplir(boites, tiroir) {
  const { xs, ys, occupe } = grille(boites, tiroir);
  const pris = occupe.map((col) => col.slice());
  const ni = xs.length - 1;
  const nj = ys.length - 1;
  const libre = (i1, i2, j1, j2) => {
    for (let i = i1; i <= i2; i++) for (let j = j1; j <= j2; j++) if (pris[i][j]) return false;
    return true;
  };
  const rects = [];
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      if (pris[i][j]) continue;
      const variantes = [];
      // d'abord en X, puis en Y
      let i2 = i;
      while (i2 + 1 < ni && libre(i2 + 1, i2 + 1, j, j)) i2++;
      let j2 = j;
      while (j2 + 1 < nj && libre(i, i2, j2 + 1, j2 + 1)) j2++;
      variantes.push([i2, j2]);
      // d'abord en Y, puis en X
      let jb = j;
      while (jb + 1 < nj && libre(i, i, jb + 1, jb + 1)) jb++;
      let ib = i;
      while (ib + 1 < ni && libre(ib + 1, ib + 1, j, jb)) ib++;
      variantes.push([ib, jb]);
      const aire = ([a, b]) => (xs[a + 1] - xs[i]) * (ys[b + 1] - ys[j]);
      const [fi, fj] = aire(variantes[0]) >= aire(variantes[1]) ? variantes[0] : variantes[1];
      for (let a = i; a <= fi; a++) for (let b = j; b <= fj; b++) pris[a][b] = true;
      rects.push(rect(xs[i], ys[j], xs[fi + 1], ys[fj + 1]));
    }
  }
  const min = tailleMin(tiroir);
  const ajoutees = [];
  const trop_etroits = [];
  for (const r of rects) {
    if (r.largeur >= min && r.longueur >= min) ajoutees.push({ ...r, auto: true });
    else trop_etroits.push(r);
  }
  return { ajoutees, trop_etroits };
}

// Messages sur ce qui empêche de construire le plan ; liste vide = plan correct.
export function controler(plan) {
  const { tiroir, boites } = plan;
  const min = tailleMin(tiroir);
  const messages = [];
  boites.forEach((b, k) => {
    if (b.x < 0 || b.y < 0 || droite(b) > tiroir.largeur || haut(b) > tiroir.longueur) messages.push(`La boîte ${k + 1} sort du tiroir.`);
    if (b.largeur < min || b.longueur < min) messages.push(`La boîte ${k + 1} est trop petite (${min} mm au moins de côté).`);
    for (let m = k + 1; m < boites.length; m++) {
      if (seChevauchent(b, boites[m])) messages.push(`Les boîtes ${k + 1} et ${m + 1} se chevauchent.`);
    }
  });
  const { ajoutees, trop_etroits } = remplir(boites, tiroir);
  for (const r of [...ajoutees, ...trop_etroits]) {
    messages.push(`Il reste un vide de ${texteVide(r)}.`);
  }
  return messages;
}

// Lit une cote saisie : accepte la virgule française et « mm », refuse le reste avec un message.
export function lireCote(texte, { min = 0, max = Infinity, entier = false } = {}) {
  const propre = String(texte).trim().replace(/\s*mm$/i, "").replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(propre)) return { erreur: "Entrez un nombre en millimètres." };
  let v = Number(propre);
  if (entier) v = Math.round(v);
  if (v < min || (min === 0 && v < 0) || (min > 0 && v <= 0)) return { erreur: `La valeur doit être au moins ${String(min).replace(".", ",")} mm.` };
  if (v > max) return { erreur: `La valeur doit être au plus ${max} mm.` };
  return { valeur: v };
}

// Un vide, pour les messages : taille puis position depuis le coin avant gauche.
export function texteVide(r) {
  const n = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
  return `${n(r.largeur)} × ${n(r.longueur)} mm en (${n(r.x)}, ${n(r.y)})`;
}
