// Du plan aux morceaux à imprimer, au script SolidCraft et au fichier téléchargé.
// Une boîte plus longue que le plateau est coupée en morceaux égaux ; à chaque coupe, le morceau de
// coordonnée basse porte un tenon (tiers central de chaque paroi traversée) et le suivant une fourche.
// L'intérieur de chaque boîte est arrondi : congé entre le fond et les parois, congé dans les coins verticaux,
// arrondi de l'arête du haut côté intérieur. Les arrondis sont faits avant les tenons et les fourches, pour
// qu'ils se suivent d'un morceau à l'autre.

import { controler, lireCote, LIMITES_TIROIR } from "./logique.js?v=2026-11-22-2256";

export const TENON = { longueur: 10, jeu: 0.2 };
export const MARGE_PLATEAU = 12;
export const JOUE_MIN = 0.8;
export const ARRONDI = 2; // rayon des arrondis intérieurs, en mm

const arrondi = (v) => Math.round(v * 1000) / 1000;

// Rayons effectifs : le congé du bas et l'arrondi du haut se partagent la hauteur intérieure,
// et l'arrondi du haut laisse au moins la moitié de la paroi à plat.
export function rayons(t) {
  const libre = (t.hauteur - t.epaisseur_fond) / 2;
  return { bas: Math.min(ARRONDI, libre), haut: Math.min(ARRONDI, t.epaisseur / 2, libre) };
}

// Section retirée par un arrondi de rayon r entre u = ua et u = ub (u : distance à la face intérieure),
// c'est-à-dire la matière d'un tenon ou d'une fourche qui tombe dans l'arrondi du haut.
function sectionArrondi(r, ua, ub) {
  const a = Math.max(0, ua);
  const b = Math.min(r, ub);
  if (b <= a) return 0;
  const F = (s) => r * s - (s * Math.sqrt(r * r - s * s) + r * r * Math.asin(s / r)) / 2;
  return F(r - a) - F(r - b);
}

