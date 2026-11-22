// Interface : dessin du plan, souris, panneaux, fichier. Toute la géométrie vient de logique.js et
// solidcraft.js ; ce fichier ne fait que les appeler et afficher le résultat.
import {
  tailleMin, coller, rogner, zoneLibre, bande, couper, redimensionner, deplacer, changerTiroir,
  remplir, controler, lireCote, contient, texteVide, LIMITES_TIROIR,
} from "./logique.js?v=2026-11-22-2256";
import { morceaux, fichier, lireFichier, nomFichier } from "./solidcraft.js?v=2026-11-22-2256";

const CLE = "casier-tiroir-plan";
const TIROIR_DEFAUT = { largeur: 325, longueur: 405, hauteur: 60, epaisseur: 4, epaisseur_fond: 3, jeu: 0.5, plateau: 180 };
const CHAMPS = LIMITES_TIROIR;
const NS = "http://www.w3.org/2000/svg";
const MARGE = 12;

const $ = (s) => document.querySelector(s);
const svg = $("#plan");
const mm = (v) => Number(v.toFixed(2)).toLocaleString("fr-FR");

let plan = charger();
let passe = [];
let futur = [];
let selection = null; // {type: "boite", index} | {type: "zone", rect}
let apercu = null; // boîtes ajoutées par le remplissage, en attente de confirmation
let etroits = [];
let geste = null; // tracé, redimension ou déplacement en cours
let vue = null; // viewBox courante {x, y, w, h}

// ---------- état, mémoire, annuler ----------

function charger() {
  try {
    const lu = lireFichier(localStorage.getItem(CLE) || "");
    if (lu.plan) return lu.plan;
  } catch {
    // mémoire du navigateur indisponible : on repart d'un plan vide
  }
  return { version: 1, tiroir: { ...TIROIR_DEFAUT }, boites: [] };
}

function memoriser() {
  try {
    localStorage.setItem(CLE, JSON.stringify(plan));
  } catch {
    // navigation privée ou stockage plein : le plan reste dans la page
  }
}

function changer(nouveau) {
  passe.push(plan);
  if (passe.length > 200) passe.shift();
  futur = [];
  plan = nouveau;
  apercu = null;
  etroits = [];
  memoriser();
  tout();
}

function annuler() {
  if (!passe.length) return;
  futur.push(plan);
  plan = passe.pop();
  selection = null;
  apercu = null;
  etroits = [];
  memoriser();
  tout();
}

function retablir() {
  if (!futur.length) return;
  passe.push(plan);
  plan = futur.pop();
  selection = null;
  apercu = null;
  etroits = [];
  memoriser();
  tout();
}

function message(texte, genre = "info") {
  const zone = $("#messages");
  zone.replaceChildren();
  if (!texte) return;
  const p = document.createElement("p");
  p.className = genre;
  p.textContent = texte;
  zone.append(p);
}

// ---------- coordonnées ----------

function ajusterVue(forcer = false) {
  const t = plan.tiroir;
  if (!vue || forcer) vue = { x: -MARGE, y: -MARGE, w: t.largeur + 2 * MARGE, h: t.longueur + 2 * MARGE };
  svg.setAttribute("viewBox", `${vue.x} ${vue.y} ${vue.w} ${vue.h}`);
}

// Le plan est vu de dessus, l'avant du tiroir (Y = 0) en bas de l'écran.
const versEcranY = (y) => plan.tiroir.longueur - y;

function versMm(evt) {
  const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: plan.tiroir.longueur - p.y };
}

function pixelsParMm() {
  const r = svg.getBoundingClientRect();
  return Math.min(r.width / vue.w, r.height / vue.h);
}

// ---------- dessin ----------

function el(nom, attrs = {}, parent) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}

function rectSvg(r, classe, parent) {
  return el("rect", { x: r.x, y: versEcranY(r.y + r.longueur), width: r.largeur, height: r.longueur, class: classe }, parent);
}

function texte(contenu, x, y, taille, classe, parent) {
  const n = el("text", { x, y: versEcranY(y), "font-size": taille, "stroke-width": taille * 0.35, class: classe }, parent);
  n.textContent = contenu;
  return n;
}

