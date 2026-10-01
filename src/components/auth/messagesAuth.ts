import { ErreurApi } from "../../lib/apiClient";
import { ErreurApiPublique } from "../../lib/apiPublic";

/**
 * Messages des ecrans sans session (connexion, parcours parent).
 *
 * Le backend renvoie parfois des textes sans accents ("Identifiants
 * invalides.", "Code invalide ou expire."). On ne modifie pas la reponse du
 * serveur : on l'affiche seulement avec une orthographe correcte et, pour les
 * cas les plus courants, une formulation plus utile pour la personne.
 */
const MESSAGES_CONNUS: Record<string, string> = {
  "Identifiants invalides.": "Adresse email ou mot de passe incorrect. Vérifiez votre saisie.",
  "Ce compte est desactive.": "Ce compte est désactivé. Contactez votre administrateur.",
  "Trop de tentatives. Veuillez reessayer dans quelques minutes.": "Trop de tentatives. Veuillez réessayer dans quelques minutes.",
  "Trop de tentatives. Reessayez dans quelques instants.": "Trop de tentatives. Réessayez dans quelques instants.",
  "Code invalide ou expire.": "Ce code est invalide ou a expiré.",
  "Code invalide.": "Ce code ne correspond à aucun dossier.",
  "Lien de reinitialisation invalide ou expire.": "Ce lien de réinitialisation est invalide ou a expiré.",
  "Mot de passe actuel incorrect.": "Le mot de passe actuel est incorrect.",
  "Session expiree. Reconnectez-vous.": "Votre session a expiré. Reconnectez-vous.",
  "Ressource introuvable.": "Élément introuvable.",
  "Requete invalide.": "Requête invalide.",
  "Un code de verification vient de vous etre envoye par SMS.": "Un code de vérification vient de vous être envoyé par SMS."
};

/** Corrections de mots entiers, appliquees aux messages serveur inconnus. */
const MOTS: Array<[RegExp, string]> = [
  [/\bVerifiez\b/g, "Vérifiez"],
  [/\bverifiez\b/g, "vérifiez"],
  [/\bReessayez\b/g, "Réessayez"],
  [/\breessayez\b/g, "réessayez"],
  [/\bReessayer\b/g, "Réessayer"],
  [/\breessayer\b/g, "réessayer"],
  [/\breseau\b/g, "réseau"],
  [/\bmomentanement\b/g, "momentanément"],
  [/\bprobleme\b/g, "problème"],
  [/\bdesactive\b/g, "désactivé"],
  [/\bexpiree\b/g, "expirée"],
  [/\bRequete\b/g, "Requête"],
  [/\bverification\b/g, "vérification"],
  [/\bVerification\b/g, "Vérification"],
  [/\betre\b/g, "être"],
  [/\benvoye\b/g, "envoyé"],
  [/\benvoyee\b/g, "envoyée"]
];

export function accentuer(message: string): string {
  const connu = MESSAGES_CONNUS[message];
  if (connu) return connu;
  return MOTS.reduce((texte, [motif, remplacement]) => texte.replace(motif, remplacement), message);
}

export interface MessageErreur {
  variante: "erreur" | "avertissement";
  titre: string;
  message: string;
}

const MESSAGE_RESEAU = "Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.";

/** Vrai si le serveur n'a jamais repondu (pas de reseau, DNS, proxy coupe). */
export function estErreurReseau(e: unknown): boolean {
  if (e instanceof ErreurApi) return e.statut === 0;
  if (e instanceof ErreurApiPublique) return e.message.startsWith("Connexion au serveur impossible");
  return false;
}

/**
 * Transforme une erreur d'appel API en message affichable : panne reseau,
 * limitation ou verrouillage, erreur serveur, ou refus metier (message du
 * serveur). `titreParDefaut` nomme le refus metier ("Connexion refusée"...).
 */
export function decrireErreur(e: unknown, titreParDefaut: string, messageParDefaut = "Une erreur est survenue. Réessayez."): MessageErreur {
  if (estErreurReseau(e)) {
    return { variante: "avertissement", titre: "Connexion impossible", message: MESSAGE_RESEAU };
  }
  const message = e instanceof Error && e.message ? accentuer(e.message) : messageParDefaut;
  if (e instanceof ErreurApi && (e.statut === 429 || e.code === "trop_de_tentatives")) {
    return { variante: "avertissement", titre: "Trop de tentatives", message: message || "Patientez quelques minutes avant de réessayer." };
  }
  if (e instanceof ErreurApi && e.statut >= 500) {
    return { variante: "erreur", titre: "Service momentanément indisponible", message };
  }
  return { variante: "erreur", titre: titreParDefaut, message };
}
