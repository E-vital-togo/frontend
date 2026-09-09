import { useEffect, useState } from "react";
import MiseEnPage from "../../components/MiseEnPage";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type DemandeModificationActe, type ListeOuPaginee } from "../../types/domaine";

export default function DemandesModificationAdminCec() {
  const [demandes, setDemandes] = useState<DemandeModificationActe[]>([]);
  const [chargement, setChargement] = useState(true);

  function charger() {
    setChargement(true);
    appelApi<ListeOuPaginee<DemandeModificationActe>>("/demandes-modification/")
      .then((donnees) => setDemandes(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    charger();
  }, []);

  async function rejeter(id: string) {
    const commentaire = window.prompt("Motif du rejet ?");
    if (!commentaire) return;
    await appelApi(`/demandes-modification/${id}/rejeter/`, { methode: "POST", corps: { commentaire } });
    charger();
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Demandes de modification d'acte</h1>
      <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13 }}>
        Les champs d'identite (nom, prenom, sexe, date de naissance/deces) exigent une validation nationale ; les
        autres champs se traitent au niveau regional.
      </p>
      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <table className="tableau-standard">
          <thead>
            <tr>
              <th>Dossier</th>
              <th>Niveau requis</th>
              <th>Statut</th>
              <th>Demandeur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d.id}>
                <td className="texte-mono">{d.dossier.slice(0, 8)}</td>
                <td>{d.niveau_requis}</td>
                <td>{d.statut}</td>
                <td>{d.demandeur}</td>
                <td>
                  {d.statut === "en_attente" && (
                    <button className="bouton-secondaire" onClick={() => rejeter(d.id)}>
                      Rejeter
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {demandes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--couleur-gris-service-2)" }}>
                  Aucune demande en attente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </MiseEnPage>
  );
}