function dessiner() {
  const t = plan.tiroir;
  ajusterVue();
  svg.replaceChildren();
  const px = pixelsParMm();

  rectSvg({ x: 0, y: 0, largeur: t.largeur, longueur: t.longueur }, "tiroir", svg);
  const grille = el("g", {}, svg);
  if (px * 1 >= 4) {
    for (let x = 1; x < t.largeur; x++) if (x % 10) el("line", { x1: x, y1: 0, x2: x, y2: t.longueur, class: "grille-fine" }, grille);
    for (let y = 1; y < t.longueur; y++) if (y % 10) el("line", { x1: 0, y1: versEcranY(y), x2: t.largeur, y2: versEcranY(y), class: "grille-fine" }, grille);
  }
  const pas = px * 10 >= 5 ? 10 : 50;
  for (let x = pas; x < t.largeur; x += pas) el("line", { x1: x, y1: 0, x2: x, y2: t.longueur, class: "grille-forte" }, grille);
  for (let y = pas; y < t.longueur; y += pas) el("line", { x1: 0, y1: versEcranY(y), x2: t.largeur, y2: versEcranY(y), class: "grille-forte" }, grille);

  // pendant un déplacement, on montre la boîte à sa place provisoire
  const vues = geste?.type === "deplacer" && geste.bouge ? geste.boites : plan.boites;
  svg.classList.toggle("deplace", geste?.type === "deplacer" && geste.bouge);
  const { morceaux: pieces, alertes } = morceaux({ ...plan, boites: [...vues, ...(apercu || [])] });
  const niveau = (n) => alertes.find((a) => a.boite === n)?.niveau;
  const toutes = [...vues.map((b) => ({ b, apercu: false })), ...(apercu || []).map((b) => ({ b, apercu: true }))];
  toutes.forEach(({ b, apercu: ap }, k) => {
    const n = k + 1;
    const classes = ["boite"];
    if (b.auto) classes.push("auto");
    if (ap) classes.push("apercu");
    if (niveau(n) === "bloquant") classes.push("bloquant");
    else if (niveau(n) === "avertissement") classes.push("avert");
    if (selection?.type === "boite" && selection.index === k && !ap) classes.push("choisie");
    // un petit retrait à l'écran laisse voir le tiroir entre deux boîtes : chaque pourtour se lit seul
    const retrait = Math.min(1.5 / px, b.largeur / 4, b.longueur / 4);
    const r = rectSvg({ x: b.x + retrait, y: b.y + retrait, largeur: b.largeur - 2 * retrait, longueur: b.longueur - 2 * retrait }, classes.join(" "), svg);
    r.dataset.index = ap ? "" : k;
  });
  for (const p of pieces) {
    const nb = pieces.filter((q) => q.boite === p.boite).length;
    if (nb > 1) rectSvg(p.ops[0].r, "morceau", svg);
  }
  toutes.forEach(({ b, apercu: ap }, k) => {
    const n = k + 1;
    const fond = b.auto || ap ? " sur-auto" : "";
    const cote = Math.min(b.largeur, b.longueur);
    const taille = Math.max(Math.min(cote / 5, 14), 3.5);
    const cx = b.x + b.largeur / 2;
    const cy = b.y + b.longueur / 2;
    texte(`${mm(b.largeur)} × ${mm(b.longueur)}`, cx, cy, taille, `cote${fond}`, svg);
    const nb = pieces.filter((q) => q.boite === n).length;
    const sous = nb > 1 ? `n° ${n} · ${nb} morceaux` : `n° ${n}`;
    if (cote > 30) texte(sous, cx, cy - taille * 1.3, taille * 0.7, `cote petite${fond}`, svg);
  });
  for (const r of etroits) rectSvg(r, "etroit", svg);

  if (selection?.type === "zone") rectSvg(selection.rect, "zone", svg);
  if (geste?.type === "trace" && geste.rect) {
    rectSvg(geste.rect, geste.valide ? "trace" : "trace invalide", svg);
    texte(`${mm(geste.rect.largeur)} × ${mm(geste.rect.longueur)}`, geste.rect.x + geste.rect.largeur / 2,
      geste.rect.y + geste.rect.longueur / 2, Math.max(Math.min(Math.min(geste.rect.largeur, geste.rect.longueur) / 5, 14), 4), "cote", svg);
  }
  if (selection?.type === "boite") {
    const b = geste?.type === "bord" && geste.apercu ? geste.apercu : vues[selection.index];
    if (b) poignees(b);
  }
}

