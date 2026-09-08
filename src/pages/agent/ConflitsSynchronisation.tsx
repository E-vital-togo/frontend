import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import BarreRecherche from "../../components/BarreRecherche";
import Pagination from "../../components/Pagination";
import EtatVide from "../../components/EtatVide";
import Squelette from "../../components/Squelette";
import { useListePaginee } from "../../hooks/useListePaginee";
import { LIENS_AGENT } from "./navigation";
import type { ConflitSync } from "../../types/domaine";

const TAILLE_PAGE = 25;

export default function ConflitsSynchronisation() {
  const [recherche, setRecherche] = useState("");

  const cheminBase = useMemo(() => {
    return recherche ? `/sync/conflits/?search=${encodeURIComponent(recherche)}` : "/sync/conflits/";
  }, [recherche]);

  const { items: conflits, count, page, setPage, totalPages, chargement } = useListePaginee<ConflitSync>(
    cheminBase,
    TAILLE_PAGE
  );

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <PageHeader
        titre="Conflits de synchronisation"
        description="Une action faite hors-ligne n'a pas pu s'appliquer car le dossier avait deja ete modifie en ligne
        entre-temps par un collegue. La version en ligne est toujours conservee : aucune donnee n'est perdue
        silencieusement, mais la correction hors-ligne doit etre reprise manuellement si elle reste pertinente."
      />

      <div style={{ marginBottom: 16 }}>
        <BarreRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher dans la raison du conflit..." />
      </div>

      {chargement ? (
        <Squelette lignes={4} />
      ) : (
        <>
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
                  <td colSpan={4}>
                    <EtatVide icone={ShieldCheck} message="Aucun conflit en attente." />
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
