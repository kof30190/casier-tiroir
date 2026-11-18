"""Construit un fichier de l'appli dans solidcraft-cli et contrôle chaque corps.

Deux références : les `morceaux` annoncés par le fichier, et un calcul refait ici à partir du seul plan
(règles de la description : jeu, découpe en morceaux égaux, tenon et fourche, arrondis intérieurs), sans lire le code de la page.
Usage : python3 tests/verif_solidcraft.py tests/plans/croquis.json [...]
"""
import bisect
import json
import math
import os
import subprocess
import sys
import tempfile

TENON, JEU_T, MARGE, ARRONDI = 10.0, 0.2, 12.0, 2.0


def section_arrondi(r, ua, ub, n=4000):
    """Matière d'un arrondi convexe de rayon r entre ua et ub de la face intérieure (intégration numérique)."""
    a, b = max(0.0, ua), min(r, ub)
    if b <= a:
        return 0.0
    du = (b - a) / n
    return sum((r - math.sqrt(r * r - (r - (a + (i + 0.5) * du)) ** 2)) * du for i in range(n))


def arrondis(piece, boite, coupes, t):
    """Matière ajoutée (congés du fond et des coins) moins retirée (arête du haut, dessus des tenons taillé),
    plus ce que la fourche retire dans l'arrondi déjà enlevé."""
    (bx1, by1, bx2, by2) = piece
    (x1, y1, x2, y2) = boite
    cuts_x, cuts_y = coupes
    e, f, H, g, d = t["epaisseur"], t["epaisseur_fond"], t["hauteur"], JEU_T, TENON
    tt = e / 3
    rb = min(ARRONDI, (H - f) / 2)
    rh = min(ARRONDI, e / 2, (H - f) / 2)
    eps = 1e-9
    px2 = min([x2] + [c - g / 2 for c in cuts_x if c - g / 2 > bx1 + eps])
    py2 = min([y2] + [c - g / 2 for c in cuts_y if c - g / 2 > by1 + eps])
    px1, py1 = bx1, by1
    G, D, AV, AR = abs(px1 - x1) < eps, abs(px2 - x2) < eps, abs(py1 - y1) < eps, abs(py2 - y2) < eps
    ix1, ix2, iy1, iy2 = px1 + e * G, px2 - e * D, py1 + e * AV, py2 - e * AR
    kb, kh = (1 - math.pi / 4) * rb * rb, (1 - math.pi / 4) * rh * rh
    v = 0.0
    for present, L, nc in ((G, iy2 - iy1, AV + AR), (D, iy2 - iy1, AV + AR), (AV, ix2 - ix1, G + D), (AR, ix2 - ix1, G + D)):
        if present:
            v += (kb - kh) * (L - rb * nc)
    cg = (10 - 3 * math.pi) / (3 * (4 - math.pi)) * rh
    for coin in ((G and AV), (D and AV), (G and AR), (D and AR)):
        if coin:
            v += kb * (H - f - rb) + (1 - math.pi / 6) * rb ** 3 - kh * (math.pi / 2) * (rb + cg)
    tenon = section_arrondi(rh, e / 2 - tt / 2, e / 2 + tt / 2) * (d + g / 2)
    fourche = section_arrondi(rh, e / 2 - tt / 2 - g, e / 2 + tt / 2 + g) * (d + g / 2)
    for c in cuts_y:
        if abs(py2 - (c - g / 2)) < eps:
            v -= tenon * (G + D)
        if abs(py1 - (c + g / 2)) < eps:
            v += fourche * (G + D)
    for c in cuts_x:
        if abs(px2 - (c - g / 2)) < eps:
            v -= tenon * (AV + AR)
        if abs(px1 - (c + g / 2)) < eps:
            v += fourche * (AV + AR)
    return v


