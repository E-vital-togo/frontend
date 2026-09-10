import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { ChargementPage, EnteteDePage, EtatVide, Pagination, Tableau } from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import type { ReponseJournalZone } from "../../types/domaine";

export default function JournalZone() {
  const [reponse, setReponse] = useState<ReponseJournalZone | null>(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    appelApi<ReponseJournalZone>(`/journal-zone/?page=${page}`)
      .then(setReponse)
      .finally(() => setChargement(false));
  }, [page]);

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Journal de la zone"
        sousTitre="Actions recentes des agents et administrateurs de votre perimetre."
      />

      {chargement ? (
        <ChargementPage />
      ) : !reponse || reponse.results.length === 0 ? (
        <EtatVide icone={<ScrollText size={28} />} titre="Aucune action enregistree pour le moment" />
      ) : (
        <>
          <Tableau>
            <thead>
              <tr>
                <th>Date</th>
                <th>Auteur</th>
                <th>Action</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {reponse.results.map((entree, index) => (
                <tr key={index}>
                  <td className="texte-mono">{new Date(entree.created_at).toLocaleString("fr-FR")}</td>
                  <td>{entree.auteur}</td>
                  <td className="eva-tableau__cellule-large">{entree.libelle}</td>
                  <td>
                    <span className={`eva-badge ${entree.succes ? "eva-badge--succes" : "eva-badge--danger"}`}>
                      {entree.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tableau>
          <Pagination
            page={reponse.page}
            taillepage={reponse.page_size}
            total={reponse.count}
            aSuivant={reponse.page * reponse.page_size < reponse.count}
            aPrecedent={reponse.page > 1}
            onChanger={setPage}
          />
        </>
      )}
    </MiseEnPage>
  );
}
