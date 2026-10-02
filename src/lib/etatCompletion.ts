import { useEffect, useState } from "react";
import { appelApiPublic } from "./apiPublic";
import { estEnLigne, surChangementConnectivite } from "./connectivite";
import type { EtatCompletion } from "../types/domaine";

/**
 * Etat de l'interrupteur de la completion parent (GET /completion/etat,
 * public, aucune donnee sensible). Partage par les ecrans parent (ecran
 * d'indisponibilite) et par les espaces agent / admin CEC (bandeaux
 * d'information, boutons de relance desactives).
 *
 * Meme principe que lib/useCompteurs.ts : l'etat vit au niveau du module,
 * pas dans un useState (chaque page remonte son propre <MiseEnPage>, un
 * etat local repartirait de zero a chaque navigation) ; useEtatCompletion()
 * n'en est qu'une vue reactive.
 *
 * Tolerance hors ligne et pannes : en cas d'erreur (reseau coupe, serveur
 * qui redemarre...) on garde la derniere valeur connue, et a defaut on
 * suppose "actif" - JAMAIS de bandeau ni d'ecran d'indisponibilite sur la
 * foi d'une simple erreur : l'etat par defaut est le comportement normal.
 * Ce qui coupe vraiment une action reste decide par le serveur (503 /
 * code `completion_desactivee`).
 */
const VALIDITE_MS = 60_000;
const INTERVALLE_MS = 120_000;

const ETAT_PAR_DEFAUT: EtatCompletion = { active: true, message: "", message_personnalise: false };

let etat: EtatCompletion = ETAT_PAR_DEFAUT;
let dernierChargement = 0;
let enCours: Promise<void> | null = null;
let connectiviteAbonnee = false;
const ecouteurs = new Set<(valeur: EtatCompletion) => void>();
let minuteur: number | undefined;

function definir(valeur: EtatCompletion): void {
  const change = valeur.active !== etat.active || valeur.message !== etat.message || valeur.message_personnalise !== etat.message_personnalise;
  etat = valeur;
  if (change) ecouteurs.forEach((ecouteur) => ecouteur(etat));
}

function valide(donnees: unknown): donnees is EtatCompletion {
  return !!donnees && typeof donnees === "object" && typeof (donnees as EtatCompletion).active === "boolean";
}

/** Interroge le serveur (requetes concurrentes fusionnees). Ne leve jamais. */
export function rafraichirEtatCompletion(): Promise<void> {
  if (enCours) return enCours;
  if (!estEnLigne()) return Promise.resolve();
  enCours = appelApiPublic<EtatCompletion>("/completion/etat")
    .then((donnees) => {
      if (valide(donnees)) {
        definir({
          active: donnees.active,
          message: typeof donnees.message === "string" ? donnees.message : "",
          message_personnalise: Boolean(donnees.message_personnalise)
        });
        dernierChargement = Date.now();
      }
    })
    .catch(() => {
      // Derniere valeur connue conservee ; a defaut, "actif" (voir plus haut).
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/**
 * A appeler quand un appel de completion repond `completion_desactivee` :
 * l'ecran bascule tout de suite, puis l'etat reel (message de l'admin
 * compris) est relu aupres du serveur.
 */
export function signalerCompletionDesactivee(): void {
  definir({ active: false, message: "", message_personnalise: false });
  dernierChargement = 0;
  void rafraichirEtatCompletion();
}

function demarrerSiBesoin(): void {
  if (!connectiviteAbonnee) {
    connectiviteAbonnee = true;
    // Retour de connexion confirme : relit l'etat sans attendre l'intervalle.
    surChangementConnectivite((enLigne) => {
      if (enLigne && ecouteurs.size > 0) void rafraichirEtatCompletion();
    });
  }
  if (minuteur === undefined) {
    minuteur = window.setInterval(() => void rafraichirEtatCompletion(), INTERVALLE_MS);
  }
  if (Date.now() - dernierChargement > VALIDITE_MS) void rafraichirEtatCompletion();
}

function arreterSiInutile(): void {
  if (ecouteurs.size === 0 && minuteur !== undefined) {
    window.clearInterval(minuteur);
    minuteur = undefined;
  }
}

/** Etat courant de la completion parent + `rafraichir` (relecture immediate). */
export function useEtatCompletion(): EtatCompletion & { rafraichir: () => Promise<void> } {
  const [valeur, setValeur] = useState(() => etat);

  useEffect(() => {
    ecouteurs.add(setValeur);
    setValeur(etat);
    demarrerSiBesoin();
    return () => {
      ecouteurs.delete(setValeur);
      arreterSiInutile();
    };
  }, []);

  return { ...valeur, rafraichir: rafraichirEtatCompletion };
}