function poignees(b) {
  const r = Math.max(2.5, 6 / pixelsParMm());
  const points = {
    gauche: [b.x, b.y + b.longueur / 2, "h"],
    droite: [b.x + b.largeur, b.y + b.longueur / 2, "h"],
    bas: [b.x + b.largeur / 2, b.y, "v"],
    haut: [b.x + b.largeur / 2, b.y + b.longueur, "v"],
  };
  for (const [bord, [x, y, sens]] of Object.entries(points)) {
    const c = el("circle", { cx: x, cy: versEcranY(y), r, class: `poignee ${sens}` }, svg);
    c.dataset.bord = bord;
  }
}

// ---------- panneaux ----------

function panneauTiroir() {
  for (const [nom] of Object.entries(CHAMPS)) {
    const champ = $(`#cotes [name="${nom}"]`);
    if (document.activeElement !== champ) champ.value = String(plan.tiroir[nom]).replace(".", ",");
    champ.classList.remove("invalide");
  }
}

function bouton(libelle, action, classe = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = libelle;
  if (classe) b.className = classe;
  b.addEventListener("click", action);
  return b;
}

function champ(valeur, libelle, largeur = 70) {
  const i = document.createElement("input");
  i.setAttribute("aria-label", libelle);
  i.value = String(valeur).replace(".", ",");
  i.inputMode = "decimal";
  i.style.width = `${largeur}px`;
  return i;
}

function ligne(...enfants) {
  const d = document.createElement("div");
  d.className = "ligne";
  for (const e of enfants) d.append(typeof e === "string" ? Object.assign(document.createElement("span"), { textContent: e }) : e);
  return d;
}

function choix(options, libelle) {
  const s = document.createElement("select");
  s.setAttribute("aria-label", libelle);
  for (const [v, l] of options) s.append(new Option(l, v));
  return s;
}

