import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import { ChargementPage, EnteteDePage, EtatVide, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { useAuth } from "../../context/AuthContext";
import { appelApi } from "../../lib/apiClient";
import { LIENS_AGENT } from "./navigation";
import { LIENS_ADMIN_CEC } from "../admin_cec/navigation";
import { listeDepuis, type ConflitSync, type ListeOuPaginee } from "../../types/domaine";

export default function ConflitsSynchronisation() {
  const { utilisateur } = useAuth();
  const estAgent = utilisateur?.role === "agent_cec";
  const liens = estAgent ? LIENS_AGENT : LIENS_ADMIN_CEC;
  const basePath = estAgent ? "/agent" : "/admin-cec";

  const [conflits, setConflits] = useState<ConflitSync[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    appelApi<ListeOuPaginee<ConflitSync>>("/sync/conflits/")
      .then((donnees) => setConflits(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }, []);

  return (
    <MiseEnPage liens={liens}>
      <EnteteDePage
        titre="Conflits de synchronisation"
        sousTitre="Une action faite hors-ligne n'a pas pu s'appliquer car le dossier avait deja ete modifie en ligne entre-temps par un collegue. La version en ligne est toujours conservee : aucune donnee n'est perdue silencieusement, mais la correction hors-ligne doit etre reprise manuellement si elle reste pertinente."
      />
      {chargement ? (
        <ChargementPage />
      ) : conflits.length === 0 ? (
        <EtatVide icone={<CheckCircle2 size={28} />} titre="Aucun conflit en attente" description="Toutes les actions hors-ligne ont ete synchronisees sans probleme." />
      ) : (
        <Tableau>
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
                <td className="eva-tableau__cellule-large">{conflit.raison}</td>
                <td>
                  <LienBouton to={`${basePath}/dossiers/${conflit.dossier}`} variante="fantome" taille="petit">
                    Reprendre le dossier
                  </LienBouton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </MiseEnPage>
  );
}
