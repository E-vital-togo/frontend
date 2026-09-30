// Tests unitaires de la logique pure src/lib/formulaire.ts (sans vitest :
// le module est compile par esbuild puis execute par node:test).
//   npm run test:formulaire
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sortie = join(mkdtempSync(join(tmpdir(), "evital-form-")), "formulaire.mjs");
await build({
  entryPoints: [resolve(racine, "src/lib/formulaire.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: sortie,
  logLevel: "silent"
});
const f = await import(pathToFileURL(sortie).href);

let n = 0;
const champ = (surcharge = {}) => ({
  data_element_code: `c${++n}`,
  label: `Champ ${n}`,
  readonly: false,
  obligatoire: false,
  type_champ: "texte_court",
  contraintes: {},
  options: [],
  valeur_actuelle: null,
  source_valeur_actuelle: null,
  etape_id: null,
  largeur: "auto",
  placeholder: "",
  aide: "",
  ...surcharge
});
const etape = (id, titre, description = "") => ({ id, titre, description, ordre: 0 });
const codes = (liste) => liste.map((c) => c.data_element_code);

test("largeur explicite : quart/tiers/moitie/deux_tiers/complet -> 3/4/6/8/12 colonnes", () => {
  const colonnes = (largeur) => f.colonnesChamp({ largeur, type_champ: "texte_court" });
  assert.deepEqual(
    ["quart", "tiers", "moitie", "deux_tiers", "complet"].map(colonnes),
    [3, 4, 6, 8, 12]
  );
});

test("largeur auto : choisie selon le type de champ", () => {
  const colonnes = (type_champ) => f.colonnesChamp({ largeur: "auto", type_champ });
  assert.equal(colonnes("texte_long"), 12);
  assert.equal(colonnes("select_multiple"), 12);
  for (const t of ["booleen", "date", "nombre_entier", "nombre_decimal"]) assert.equal(colonnes(t), 4, t);
  for (const t of ["texte_court", "select", "telephone", "datalist"]) assert.equal(colonnes(t), 6, t);
});

test("largeur absente ou inconnue (ancien cache, futur serveur) : comme auto", () => {
  assert.equal(f.colonnesChamp({ type_champ: "texte_long" }), 12);
  assert.equal(f.colonnesChamp({ largeur: "inconnue", type_champ: "date" }), 4);
});

test("sans mise en page (ancien cache / serveur) : liste plate", () => {
  const champs = [champ(), champ()];
  for (const mep of [undefined, null]) {
    const plan = f.planFormulaire(champs, mep);
    assert.equal(plan.mode, "lineaire");
    assert.deepEqual(plan.etapes, []);
    assert.equal(plan.champs, champs);
  }
});

test("mode lineaire : etapes ignorees", () => {
  const champs = [champ({ etape_id: "e1" })];
  const plan = f.planFormulaire(champs, { mode: "lineaire", etapes: [etape("e1", "Enfant")] });
  assert.equal(plan.mode, "lineaire");
  assert.deepEqual(plan.etapes, []);
});

test("mode etapes : groupement par etape_id, ordre du tableau et des champs conserves", () => {
  const a = champ({ etape_id: "e2" });
  const b = champ({ etape_id: "e1" });
  const c = champ({ etape_id: "e2" });
  const d = champ({ etape_id: null });
  // `champs` arrive deja dans l'ordre de rendu (e1 d'abord dans le tableau des etapes).
  const champs = [b, a, c, d];
  const plan = f.planFormulaire(champs, {
    mode: "etapes",
    etapes: [etape("e1", "Enfant", "Identite"), etape("e2", "Parents"), etape(null, "Autres informations")]
  });
  assert.equal(plan.mode, "etapes");
  assert.deepEqual(plan.etapes.map((e) => e.titre), ["Enfant", "Parents", "Autres informations"]);
  assert.deepEqual(codes(plan.etapes[0].champs), codes([b]));
  assert.deepEqual(codes(plan.etapes[1].champs), codes([a, c]));
  assert.deepEqual(codes(plan.etapes[2].champs), codes([d]));
  assert.equal(plan.etapes[0].description, "Identite");
});

test("etapes sans champ omises ; une seule etape restante : rendu lineaire avec titre", () => {
  const a = champ({ etape_id: "e1" });
  const plan = f.planFormulaire([a], { mode: "etapes", etapes: [etape("e1", "Enfant"), etape("e2", "Vide")] });
  assert.equal(plan.mode, "lineaire");
  assert.equal(plan.etapes.length, 1);
  assert.equal(plan.etapes[0].titre, "Enfant");
});

test("cache desynchronise : champ dont l'etape est inconnue -> 'Autres informations', aucun champ perdu", () => {
  const a = champ({ etape_id: "e1" });
  const orphelin = champ({ etape_id: "supprimee" });
  const plan = f.planFormulaire([a, orphelin], { mode: "etapes", etapes: [etape("e1", "Enfant")] });
  assert.equal(plan.mode, "etapes");
  assert.deepEqual(plan.etapes.map((e) => e.titre), ["Enfant", "Autres informations"]);
  assert.deepEqual(codes(plan.etapes[1].champs), codes([orphelin]));
  const total = plan.etapes.reduce((s, e) => s + e.champs.length, 0);
  assert.equal(total, 2);
});

test("orphelins rattaches a l'etape virtuelle existante plutot que d'en creer une seconde", () => {
  const a = champ({ etape_id: "e1" });
  const v = champ({ etape_id: null });
  const o = champ({ etape_id: "inconnue" });
  const plan = f.planFormulaire([a, v, o], {
    mode: "etapes",
    etapes: [etape("e1", "Enfant"), etape(null, "Autres informations")]
  });
  assert.equal(plan.etapes.length, 2);
  assert.deepEqual(codes(plan.etapes[1].champs), codes([v, o]));
});

test("mise en page corrompue (etapes non tableau / vide) : liste plate", () => {
  const champs = [champ()];
  assert.equal(f.planFormulaire(champs, { mode: "etapes", etapes: [] }).mode, "lineaire");
  assert.equal(f.planFormulaire(champs, { mode: "etapes" }).mode, "lineaire");
});

test("validation d'etape : obligatoires visibles non readonly, vide = null/''/[]/undefined, pas 0 ni false", () => {
  const nom = champ({ obligatoire: true });
  const age = champ({ obligatoire: true, type_champ: "nombre_entier" });
  const actif = champ({ obligatoire: true, type_champ: "booleen" });
  const liste = champ({ obligatoire: true, type_champ: "select_multiple" });
  const dhis2 = champ({ obligatoire: true, readonly: true, valeur_actuelle: null });
  const facultatif = champ();
  const valeurs = { [age.data_element_code]: 0, [actif.data_element_code]: false, [liste.data_element_code]: [] };
  const manquants = f.champsManquants([nom, age, actif, liste, dhis2, facultatif], (c) =>
    f.valeurEffective(c, valeurs)
  );
  assert.deepEqual(codes(manquants), codes([nom, liste]));
});

test("valeurEffective : une valeur videe (null) n'est pas remplacee par la valeur d'origine", () => {
  const c = champ({ valeur_actuelle: "Kossi" });
  assert.equal(f.valeurEffective(c, {}), "Kossi");
  assert.equal(f.valeurEffective(c, { [c.data_element_code]: null }), null);
  assert.equal(f.valeurEffective(c, { [c.data_element_code]: "Ama" }), "Ama");
});

test("premiereEtapeIncomplete : ne saute pas une etape incomplete", () => {
  const a = champ({ obligatoire: true, etape_id: "e1" });
  const b = champ({ obligatoire: true, etape_id: "e2" });
  const d = champ({ etape_id: "e3" });
  const plan = f.planFormulaire([a, b, d], {
    mode: "etapes",
    etapes: [etape("e1", "1"), etape("e2", "2"), etape("e3", "3")]
  });
  const lecteur = (valeurs) => (c) => f.valeurEffective(c, valeurs);
  assert.equal(f.premiereEtapeIncomplete(plan.etapes, lecteur({}), 0, 2), 0);
  assert.equal(f.premiereEtapeIncomplete(plan.etapes, lecteur({ [a.data_element_code]: "x" }), 0, 2), 1);
  assert.equal(
    f.premiereEtapeIncomplete(plan.etapes, lecteur({ [a.data_element_code]: "x", [b.data_element_code]: "y" }), 0, 2),
    -1
  );
});

test("recapitulatif : libelles d'options, oui/non, date jj/mm/aaaa, vide = null", () => {
  const options = [
    { valeur: "m", libelle: "Masculin" },
    { valeur: "f", libelle: "Feminin" }
  ];
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "select", options }), "f"), "Feminin");
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "select_multiple", options }), ["m", "f"]), "Masculin, Feminin");
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "booleen" }), false), "Non");
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "booleen" }), "oui"), "Oui");
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "date" }), "2026-09-30"), "30/09/2026");
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "nombre_entier" }), 0), "0");
  assert.equal(f.formaterValeurChamp(champ(), ""), null);
  assert.equal(f.formaterValeurChamp(champ({ type_champ: "select_multiple" }), []), null);
});

test("memorisation de l'etape : sans sessionStorage, retombe sur 0 sans lever d'erreur", () => {
  assert.equal(f.lireEtapeMemorisee("dossier-1", 4), 0);
  f.memoriserEtape("dossier-1", 2);
  assert.equal(f.lireEtapeMemorisee(undefined, 4), 0);
});

test("memorisation de l'etape : lue par dossier, bornee", () => {
  const magasin = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
    setItem: (k, v) => magasin.set(k, v)
  };
  try {
    f.memoriserEtape("A", 3);
    f.memoriserEtape("B", 1);
    assert.equal(f.lireEtapeMemorisee("A", 10), 3);
    assert.equal(f.lireEtapeMemorisee("B", 10), 1);
    assert.equal(f.lireEtapeMemorisee("A", 2), 2);
    assert.equal(f.lireEtapeMemorisee("C", 10), 0);
  } finally {
    delete globalThis.sessionStorage;
  }
});