def pieces_attendues(plan):
    t = plan["tiroir"]
    W, L, H, e, f, j, bed = (t[k] for k in ("largeur", "longueur", "hauteur", "epaisseur", "epaisseur_fond", "jeu", "plateau"))
    tt, g, d, lim = e / 3, JEU_T, TENON, bed - MARGE
    out = {}
    for n, b in enumerate(plan["boites"], 1):
        x1 = b["x"] + (j / 2 if b["x"] > 0 else 0)
        x2 = b["x"] + b["largeur"] - (j / 2 if b["x"] + b["largeur"] < W else 0)
        y1 = b["y"] + (j / 2 if b["y"] > 0 else 0)
        y2 = b["y"] + b["longueur"] - (j / 2 if b["y"] + b["longueur"] < L else 0)
        # un morceau coupé doit tenir dans lim avec son tenon, qui dépasse de d + g/2
        nombre = lambda cote: 1 if cote <= lim else math.ceil(cote / (lim - d - g / 2) - 1e-9)
        nx, ny = nombre(x2 - x1), nombre(y2 - y1)
        if nx > 2 and ny > 2:
            continue
        # la boîte entière, puis la fente de jeu le long de chaque coupe, puis tenons et fourches
        ops = [("add", "f", (x1, y1, x2, y2)), ("add", "w", (x1, y1, x1 + e, y2)), ("add", "w", (x2 - e, y1, x2, y2)),
               ("add", "w", (x1, y1, x2, y1 + e)), ("add", "w", (x1, y2 - e, x2, y2)), ("sub", "w", (x1 + e, y1 + e, x2 - e, y2 - e))]
        cuts_y = [y1 + c * (y2 - y1) / ny for c in range(1, ny)]
        cuts_x = [x1 + a * (x2 - x1) / nx for a in range(1, nx)]
        for c in cuts_y:
            ops.append(("sub", "fw", (x1 - 1, c - g / 2, x2 + 1, c + g / 2)))
        for c in cuts_x:
            ops.append(("sub", "fw", (c - g / 2, y1 - 1, c + g / 2, y2 + 1)))
        for c in cuts_y:
            for m in (x1 + e / 2, x2 - e / 2):
                ops.append(("sub", "fw", (m - tt / 2 - g, c + g / 2, m + tt / 2 + g, c + d + g)))
                ops.append(("add", "fw", (m - tt / 2, c - g / 2, m + tt / 2, c + d)))
        for c in cuts_x:
            for m in (y1 + e / 2, y2 - e / 2):
                ops.append(("sub", "fw", (c + g / 2, m - tt / 2 - g, c + d + g, m + tt / 2 + g)))
                ops.append(("add", "fw", (c - g / 2, m - tt / 2, c + d, m + tt / 2)))
        for k, (bx, vol) in enumerate(sorted(composantes(ops, f, H), key=lambda c: (round(c[0][1], 3), round(c[0][0], 3))), 1):
            out[f"B{n}-M{k}"] = (bx, vol + arrondis(bx, (x1, y1, x2, y2), (cuts_x, cuts_y), t))
    return out, H


def composantes(ops, f, H):
    xs = sorted({v for _, _, r in ops for v in (r[0], r[2])})
    ys = sorted({v for _, _, r in ops for v in (r[1], r[3])})
    nx, ny = len(xs) - 1, len(ys) - 1
    grid = {c: [[False] * ny for _ in range(nx)] for c in "fw"}
    for kind, layers, (a1, b1, a2, b2) in ops:
        i1, i2, j1, j2 = bisect.bisect_left(xs, a1), bisect.bisect_left(xs, a2), bisect.bisect_left(ys, b1), bisect.bisect_left(ys, b2)
        for c in layers:
            for i in range(i1, i2):
                for jj in range(j1, j2):
                    grid[c][i][jj] = kind == "add"
    seen, out = set(), []
    for c0 in "fw":
        for i in range(nx):
            for jj in range(ny):
                if not grid[c0][i][jj] or (c0, i, jj) in seen:
                    continue
                stack, cells = [(c0, i, jj)], []
                seen.add((c0, i, jj))
                while stack:
                    cell = stack.pop()
                    cells.append(cell)
                    c, a, b = cell
                    for nb in ((c, a + 1, b), (c, a - 1, b), (c, a, b + 1), (c, a, b - 1), ("w" if c == "f" else "f", a, b)):
                        if 0 <= nb[1] < nx and 0 <= nb[2] < ny and grid[nb[0]][nb[1]][nb[2]] and nb not in seen:
                            seen.add(nb)
                            stack.append(nb)
                vol = sum((xs[a + 1] - xs[a]) * (ys[b + 1] - ys[b]) * (f if c == "f" else H - f) for c, a, b in cells)
                bx = (min(xs[a] for _, a, _ in cells), min(ys[b] for _, _, b in cells), max(xs[a + 1] for _, a, _ in cells), max(ys[b + 1] for _, _, b in cells))
                out.append((bx, vol))
    return out


