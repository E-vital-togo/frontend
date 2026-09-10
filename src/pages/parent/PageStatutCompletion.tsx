import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Check } from "lucide-react";
import Logo from "../../components/Logo";
import { appelApiPublic } from "../../lib/apiPublic";
import type { StatutDossier } from "../../types/domaine";

interface ReponseStatutCompletion {
  statut: StatutDossier;
  mairie: string;
}

const ETAPES: Array<{ statuts: StatutDossier[]; libelle: string }> = [
  { statuts: ["recu", "notifie"], libelle: "Recu" },
  { statuts: ["en_attente_complement"], libelle: "Verification" },
  { statuts: ["complete"], libelle: "Complet" },
  { statuts: ["acte_emis"], libelle: "Acte emis" }
];

const MESSAGES: Record<StatutDossier, string> = {
  recu: "Votre declaration a ete recue.",
  notifie: "Votre declaration a ete recue et vous a ete notifiee.",
  en_attente_complement: "Un complement d'information est attendu.",
  complete: "Votre dossier est complet, en attente de verification par la mairie.",
  acte_emis: "Votre acte a ete etabli, vous pouvez le retirer a la mairie.",
  sans_suite: "Le delai legal est depasse. Rapprochez-vous de la mairie pour la procedure de rattrapage."
};

function indexEtape(statut: StatutDossier): number {
  return ETAPES.findIndex((etape) => etape.statuts.includes(statut));
}

export default function PageStatutCompletion() {
  const { code } = useParams<{ code: string }>();
  const [statut, setStatut] = useState<ReponseStatutCompletion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    appelApiPublic<ReponseStatutCompletion>(`/completion/statut/${code}`)
      .then(setStatut)
      .catch(() => setErreur("Code invalide."));
  }, [code]);

  const etapeActuelle = statut ? indexEtape(statut.statut) : -1;

  return (
    <div className="eva-ecran-centre">
      <div className="eva-carte" style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Logo variante="vertical" hauteur={90} />
        </div>
        {erreur && <p className="message-erreur">{erreur}</p>}
        {statut && (
          <>
            <p className="eva-sous-titre" style={{ marginBottom: 20 }}>Mairie de {statut.mairie}</p>

            {statut.statut === "sans_suite" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={30} color="var(--couleur-erreur)" />
                <p style={{ fontSize: 15 }}>{MESSAGES[statut.statut]}</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, position: "relative" }}>
                  <div style={{ position: "absolute", top: 13, left: "12%", right: "12%", height: 2, background: "var(--couleur-bordure)", zIndex: 0 }} />
                  {ETAPES.map((etape, index) => {
                    const atteinte = index <= etapeActuelle;
                    return (
                      <div key={etape.libelle} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1, flex: 1 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: atteinte ? "var(--couleur-emeraude)" : "var(--couleur-blanc)",
                            border: `2px solid ${atteinte ? "var(--couleur-emeraude)" : "var(--couleur-bordure-forte)"}`,
                            color: "var(--couleur-blanc)"
                          }}
                        >
                          {atteinte && <Check size={14} />}
                        </div>
                        <span style={{ fontSize: 10.5, color: atteinte ? "var(--couleur-encre)" : "var(--couleur-gris-service-2)", fontWeight: atteinte ? 600 : 400 }}>
                          {etape.libelle}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 15 }}>{MESSAGES[statut.statut] || statut.statut}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
