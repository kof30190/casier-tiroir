// À lancer avant chaque mise en ligne : node outils/nouvelle-version.mjs
// Donne un nouveau numéro de version (date et heure de Paris) et l'écrit partout où la page charge un
// fichier (?v=…) : les navigateurs prennent alors tout de suite les nouveaux fichiers au lieu de leur copie.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dossier = fileURLToPath(new URL("..", import.meta.url));
const morceaux = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(new Date()).map((p) => [p.type, p.value]));
const version = `${morceaux.year}-${morceaux.month}-${morceaux.day}-${morceaux.hour}${morceaux.minute}`;

const changer = (nom, remplacements) => {
  let texte = readFileSync(dossier + nom, "utf8");
  for (const [motif, par] of remplacements) {
    if (!motif.test(texte)) throw new Error(`${nom} : motif introuvable ${motif}`);
    texte = texte.replace(motif, par);
  }
  writeFileSync(dossier + nom, texte);
};
const fichiers = /(["'](?:\.\/)?(?:app|logique|solidcraft|style)\.(?:js|css))(?:\?v=[\w-]+)?(["'])/g;
changer("index.html", [[fichiers, `$1?v=${version}$2`], [/(<meta name="version" content=")[^"]*(")/, `$1${version}$2`]]);
changer("app.js", [[fichiers, `$1?v=${version}$2`]]);
changer("solidcraft.js", [[fichiers, `$1?v=${version}$2`]]);
writeFileSync(dossier + "version.json", JSON.stringify({ version }) + "\n");
console.log(`Version ${version}`);
