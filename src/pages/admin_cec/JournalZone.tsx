import { useEffect, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { Badge, BarreOutils, Bouton, EnteteDePage, ListeResponsive, Pagination, type ColonneListe } from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDateHeure, messageErreur } from "./outils";
import type { EntreeJournalZone, ReponseJournalZone } from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";

const COLONNES: ColonneListe<EntreeJournalZone>[] = [
  {
    id: "date",
    libelle: "Date",
    principale: true,
    nowrap: true,
    rendu: (e) => <span className="texte-mono">{formaterDateHeure(e.created_at)}</span>
  },
  { id: "auteur", libelle: "Auteur", rendu: (e) => e.auteur || "-" },
  { id: "action", libelle: "Action", rendu: (e) => e.libelle },
  {
    id: "statut",
    libelle: "Résultat",
    rendu: (e) => (
      <span className="eva-ac-resultat">
        <Badge variante={e.succes ? "succes" : "danger"} point>
          {e.succes ? "Réussie" : "Échec"}
        </Badge>
        <span className="eva-ac-resultat__code texte-mono" title="Code de réponse du serveur">
          {e.statut}
        </span>
      </span>
    )
  }
];

export default function JournalZone() {
  const [reponse, setReponse] = useState<ReponseJournalZone | null>(null);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    let obsolete = false;
    setChargement(true);
    setErreur(null);
    appelApi<ReponseJournalZone>(`/journal-zone/?page=${page}`)
      .then((donnees) => {
        if (!obsolete) setReponse(donnees);
      })
      .catch((e) => {
        if (!obsolete) setErreur(messageErreur(e, "Impossible de charger le journal."));
      })
      .finally(() => {
        if (!obsolete) setChargement(false);
      });
    return () => {
      obsolete = true;
    };
  }, [page, rechargement]);

  const entrees = reponse?.results ?? [];

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage titre="Journal de la zone" sousTitre="Actions récentes des agents et administrateurs de votre périmètre." />

      <BarreOutils
        compteur={reponse && !erreur ? compterAvecUnite(reponse.count, "action enregistrée", "actions enregistrées") : undefined}
        actions={
          <Bouton
            variante="secondaire"
            taille="petit"
            onClick={() => setRechargement((n) => n + 1)}
            disabled={chargement}
            iconeGauche={<RefreshCw size={14} />}
          >
            Actualiser
          </Bouton>
        }
      />

      <ListeResponsive<EntreeJournalZone>
        legende="Journal de la zone"
        lignes={entrees}
        cle={(e, index) => `${e.created_at}-${index}`}
        colonnes={COLONNES}
        chargement={chargement}
        erreur={erreur}
        onReessayer={() => setRechargement((n) => n + 1)}
        hauteurMax="none"
        sansSurvol
        vide={{
          icone: <ScrollText size={26} />,
          titre: "Aucune action enregistrée pour le moment",
          description: "Les actions des agents et administrateurs de votre zone apparaîtront ici."
        }}
      />

      {reponse && !erreur && (
        <Pagination
          page={reponse.page}
          taillepage={reponse.page_size}
          total={reponse.count}
          aSuivant={reponse.page * reponse.page_size < reponse.count}
          aPrecedent={reponse.page > 1}
          onChanger={setPage}
        />
      )}
    </MiseEnPage>
  );
}
