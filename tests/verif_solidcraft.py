"""Construit un fichier de l'appli dans solidcraft-cli et contrôle chaque corps.

Deux références : les `morceaux` annoncés par le fichier, et un calcul refait ici à partir du seul plan
(règles de la description : jeu, découpe en morceaux égaux, tenon et fourche), sans lire le code de la page.
Usage : python3 tests/verif_solidcraft.py tests/plans/croquis.json [...]
"""
import bisect
import json
import math
import os
import subprocess
import sys
import tempfile

TENON, JEU_T, MARGE = 10.0, 0.2, 12.0


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
        nx, ny = max(1, math.ceil((x2 - x1) / lim - 1e-9)), max(1, math.ceil((y2 - y1) / lim - 1e-9))
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
            out[f"B{n}-M{k}"] = (bx, vol)
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
    res = json.loads(r.stdout)
    corps = {b["name"]: b for b in res["bodies"]}
    annonces = {m["nom"]: m for m in doc["morceaux"]}
    attendus, H = pieces_attendues(doc)
    ecarts = [f"fonction en erreur : {t['name']}" for t in res.get("timeline", []) if t.get("error")]
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
        if max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) > doc["tiroir"]["plateau"]:
            ecarts.append(f"{nom} dépasse le plateau")
    print(f"{os.path.basename(chemin):18} {'OK ' if not ecarts else 'NON'} morceaux {len(corps)} plus grand {plus_grand:.1f} mm")
    for x in ecarts[:12]:
        print("   ", x)
    return not ecarts


if __name__ == "__main__":
    ok = all([verifier(c) for c in sys.argv[1:]])
    sys.exit(0 if ok else 1)
