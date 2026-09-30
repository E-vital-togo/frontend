// Copie la logique et le composant telephone partages (frontend/src) vers
// l'app DHIS2, qui n'a pas de workspace commun avec le frontend CEC. La
// SOURCE DE VERITE reste le frontend : les copies portent un bandeau
// "NE PAS MODIFIER" et sont regenerees par ce script.
//   npm run sync:telephone                   regenere les copies
//   npm run sync:telephone -- --verifier     echoue si une copie a diverge (CI)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dhis2 = resolve(racine, "../dhis2-app/src");
const verifier = process.argv.includes("--verifier");

const bandeauTs = (source) =>
  `// COPIE GENEREE de frontend/${source} - NE PAS MODIFIER ICI.\n// Modifier la source puis lancer \`npm run sync:telephone\` dans frontend/.\n`;
const bandeauCss = (source) =>
  `/* COPIE GENEREE de frontend/${source} - NE PAS MODIFIER ICI.\n   Modifier la source puis lancer \`npm run sync:telephone\` dans frontend/. */\n`;

const copies = [
  { source: "src/lib/telephone.ts", cible: "lib/telephone.ts", bandeau: bandeauTs },
  { source: "src/lib/drapeauxTelephone.ts", cible: "lib/drapeauxTelephone.ts", bandeau: bandeauTs },
  { source: "src/styles/telephone.css", cible: "styles/telephone.css", bandeau: bandeauCss },
  {
    source: "src/components/ui/ChampTelephoneCorps.tsx",
    cible: "components/ControleTelephone.tsx",
    bandeau: bandeauTs,
    // Arborescence differente cote DHIS2 (components/ au lieu de components/ui/).
    transformer: (texte) =>
      texte
        .replaceAll('"../../lib/', '"../lib/')
        .replaceAll('"../../styles/', '"../styles/')
        .replace("export default function ChampTelephoneCorps(", "export default function ControleTelephone(")
  }
];

let divergences = 0;
for (const { source, cible, bandeau, transformer } of copies) {
  const brut = readFileSync(resolve(racine, source), "utf8");
  const attendu = bandeau(source) + (transformer ? transformer(brut) : brut);
  const chemin = resolve(dhis2, cible);
  if (verifier) {
    let actuel = "";
    try {
      actuel = readFileSync(chemin, "utf8");
    } catch {
      // absent : divergence
    }
    if (actuel !== attendu) {
      console.error(`Divergence : ${chemin} differe de sa source ${source}`);
      divergences += 1;
    }
  } else {
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, attendu);
    console.log(`Copie : ${source} -> dhis2-app/src/${cible}`);
  }
}
process.exit(divergences ? 1 : 0);
