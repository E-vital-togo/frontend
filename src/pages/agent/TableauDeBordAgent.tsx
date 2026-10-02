import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, FilePlus, FolderOpen, PackageCheck, QrCode, RefreshCw, WifiOff } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import AlerteCompletionDesactivee from "../../components/AlerteCompletionDesactivee";
import BadgeStatut from "../../components/BadgeStatut";
import EcheanceDossier from "../../components/statistiques/EcheanceDossier";
import RaccourciAction from "../../components/statistiques/RaccourciAction";
import { Alerte, Badge, Carte, CarteStat, EnteteDePage, ListeResponsive, Squelette, type ColonneListe } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import { instantaneEnCache, mettreEnCacheDossier, mettreEnCacheInstantane } from "../../lib/db";
import { precacherFormulaires } from "../../lib/formulairesHorsLigne";
import { useCompteurs } from "../../lib/useCompteurs";
import { classeUrgence, joursRestants } from "../../lib/urgence";
import { LIENS_AGENT } from "./navigation";
import { listeDepuis, type Dossier, type ListeOuPaginee } from "../../types/domaine";

import "../../styles/statistiques.css";

const CLE_CACHE_ECHEANCES = "tableau_bord_agent::dossiers_echeance_proche";

const COLONNES: ColonneListe<Dossier>[] = [
  {
    id: "evenement",
    libelle: "Événement",
    principale: true,
    rendu: (d) => (
      <span className="eva-st-evenement">
        <Badge variante="neutre">{d.event_type === "naissance" ? "Naissance" : "Décès"}</Badge>
        {d.nom && <span className="eva-st-evenement__nom">{d.nom}</span>}
      </span>
    )
  },
  { id: "statut", libelle: "Statut", rendu: (d) => <BadgeStatut statut={d.statut} /> },
  {
    id: "echeance",
    libelle: "Échéance",
    nowrap: true,
    rendu: (d) => <EcheanceDossier dateLimite={d.date_limite} />
  },
  {
    id: "actions",
    libelle: "Actions",
    actions: true,
    masquerLibelle: true,
    rendu: (d) => (
      <LienBouton to={`/agent/dossiers/${d.id}`} variante="secondaire" taille="petit">
        Ouvrir
      </LienBouton>
    )
  }
];

export default function TableauDeBordAgent() {
  const navigate = useNavigate();
  const enLigne = useConnectivite();
  const compteurs = useCompteurs();
  const [dossiersProches, setDossiersProches] = useState<Dossier[]>([]);
  const [chargement, setChargement] = useState(true);
  const [horsLigne, setHorsLigne] = useState(false);
  const [dateInstantane, setDateInstantane] = useState<string | null>(null);

  const dossiersTries = useMemo(
    () => dossiersProches.slice().sort((a, b) => joursRestants(a.date_limite) - joursRestants(b.date_limite)),
    [dossiersProches]
  );
  const enRetard = useMemo(() => dossiersProches.filter((d) => joursRestants(d.date_limite) < 0).length, [dossiersProches]);

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
      <EnteteDePage
        titre="Tableau de bord"
        sousTitre="Vue d'ensemble de vos dossiers en cours"
        actions={
          <LienBouton to="/agent/dossiers/nouveau" iconeGauche={<FilePlus size={16} />}>
            Nouveau dossier
          </LienBouton>
        }
      />

      <AlerteCompletionDesactivee />

      {horsLigne && !chargement && (
        <Alerte variante="avertissement" titre="Vous êtes hors ligne" icone={<WifiOff size={18} aria-hidden="true" />} className="eva-st-alerte-page">
          Liste mise en cache
          {dateInstantane ? ` le ${new Date(dateInstantane).toLocaleString("fr-FR")}` : ""}. Elle sera actualisée dès le retour du réseau.
        </Alerte>
      )}

      <section className="eva-st-bloc" aria-label="Chiffres clés">
        {chargement ? (
          <Squelette variante="stats" lignes={3} libelle="Chargement des chiffres clés" />
        ) : (
          <div className="eva-grille-stats">
            <CarteStat
              icone={<Clock size={20} />}
              valeur={compteurs.echeances}
              libelle="Échéances proches"
              alerte={compteurs.echeances > 0}
              detail={compteurs.echeances > 0 ? "Dossiers à traiter en priorité" : "Aucune échéance à surveiller"}
              vers="/agent/dossiers"
            />
            <CarteStat
              icone={<CalendarClock size={20} />}
              valeur={enRetard}
              libelle="Dossiers en retard"
              variante={enRetard > 0 ? "alerte" : "defaut"}
              detail={enRetard > 0 ? "Date limite dépassée" : "Aucun retard"}
              vers="/agent/dossiers"
            />
            <CarteStat
              icone={<PackageCheck size={20} />}
              valeur={compteurs.actesARetirer}
              libelle="Actes à retirer"
              variante={compteurs.actesARetirer > 0 ? "attention" : "defaut"}
              detail={compteurs.actesARetirer > 0 ? "Émis, en attente d'être remis au déclarant" : "Aucun acte en attente de retrait"}
              vers="/agent/dossiers?retrait=a_retirer"
            />
            <CarteStat
              icone={<AlertTriangle size={20} />}
              valeur={compteurs.conflits}
              libelle="Conflits de synchronisation"
              variante={compteurs.conflits > 0 ? "attention" : "defaut"}
              detail={compteurs.conflits > 0 ? "À résoudre avant la prochaine synchronisation" : "Tout est synchronisé"}
              vers="/agent/conflits"
            />
          </div>
        )}
      </section>

      <section className="eva-st-bloc" aria-labelledby="titre-actions-rapides">
        <div className="eva-section__entete">
          <h2 className="eva-section__titre" id="titre-actions-rapides">
            Actions rapides
          </h2>
        </div>
        <div className="eva-st-raccourcis">
          <RaccourciAction vers="/agent/dossiers/nouveau" icone={<FilePlus size={20} />} titre="Nouveau dossier" description="Saisir une déclaration papier" />
          <RaccourciAction vers="/agent/retrait" icone={<QrCode size={20} />} titre="Retrait d'un acte" description="Scanner ou saisir un code" />
          <RaccourciAction vers="/agent/dossiers" icone={<FolderOpen size={20} />} titre="Tous les dossiers" description="Rechercher et filtrer" />
          <RaccourciAction vers="/agent/synchronisation" icone={<RefreshCw size={20} />} titre="Synchronisation" description="Envoyer les actions en attente" />
        </div>
      </section>

      <Carte
        sansMarge
        titre="Dossiers proches de l'échéance"
        description="Triés par urgence : les plus en retard ou les plus proches de la date limite en premier."
        actions={
          <LienBouton to="/agent/dossiers" variante="secondaire" taille="petit">
            Voir tous les dossiers
          </LienBouton>
        }
      >
        <ListeResponsive<Dossier>
          legende="Dossiers proches de l'échéance"
          sansCadre
          hauteurMax="none"
          lignes={dossiersTries}
          cle={(d) => d.id}
          chargement={chargement}
          colonnes={COLONNES}
          classeLigne={(d) => classeUrgence(joursRestants(d.date_limite))}
          onLigneClic={(d) => navigate(`/agent/dossiers/${d.id}`)}
          vide={{
            titre: "Aucun dossier proche de l'échéance",
            description: horsLigne ? "Aucune liste n'est mise en cache sur cet appareil pour l'instant." : "Tout est à jour pour le moment.",
            icone: horsLigne ? <WifiOff size={26} /> : <CheckCircle2 size={26} />
          }}
        />
      </Carte>
    </MiseEnPage>
  );
}
