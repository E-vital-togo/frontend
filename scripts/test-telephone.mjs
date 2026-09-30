// Tests unitaires de la logique pure src/lib/telephone.ts (sans vitest :
// le module est compile par esbuild puis execute par node:test).
//   npm run test:telephone
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(mkdtempSync(join(tmpdir(), "evital-tel-")), "telephone.mjs");
await build({
  entryPoints: [resolve(racine, "src/lib/telephone.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: sortie,
  logLevel: "silent"
});
const t = await import(pathToFileURL(sortie).href);

const saisir = (texte, iso = "TG", collage = false) => t.interpreterSaisie(texte, t.etatVide(iso), collage);

test("liste des pays : tous les pays, Togo d'abord puis Afrique de l'Ouest puis A-Z", () => {
  const pays = t.listerPays();
  assert.ok(pays.length >= 240);
  assert.equal(pays[0].iso, "TG");
  assert.equal(pays[0].indicatif, "+228");
  const ouest = pays.filter((p) => p.groupe === "afrique_ouest").map((p) => p.iso);
  assert.ok(ouest.includes("BJ") && ouest.includes("CI") && ouest.includes("NG"));
  // Les pays ouest-africains forment un bloc contigu en tete.
  assert.deepEqual(pays.slice(0, ouest.length).map((p) => p.iso).sort(), [...ouest].sort());
  const monde = pays.filter((p) => p.groupe === "monde").map((p) => p.nom);
  const trie = [...monde].sort(new Intl.Collator("fr", { sensitivity: "base" }).compare);
  assert.deepEqual(monde, trie);
  assert.equal(t.paysParIso("FR").nom, "France");
  assert.equal(t.paysParIso("CI").groupe, "afrique_ouest");
});

test("recherche : nom, indicatif, ISO, accents", () => {
  const liste = t.listerPays();
  assert.equal(t.filtrerPays(liste, "togo")[0].iso, "TG");
  assert.equal(t.filtrerPays(liste, "cote")[0].iso, "CI");
  assert.equal(t.filtrerPays(liste, "côte")[0].iso, "CI");
  assert.equal(t.filtrerPays(liste, "+228")[0].iso, "TG");
  assert.equal(t.filtrerPays(liste, "228")[0].iso, "TG");
  assert.equal(t.filtrerPays(liste, "fr")[0].iso, "FR");
  assert.equal(t.filtrerPays(liste, "+33")[0].iso, "FR");
  assert.equal(t.filtrerPays(liste, "zzzz").length, 0);
  assert.equal(t.filtrerPays(liste, "").length, liste.length);
});

test("numeros togolais valides", () => {
  for (const s of ["90123456", "90 12 34 56", "22212345", "70123456"]) {
    const etat = saisir(s);
    assert.equal(t.validerEtat(etat).valide, true, s);
    assert.match(t.versE164(etat), /^\+228\d{8}$/);
  }
  assert.equal(t.versE164(saisir("90 12 34 56")), "+22890123456");
  assert.equal(t.formaterSaisie(saisir("90123456")), "90 12 34 56");
});

test("numeros togolais invalides : messages clairs", () => {
  assert.equal(t.validerEtat(saisir("")).code, "vide");
  const court = t.validerEtat(saisir("9012345"));
  assert.equal(court.code, "trop_court");
  assert.match(court.message, /trop court pour Togo/);
  assert.equal(t.validerEtat(saisir("901234567")).code, "trop_long");
  assert.equal(t.validerEtat(saisir("10123456")).valide, false);
  assert.equal(t.validerEtat(saisir("1234")).valide, false);
});

test("collage international detecte le pays", () => {
  for (const s of ["+228 90 12 34 56", "0022890123456", "+22890123456", "228-90-12-34-56", "22890123456"]) {
    const etat = saisir(s, "FR", true);
    assert.equal(etat.iso, "TG", s);
    assert.equal(etat.chiffres, "90123456", s);
    assert.equal(t.versE164(etat), "+22890123456", s);
  }
  const fr = saisir("+33 6 12 34 56 78", "TG", true);
  assert.equal(fr.iso, "FR");
  assert.equal(t.versE164(fr), "+33612345678");
  assert.equal(t.validerEtat(fr).valide, true);
  // "+" colle apres du texte existant
  assert.equal(saisir("12+22890123456", "TG", true).chiffres, "90123456");
});

test("zero de trunk supprime a l'emission", () => {
  const fr = saisir("06 12 34 56 78", "FR");
  assert.equal(t.versE164(fr), "+33612345678");
  assert.equal(t.validerEtat(fr).valide, true);
  assert.equal(t.versE164(saisir("+33 (0)6 12 34 56 78", "TG", true)), "+33612345678");
  assert.equal(t.formaterSaisie(fr), "06 12 34 56 78");
  // Relecture d'un E.164 : affiche avec le zero de trunk, emet sans.
  const relu = t.lireValeur("+33612345678");
  assert.equal(t.formaterSaisie(relu), "06 12 34 56 78");
  assert.equal(t.versE164(relu), "+33612345678");
  assert.equal(t.formaterSaisie(t.lireValeur("+447911123456")), "07911 123456");
});

test("saisie internationale en cours (indicatif partiel)", () => {
  const plus = saisir("+");
  assert.equal(plus.partiel, "+");
  assert.equal(t.versE164(plus), "");
  assert.equal(t.validerEtat(plus).code, "vide");
  const deux = saisir("+2");
  assert.equal(deux.partiel, "+2");
  assert.equal(t.validerEtat(deux).code, "partiel");
  const tg = saisir("+228");
  assert.equal(tg.iso, "TG");
  assert.equal(tg.partiel, undefined);
});

test("valeurs recues : E.164 et anciens formats libres (Togo par defaut)", () => {
  for (const v of ["+22890123456", "90123456", "+228 90 12 34 56", "228-90-12-34-56", "0022890123456", " 90 12 34 56 "]) {
    const etat = t.lireValeur(v);
    assert.equal(etat.iso, "TG", v);
    assert.equal(t.versE164(etat), "+22890123456", v);
    assert.equal(t.normaliserE164(v), "+22890123456", v);
  }
  assert.equal(t.lireValeur("").chiffres, "");
  assert.equal(t.lireValeur(null).iso, "TG");
  assert.equal(t.lireValeur("+33612345678").iso, "FR");
  assert.equal(t.normaliserE164("abc"), null);
  assert.equal(t.normaliserE164("1234"), null);
  assert.equal(t.formaterInternational("90123456"), "+228 90 12 34 56");
  assert.equal(t.formaterInternational("n/a"), "n/a");
});

test("indicatif partage : +1 et +44", () => {
  const us = t.lireValeur("+1 415 555 2671");
  assert.equal(us.iso, "US");
  assert.equal(t.versE164(us), "+14155552671");
  assert.equal(t.lireValeur("+44 20 7946 0958").iso, "GB");
  assert.equal(t.lireValeur("+44 7911 123456").iso, "GG"); // plage de Guernesey
  assert.equal(t.lireValeur("+1", "CA").iso, "CA");
});

test("limite de longueur E.164", () => {
  const etat = saisir("9".repeat(30));
  assert.ok(etat.chiffres.length <= 12);
});

test("position du curseur apres reformatage", () => {
  assert.equal(t.positionCurseur("90 12 34 56", 0), 0);
  assert.equal(t.positionCurseur("90 12 34 56", 2), 2);
  assert.equal(t.positionCurseur("90 12 34 56", 3), 4);
  assert.equal(t.positionCurseur("90 12 34 56", 8), 11);
  assert.equal(t.positionCurseur("90 12", 9), 5);
});

test("exemples nationaux", () => {
  assert.match(t.exempleNational("TG"), /^\d{2} \d{2} \d{2} \d{2}$/);
  assert.notEqual(t.exempleNational("FR"), "");
});
