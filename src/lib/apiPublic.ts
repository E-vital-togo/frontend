/**
 * Client pour les endpoints publics (parent/declarant), accessibles sans
 * authentification (code seul - voir apps.dossiers.views cote backend).
 * Ne joint jamais de jeton JWT, contrairement a appelApi() utilise partout
 * ailleurs dans l'app.
 */
import { extraireMessageErreur } from "./apiClient";

const BASE_URL = import.meta.env.API_BASE_URL || "https://evital.duckdns.org/api/v1";

export class ErreurApiPublique extends Error {}

export async function appelApiPublic<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${BASE_URL}${chemin}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
  } catch {
    throw new ErreurApiPublique("Connexion au serveur impossible. Verifiez votre reseau.");
  }

  if (!reponse.ok) {
    let details: unknown = null;
    try {
      details = await reponse.json();
    } catch {
      // reponse non-JSON : extraireMessageErreur retombe sur le statut
    }
    // Meme extraction que le client authentifie : le backend melange
    // {message}, {detail} et {champ: [...]} selon le type d'erreur.
    throw new ErreurApiPublique(extraireMessageErreur(details, reponse.status));
  }
  return reponse.json() as Promise<T>;
}
