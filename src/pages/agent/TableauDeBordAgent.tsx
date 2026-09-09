import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee } from "../../types/domaine";

export default function TableauDeBordAgent() {
  const [dossiersProches, setDossiersProches] = useState<Dossier[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true")
      .then((donnees) => setDossiersProches(listeDepuis(donnees)))
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setChargement(false));
  }, []);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Tableau de bord</h1>
      <div className="grille-cartes" style={{ marginBottom: 28 }}>
        <div className="carte">
          <div className="chiffre-cle">{dossiersProches.length}</div>
          <div className="libelle-cle">Echeances proches</div>
        </div>
        <Link to="/agent/dossiers" className="carte" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--couleur-emeraude)" }}>Dossiers</div>
          <div className="libelle-cle">Voir tous les dossiers</div>
        </Link>
        <Link to="/agent/dossiers/nouveau" className="carte" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--couleur-emeraude)" }}>Nouveau</div>
          <div className="libelle-cle">Creer un dossier manuel</div>
        </Link>
        <Link to="/agent/conflits" className="carte" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--couleur-emeraude)" }}>Conflits</div>
          <div className="libelle-cle">Conflits de synchronisation</div>
        </Link>
      </div>

      <h2 style={{ fontSize: 16, color: "var(--couleur-emeraude)" }}>Dossiers proches de l'echeance</h2>
      {erreur && <div className="message-erreur">{erreur}</div>}
      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <table className="tableau-standard">
          <thead>
            <tr>
              <th>Evenement</th>
              <th>Statut</th>
              <th>Date limite</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dossiersProches.map((dossier) => (
              <tr key={dossier.id}>
                <td>{dossier.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                <td>
                  <BadgeStatut statut={dossier.statut} />
                </td>
                <td className="texte-mono">{dossier.date_limite}</td>
                <td>
                  <Link to={`/agent/dossiers/${dossier.id}`}>Ouvrir</Link>
                </td>
              </tr>
            ))}
            {dossiersProches.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--couleur-gris-service-2)" }}>
                  Aucun dossier proche de l'echeance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </MiseEnPage>
  );
}
