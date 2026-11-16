// Du plan aux morceaux à imprimer, au script SolidCraft et au fichier téléchargé.
// Une boîte plus longue que le plateau est coupée en morceaux égaux ; à chaque coupe, le morceau de
// coordonnée basse porte un tenon (tiers central de chaque paroi traversée) et le suivant une fourche.

import { controler } from "./logique.js";

export const TENON = { longueur: 10, jeu: 0.2 };
export const MARGE_PLATEAU = 12;
export const JOUE_MIN = 0.8;

const arrondi = (v) => Math.round(v * 1000) / 1000;

// Volume d'un morceau décrit en deux couches : "f" = fond (0 à epaisseur_fond), "w" = parois (au-dessus).
// Les opérations sont appliquées dans l'ordre sur une grille des bords.
export function volume(ops, fond, hauteur) {
  const xs = [...new Set(ops.flatMap((o) => [o.r.x, o.r.x + o.r.largeur]))].sort((a, b) => a - b);
  const ys = [...new Set(ops.flatMap((o) => [o.r.y, o.r.y + o.r.longueur]))].sort((a, b) => a - b);
  let v = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const etat = { f: false, w: false };
      for (const o of ops) {
        if (cx > o.r.x && cx < o.r.x + o.r.largeur && cy > o.r.y && cy < o.r.y + o.r.longueur) {
          for (const c of o.couches) etat[c] = o.op === "add";
        }
      }
      const aire = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      v += aire * ((etat.f ? fond : 0) + (etat.w ? hauteur - fond : 0));
    }
  }
  return v;
}

const R = (x1, y1, x2, y2) => ({ x: x1, y: y1, largeur: x2 - x1, longueur: y2 - y1 });

export function morceaux(plan) {
  const t = plan.tiroir;
  const e = t.epaisseur;
  const g = TENON.jeu;
  const d = TENON.longueur;
  const tt = e / 3;
  const lim = t.plateau - MARGE_PLATEAU;
  const joue = (e - tt - 2 * g) / 2;
  const out = [];
  const alertes = [];

  plan.boites.forEach((b, k) => {
    const num = k + 1;
    const x1 = b.x + (b.x > 0 ? t.jeu / 2 : 0);
    const x2 = b.x + b.largeur - (b.x + b.largeur < t.largeur ? t.jeu / 2 : 0);
    const y1 = b.y + (b.y > 0 ? t.jeu / 2 : 0);
    const y2 = b.y + b.longueur - (b.y + b.longueur < t.longueur ? t.jeu / 2 : 0);
    const nx = Math.max(1, Math.ceil((x2 - x1) / lim - 1e-9));
    const ny = Math.max(1, Math.ceil((y2 - y1) / lim - 1e-9));
    if (nx > 2 && ny > 2) {
      alertes.push({ boite: num, niveau: "bloquant", texte: `La boîte ${num} est trop grande dans les deux sens : coupez-la en boîtes plus petites.` });
      return;
    }
    if ((nx > 1 || ny > 1) && joue < JOUE_MIN) {
      alertes.push({ boite: num, niveau: "avertissement", texte: `Boîte ${num} : les joues de l'assemblage ne feront que ${arrondi(joue)} mm, trop fragiles. Épaississez les parois.` });
    }
    const cx = Array.from({ length: nx + 1 }, (_, a) => x1 + (a * (x2 - x1)) / nx);
    const cy = Array.from({ length: ny + 1 }, (_, c) => y1 + (c * (y2 - y1)) / ny);
    let m = 0;
    for (let c = 0; c < ny; c++) {
      for (let a = 0; a < nx; a++) {
        m++;
        const px1 = a === 0 ? x1 : cx[a] + g / 2;
        const px2 = a === nx - 1 ? x2 : cx[a + 1] - g / 2;
        const py1 = c === 0 ? y1 : cy[c] + g / 2;
        const py2 = c === ny - 1 ? y2 : cy[c + 1] - g / 2;
        const ops = [{ op: "add", couches: "f", r: R(px1, py1, px2, py2) }];
        const parois = [];
        if (a === 0) parois.push({ cote: "gauche", r: R(px1, py1, px1 + e, py2), milieu: px1 + e / 2 });
        if (a === nx - 1) parois.push({ cote: "droite", r: R(px2 - e, py1, px2, py2), milieu: px2 - e / 2 });
        if (c === 0) parois.push({ cote: "avant", r: R(px1, py1, px2, py1 + e), milieu: py1 + e / 2 });
        if (c === ny - 1) parois.push({ cote: "arriere", r: R(px1, py2 - e, px2, py2), milieu: py2 - e / 2 });
        for (const p of parois) ops.push({ op: "add", couches: "w", r: p.r });
        const tenons = [];
        const fourches = [];
        for (const p of parois) {
          const long = p.cote === "gauche" || p.cote === "droite"; // paroi parallèle à Y : traversée par les coupes en Y
          if (long) {
            if (c < ny - 1) tenons.push(R(p.milieu - tt / 2, cy[c + 1] - g / 2 - 1, p.milieu + tt / 2, cy[c + 1] + d));
            if (c > 0) fourches.push(R(p.milieu - tt / 2 - g, py1 - 1, p.milieu + tt / 2 + g, cy[c] + d + g));
          } else {
            if (a < nx - 1) tenons.push(R(cx[a + 1] - g / 2 - 1, p.milieu - tt / 2, cx[a + 1] + d, p.milieu + tt / 2));
            if (a > 0) fourches.push(R(px1 - 1, p.milieu - tt / 2 - g, cx[a] + d + g, p.milieu + tt / 2 + g));
          }
        }
        for (const r of tenons) ops.push({ op: "add", couches: "fw", r });
        for (const r of fourches) ops.push({ op: "sub", couches: "fw", r });
        const ajouts = ops.filter((o) => o.op === "add").map((o) => o.r);
        const bx1 = Math.min(...ajouts.map((r) => r.x));
        const by1 = Math.min(...ajouts.map((r) => r.y));
        const bx2 = Math.max(...ajouts.map((r) => r.x + r.largeur));
        const by2 = Math.max(...ajouts.map((r) => r.y + r.longueur));
        out.push({
          nom: `B${num}-M${m}`,
          boite: num,
          x: arrondi(bx1),
          y: arrondi(by1),
          largeur: arrondi(bx2 - bx1),
          longueur: arrondi(by2 - by1),
          hauteur: t.hauteur,
          volume_mm3: volume(ops, t.epaisseur_fond, t.hauteur),
          ops,
        });
      }
    }
  });
  return { morceaux: out, alertes };
}

