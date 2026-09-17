import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, FilePlus, FolderOpen, QrCode } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { CarteStat, ChargementPage, EnteteDePage, EtatVide, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { useCompteurs } from "../../lib/useCompteurs";
import { classeUrgence, couleurUrgence, joursRestants } from "../../lib/urgence";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee } from "../../types/domaine";

export default function TableauDeBordAgent() {
  const compteurs = useCompteurs();
  const [dossiersProches, setDossiersProches] = useState<Dossier[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true")
      .then((donnees) => setDossiersProches(listeDepuis(donnees)))
      .finally(() => setChargement(false));
  }, []);

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage titre="Tableau de bord" sousTitre="Vue d'ensemble de vos dossiers en cours" />

      <div className="grille-cartes" style={{ marginBottom: 28 }}>
        <CarteStat icone={<Clock size={22} />} valeur={compteurs.echeances} libelle="Echeances proches" alerte={compteurs.echeances > 0} />
        <CarteStat icone={<AlertTriangle size={22} />} valeur={compteurs.conflits} libelle="Conflits de sync" alerte={compteurs.conflits > 0} />
        <Link to="/agent/dossiers/nouveau" className="eva-carte eva-carte--interactive" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <FilePlus size={20} color="var(--couleur-emeraude)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Nouveau dossier</div>
          <div className="eva-sous-titre">Declaration papier</div>
        </Link>
        <Link to="/agent/retrait" className="eva-carte eva-carte--interactive" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <QrCode size={20} color="var(--couleur-emeraude)" />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Retrait</div>
          <div className="eva-sous-titre">Scanner ou saisir un code</div>
        </Link>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Dossiers proches de l'echeance</h2>
      {chargement ? (
        <ChargementPage />
      ) : dossiersProches.length === 0 ? (
        <EtatVide icone={<FolderOpen size={26} />} titre="Aucun dossier proche de l'echeance" description="Tout est a jour pour le moment." />
      ) : (
        <Tableau>
          <thead>
            <tr>
              <th>Evenement</th>
              <th>Statut</th>
              <th>Jours restants</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dossiersProches
              .slice()
              .sort((a, b) => joursRestants(a.date_limite) - joursRestants(b.date_limite))
              .map((dossier) => {
                const jours = joursRestants(dossier.date_limite);
                return (
                  <tr key={dossier.id} className={classeUrgence(jours)}>
                    <td>{dossier.event_type === "naissance" ? "Naissance" : "Deces"}</td>
                    <td>
                      <BadgeStatut statut={dossier.statut} />
                    </td>
                    <td>
                      <strong style={{ color: couleurUrgence(jours) }}>
                        {jours <= 0 ? "Echue" : `${jours} jour${jours > 1 ? "s" : ""}`}
                      </strong>{" "}
                      <span className="texte-mono" style={{ fontSize: 11.5, color: "var(--couleur-gris-service-2)" }}>
                        ({dossier.date_limite})
                      </span>
                    </td>
                    <td>
                      <LienBouton to={`/agent/dossiers/${dossier.id}`} variante="fantome" taille="petit">
                        Ouvrir
                      </LienBouton>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </Tableau>
      )}
    </MiseEnPage>
  );
}
