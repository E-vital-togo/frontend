import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import BarreRecherche from "../../components/BarreRecherche";
import Pagination from "../../components/Pagination";
import EtatVide from "../../components/EtatVide";
import Squelette from "../../components/Squelette";
import BadgeStatut from "../../components/BadgeStatut";
import { useListePaginee } from "../../hooks/useListePaginee";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, StatutDossier } from "../../types/domaine";

const STATUTS: Array<{ valeur: StatutDossier | ""; libelle: string }> = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "recu", libelle: "Recu" },
  { valeur: "notifie", libelle: "Notifie" },
  { valeur: "en_attente_complement", libelle: "En attente de complement" },
  { valeur: "complete", libelle: "Complete" },
  { valeur: "acte_emis", libelle: "Acte emis" },
  { valeur: "sans_suite", libelle: "Sans suite" }
];

const TAILLE_PAGE = 25;

export default function ListeDossiers() {
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [recherche, setRecherche] = useState("");

  const cheminBase = useMemo(() => {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (recherche) parametres.set("search", recherche);
    const suffixe = parametres.toString();
    return suffixe ? `/dossiers/?${suffixe}` : "/dossiers/";
  }, [statutFiltre, recherche]);

  const { items: dossiers, count, page, setPage, totalPages, chargement } = useListePaginee<Dossier>(
    cheminBase,
    TAILLE_PAGE
  );

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader titre="Dossiers" description="Naissances et deces recus, en cours de traitement ou clotures." />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <BarreRecherche
          valeur={recherche}
          onChange={setRecherche}
          placeholder="Rechercher par nom (enfant, defunt, declarant...)"
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
        <Squelette lignes={6} />
      ) : (
        <>
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
                    {dossier.a_une_nouvelle_version && (
                      <span className="badge badge--attente" style={{ marginLeft: 6 }}>
                        Modification DHIS2
                      </span>
                    )}
                  </td>
                  <td className="texte-mono">{dossier.date_declaration}</td>
                  <td>
                    <Link to={`/agent/dossiers/${dossier.id}`}>Ouvrir</Link>
                  </td>
                </tr>
              ))}
              {dossiers.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EtatVide icone={FolderOpen} message="Aucun dossier ne correspond a ces criteres." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={count} taillePage={TAILLE_PAGE} onChangerPage={setPage} />
        </>
      )}
    </MiseEnPage>
  );
}