// Commandes SolidCraft qui construisent chaque morceau comme un corps nommé, sans toucher aux autres.
export function script(plan) {
  const t = plan.tiroir;
  const commands = [];
  for (const m of morceaux(plan).morceaux) {
    m.ops.forEach((o, n) => {
      const params = {
        length: arrondi(o.r.largeur),
        width: arrondi(o.r.longueur),
        height: o.couches === "f" ? t.epaisseur_fond : o.op === "sub" ? t.hauteur + 2 : t.hauteur,
        corner: [arrondi(o.r.x), arrondi(o.r.y), o.op === "sub" ? -1 : 0],
        name: `${m.nom} ${n + 1}`,
      };
      if (n === 0) Object.assign(params, { operation: "new", body_name: m.nom });
      else Object.assign(params, { operation: o.op === "add" ? "join" : "cut", targets: [m.nom] });
      commands.push({ command: "solid.box", params });
    });
  }
  return { commands };
}

export const CONSIGNE = [
  "Ce fichier décrit un casier de tiroir fait de boîtes indépendantes, à imprimer en 3D une pièce à la fois.",
  "Il vient de l'appli « Casier de tiroir » ; tout est déjà calculé (jeu entre boîtes, découpes, tenons et fourches), il n'y a rien à recalculer.",
  "Pour le construire avec SolidCraft (solidcraft-cli doit être installé) :",
  "1. Écrire la liste `script_solidcraft.commands` telle quelle dans un fichier script.json.",
  "2. Lancer `solidcraft-cli eval script.json` et comparer chaque corps à la liste `morceaux` : même nombre de corps, un corps par `nom`, fermé, dont la boîte englobante va de (x, y, 0) à (x + largeur, y + longueur, hauteur) à 0,01 mm près et dont le volume vaut `volume_mm3` à 0,01 % près. Si un écart apparaît, ne rien exporter et le signaler.",
  "3. Si tout concorde, ajouter les commandes `export_3mf` à la fin du script, puis lancer `solidcraft-cli run script.json --save casier.sc` dans le dossier du fichier : cela enregistre le modèle et écrit un fichier 3MF par morceau dans impression/ (créer ce dossier avant).",
  "4. Rendre compte : nombre de morceaux, plus grand morceau, et les éventuels écarts.",
  "Les morceaux d'une même boîte (B3-M1, B3-M2…) s'assemblent par enfourchement : le tenon du morceau de plus petit numéro entre dans la fourche du suivant.",
].join("\n");

// Le fichier téléchargé : autonome, il suffit à un Claude Code avec SolidCraft pour tout construire.
export function fichier(plan) {
  const { morceaux: m, alertes } = morceaux(plan);
  return {
    version: 1,
    consigne: CONSIGNE,
    tiroir: plan.tiroir,
    boites: plan.boites,
    alertes,
    morceaux: m.map(({ ops, ...reste }) => ({ ...reste, volume_mm3: arrondi(reste.volume_mm3) })),
    script_solidcraft: script(plan),
    export_3mf: m.map((x) => ({ command: "file.export", params: { path: `impression/${x.nom}.3mf`, bodies: [x.nom] } })),
  };
}

const CHAMPS_TIROIR = ["largeur", "longueur", "hauteur", "epaisseur", "epaisseur_fond", "jeu", "plateau"];

// Relit un fichier téléchargé (ou un plan) pour le modifier ; refuse tout ce qui n'en est pas un.
export function lireFichier(texte) {
  let d;
  try {
    d = JSON.parse(texte);
  } catch {
    return { erreur: "Ce fichier n'est pas un plan de casier (ce n'est pas du JSON)." };
  }
  if (!d || typeof d !== "object" || !d.tiroir || !Array.isArray(d.boites)) return { erreur: "Ce fichier n'est pas un plan de casier." };
  if (d.version !== 1) return { erreur: `Version de plan inconnue (${d.version}) : mettez l'appli à jour.` };
  const nombre = (v) => typeof v === "number" && Number.isFinite(v);
  if (!CHAMPS_TIROIR.every((c) => nombre(d.tiroir[c]))) return { erreur: "Les cotes du tiroir sont incomplètes." };
  if (!d.boites.every((b) => ["x", "y", "largeur", "longueur"].every((c) => nombre(b[c])))) return { erreur: "Une boîte du fichier est incomplète." };
  const tiroir = Object.fromEntries(CHAMPS_TIROIR.map((c) => [c, d.tiroir[c]]));
  const boites = d.boites.map((b) => ({ x: b.x, y: b.y, largeur: b.largeur, longueur: b.longueur, auto: !!b.auto }));
  const plan = { version: 1, tiroir, boites };
  const graves = controler(plan).filter((m) => !m.startsWith("Il reste un vide"));
  if (graves.length) return { erreur: graves.join(" ") };
  return { plan };
}