// Arrondis intérieurs d'un morceau : arêtes à prendre, outils qui taillent le dessus des tenons au profil
// de l'arrondi du haut (pour un bord continu une fois emboîté), et matière gagnée ou perdue par rapport aux boîtes.
function arrondis(t, P, parois, tenons, fourches) {
  const e = t.epaisseur;
  const f = t.epaisseur_fond;
  const H = t.hauteur;
  const { bas: rb, haut: rh } = rayons(t);
  const a = (cote) => parois.some((p) => p.cote === cote);
  const ix1 = P.px1 + (a("gauche") ? e : 0);
  const ix2 = P.px2 - (a("droite") ? e : 0);
  const iy1 = P.py1 + (a("avant") ? e : 0);
  const iy2 = P.py2 - (a("arriere") ? e : 0);
  const kb = (1 - Math.PI / 4) * rb * rb; // section d'un congé du bas
  const kh = (1 - Math.PI / 4) * rh * rh; // section de l'arrondi du haut
  const cg = ((10 - 3 * Math.PI) / (3 * (4 - Math.PI))) * rh; // son centre de gravité, depuis la face intérieure
  // face intérieure de chaque paroi : axe qui la traverse, position, sens vers l'extérieur
  const face = {
    gauche: { axe: "x", pos: ix1, sg: -1, pt: [ix1, (iy1 + iy2) / 2], L: iy2 - iy1, coins: a("avant") + a("arriere") },
    droite: { axe: "x", pos: ix2, sg: 1, pt: [ix2, (iy1 + iy2) / 2], L: iy2 - iy1, coins: a("avant") + a("arriere") },
    avant: { axe: "y", pos: iy1, sg: -1, pt: [(ix1 + ix2) / 2, iy1], L: ix2 - ix1, coins: a("gauche") + a("droite") },
    arriere: { axe: "y", pos: iy2, sg: 1, pt: [(ix1 + ix2) / 2, iy2], L: ix2 - ix1, coins: a("gauche") + a("droite") },
  };
  let ecart = 0;
  const aretesBas = [];
  const aretesHaut = [];
  for (const p of parois) {
    const F = face[p.cote];
    aretesBas.push([...F.pt, f]);
    aretesHaut.push([...F.pt, H]);
    // partie droite de l'arête : elle s'arrête au congé vertical de chaque coin
    ecart += (kb - kh) * (F.L - rb * F.coins);
  }
  for (const [c1, c2] of [["gauche", "avant"], ["droite", "avant"], ["gauche", "arriere"], ["droite", "arriere"]]) {
    if (!a(c1) || !a(c2)) continue;
    aretesBas.push([face[c1].pos, face[c2].pos, (f + H) / 2]);
    // congé vertical, coin du bas où trois congés se rejoignent (huitième de boule), arrondi du haut qui tourne le coin
    ecart += kb * (H - f - rb) + (1 - Math.PI / 6) * rb ** 3 - kh * (Math.PI / 2) * (rb + cg);
  }
  // r : rectangle d'un tenon ou d'une fourche ; u : sa distance à la face intérieure, s : sa position le long de la paroi
  const situer = (p, r) => {
    const F = face[p.cote];
    const [t0, t1] = F.axe === "x" ? [r.x, r.x + r.largeur] : [r.y, r.y + r.longueur];
    const [ua, ub] = [(t0 - F.pos) * F.sg, (t1 - F.pos) * F.sg].sort((m, n) => m - n);
    const [s0, s1] = F.axe === "x" ? [r.y, r.y + r.longueur] : [r.x, r.x + r.largeur];
    const [lo, hi] = F.axe === "x" ? [P.py1, P.py2] : [P.px1, P.px2];
    return { F, ua, ub, s0, s1, lo, hi };
  };
  const tailles = [];
  for (const { p, r } of tenons) {
    const { F, ua, ub, s0, s1, hi } = situer(p, r);
    const section = sectionArrondi(rh, ua, ub);
    if (section <= 0) continue;
    ecart -= section * (s1 - hi); // la partie ancrée dans la paroi est déjà arrondie
    const [c0, c1] = [F.pos + F.sg * Math.max(0, ua - 0.2), F.pos + F.sg * rh].sort((m, n) => m - n);
    const long = s1 + 0.5 - s0;
    const centre = F.pos + F.sg * rh;
    tailles.push(
      F.axe === "x"
        ? { boite: { length: c1 - c0, width: long, height: rh + 1, corner: [c0, s0, H - rh] }, cylindre: { radius: rh, height: long + 2, base: [centre, s0 - 1, H - rh], axis: "Y" } }
        : { boite: { length: long, width: c1 - c0, height: rh + 1, corner: [s0, c0, H - rh] }, cylindre: { radius: rh, height: long + 2, base: [s0 - 1, centre, H - rh], axis: "X" } },
    );
  }
  for (const { p, r } of fourches) {
    const { ua, ub, s0, s1, lo, hi } = situer(p, r);
    ecart += sectionArrondi(rh, ua, ub) * Math.max(0, Math.min(s1, hi) - Math.max(s0, lo)); // déjà retiré par l'arrondi
  }
  return { conges: { bas: rb, haut: rh, aretesBas, aretesHaut }, tailles, ecart };
}

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
    // un morceau coupé porte un tenon qui dépasse de d + g/2 : il doit tenir dans lim, tenon compris
    const nombre = (cote) => (cote <= lim ? 1 : Math.ceil(cote / (lim - d - g / 2) - 1e-9));
    const nx = nombre(x2 - x1);
    const ny = nombre(y2 - y1);
    if (nx > 2 && ny > 2) {
      alertes.push({ boite: num, niveau: "bloquant", texte: `La boîte ${num} est trop grande dans les deux sens : coupez-la en boîtes plus petites.` });
      return;
    }
    if ((nx > 1 || ny > 1) && joue < JOUE_MIN) {
      alertes.push({ boite: num, niveau: "avertissement", texte: `Boîte ${num} : les joues de l'assemblage ne feront que ${String(Math.round(joue * 100) / 100).replace(".", ",")} mm, trop fragiles. Épaississez les parois.` });
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
            if (c < ny - 1) tenons.push({ p, r: R(p.milieu - tt / 2, cy[c + 1] - g / 2 - 1, p.milieu + tt / 2, cy[c + 1] + d) });
            if (c > 0) fourches.push({ p, r: R(p.milieu - tt / 2 - g, py1 - 1, p.milieu + tt / 2 + g, cy[c] + d + g) });
          } else {
            if (a < nx - 1) tenons.push({ p, r: R(cx[a + 1] - g / 2 - 1, p.milieu - tt / 2, cx[a + 1] + d, p.milieu + tt / 2) });
            if (a > 0) fourches.push({ p, r: R(px1 - 1, p.milieu - tt / 2 - g, cx[a] + d + g, p.milieu + tt / 2 + g) });
          }
        }
        for (const { r } of tenons) ops.push({ op: "add", couches: "fw", r });
        for (const { r } of fourches) ops.push({ op: "sub", couches: "fw", r });
        const { conges, tailles, ecart } = arrondis(t, { px1, px2, py1, py2 }, parois, tenons, fourches);
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
          volume_mm3: volume(ops, t.epaisseur_fond, t.hauteur) + ecart,
          ops,
          conges,
          tailles,
        });
      }
    }
  });
  return { morceaux: out, alertes };
}

