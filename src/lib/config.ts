/**
 * Configuration de l'application, lue AU BUILD depuis l'environnement
 * (variables du projet Vercel, ou fichier `.env` en local). Deux variables :
 *
 *   API_BASE_URL       URL de l'API du backend, ex: https://api.exemple.tg/api/v1
 *                      (un chemin relatif "/api/v1" est aussi accepte).
 *   FRONTEND_BASE_URL  URL publique de ce frontend, ex: https://portail.exemple.tg
 *
 * Vite n'expose au code que les variables dont le nom commence par un des
 * `envPrefix` de vite.config : ils sont limites ici a ces deux noms exacts,
 * pour qu'aucune autre variable d'environnement (secret, jeton) ne puisse
 * finir par erreur dans le bundle livre au navigateur. Les valeurs sont
 * integrees au build : apres un changement dans Vercel, relancer un deploiement.
 */

function nettoyer(valeur: unknown): string {
  // Espaces et barres finales retirees : les chemins ajoutes ensuite commencent par "/".
  return typeof valeur === "string" ? valeur.trim().replace(/\/+$/, "") : "";
}

const API_PAR_DEFAUT = "https://evital.duckdns.org/api/v1";

const apiConfiguree = nettoyer(import.meta.env.API_BASE_URL);

if (!apiConfiguree && import.meta.env.DEV) {
  // Sans variable, l'application parle a l'API de PRODUCTION (valeur de repli) :
  // a signaler plutot que de le decouvrir apres coup.
  console.warn(`API_BASE_URL n'est pas definie : l'application utilise ${API_PAR_DEFAUT} (production).`);
}

export const API_BASE_URL: string = apiConfiguree || API_PAR_DEFAUT;

/** URL publique du frontend ; a defaut, l'origine de la page courante. */
export const FRONTEND_BASE_URL: string =
  nettoyer(import.meta.env.FRONTEND_BASE_URL) || (typeof window !== "undefined" ? window.location.origin : "");

/** Adresse absolue d'une page du frontend (ex: `urlFrontend("/completion/ABC123")`). */
export function urlFrontend(chemin = ""): string {
  return `${FRONTEND_BASE_URL}${chemin && !chemin.startsWith("/") ? "/" : ""}${chemin}`;
}

/**
 * Origine (schema + hote, sans le /api/v1) utilisee par lib/connectivite.ts
 * pour sonder /ping. Si API_BASE_URL n'est pas une URL absolue (config
 * relative), on retombe sur l'origine de la page.
 */
export const ORIGINE_API: string = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
})();