function panneauOutil() {
  const zone = $("#outil");
  zone.replaceChildren();
  if (selection?.type === "zone") {
    const r = selection.rect;
    const h = document.createElement("h3");
    h.textContent = `Zone libre ${mm(r.largeur)} × ${mm(r.longueur)} mm`;
    const sorte = choix([["colonne:gauche", "Colonne à gauche"], ["colonne:droite", "Colonne à droite"], ["rangee:bas", "Rangée devant (en bas)"], ["rangee:haut", "Rangée au fond (en haut)"]], "Sorte de bande");
    const cote = champ(100, "Cote de la bande en millimètres");
    const ajouter = () => {
      const [sens, cote_] = sorte.value.split(":");
      const lu = lireCote(cote.value, { min: tailleMin(plan.tiroir), entier: true });
      if (lu.erreur) return message(lu.erreur, "erreur");
      const b = bande(r, sens, cote_, lu.valeur);
      ajouterBoite(b, 0);
    };
    zone.append(h, ligne(sorte), ligne(cote, "mm", bouton("Ajouter", ajouter, "principal")),
      ligne(bouton("Une boîte sur toute la zone", () => ajouterBoite(r, 0))),
      Object.assign(document.createElement("p"), { textContent: "La bande ne prend que la place libre de cette zone." }));
    return;
  }
  if (selection?.type !== "boite") {
    const libres = remplir(plan.boites, plan.tiroir).ajoutees;
    if (!libres.length) return;
    const h = document.createElement("h3");
    h.textContent = "Ajouter des boîtes";
    zone.append(h,
      Object.assign(document.createElement("p"), { textContent: "Glissez sur le plan, ou choisissez une zone libre pour y poser une colonne ou une rangée." }),
      ligne(bouton("Choisir la plus grande zone libre", () => {
        const plus = libres.reduce((a, b) => (b.largeur * b.longueur > a.largeur * a.longueur ? b : a));
        selection = { type: "zone", rect: zoneLibre({ x: plus.x + 0.5, y: plus.y + 0.5 }, plan.boites, plan.tiroir) };
        tout();
        $("#outil select")?.focus();
      })));
    return;
  }
  const k = selection.index;
  const b = plan.boites[k];
  if (!b) return;
  const { morceaux: pieces, alertes } = morceaux(plan);
  const nb = pieces.filter((p) => p.boite === k + 1).length;
  const h = document.createElement("h3");
  h.textContent = `Boîte n° ${k + 1}${b.auto ? " (ajoutée)" : ""}`;
  const larg = champ(b.largeur, "Largeur de la boîte en millimètres");
  const long = champ(b.longueur, "Longueur de la boîte en millimètres");
  const appliquerTaille = () => {
    let boites = plan.boites;
    for (const [entree, bord, depart] of [[larg, "droite", b.x], [long, "haut", b.y]]) {
      const lu = lireCote(entree.value, { min: 1, entier: true });
      if (lu.erreur) return message(lu.erreur, "erreur");
      const r = redimensionner(boites, k, bord, depart + lu.valeur, plan.tiroir, 0);
      if (r.erreur) return message(r.erreur, "erreur");
      boites = r;
    }
    changer({ ...plan, boites: boites.map((x, i) => (i === k ? { ...x, auto: false } : x)) });
    message("");
  };
  const parts = champ(2, "Nombre de parts", 50);
  const premiere = champ(100, "Longueur de la première boîte en millimètres");
  const decouper = (axe, choixCoupe) => {
    const res = couper(b, axe, choixCoupe, plan.tiroir);
    if (res.erreur) return message(res.erreur, "erreur");
    const boites = [...plan.boites.slice(0, k), ...res, ...plan.boites.slice(k + 1)];
    selection = null;
    changer({ ...plan, boites });
    message("");
  };
  const lireParts = () => lireCote(parts.value, { min: 2, max: 50, entier: true });
  const lirePremiere = () => lireCote(premiere.value, { min: 1, entier: true });
  const viaLecture = (lire, f) => () => {
    const lu = lire();
    if (lu.erreur) return message(lu.erreur, "erreur");
    f(lu.valeur);
  };
  zone.append(
    h,
    ligne("Largeur", larg, "mm"),
    ligne("Longueur", long, "mm", bouton("Appliquer", appliquerTaille)),
    Object.assign(document.createElement("p"), { textContent: nb > 1 ? `Imprimée en ${nb} morceaux assemblés par enfourchement.` : "Imprimée d'une seule pièce." }),
    ligne("Couper en", parts, "parts :"),
    ligne(bouton("côte à côte", viaLecture(lireParts, (n) => decouper("x", { parts: n }))), bouton("l'une derrière l'autre", viaLecture(lireParts, (n) => decouper("y", { parts: n })))),
    ligne("Une première de", premiere, "mm :"),
    ligne(bouton("à gauche", viaLecture(lirePremiere, (v) => decouper("x", { premiere: v }))), bouton("devant", viaLecture(lirePremiere, (v) => decouper("y", { premiere: v })))),
    ligne(bouton("Supprimer la boîte", supprimer, "danger")),
  );
  for (const a of alertes.filter((x) => x.boite === k + 1)) {
    zone.append(Object.assign(document.createElement("p"), { textContent: a.texte, className: a.niveau === "bloquant" ? "alerte" : "avert" }));
  }
}

