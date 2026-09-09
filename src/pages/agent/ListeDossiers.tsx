import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee, type StatutDossier } from "../../types/domaine";

const STATUTS: Array<{ valeur: StatutDossier | ""; libelle: string }> = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "recu", libelle: "Recu" },
  { valeur: "notifie", libelle: "Notifie" },
  { valeur: "en_attente_complement", libelle: "En attente de complement" },
  { valeur: "complete", libelle: "Complete" },
  { valeur: "acte_emis", libelle: "Acte emis" },
  { valeur: "sans_suite", libelle: "Sans suite" }
];

export default function ListeDossiers() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (recherche) parametres.set("search", recherche);

    setChargement(true);
    appelApi<ListeOuPaginee<Dossier>>(`/dossiers/?${parametres.toString()}`)
      .then((donnees) => setDossiers(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }, [statutFiltre, recherche]);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Dossiers</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Rechercher par identifiant..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ flex: 1, padding: "9px 11px", border: "1px solid #C9D2C6", borderRadius: 6 }}
        />
        <select
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value as StatutDossier | "")}
          style={{ padding: "9px 11px", border: "1px solid #C9D2C6", borderRadius: 6 }}
        >
          {STATUTS.map((s) => (
            <option key={s.valeur} value={s.valeur}>
              {s.libelle}
            </option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <table className="tableau-standard">
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Evenement</th>
              <th>Origine</th>
              <th>Statut</th>
              <th>Date de declaration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((dossier) => (
              <tr key={dossier.id}>
                <td className="texte-mono">{dossier.id.slice(0, 8)}</td>
                <td>{dossier.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                <td>{dossier.origine === "dhis2" ? "DHIS2" : "Manuel"}</td>
                <td>
                  <BadgeStatut statut={dossier.statut} />
                </td>
                <td className="texte-mono">{dossier.date_declaration}</td>
                <td>
                  <Link to={`/agent/dossiers/${dossier.id}`}>Ouvrir</Link>
                </td>
              </tr>
            ))}
            {dossiers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--couleur-gris-service-2)" }}>
                  Aucun dossier ne correspond a ces criteres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </MiseEnPage>
  );
}
