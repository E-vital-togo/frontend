import { useEffect, useState } from "react";
import MiseEnPage from "../../components/MiseEnPage";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee, type StatutDossier } from "../../types/domaine";

const LIBELLES_STATUT: Record<StatutDossier, string> = {
  recu: "Recu",
  notifie: "Notifie",
  en_attente_complement: "En attente",
  complete: "Complete",
  acte_emis: "Acte emis",
  sans_suite: "Sans suite"
};

export default function TableauDeBordAdminCec() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    appelApi<ListeOuPaginee<Dossier>>("/dossiers/")
      .then((donnees) => setDossiers(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }, []);

  const repartition = dossiers.reduce<Partial<Record<StatutDossier, number>>>((acc, d) => {
    acc[d.statut] = (acc[d.statut] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <h1 style={{ color: "var(--couleur-emeraude)" }}>Vue d'ensemble de la zone</h1>
      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <div className="grille-cartes">
          <div className="carte">
            <div className="chiffre-cle">{dossiers.length}</div>
            <div className="libelle-cle">Dossiers au total</div>
          </div>
          {(Object.entries(LIBELLES_STATUT) as Array<[StatutDossier, string]>).map(([cle, libelle]) => (
            <div className="carte" key={cle}>
              <div className="chiffre-cle">{repartition[cle] ?? 0}</div>
              <div className="libelle-cle">{libelle}</div>
            </div>
          ))}
        </div>
      )}
    </MiseEnPage>
  );
}
