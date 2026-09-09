import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Logo from "../../components/Logo";
import type { StatutDossier } from "../../types/domaine";

interface ReponseStatutCompletion {
  statut: StatutDossier;
  mairie: string;
}

const LIBELLES_STATUT: Record<StatutDossier, string> = {
  recu: "Votre declaration a ete recue.",
  notifie: "Votre declaration a ete recue et vous a ete notifiee.",
  en_attente_complement: "Un complement d'information est attendu.",
  complete: "Votre dossier est complet, en attente de verification par la mairie.",
  acte_emis: "Votre acte a ete etabli, vous pouvez le retirer a la mairie.",
  sans_suite: "Le delai legal est depasse. Rapprochez-vous de la mairie pour la procedure de rattrapage."
};

export default function PageStatutCompletion() {
  const { code } = useParams<{ code: string }>();
  const [statut, setStatut] = useState<ReponseStatutCompletion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
    fetch(`${base}/completion/statut/${code}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<ReponseStatutCompletion>;
      })
      .then(setStatut)
      .catch(() => setErreur("Code invalide."));
  }, [code]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="carte" style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={100} />
        </div>
        {erreur && <p className="message-erreur">{erreur}</p>}
        {statut && (
          <>
            <p style={{ fontSize: 13, color: "var(--couleur-gris-service-2)" }}>Mairie de {statut.mairie}</p>
            <p style={{ fontSize: 15 }}>{LIBELLES_STATUT[statut.statut] || statut.statut}</p>
          </>
        )}
      </div>
    </div>
  );
}
