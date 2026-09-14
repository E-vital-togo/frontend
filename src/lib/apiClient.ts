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

export class ErreurApi extends Error {
  code?: string;
  statut: number;

  constructor(message: string, code: string | undefined, statut: number) {
    super(message);
    this.code = code;
    this.statut = statut;
  }
}

/**
 * Le serveur n'a jamais repondu : pas de reseau, DNS injoignable, proxy
 * coupe, requete avortee. Sous-classe d'ErreurApi (statut 0) pour que tous
 * les ecrans qui testent deja `e instanceof ErreurApi` affichent un message
 * comprehensible au lieu du "Failed to fetch" brut du navigateur.
 *
 * Distinction VITALE pour une app hors-ligne : une absence de reponse ne
 * dit RIEN sur la validite de la session. Elle ne doit jamais deconnecter
 * qui que ce soit (voir terminerSession, declenche uniquement sur un vrai
 * 401/403 renvoye par le serveur).
 */
export class ErreurReseau extends ErreurApi {
  constructor() {
    super("Connexion au serveur impossible. Verifiez votre reseau.", "reseau_indisponible", 0);
  }
}

/**
 * Messages de repli quand le corps de la reponse ne dit rien d'exploitable
 * (page HTML d'un proxy, 502 sans JSON, reponse vide...).
 */
const MESSAGES_PAR_STATUT: Record<number, string> = {
  400: "Requete invalide.",
  401: "Session expiree. Reconnectez-vous.",
  403: "Vous n'avez pas les droits necessaires pour cette action.",
  404: "Ressource introuvable.",
  429: "Trop de tentatives. Reessayez dans quelques instants.",
  500: "Le serveur rencontre un probleme. Reessayez plus tard.",
  502: "Le serveur est momentanement injoignable. Reessayez plus tard.",
  503: "Le serveur est momentanement indisponible. Reessayez plus tard.",
  504: "Le serveur met trop de temps a repondre. Reessayez plus tard."
};

/**
 * Le backend n'a pas UN seul format d'erreur, il en a trois :
 *  - ErreurMetier maison (apps.core.exceptions) : {code, message}
 *  - erreurs DRF standard (401, 403, 404, throttling) : {detail: "..."}
 *  - erreurs de validation DRF : {non_field_errors: ["..."]} ou
 *    {champ: ["..."]} - c'est le cas d'un mauvais mot de passe au login
 *    (LoginSerializer), qui n'a PAS de cle `message`.
 * Ne lire que `message` faisait donc afficher le litteral "Erreur" pour
 * tout le troisieme groupe, y compris "Identifiants invalides.".
 */
export function extraireMessageErreur(details: unknown, statut: number): string {
  if (details && typeof details === "object") {
    const corps = details as Record<string, unknown>;

    if (typeof corps.message === "string" && corps.message) return corps.message;
    if (typeof corps.detail === "string" && corps.detail) return corps.detail;

    for (const valeur of Object.values(corps)) {
      if (typeof valeur === "string" && valeur) return valeur;
      if (Array.isArray(valeur) && typeof valeur[0] === "string" && valeur[0]) return valeur[0];
    }
  }
  return MESSAGES_PAR_STATUT[statut] || "Une erreur est survenue.";
}

type EcouteurSessionExpiree = () => void;

const ecouteursSessionExpiree = new Set<EcouteurSessionExpiree>();

/**
 * Notifie l'app (voir AuthContext) qu'une session est REELLEMENT morte -
 * jamais sur une simple panne reseau ou serveur. Un registre plutot qu'un
 * appel direct a un contexte React : ce module reste utilisable hors d'un
 * composant (syncService, etc.).
 */
export function surSessionExpiree(ecouteur: EcouteurSessionExpiree): () => void {
  ecouteursSessionExpiree.add(ecouteur);
  return () => {
    ecouteursSessionExpiree.delete(ecouteur);
  };
}

function terminerSession(): void {
  effacerJetons();
  ecouteursSessionExpiree.forEach((ecouteur) => ecouteur());
}

type ResultatRafraichissement =
  | { etat: "ok"; jeton: string }
  | { etat: "session_morte" }
  | { etat: "indisponible" };

/**
 * Trois issues possibles, volontairement distinctes :
 *  - "ok"            : nouveau jeton d'acces obtenu.
 *  - "session_morte" : le serveur a explicitement REFUSE le jeton de
 *                      rafraichissement (401/403) - expire, revoque,
 *                      blackliste. Seul cas qui autorise une deconnexion.
 *  - "indisponible"  : on n'en sait rien (reseau coupe, 500, 502, 429...).
 *                      On ne touche alors ni aux jetons ni a la session :
 *                      l'ancienne version effacait les jetons sur n'importe
 *                      quel `!reponse.ok`, donc un simple redemarrage du
 *                      backend suffisait a deconnecter un agent en plein
 *                      travail.
 */
