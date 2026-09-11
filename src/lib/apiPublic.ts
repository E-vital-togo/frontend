/**
 * Client pour les endpoints publics (parent/declarant), accessibles sans
 * authentification (code seul - voir apps.dossiers.views cote backend).
 * Ne joint jamais de jeton JWT, contrairement a appelApi() utilise partout
 * ailleurs dans l'app.
 */
const BASE_URL = import.meta.env.API_BASE_URL || "https://evital.duckdns.org/api/v1";

export class ErreurApiPublique extends Error {}

export async function appelApiPublic<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!reponse.ok) {
    let message = "Une erreur est survenue.";
    try {
      const details = (await reponse.json()) as { message?: string };
      if (details.message) message = details.message;
    } catch {
      // reponse non-JSON : on garde le message par defaut
    }
    throw new ErreurApiPublique(message);
  }
  return reponse.json() as Promise<T>;
}
