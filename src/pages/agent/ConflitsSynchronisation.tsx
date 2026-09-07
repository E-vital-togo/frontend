import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type ConflitSync, type ListeOuPaginee } from "../../types/domaine";

export default function ConflitsSynchronisation() {
  const [conflits, setConflits] = useState<ConflitSync[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/")
      .then((donnees) => setConflits(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }, []);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Conflits de synchronisation</h1>
      <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13 }}>
        Une action faite hors-ligne n'a pas pu s'appliquer car le dossier avait deja ete modifie en ligne entre-temps
        par un collegue. La version en ligne est toujours conservee : aucune donnee n'est perdue silencieusement,
        mais la correction hors-ligne doit etre reprise manuellement si elle reste pertinente.
      </p>
      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <table className="tableau-standard">
          <thead>
            <tr>
              <th>Date</th>
              <th>Dossier</th>
              <th>Raison</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {conflits.map((conflit) => (
              <tr key={conflit.id}>
                <td className="texte-mono">{new Date(conflit.created_at).toLocaleString("fr-FR")}</td>
                <td className="texte-mono">{conflit.dossier.slice(0, 8)}</td>
                <td>{conflit.raison}</td>
                <td>
                  <Link to={`/agent/dossiers/${conflit.dossier}`}>Reprendre le dossier</Link>
                </td>
              </tr>
            ))}
            {conflits.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--couleur-gris-service-2)" }}>
                  Aucun conflit en attente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </MiseEnPage>
  );
}
