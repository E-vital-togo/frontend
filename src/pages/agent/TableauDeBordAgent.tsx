import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, FilePlus, FolderOpen, QrCode } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import { CarteStat, ChargementPage, EnteteDePage, EtatVide, Tableau } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { instantaneEnCache, mettreEnCacheDossier, mettreEnCacheInstantane } from "../../lib/db";
import { precacherFormulaires } from "../../lib/formulairesHorsLigne";
import { useCompteurs } from "../../lib/useCompteurs";
import { classeUrgence, couleurUrgence, joursRestants } from "../../lib/urgence";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee } from "../../types/domaine";

const CLE_CACHE_ECHEANCES = "tableau_bord_agent::dossiers_echeance_proche";

export default function TableauDeBordAgent() {
  const enLigne = useConnectivite();
  const compteurs = useCompteurs();
  const [dossiersProches, setDossiersProches] = useState<Dossier[]>([]);
  const [chargement, setChargement] = useState(true);
  const [horsLigne, setHorsLigne] = useState(false);
  const [dateInstantane, setDateInstantane] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;

    async function charger() {
      setChargement(true);

      // enLigne verifie deja la joignabilite reelle du serveur (voir
      // lib/connectivite.ts), pas seulement navigator.onLine : des que ce
      // signal repasse a true, cet effet se redeclenche (deps ci-dessous)
      // et remplace tout affichage issu du cache par les donnees live -
      // jamais l'inverse.
      if (enLigne) {
        try {
          const donnees = await appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true");
          const liste = listeDepuis(donnees);
          if (annule) return;
          setDossiersProches(liste);
          setHorsLigne(false);
          setChargement(false);
          await mettreEnCacheInstantane(CLE_CACHE_ECHEANCES, liste);
          // Voir ListeDossiers : on garde aussi chaque dossier a l'unite,
          // c'est ce cache que DetailDossier relit hors-ligne, et leurs
          // formulaires en une requete groupee, en arriere-plan.
          await Promise.all(liste.map((dossier) => mettreEnCacheDossier(dossier)));
          precacherFormulaires(liste.map((dossier) => dossier.id)).catch(() => {});
          return;
        } catch {
          // Reseau annonce disponible mais requete en echec (backend
          // injoignable malgre la sonde, coupure en plein appel) : on
          // retombe sur le dernier instantane connu, comme hors-ligne.
        }
      }

      const instantane = await instantaneEnCache<Dossier[]>(CLE_CACHE_ECHEANCES);
      if (annule) return;
      setDossiersProches(instantane?.donnees ?? []);
      setDateInstantane(instantane?.horodatage ?? null);
      setHorsLigne(true);
      setChargement(false);
    }

    charger();
    return () => {
      annule = true;
    };
  }, [enLigne]);

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
      {horsLigne && !chargement && (
        <div className="eva-carte" style={{ background: "var(--couleur-citron-fond)", borderColor: "var(--couleur-citron-profond)", marginBottom: 16, fontSize: 13.5 }}>
          Hors-ligne : liste mise en cache
          {dateInstantane ? ` au ${new Date(dateInstantane).toLocaleString("fr-FR")}` : ""}. Sera actualisee des le retour du reseau.
        </div>
      )}
      {chargement ? (
        <ChargementPage />
      ) : dossiersProches.length === 0 ? (
        <EtatVide
          icone={<FolderOpen size={26} />}
          titre="Aucun dossier proche de l'echeance"
          description={horsLigne ? "Aucune liste mise en cache localement pour l'instant." : "Tout est a jour pour le moment."}
        />
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
