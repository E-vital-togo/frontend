const BASE_URL = import.meta.env.API_BASE_URL || "https://evital.duckdns.org/api/v1";

const CLE_ACCES = "evital_access_token";
const CLE_RAFRAICHISSEMENT = "evital_refresh_token";

export interface Jetons {
  access: string;
  refresh?: string;
}

export function stockerJetons({ access, refresh }: Jetons): void {
  localStorage.setItem(CLE_ACCES, access);
  if (refresh) localStorage.setItem(CLE_RAFRAICHISSEMENT, refresh);
}

export function effacerJetons(): void {
  localStorage.removeItem(CLE_ACCES);
  localStorage.removeItem(CLE_RAFRAICHISSEMENT);
}

export function jetonAcces(): string | null {
  return localStorage.getItem(CLE_ACCES);
}

async function rafraichirJeton(): Promise<string | null> {
  const refresh = localStorage.getItem(CLE_RAFRAICHISSEMENT);
  if (!refresh) return null;

  const reponse = await fetch(`${BASE_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh })
  });
  if (!reponse.ok) {
    effacerJetons();
    return null;
  }
  const donnees = (await reponse.json()) as { access: string };
  stockerJetons({ access: donnees.access });
  return donnees.access;
}

export class ErreurApi extends Error {
  code?: string;
  statut: number;

  constructor(message: string, code: string | undefined, statut: number) {
    super(message);
    this.code = code;
    this.statut = statut;
  }
}

interface OptionsAppel {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  entetesSupplementaires?: Record<string, string>;
  estFormData?: boolean;
}

/**
 * Wrapper fetch unique pour toute l'app : ajoute le jeton d'acces, tente
 * un rafraichissement automatique sur un 401, et convertit les reponses
 * d'erreur du backend ({code, message}, voir apps.core.exceptions cote
 * Django) en exception exploitable par l'appelant plutot que de laisser
 * chaque ecran reparser la reponse.
 */
export async function appelApi<T = unknown>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  const { methode = "GET", corps, entetesSupplementaires = {}, estFormData = false } = options;

  const executer = async (jeton: string | null) => {
    const entetes: Record<string, string> = { ...entetesSupplementaires };
    if (!estFormData) entetes["Content-Type"] = "application/json";
    if (jeton) entetes["Authorization"] = `Bearer ${jeton}`;

    return fetch(`${BASE_URL}${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps ? (estFormData ? (corps as BodyInit) : JSON.stringify(corps)) : undefined
    });
  };

  let reponse = await executer(jetonAcces());

  if (reponse.status === 401) {
    const nouveauJeton = await rafraichirJeton();
    if (nouveauJeton) {
      reponse = await executer(nouveauJeton);
    }
  }

  if (!reponse.ok) {
    let details: { message?: string; code?: string } = { message: "Une erreur est survenue." };
    try {
      details = await reponse.json();
    } catch {
      // reponse non-JSON (ex: 500 brut) : on garde le message par defaut
    }
    throw new ErreurApi(details.message || "Erreur", details.code, reponse.status);
  }

  const typeContenu = reponse.headers.get("content-type") || "";
  if (typeContenu.includes("application/json")) {
    return (await reponse.json()) as T;
  }
  return (await reponse.blob()) as unknown as T;
}
