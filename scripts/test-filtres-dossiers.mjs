// Tests de src/lib/filtresDossiers.ts (statut, retrait, « Masquer les actes émis » toujours compatibles).
//   npm run test:filtres-dossiers
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(mkdtempSync(join(tmpdir(), "evital-filtres-")), "filtres.mjs");
await build({ entryPoints: [resolve(racine, "src/lib/filtresDossiers.ts")], bundle: true, format: "esm", platform: "node", outfile: sortie, logLevel: "silent" });
const { concilierFiltresActe: c } = await import(pathToFileURL(sortie).href);

const vide = { statut: "", retrait: "", masquerActesEmis: false };
const STATUTS = ["", "recu", "notifie", "en_attente_complement", "complete", "acte_emis", "sans_suite"];
const RETRAITS = ["", "a_retirer", "retire"];

/** Vrai si la combinaison peut renvoyer des dossiers. */
function possible(f) {
  if (f.masquerActesEmis && (f.statut === "acte_emis" || f.retrait)) return false;
  if (f.retrait && f.statut && f.statut !== "acte_emis") return false;
  return true;
}

test("masquer les actes émis retire le statut « Actes émis » et le retrait", () => {
  assert.deepEqual(c({ statut: "acte_emis", retrait: "retire", masquerActesEmis: false }, { masquerActesEmis: true }), { statut: "", retrait: "", masquerActesEmis: true });
  assert.deepEqual(c({ ...vide, statut: "complete" }, { masquerActesEmis: true }), { statut: "complete", retrait: "", masquerActesEmis: true });
});

test("choisir « Actes émis » ou un retrait décoche « Masquer les actes émis »", () => {
  assert.deepEqual(c({ ...vide, masquerActesEmis: true }, { statut: "acte_emis" }), { statut: "acte_emis", retrait: "", masquerActesEmis: false });
  assert.deepEqual(c({ ...vide, masquerActesEmis: true }, { retrait: "a_retirer" }), { statut: "", retrait: "a_retirer", masquerActesEmis: false });
});

test("le retrait ne garde qu'un statut compatible, et inversement", () => {
  assert.deepEqual(c({ ...vide, statut: "complete" }, { retrait: "retire" }), { statut: "", retrait: "retire", masquerActesEmis: false });
  assert.deepEqual(c({ ...vide, statut: "acte_emis" }, { retrait: "retire" }), { statut: "acte_emis", retrait: "retire", masquerActesEmis: false });
  assert.deepEqual(c({ ...vide, retrait: "retire" }, { statut: "recu" }), { statut: "recu", retrait: "", masquerActesEmis: false });
});

test("quel que soit le point de départ et le changement, jamais de combinaison impossible", () => {
  const etats = [];
  for (const statut of STATUTS) for (const retrait of RETRAITS) for (const masquerActesEmis of [false, true]) etats.push({ statut, retrait, masquerActesEmis });
  const changements = [...STATUTS.map((statut) => ({ statut })), ...RETRAITS.map((retrait) => ({ retrait })), { masquerActesEmis: true }, { masquerActesEmis: false }];
  for (const depart of etats.filter(possible)) {
    for (const ch of changements) {
      const r = c(depart, ch);
      assert.ok(possible(r), JSON.stringify({ depart, ch, r }));
      for (const [k, v] of Object.entries(ch)) assert.equal(r[k], v, "le choix de l'utilisateur est toujours respecté");
    }
  }
});
