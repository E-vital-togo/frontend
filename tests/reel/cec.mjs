/*
 * Parcours réel du frontend CEC (serveur Vite) contre un vrai backend : un certificat de vie et une naissance
 * ordinaire reçus comme dhis2-app les envoie, puis l'en-tête de chaque dossier vu par un agent CEC, avec captures.
 * Lancé par backend/outils/tests_reels/lancer.sh (étape 5). Variables : FRONTEND_URL, BACKEND_URL, SECRET_PUSH,
 * FS_UID, JETONS (fichier JSON {access, refresh, utilisateur} d'un agent CEC de la mairie de FS_UID).
 */
import { mkdirSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const FRONTEND = process.env.FRONTEND_URL ?? "http://localhost:5173";
const BACKEND = process.env.BACKEND_URL;
const SECRET = process.env.SECRET_PUSH;
const FS = process.env.FS_UID;
const JETONS = JSON.parse(readFileSync(process.env.JETONS, "utf8"));
const SORTIE = process.argv[2];
mkdirSync(SORTIE, { recursive: true });
let echecs = 0;
const verifier = (ok, msg, detail) => {
  console.log(`${ok ? "OK  " : "ECHEC"} ${msg}${!ok && detail !== undefined ? " -> " + JSON.stringify(detail).slice(0, 300) : ""}`);
  if (!ok) echecs++;
};
const uid = () => "Cec" + Math.random().toString(36).slice(2, 10).padEnd(8, "x");
const marque = String(Date.now()).slice(-5);

async function recevoir(type, nom) {
  const r = await fetch(`${BACKEND}/dhis2/webhook/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `ApiToken ${SECRET}` },
    body: JSON.stringify({
      event_uid: uid(), event_type: "naissance", org_unit_uid: FS, date_evenement: "2026-11-12",
      data_values: { bjLccCgwZAL: type, ...(type === "2" ? { PXp2Y0kTsDe: "CEC Dr Mensah", IWtmLrhloE8: "1" } : { q40fAraVNqT: "CEC Accoucheuse" }), Smt9OBGhnuK: nom, oKaRdebuFrE: "F", Ii6JDWYlgAA: "2026-11-10", YWrRTWPElnd: `CEC Mere${marque}${type}`, hVIUILbqD6V: "+22890123456" }
    })
  });
  const corps = await r.json().catch(() => ({}));
  verifier(r.ok && corps.dossier_id, `${type === "2" ? "certificat de vie" : "certificat de naissance"} reçu par le backend`, corps);
  return corps.dossier_id;
}
const vie = await recevoir("2", `CEC Vie${marque}`);
const naissance = await recevoir("1", `CEC Naiss${marque}`);

const navigateur = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await navigateur.newPage();
await page.setViewport({ width: 1280, height: 1000 });
const erreursJs = [];
page.on("pageerror", (e) => erreursJs.push(String(e).slice(0, 200)));
await page.goto(FRONTEND, { waitUntil: "networkidle2", timeout: 120000 });
await page.evaluate((j) => {
  localStorage.setItem("evital_access_token", j.access);
  localStorage.setItem("evital_refresh_token", j.refresh);
  localStorage.setItem("evital_utilisateur", JSON.stringify(j.utilisateur));
}, JETONS);
const ouvrir = async (id) => {
  await page.goto(`${FRONTEND}/agent/dossiers/${id}`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForFunction(() => document.body.innerText.includes("Dossier de naissance"), { timeout: 60000 }).catch(() => {});
  return page.evaluate(() => document.querySelector("header.eva-dd-entete")?.innerText ?? document.body.innerText.slice(0, 600));
};

const enteteVie = await ouvrir(vie);
verifier(enteteVie.includes("Dossier de naissance") && enteteVie.includes("certificat de vie"), "dossier issu d'un certificat de vie : mention dans l'en-tête", enteteVie.slice(0, 300));
const discret = await page.evaluate(() => {
  const m = document.querySelector(".eva-dd-mention-vie");
  if (!m) return null;
  const s = getComputedStyle(m);
  return { italique: s.fontStyle, taille: s.fontSize, infobulle: m.getAttribute("title") ?? "" };
});
verifier(discret && discret.italique === "italic" && discret.infobulle.startsWith("Certificat de vie"), "mention discrète (italique, infobulle)", discret);
await page.screenshot({ path: `${SORTIE}/30-cec-dossier-certificat-de-vie.png` });

const enteteNaiss = await ouvrir(naissance);
verifier(enteteNaiss.includes("Dossier de naissance") && !enteteNaiss.includes("certificat de vie"), "dossier ordinaire : aucune mention", enteteNaiss.slice(0, 300));
await page.screenshot({ path: `${SORTIE}/31-cec-dossier-ordinaire.png` });

await page.goto(`${FRONTEND}/agent/dossiers`, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout: 60000 }, `CEC Vie${marque}`).then(() => verifier(true, "liste des dossiers de l'agent"), () => verifier(false, "liste des dossiers de l'agent"));
await page.screenshot({ path: `${SORTIE}/32-cec-liste-dossiers.png` });
verifier(erreursJs.length === 0, "aucune erreur JavaScript dans le frontend", erreursJs);
await navigateur.close();
console.log(`\n${echecs ? echecs + " échec(s)" : "Tout est OK"} dans le frontend CEC ; captures : ${SORTIE}`);
process.exit(echecs ? 1 : 0);