def verifier(chemin):
    doc = json.load(open(chemin))
    with tempfile.TemporaryDirectory() as tmp:
        s = os.path.join(tmp, "script.json")
        json.dump(doc["script_solidcraft"]["commands"], open(s, "w"))
        r = subprocess.run(["solidcraft-cli", "eval", s], capture_output=True, text=True, timeout=1200)
        # les morceaux voisins, à leur place dans le tiroir, ne doivent pas se toucher : jeu, tenons et fourches
        si = os.path.join(tmp, "interference.json")
        json.dump(doc["script_solidcraft"]["commands"] + [{"command": "inspect.interference", "params": {}}], open(si, "w"))
        ri = subprocess.run(["solidcraft-cli", "run", si, "--results", "--quiet"], capture_output=True, text=True, timeout=1200)
    res = json.loads(r.stdout)
    inter = json.loads(ri.stdout)[-1] if ri.returncode == 0 else {"count": None, "pairs_not_checked": None}
    corps = {b["name"]: b for b in res["bodies"]}
    annonces = {m["nom"]: m for m in doc["morceaux"]}
    attendus, H = pieces_attendues(doc)
    ecarts = [f"fonction en erreur : {t['name']}" for t in res.get("timeline", []) if t.get("error")]
    if inter.get("count") != 0 or inter.get("pairs_not_checked") != 0:
        ecarts.append(f"interférence entre morceaux : {inter.get('interferences', ri.stderr[-300:])}")
    if set(corps) != set(annonces) or set(corps) != set(attendus):
        ecarts.append(f"noms : solidcraft {sorted(corps)} / fichier {sorted(annonces)} / calcul {sorted(attendus)}")
    plus_grand = 0
    for nom in sorted(set(corps) & set(annonces) & set(attendus)):
        b, m, (bx, vol) = corps[nom], annonces[nom], attendus[nom]
        mn, mx = b["bbox"]["min"], b["bbox"]["max"]
        reel = (mn[0], mn[1], mx[0], mx[1], mx[2] - mn[2])
        fich = (m["x"], m["y"], m["x"] + m["largeur"], m["y"] + m["longueur"], m["hauteur"])
        calc = (*bx, H)
        for quoi, ref in (("fichier", fich), ("calcul", calc)):
            if max(abs(a - c) for a, c in zip(reel, ref)) > 0.01:
                ecarts.append(f"{nom} boite englobante {[round(v, 3) for v in reel]} != {quoi} {[round(v, 3) for v in ref]}")
        for quoi, ref in (("fichier", m["volume_mm3"]), ("calcul", vol)):
            if abs(b["volume_mm3"] - ref) / ref > 1e-4:
                ecarts.append(f"{nom} volume {b['volume_mm3']:.1f} != {quoi} {ref:.1f}")
        if not b.get("closed"):
            ecarts.append(f"{nom} n'est pas fermé")
        plus_grand = max(plus_grand, mx[0] - mn[0], mx[1] - mn[1])
        if max(mx[0] - mn[0], mx[1] - mn[1]) > doc["tiroir"]["plateau"] - MARGE + 1e-9 or mx[2] - mn[2] > doc["tiroir"]["plateau"]:
            ecarts.append(f"{nom} dépasse le plateau moins la marge de {MARGE:g} mm")
    print(f"{os.path.basename(chemin):18} {'OK ' if not ecarts else 'NON'} morceaux {len(corps)} plus grand {plus_grand:.1f} mm")
    for x in ecarts[:12]:
        print("   ", x)
    return not ecarts


if __name__ == "__main__":
    ok = all([verifier(c) for c in sys.argv[1:]])
    sys.exit(0 if ok else 1)
