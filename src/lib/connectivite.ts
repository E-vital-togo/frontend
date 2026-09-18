import { useEffect, useState } from "react";
import { ORIGINE_API } from "./apiClient";

const CHEMIN_SONDE = "/ping";
const DELAI_SONDE_MS = 4_000;
const DEBOUNCE_RETOUR_MS = 800;
const INTERVALLE_ARRIERE_PLAN_MS = 45_000;

type Ecouteur = (enLigne: boolean) => void;

/**
 * Source unique de verite pour la connectivite, partagee par toute l'app
 * (badge d'entete, ecrans agent, file de sync) au lieu que chaque composant
 * relise navigator.onLine et pose ses propres listeners "online"/"offline".
 *
 * navigator.onLine ne dit que "une interface reseau existe" : un wifi sans
 * internet, un portail captif ou un DNS mort le laissent a `true`. On le
 * garde comme signal rapide et gratuit, mais on ne le croit jamais seul -
 * toute transition vers "en ligne" est confirmee par un aller-retour reel
 * vers le serveur (voir sonder ci-dessous) avant d'etre annoncee aux
 * abonnes (syncService.surRetourConnexion notamment, pour ne pas lancer une
 * synchronisation sur un reseau qui n'est pas encore reellement utilisable).
 */
let enLigne = navigator.onLine;
const ecouteurs = new Set<Ecouteur>();
let demarre = false;
let minuteurDebounce: number | undefined;
let sondeEnCours: Promise<boolean> | null = null;

function notifier(valeur: boolean): void {
  if (valeur === enLigne) return;
  enLigne = valeur;
  ecouteurs.forEach((ecouteur) => ecouteur(enLigne));
}

/**
 * Aller-retour HTTP minimal vers /ping. En production ce chemin est servi
 * directement par nginx (return 204, jamais de proxy_pass vers Django) :
 * contrairement a /health/ (qui interroge Postgres/Redis/Mongo et est
 * pense pour un monitoring d'infra, pas pour etre appele en continu par
 * chaque agent), /ping ne coute rien au backend, meme a grande echelle.
 *
 * mode "no-cors" volontaire : on ne lit jamais la reponse (opaque), on
 * verifie seulement que la requete aboutit reseau. Ca evite toute
 * dependance a la config CORS pour cette route, et ca reste correct meme
 * la ou /ping n'existe pas encore cote serveur (dev local sans nginx
 * devant Django) - un 404 prouve quand meme que le serveur est joignable,
 * seule une exception (coupure, DNS, timeout) signifie hors-ligne.
 */
async function sonder(): Promise<boolean> {
  if (sondeEnCours) return sondeEnCours;

  sondeEnCours = (async () => {
    const controleur = new AbortController();
    const minuteur = window.setTimeout(() => controleur.abort(), DELAI_SONDE_MS);
    try {
      await fetch(`${ORIGINE_API}${CHEMIN_SONDE}`, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controleur.signal
      });
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(minuteur);
    }
  })();

  try {
    return await sondeEnCours;
  } finally {
    sondeEnCours = null;
  }
}

/**
 * Verifie et met a jour l'etat partage. Exportee pour permettre un
 * declenchement manuel (ex: bouton "reessayer"), en plus des declencheurs
 * automatiques geres par demarrerSiBesoin.
 */
export async function verifierConnexion(): Promise<boolean> {
  if (!navigator.onLine) {
    notifier(false);
    return false;
  }
  const resultat = await sonder();
  notifier(resultat);
  return resultat;
}

function gererHorsLigneNavigateur(): void {
  if (minuteurDebounce) window.clearTimeout(minuteurDebounce);
  notifier(false);
}

function gererEnLigneNavigateur(): void {
  if (minuteurDebounce) window.clearTimeout(minuteurDebounce);
  // L'evenement "online" du navigateur signale qu'une interface reseau
  // vient de remonter (association wifi, DHCP, VPN), pas que le serveur
  // est joignable : on laisse un court instant passer puis on verifie
  // reellement, plutot que d'annoncer un retour de connexion immediat et
  // non confirme aux abonnes.
  minuteurDebounce = window.setTimeout(() => {
    verifierConnexion();
  }, DEBOUNCE_RETOUR_MS);
}

function gererVisibilite(): void {
  if (document.visibilityState === "visible") verifierConnexion();
}

/**
 * Demarrage paresseux au premier abonne : un seul jeu de listeners et un
 * seul intervalle pour toute l'app, jamais un par composant. L'intervalle
 * de fond ne tourne que si l'onglet est visible (Page Visibility API) -
 * inutile de sonder un onglet en arriere-plan - et sert a rattraper un
 * retour reseau qui ne declenche pas l'evenement "online" (portail captif
 * qui se resout sans coupure d'interface) ou un navigator.onLine=true
 * mensonger jamais corrige faute de nouvel evenement.
 */
function demarrerSiBesoin(): void {
  if (demarre) return;
  demarre = true;

  window.addEventListener("online", gererEnLigneNavigateur);
  window.addEventListener("offline", gererHorsLigneNavigateur);
  document.addEventListener("visibilitychange", gererVisibilite);

  verifierConnexion();
  window.setInterval(() => {
    if (document.visibilityState === "visible") verifierConnexion();
  }, INTERVALLE_ARRIERE_PLAN_MS);
}

export function estEnLigne(): boolean {
  return enLigne;
}

export function surChangementConnectivite(ecouteur: Ecouteur): () => void {
  demarrerSiBesoin();
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

export function useConnectivite(): boolean {
  const [valeur, setValeur] = useState(estEnLigne());
  useEffect(() => surChangementConnectivite(setValeur), []);
  return valeur;
}