// Commandes SolidCraft qui construisent chaque morceau comme un corps nommé, sans toucher aux autres.
// Ordre : fond et parois, arrondis, tenons, taille du dessus des tenons, fourches.
export function script(plan) {
  const t = plan.tiroir;
  const commands = [];
  const pt = (p) => p.map(arrondi);
  for (const m of morceaux(plan).morceaux) {
    const boite = (o, n) => {
      const params = {
        length: arrondi(o.r.largeur),
        width: arrondi(o.r.longueur),
        height: o.couches === "f" ? t.epaisseur_fond : o.op === "sub" ? t.hauteur + 2 : t.hauteur,
        corner: [arrondi(o.r.x), arrondi(o.r.y), o.op === "sub" ? -1 : 0],
        name: `${m.nom} ${n + 1}`,
      };
      if (n === 0) Object.assign(params, { operation: "new", body_name: m.nom });
      else Object.assign(params, { operation: o.op === "add" ? "join" : "cut", targets: [m.nom] });
      return { command: "solid.box", params };
    };
    const etapes = m.ops.map((o, n) => ({ o, c: boite(o, n) }));
    const de = (filtre) => etapes.filter(({ o }) => filtre(o)).map(({ c }) => c);
    commands.push(...de((o) => o.couches !== "fw"));
    const { bas, haut, aretesBas, aretesHaut } = m.conges;
    commands.push({ command: "solid.fillet", params: { edges: aretesBas.map(pt), radius: `${arrondi(bas)} mm`, body: m.nom, tangent_chain: false, name: `${m.nom} congés` } });
    commands.push({ command: "solid.fillet", params: { edges: aretesHaut.map(pt), radius: `${arrondi(haut)} mm`, body: m.nom, tangent_chain: true, name: `${m.nom} arrondi haut` } });
    commands.push(...de((o) => o.couches === "fw" && o.op === "add"));
    m.tailles.forEach(({ boite: b, cylindre: c }, k) => {
      const outil = `${m.nom} outil ${k + 1}`;
      commands.push({ command: "solid.box", params: { length: arrondi(b.length), width: arrondi(b.width), height: arrondi(b.height), corner: pt(b.corner), operation: "new", body_name: outil, name: outil } });
      commands.push({ command: "solid.cylinder", params: { radius: `${arrondi(c.radius)} mm`, height: arrondi(c.height), base: pt(c.base), axis: c.axis, operation: "cut", targets: [outil], name: `${outil} profil` } });
      commands.push({ command: "solid.combine", params: { target: m.nom, tools: [outil], operation: "cut", name: `${m.nom} taille tenon ${k + 1}` } });
    });
    commands.push(...de((o) => o.couches === "fw" && o.op === "sub"));
  }
  return { commands };
}

