import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { appelApi, effacerJetons, jetonAcces, stockerJetons } from "../lib/apiClient";
import type { Utilisateur } from "../types/domaine";

const CLE_UTILISATEUR = "evital_utilisateur";

interface ReponseDemarrageConnexion {
  message: string;
  email: string;
}

interface ReponseVerificationCode {
  access: string;
  refresh: string;
  utilisateur: Utilisateur;
}

interface ContexteAuthValeur {
  utilisateur: Utilisateur | null;
  enChargement: boolean;
  demarrerConnexion: (email: string, motDePasse: string) => Promise<ReponseDemarrageConnexion>;
  validerCode: (email: string, code: string) => Promise<Utilisateur>;
  deconnecter: () => void;
  mettreAJourUtilisateur: (utilisateur: Utilisateur) => void;
}

const ContexteAuth = createContext<ContexteAuthValeur | null>(null);

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(() => {
    const brut = localStorage.getItem(CLE_UTILISATEUR);
    return brut ? (JSON.parse(brut) as Utilisateur) : null;
  });
  const [enChargement, setEnChargement] = useState(true);

  useEffect(() => {
    // Un jeton present sans utilisateur en cache signifie une session
    // corrompue (ex: stockage partiellement efface) : on repart propre.
    if (jetonAcces() && !utilisateur) {
      effacerJetons();
    }
    setEnChargement(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function demarrerConnexion(email: string, motDePasse: string) {
    return appelApi<ReponseDemarrageConnexion>("/auth/login", {
      methode: "POST",
      corps: { email, password: motDePasse }
    });
  }

  async function validerCode(email: string, code: string) {
    const donnees = await appelApi<ReponseVerificationCode>("/auth/verify-2fa", {
      methode: "POST",
      corps: { email, code }
    });
    stockerJetons({ access: donnees.access, refresh: donnees.refresh });
    localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(donnees.utilisateur));
    setUtilisateur(donnees.utilisateur);
    return donnees.utilisateur;
  }

  function deconnecter() {
    effacerJetons();
    localStorage.removeItem(CLE_UTILISATEUR);
    setUtilisateur(null);
  }

  function mettreAJourUtilisateur(nouvelUtilisateur: Utilisateur) {
    localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(nouvelUtilisateur));
    setUtilisateur(nouvelUtilisateur);
  }

  return (
    <ContexteAuth.Provider
      value={{ utilisateur, enChargement, demarrerConnexion, validerCode, deconnecter, mettreAJourUtilisateur }}
    >
      {children}
    </ContexteAuth.Provider>
  );
}

export function useAuth(): ContexteAuthValeur {
  const contexte = useContext(ContexteAuth);
  if (!contexte) throw new Error("useAuth doit etre utilise a l'interieur de FournisseurAuth");
  return contexte;
}
