import { useEffect, useState } from "react";
import MiseEnPage from "../../components/MiseEnPage";
import PageHeader from "../../components/PageHeader";
import Squelette from "../../components/Squelette";
import TableauStatistiques from "../../components/graphiques/TableauStatistiques";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee, type StatutDossier } from "../../types/domaine";

const DIMENSIONS_ADMIN_CEC = [
  { valeur: "statut" as const, libelle: "Statut" },
  { valeur: "event_type" as const, libelle: "Type d'evenement" },
  { valeur: "origine" as const, libelle: "Origine" },
  { valeur: "type_dossier" as const, libelle: "Type de dossier" },
  { valeur: "mairie" as const, libelle: "Mairie" }
];

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
      <PageHeader titre="Vue d'ensemble de la zone" />
      {chargement ? (
        <Squelette lignes={4} />
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

      <div style={{ marginTop: 28 }}>
        <TableauStatistiques titre="Statistiques de la zone" dimensionsDisponibles={DIMENSIONS_ADMIN_CEC} />
      </div>
    </MiseEnPage>
  );
}
