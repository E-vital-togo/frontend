// Tests de src/lib/conditions.ts (memes cas que backend/apps/catalogue/tests_conditions.py).
//   node scripts/test-conditions.mjs
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(mkdtempSync(join(tmpdir(), "evital-cond-")), "conditions.mjs");
await build({ entryPoints: [resolve(racine, "src/lib/conditions.ts")], bundle: true, format: "esm", platform: "node", outfile: sortie, logLevel: "silent" });
const c = await import(pathToFileURL(sortie).href);

const regle = (champ, operateur, valeurs) => ({ mode: "toutes", regles: [{ champ, operateur, ...(valeurs ? { valeurs } : {}) }] });
const champ = (code, condition = null, valeur = null) => ({ data_element_code: code, label: code, condition_affichage: condition, valeur_actuelle: valeur });
const valeurDe = (ch) => ch.valeur_actuelle;

test("evaluation : memes cas que le serveur", () => {
  assert.equal(c.evaluerCondition(null, {}), true);
  assert.equal(c.evaluerCondition(regle("a", "renseigne"), { a: "  " }), false);
  assert.equal(c.evaluerCondition(regle("a", "renseigne"), { a: 0 }), true);
  assert.equal(c.evaluerCondition(regle("s", "hors", ["M"]), {}), true);
  assert.equal(c.evaluerCondition(regle("b", "parmi", ["true"]), { b: true }), true);
  assert.equal(c.evaluerCondition(regle("l", "parmi", ["2"]), { l: ["1", "2"] }), true);
  assert.equal(c.evaluerCondition({ mode: "une", regles: [{ champ: "a", operateur: "renseigne" }, { champ: "b", operateur: "renseigne" }] }, { a: "x" }), true);
});

test("masquage en chaine : un champ masque compte comme vide", () => {
  const champs = [champ("sexe", null, "M"), champ("nom_jf", regle("sexe", "parmi", ["F"]), "X"), champ("detail", regle("nom_jf", "renseigne"))];
  assert.deepEqual([...c.codesAffiches(champs, valeurDe)], ["sexe"]);
  champs[0].valeur_actuelle = "F";
  assert.deepEqual(c.champsAffiches(champs, valeurDe).map((x) => x.data_element_code), ["sexe", "nom_jf", "detail"]);
});

test("valeurs a envoyer : celles d'un champ masque ne partent pas", () => {
  const champs = [champ("sexe", null, "M"), champ("nom_jf", regle("sexe", "parmi", ["F"]))];
  const envoi = c.valeursAEnvoyer(champs, { sexe: "M", nom_jf: "Y", autre: 1 }, (ch) => ({ sexe: "M", nom_jf: "Y" })[ch.data_element_code]);
  assert.deepEqual(envoi, { sexe: "M", autre: 1 });
  const sansCondition = [champ("a")];
  const modifiees = { a: 1 };
  assert.equal(c.valeursAEnvoyer(sansCondition, modifiees, valeurDe), modifiees);
});