function panneauListe() {
  const liste = $("#liste");
  liste.replaceChildren();
  const { morceaux: pieces, alertes } = morceaux(plan);
  plan.boites.forEach((b, k) => {
    const li = document.createElement("li");
    if (b.auto) li.classList.add("auto");
    if (selection?.type === "boite" && selection.index === k) li.classList.add("choisie");
    const nb = pieces.filter((p) => p.boite === k + 1).length;
    const bloque = alertes.some((a) => a.boite === k + 1 && a.niveau === "bloquant");
    const choisir = document.createElement("button");
    choisir.type = "button";
    choisir.className = "ligne-boite";
    choisir.setAttribute("aria-pressed", String(selection?.type === "boite" && selection.index === k));
    choisir.innerHTML = `<span><span class="num">${k + 1}</span> ${mm(b.largeur)} × ${mm(b.longueur)} mm</span>`
      + `<small class="${bloque ? "bloquant" : ""}">${bloque ? "trop grande" : nb > 1 ? `${nb} morceaux` : "1 pièce"}</small>`;
    li.append(choisir);
    choisir.addEventListener("click", () => {
      selection = { type: "boite", index: k };
      tout();
    });
    liste.append(li);
  });
  const total = pieces.length;
  $("#resume").textContent = plan.boites.length ? `${plan.boites.length} boîte${plan.boites.length > 1 ? "s" : ""}, ${total} pièce${total > 1 ? "s" : ""} à imprimer` : "aucune pour l'instant";
}

function tout() {
  dessiner();
  panneauTiroir();
  panneauOutil();
  panneauListe();
  $("#annuler").disabled = !passe.length;
  $("#retablir").disabled = !futur.length;
}

// ---------- actions ----------

// `tol` = 0 quand la boîte vient d'une cote tapée : elle reste exacte.
function ajouterBoite(r, tol) {
  const propre = coller(r, plan.boites, plan.tiroir, tol);
  const rogne = rogner(propre, { x: propre.x, y: propre.y }, plan.boites, plan.tiroir);
  if (!rogne) return message(`Pas assez de place : une boîte fait au moins ${tailleMin(plan.tiroir)} mm de côté.`, "erreur");
  selection = { type: "boite", index: plan.boites.length };
  changer({ ...plan, boites: [...plan.boites, { ...rogne, auto: false }] });
  message("");
}

function supprimer() {
  if (selection?.type !== "boite") return;
  const k = selection.index;
  selection = null;
  changer({ ...plan, boites: plan.boites.filter((_, i) => i !== k) });
}

// Enregistre la nouvelle place d'une boîte (annulable) ; rien si elle n'a pas bougé.
function poserDeplacement(k, boites) {
  const avant = plan.boites[k];
  const apres = boites[k];
  if (apres.x === avant.x && apres.y === avant.y) return false;
  selection = { type: "boite", index: k };
  changer({ ...plan, boites: boites.map((b, i) => (i === k ? { ...b, auto: false } : b)) });
  message("");
  return true;
}

function couperAuClic(k, p, autreSens) {
  const b = plan.boites[k];
  let axe = b.largeur >= b.longueur ? "x" : "y";
  if (autreSens) axe = axe === "x" ? "y" : "x";
  const premiere = axe === "x" ? Math.round(p.x - b.x) : Math.round(p.y - b.y);
  const res = couper(b, axe, { premiere }, plan.tiroir);
  if (res.erreur) return message(res.erreur, "erreur");
  selection = null;
  changer({ ...plan, boites: [...plan.boites.slice(0, k), ...res, ...plan.boites.slice(k + 1)] });
}

function cotesTiroir(evt) {
  const champ_ = evt.target;
  const nom = champ_.name;
  if (!CHAMPS[nom]) return;
  const lu = lireCote(champ_.value, CHAMPS[nom]);
  if (lu.erreur) {
    champ_.classList.add("invalide");
    message(`${champ_.closest("label").firstChild.textContent.trim()} : ${lu.erreur}`, "erreur");
    champ_.value = String(plan.tiroir[nom]).replace(".", ",");
    return;
  }
  if (lu.valeur === plan.tiroir[nom]) return;
  const { plan: nouveau, messages } = changerTiroir(plan, { ...plan.tiroir, [nom]: lu.valeur });
  selection = null;
  if (nom === "largeur" || nom === "longueur") vue = null;
  changer(nouveau);
  message(messages.join(" "), messages.length ? "erreur" : "info");
}

