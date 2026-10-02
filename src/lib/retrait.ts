import { useEffect, useState } from "react";
import { appelApi } from "./apiClient";
import { estEnLigne, surChangementConnectivite } from "./connectivite";
import type { EtatRetrait, ModeRetrait, ModeVerificationRetrait, PieceIdentite, QualiteReceveur } from "../types/domaine";

/**
 * Retrait de l'acte au guichet : libellés partagés et mode de vérification de
 * la recherche par téléphone (interrupteur « Vérification par SMS au
 * guichet » de l'Administrateur Général, voir docs/retrait-acte.md).
 */

export const QUALITES_RECEVEUR: Array<{ valeur: QualiteReceveur; libelle: string }> = [
  { valeur: "declarant", libelle: "Déclarant" },
  { valeur: "parent", libelle: "Parent" },
  { valeur: "mandataire", libelle: "Mandataire" },
  { valeur: "autre", libelle: "Autre" }
];

export const PIECES_IDENTITE: Array<{ valeur: PieceIdentite; libelle: string }> = [
  { valeur: "cni", libelle: "Carte nationale d'identité" },
  { valeur: "passeport", libelle: "Passeport" },
  { valeur: "permis", libelle: "Permis de conduire" },
  { valeur: "carte_electeur", libelle: "Carte d'électeur" },
  { valeur: "autre", libelle: "Autre pièce" }
];

export const MODES_VERIFICATION: Record<ModeVerificationRetrait, string> = {
  physique: "Vérification physique",
  sms: "Code SMS"
};

export function libelleQualite(valeur: string | null | undefined): string {
  return QUALITES_RECEVEUR.find((q) => q.valeur === valeur)?.libelle ?? "";
}

export function libellePiece(valeur: string | null | undefined): string {
  return PIECES_IDENTITE.find((p) => p.valeur === valeur)?.libelle ?? "";
}

export const LIBELLES_ETAT_RETRAIT: Record<EtatRetrait, string> = {
  non_emis: "Acte non émis",
  a_retirer: "À retirer",
  retire: "Retiré"
};

/** « 02/10/2026 » ; chaîne vide si la date est absente ou illisible. */
export function dateRetrait(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
}

/** « 02/10/2026 à 14:05 ». */
export function dateHeureRetrait(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("fr-FR")} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

// --- Mode de vérification de la recherche par téléphone -----------------

/**
 * Même principe que lib/etatCompletion.ts : l'état vit au niveau du module
 * (chaque page remonte son <MiseEnPage>). `verification_sms` vaut `null`
 * tant que le serveur n'a pas répondu : l'écran n'affiche alors aucun des
 * deux parcours (jamais un faux « recherche directe » sur une simple erreur).
 * Hors ligne, la recherche par téléphone est de toute façon impossible.
 */
let mode: boolean | null = null;
let enCours: Promise<void> | null = null;
let connectiviteAbonnee = false;
const ecouteurs = new Set<(valeur: boolean | null) => void>();

function definir(valeur: boolean | null): void {
  if (valeur === mode) return;
  mode = valeur;
  ecouteurs.forEach((ecouteur) => ecouteur(mode));
}

/** Relit le mode auprès du serveur (requêtes concurrentes fusionnées). Ne lève jamais. */
export function rafraichirModeRetrait(): Promise<void> {
  if (enCours) return enCours;
  if (!estEnLigne()) return Promise.resolve();
  enCours = appelApi<ModeRetrait>("/codes-retrait/mode")
    .then((donnees) => {
      if (donnees && typeof donnees.verification_sms === "boolean") definir(donnees.verification_sms);
    })
    .catch(() => {
      // Dernière valeur connue conservée.
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/** Le serveur vient de répondre que le mode a changé : l'écran bascule tout de suite. */
export function signalerModeRetrait(verificationSms: boolean): void {
  definir(verificationSms);
}

/** `verificationSms` : true (code SMS exigé), false (liste directe), null (pas encore connu). */
export function useModeRetrait(): { verificationSms: boolean | null; rafraichir: () => Promise<void> } {
  const [valeur, setValeur] = useState<boolean | null>(() => mode);

  useEffect(() => {
    ecouteurs.add(setValeur);
    setValeur(mode);
    if (!connectiviteAbonnee) {
      connectiviteAbonnee = true;
      surChangementConnectivite((enLigne) => {
        if (enLigne && ecouteurs.size > 0) void rafraichirModeRetrait();
      });
    }
    // Relecture à chaque ouverture de l'écran : l'administrateur a pu basculer depuis.
    void rafraichirModeRetrait();
    return () => {
      ecouteurs.delete(setValeur);
    };
  }, []);

  return { verificationSms: valeur, rafraichir: rafraichirModeRetrait };
}