export const CONSIGNE = [
  "Ce fichier décrit un casier de tiroir fait de boîtes indépendantes, à imprimer en 3D une pièce à la fois.",
  "Il vient de l'appli « Casier de tiroir » ; tout est déjà calculé (jeu entre boîtes, découpes, tenons et fourches, arrondis intérieurs), il n'y a rien à recalculer.",
  "Pour le construire avec SolidCraft (solidcraft-cli doit être installé ; avec le serveur MCP de SolidCraft, les mêmes commandes passent par l'outil batch) :",
  "1. Écrire la liste `script_solidcraft.commands` telle quelle dans un fichier script.json.",
  "2. Lancer `solidcraft-cli eval script.json --json-out mesures.json` et comparer chaque corps à la liste `morceaux` : même nombre de corps, un corps par `nom`, fermé, dont la boîte englobante va de (x, y, 0) à (x + largeur, y + longueur, hauteur) à 0,01 mm près, dont le volume vaut `volume_mm3` à 0,01 % près, et aucun plus grand que `tiroir.plateau` − 12 mm en X ou en Y (sinon il ne tiendrait pas sur le plateau). Si un écart apparaît, ne rien exporter et le signaler.",
  "3. Si tout concorde, créer un dossier impression/ à côté de ce fichier, ajouter à la fin de la liste de script.json les commandes du champ `export_3mf` de ce fichier, puis lancer `solidcraft-cli run script.json --save casier.sc` dans ce dossier : cela enregistre le modèle et écrit un fichier 3MF par morceau dans impression/.",
  "4. Rendre compte : nombre de morceaux, plus grand morceau, et les éventuels écarts.",
  "Les morceaux sont exportés à leur place dans le tiroir : le trancheur les recentre sur le plateau.",
  "Les morceaux d'une même boîte (B3-M1, B3-M2…) s'assemblent par enfourchement : le tenon du morceau de plus petit numéro entre dans la fourche du suivant.",
  "L'intérieur de chaque boîte est arrondi (congés du fond et des coins, arête du haut) ; le dessus des tenons est taillé au profil de l'arrondi du haut, pour que le bord soit continu une fois emboîté. Les corps « … outil n » que crée le script sont absorbés aussitôt par la taille et ne restent pas.",
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
    morceaux: m.map(({ ops, conges, tailles, ...reste }) => ({ ...reste, volume_mm3: arrondi(reste.volume_mm3) })),
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
  if (d && typeof d === "object" && d.version !== undefined && d.version !== 1) {
    return { erreur: `Version de plan inconnue (${d.version}) : mettez l'appli à jour.` };
  }
  if (!d || typeof d !== "object" || d.version !== 1 || !d.tiroir || typeof d.tiroir !== "object" || !Array.isArray(d.boites)) {
    return { erreur: "Ce fichier n'est pas un plan de casier." };
  }
  const nombre = (v) => typeof v === "number" && Number.isFinite(v);
  if (!CHAMPS_TIROIR.every((c) => nombre(d.tiroir[c]))) return { erreur: "Les cotes du tiroir sont incomplètes." };
  for (const c of CHAMPS_TIROIR) {
    const lu = lireCote(String(d.tiroir[c]), { ...LIMITES_TIROIR[c], entier: false });
    if (lu.erreur) return { erreur: `Cote « ${c} » du tiroir invalide : ${lu.erreur}` };
  }
  if (d.tiroir.hauteur <= d.tiroir.epaisseur_fond) return { erreur: "La hauteur du tiroir doit dépasser l'épaisseur du fond." };
  if (!d.boites.every((b) => b && typeof b === "object" && ["x", "y", "largeur", "longueur"].every((c) => nombre(b[c])))) return { erreur: "Une boîte du fichier est incomplète." };
  const tiroir = Object.fromEntries(CHAMPS_TIROIR.map((c) => [c, d.tiroir[c]]));
  const boites = d.boites.map((b) => ({ x: b.x, y: b.y, largeur: b.largeur, longueur: b.longueur, auto: !!b.auto }));
  const plan = { version: 1, tiroir, boites };
  const graves = controler(plan).filter((m) => !m.startsWith("Il reste un vide"));
  if (graves.length) return { erreur: graves.join(" ") };
  return { plan };
}

// Nom du fichier téléchargé, à la date locale (la date UTC change à 1 h du matin en France).
export function nomFichier(date = new Date()) {
  const deux = (n) => String(n).padStart(2, "0");
  return `casier-${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}.json`;
}