function valider() {
  if (geste) return;
  const { alertes } = morceaux(plan);
  const bloquants = alertes.filter((a) => a.niveau === "bloquant");
  if (bloquants.length) return message(bloquants.map((a) => a.texte).join(" "), "erreur");
  const { ajoutees, trop_etroits } = remplir(plan.boites, plan.tiroir);
  if (trop_etroits.length) {
    etroits = trop_etroits;
    apercu = null;
    tout();
    const liste = trop_etroits.map(texteVide).join(" ; ");
    return message(`${trop_etroits.length > 1 ? "Ces vides sont trop étroits" : "Ce vide est trop étroit"} pour une boîte (en rouge) : ${liste}. Agrandissez une boîte voisine pour ${trop_etroits.length > 1 ? "les" : "le"} combler.`, "erreur");
  }
  apercu = ajoutees;
  etroits = [];
  const autre = morceaux({ ...plan, boites: [...plan.boites, ...ajoutees] }).alertes.filter((a) => a.niveau === "bloquant");
  dessiner();
  if (autre.length) {
    apercu = null;
    tout();
    return message(`Une boîte ajoutée pour combler un vide serait trop grande : tracez vous-même les boîtes de cette zone. ${autre[0].texte}`, "erreur");
  }
  const complet = { ...plan, boites: [...plan.boites, ...ajoutees] };
  const { morceaux: piecesCompletes, alertes: alertesCompletes } = morceaux(complet);
  const nbPieces = piecesCompletes.length;
  const avertissements = regrouper(alertesCompletes.filter((a) => a.niveau === "avertissement"));
  $("#confirmer-texte").textContent = (ajoutees.length
    ? `${ajoutees.length} boîte${ajoutees.length > 1 ? "s ont été ajoutées" : " a été ajoutée"} pour combler les vides (en bleu). `
    : "Le tiroir est entièrement couvert. ")
    + `Le casier compte ${complet.boites.length} boîte${complet.boites.length > 1 ? "s" : ""}, soit ${nbPieces} pièce${nbPieces > 1 ? "s" : ""} à imprimer. `
    + "Le fichier téléchargé contient tout ce qu'il faut pour construire les pièces dans SolidCraft."
    + (avertissements.length ? ` Attention : ${avertissements.join(" ")}` : "");
  const dlg = $("#confirmer");
  dlg.returnValue = "";
  dlg.showModal();
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "oui") {
      changer(complet);
      telecharger(complet);
      message("Fichier téléchargé. Donnez-le à Claude Code sur un poste qui a SolidCraft : « construis ce casier ».", "ok");
    } else {
      apercu = null;
      tout();
    }
  }, { once: true });
}

// « Boîte 1 : X » + « Boîte 2 : X » → « Boîtes 1 et 2 : X ».
function regrouper(alertes) {
  const parTexte = new Map();
  for (const a of alertes) {
    const fin = a.texte.replace(/^Boîte \d+ : /, "");
    parTexte.set(fin, [...(parTexte.get(fin) || []), a.boite]);
  }
  return [...parTexte].map(([fin, nums]) => {
    const liste = nums.length > 1 ? `${nums.slice(0, -1).join(", ")} et ${nums.at(-1)}` : String(nums[0]);
    return `${nums.length > 1 ? "Boîtes" : "Boîte"} ${liste} : ${fin}`;
  });
}