async function rafraichirJeton(): Promise<ResultatRafraichissement> {
  const refresh = localStorage.getItem(CLE_RAFRAICHISSEMENT);
  if (!refresh) return { etat: "session_morte" };

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh })
    });
  } catch {
    return { etat: "indisponible" };
  }

  if (reponse.ok) {
    try {
      const donnees = (await reponse.json()) as { access: string };
      stockerJetons({ access: donnees.access });
      return { etat: "ok", jeton: donnees.access };
    } catch {
      return { etat: "indisponible" };
    }
  }

  if (reponse.status === 401 || reponse.status === 403) {
    return { etat: "session_morte" };
  }
  return { etat: "indisponible" };
}

/**
 * Endpoints ou un 401/403 est le RESULTAT d'une tentative de connexion, pas
 * le signe d'une session morte : il ne doit donc jamais declencher de
 * deconnexion automatique (on n'est pas connecte, il n'y a rien a fermer).
 * A noter : de mauvais identifiants renvoient de toute facon un 400 DRF,
 * pas un 401 - cette liste est une ceinture de securite supplementaire.
 */
const CHEMINS_SANS_SESSION = ["/auth/login", "/auth/verify-2fa", "/auth/token/refresh", "/auth/mot-de-passe-oublie"];

function estCheminSansSession(chemin: string): boolean {
  return CHEMINS_SANS_SESSION.some((prefixe) => chemin.startsWith(prefixe));
}

interface OptionsAppel {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  entetesSupplementaires?: Record<string, string>;
  estFormData?: boolean;
}

/**
 * Wrapper fetch unique pour toute l'app : ajoute le jeton d'acces, tente un
 * rafraichissement automatique sur un 401, et convertit toute erreur en
 * ErreurApi exploitable (ErreurReseau si le serveur n'a jamais repondu).
 *
 * Regle de deconnexion, volontairement etroite : SEUL un 401 renvoye par le
 * serveur, suivi d'un rafraichissement lui-meme refuse par le serveur
 * (401/403), ferme la session. Ni une panne reseau, ni un 403, ni un 5xx,
 * ni un 429 n'y touchent - un agent hors couverture ou un backend qui
 * redemarre ne doit jamais perdre sa session ni sa file d'actions locale
 * (voir lib/db.ts, jamais videe ici).
 */
export async function appelApi<T = unknown>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  const { methode = "GET", corps, entetesSupplementaires = {}, estFormData = false } = options;

  const executer = async (jeton: string | null): Promise<Response> => {
    const entetes: Record<string, string> = { ...entetesSupplementaires };
    if (!estFormData) entetes["Content-Type"] = "application/json";
    if (jeton) entetes["Authorization"] = `Bearer ${jeton}`;

    try {
      return await fetch(`${BASE_URL}${chemin}`, {
        method: methode,
        headers: entetes,
        body: corps ? (estFormData ? (corps as BodyInit) : JSON.stringify(corps)) : undefined
      });
    } catch {
      throw new ErreurReseau();
    }
  };

  let reponse = await executer(jetonAcces());
  let sessionTerminee = false;

  if (reponse.status === 401 && !estCheminSansSession(chemin)) {
    const resultat = await rafraichirJeton();

    if (resultat.etat === "ok") {
      reponse = await executer(resultat.jeton);
      // Toujours 401 avec un jeton frais : ce n'est plus une expiration
      // mais un refus de fond (compte desactive, acces revoque).
      if (reponse.status === 401) sessionTerminee = true;
    } else if (resultat.etat === "session_morte") {
      sessionTerminee = true;
    }
    // "indisponible" : session laissee intacte, le 401 d'origine suit le
    // chemin d'erreur normal ci-dessous.

    if (sessionTerminee) {
      terminerSession();
      // Message maison plutot que celui de simplejwt ("Given token not
      // valid for any token type", en anglais) : il peut s'afficher une
      // fraction de seconde avant que la redirection vers /connexion
      // n'intervienne.
      throw new ErreurApi("Session expiree. Reconnectez-vous.", "session_expiree", 401);
    }
  }

  if (!reponse.ok) {
    let details: unknown = null;
    try {
      details = await reponse.json();
    } catch {
      // Reponse non-JSON (page d'erreur d'un proxy, 500 brut) : on retombe
      // sur le message par defaut du statut.
    }
    const corpsErreur = (details && typeof details === "object" ? (details as Record<string, unknown>) : {}) as {
      code?: string;
    };
    throw new ErreurApi(extraireMessageErreur(details, reponse.status), corpsErreur.code, reponse.status);
  }

  const typeContenu = reponse.headers.get("content-type") || "";
  if (typeContenu.includes("application/json")) {
    return (await reponse.json()) as T;
  }
  return (await reponse.blob()) as unknown as T;
}