function telecharger(p) {
  const contenu = JSON.stringify(fichier(p), null, 1);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
  a.download = nomFichier();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function ouvrir(evt) {
  const f = evt.target.files[0];
  evt.target.value = "";
  if (!f) return;
  const lu = lireFichier(await f.text());
  if (lu.erreur) return message(`${f.name} : ${lu.erreur} Le plan en cours est conservé.`, "erreur");
  selection = null;
  vue = null;
  changer(lu.plan);
  message(`${f.name} ouvert.`, "ok");
}

// ---------- souris ----------

function boiteSous(p) {
  return plan.boites.findIndex((b) => contient(b, p));
}

svg.addEventListener("pointerdown", (evt) => {
  if (evt.button !== 0) return;
  const p = versMm(evt);
  const bord = evt.target.dataset?.bord;
  const k = boiteSous(p);
  if (bord && selection?.type === "boite") {
    geste = { type: "bord", bord, index: selection.index };
  } else if (k >= 0) {
    const b = plan.boites[k];
    geste = { type: "deplacer", index: k, depart: p, origine: { x: b.x, y: b.y }, boites: plan.boites, ecran: [evt.clientX, evt.clientY], bouge: false };
  } else {
    geste = { type: "trace", depart: p, ecran: [evt.clientX, evt.clientY], bouge: false };
  }
  try {
    svg.setPointerCapture(evt.pointerId);
  } catch {
    // capture refusée : le relâchement est aussi écouté sur la fenêtre
  }
});

window.addEventListener("pointermove", (evt) => {
  if (!geste) return;
  const p = versMm(evt);
  if (geste.type === "bord") {
    const valeur = geste.bord === "gauche" || geste.bord === "droite" ? p.x : p.y;
    const r = redimensionner(plan.boites, geste.index, geste.bord, valeur, plan.tiroir);
    geste.apercu = r.erreur ? null : r[geste.index];
    geste.resultat = r;
    dessiner();
    return;
  }
  if (Math.hypot(evt.clientX - geste.ecran[0], evt.clientY - geste.ecran[1]) < 4 && !geste.bouge) return;
  if (geste.type === "deplacer") {
    if (!geste.bouge) {
      selection = { type: "boite", index: geste.index };
      apercu = null;
      etroits = [];
    }
    geste.bouge = true;
    // on part toujours de la dernière place valide : la boîte bute sans traverser
    const cible = { x: geste.origine.x + p.x - geste.depart.x, y: geste.origine.y + p.y - geste.depart.y };
    geste.boites = deplacer(geste.boites, geste.index, cible, plan.tiroir);
    dessiner();
    return;
  }
  geste.bouge = true;
  const brut = {
    x: Math.min(geste.depart.x, p.x), y: Math.min(geste.depart.y, p.y),
    largeur: Math.abs(p.x - geste.depart.x), longueur: Math.abs(p.y - geste.depart.y),
  };
  const colle = coller(brut, plan.boites, plan.tiroir);
  geste.rect = rogner(colle, geste.depart, plan.boites, plan.tiroir) || colle;
  geste.valide = !!rogner(colle, geste.depart, plan.boites, plan.tiroir);
  dessiner();
});

// Le relâchement peut arriver hors du plan (souris sortie de la zone) : on l'écoute sur la fenêtre.
window.addEventListener("pointerup", (evt) => {
  if (!geste) return;
  const g = geste;
  geste = null;
  const p = versMm(evt);
  if (g.type === "bord") {
    if (g.resultat && !g.resultat.erreur) {
      changer({ ...plan, boites: g.resultat.map((b, i) => (i === g.index ? { ...b, auto: false } : b)) });
      message("");
    } else {
      if (g.resultat?.erreur) message(g.resultat.erreur, "erreur");
      tout();
    }
    return;
  }
  if (g.type === "deplacer" && g.bouge) {
    if (!poserDeplacement(g.index, g.boites)) tout();
    return;
  }
  if (g.bouge) {
    if (!g.valide) {
      message(boiteSous(g.depart) >= 0 ? "Commencez le tracé dans une zone libre." : `Trop petit : une boîte fait au moins ${tailleMin(plan.tiroir)} mm de côté.`, "erreur");
      tout();
      return;
    }
    selection = { type: "boite", index: plan.boites.length };
    changer({ ...plan, boites: [...plan.boites, { ...g.rect, auto: false }] });
    message("");
    return;
  }
  // simple clic
  const k = boiteSous(p);
  if (k >= 0) selection = { type: "boite", index: k };
  else {
    const z = zoneLibre(p, plan.boites, plan.tiroir);
    selection = z ? { type: "zone", rect: z } : null;
  }
  apercu = null;
  etroits = [];
  tout();
});

svg.addEventListener("dblclick", (evt) => {
  const p = versMm(evt);
  const k = boiteSous(p);
  if (k >= 0) couperAuClic(k, p, evt.shiftKey);
});

svg.addEventListener("wheel", (evt) => {
  evt.preventDefault();
  const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const f = Math.exp(evt.deltaY * 0.0015);
  const t = plan.tiroir;
  const maxi = Math.max(t.largeur, t.longueur) + 2 * MARGE;
  const w = Math.min(Math.max(vue.w * f, 20), maxi * 1.5);
  const k = w / vue.w;
  vue = { x: p.x - (p.x - vue.x) * k, y: p.y - (p.y - vue.y) * k, w, h: vue.h * k };
  dessiner();
}, { passive: false });

window.addEventListener("resize", () => dessiner());
window.addEventListener("pointercancel", () => {
  geste = null;
  tout();
});

document.addEventListener("keydown", (evt) => {
  if ($("#confirmer").open) return; // la fenêtre de confirmation gère ses propres touches
  const saisie = evt.target.closest?.("input, select, textarea");
  const cmd = evt.metaKey || evt.ctrlKey;
  if (cmd && evt.key.toLowerCase() === "z") {
    if (saisie) return;
    evt.preventDefault();
    if (evt.shiftKey) retablir();
    else annuler();
  } else if ((evt.key === "Delete" || evt.key === "Backspace") && !saisie) {
    supprimer();
  } else if (evt.key.startsWith("Arrow") && !saisie && !cmd && selection?.type === "boite" && plan.boites[selection.index]) {
    evt.preventDefault();
    const pas = evt.shiftKey ? 10 : 1;
    const dx = { ArrowLeft: -pas, ArrowRight: pas }[evt.key] || 0;
    const dy = { ArrowDown: -pas, ArrowUp: pas }[evt.key] || 0; // l'avant du tiroir est en bas
    const k = selection.index;
    const b = plan.boites[k];
    const boites = deplacer(plan.boites, k, { x: b.x + dx, y: b.y + dy }, plan.tiroir, 0);
    if (!poserDeplacement(k, boites)) message("La boîte est en butée.", "info");
  } else if (evt.key === "Escape") {
    selection = null;
    apercu = null;
    etroits = [];
    tout();
  }
});

// ---------- boutons ----------

$("#annuler").addEventListener("click", annuler);
$("#retablir").addEventListener("click", retablir);
$("#valider").addEventListener("click", valider);
$("#ouvrir").addEventListener("change", ouvrir);
$("#bouton-ouvrir").addEventListener("click", () => $("#ouvrir").click());
$("#vider").addEventListener("click", () => {
  if (!plan.boites.length) return;
  selection = null;
  changer({ ...plan, boites: [] });
  message("Toutes les boîtes ont été retirées. « Annuler » les remet.", "info");
});
$("#cotes").addEventListener("change", cotesTiroir);
$("#cotes").addEventListener("submit", (evt) => evt.preventDefault());
$("#cotes").addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    evt.target.blur();
  }
});

// ---------- version ----------

// Version de cette page (écrite par outils/nouvelle-version.mjs) ; version.json, lu sans copie du
// navigateur, dit si une plus récente est en ligne.
const VERSION = document.querySelector('meta[name="version"]')?.content || "";
function texteVersion(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/.exec(v);
  return m ? `version du ${m[3]}/${m[2]}/${m[1]} à ${m[4]} h ${m[5]}` : "";
}
$("#version").textContent = texteVersion(VERSION);
async function verifierVersion() {
  if (!VERSION) return;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    const { version } = await r.json();
    $("#nouvelle-version").hidden = !version || version === VERSION;
  } catch {
    // hors ligne ou fichier absent : on garde la version chargée
  }
}
$("#recharger").addEventListener("click", () => location.reload());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") verifierVersion();
});
verifierVersion();

// l'erreur éventuelle d'un plan mémorisé ne doit pas bloquer l'appli
const lus = controler(plan).filter((m) => !m.startsWith("Il reste un vide"));
if (lus.length) message(lus.join(" "), "erreur");
tout();
