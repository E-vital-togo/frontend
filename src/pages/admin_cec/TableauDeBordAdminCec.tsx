import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileEdit,
  FolderOpen,
  LayoutDashboard,
  Radio,
  RotateCcw,
  Users
} from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import EcheanceDossier from "../../components/statistiques/EcheanceDossier";
import RaccourciAction from "../../components/statistiques/RaccourciAction";
import {
  hauteurRepartitionMairie,
  optionEvolution,
  optionRepartitionMairie,
  optionRepartitionStatut
} from "../../components/statistiques/optionsTableauDeBord";
import { Alerte, Badge, Bouton, Carte, CarteStat, Champ, EnteteDePage, EtatVide, GraphiqueECharts, ListeResponsive, PilulesFiltre, Squelette, type ColonneListe } from "../../components/ui";
import { LienBouton } from "../../components/ui/Bouton";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { classeUrgence, joursRestants as joursDepuisAujourdhui } from "../../lib/urgence";
import { LIENS_ADMIN_CEC } from "./navigation";
import type {
  Dossier,
  ListeOuPaginee,
  StatistiqueEvolutionReponse,
  StatistiqueRepartitionItem,
  StatistiquesNotifications
} from "../../types/domaine";
import { listeDepuis } from "../../types/domaine";

import "../../styles/statistiques.css";

type Periode = "" | "30j" | "annee" | "perso";

function versIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const COLONNES_ECHEANCES: ColonneListe<Dossier>[] = [
  {
    id: "evenement",
    libelle: "Événement",
    principale: true,
    rendu: (d) => <Badge variante="neutre">{d.event_type === "naissance" ? "Naissance" : "Décès"}</Badge>
  },
  { id: "mairie", libelle: "Mairie", rendu: (d) => d.mairie_nom || d.mairie },
  { id: "statut", libelle: "Statut", rendu: (d) => <BadgeStatut statut={d.statut} /> },
  { id: "echeance", libelle: "Échéance", nowrap: true, rendu: (d) => <EcheanceDossier dateLimite={d.date_limite} /> },
  {
    id: "actions",
    libelle: "Actions",
    actions: true,
    masquerLibelle: true,
    rendu: (d) => (
      <LienBouton to={`/admin-cec/dossiers/${d.id}`} variante="secondaire" taille="petit">
        Ouvrir
      </LienBouton>
    )
  }
];

export default function TableauDeBordAdminCec() {
  const navigate = useNavigate();
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [periode, setPeriode] = useState<Periode>("");
  const [repartitionStatut, setRepartitionStatut] = useState<StatistiqueRepartitionItem[] | null>(null);
  const [repartitionMairie, setRepartitionMairie] = useState<StatistiqueRepartitionItem[] | null>(null);
  const [evolution, setEvolution] = useState<StatistiqueEvolutionReponse | null>(null);
  const [echeancesProches, setEcheancesProches] = useState<Dossier[]>([]);
  const [delaiMoyenJours, setDelaiMoyenJours] = useState<number | null>(null);
  const [statsNotifications, setStatsNotifications] = useState<StatistiquesNotifications | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    const parametres = new URLSearchParams();
    if (dateDebut) parametres.set("date_debut", dateDebut);
    if (dateFin) parametres.set("date_fin", dateFin);
    const suffixe = parametres.toString() ? `&${parametres.toString()}` : "";

    let annule = false;
    setChargement(true);
    setErreur(null);
    Promise.all([
      appelApi<StatistiqueRepartitionItem[]>(`/dossiers/statistiques/repartition/?dimension=statut${suffixe}`),
      appelApi<StatistiqueRepartitionItem[]>(`/dossiers/statistiques/repartition/?dimension=mairie${suffixe}`),
      appelApi<StatistiqueEvolutionReponse>(`/dossiers/statistiques/evolution/?intervalle=mois&serie=event_type${suffixe}`),
      appelApi<ListeOuPaginee<Dossier>>("/dossiers/?echeance_proche=true"),
      appelApi<{ delai_moyen_jours: number | null }>(`/dossiers/statistiques/delai-moyen/?${parametres.toString()}`)
    ])
      .then(([statuts, mairies, evol, echeances, delai]) => {
        if (annule) return;
        setRepartitionStatut(statuts);
        setRepartitionMairie(mairies);
        setEvolution(evol);
        setEcheancesProches(listeDepuis(echeances));
        setDelaiMoyenJours(delai.delai_moyen_jours);
      })
      .catch((e) => {
        if (annule) return;
        setErreur(e instanceof ErreurApi ? e.message : "Les statistiques n'ont pas pu être chargées.");
      })
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [dateDebut, dateFin, tentative]);

  // Requete separee, volontairement isolee du Promise.all principal : le
  // sous-enregistrement (notifications ASC) est une fonctionnalite plus
  // recente, potentiellement pas encore deployee/configuree partout - une
  // erreur ici (404, permission...) ne doit jamais faire echouer le reste
  // du tableau de bord qui, lui, fonctionne deja de maniere fiable. Pas de
  // filtre date_debut/date_fin : voir apps.dhis2_integration.services.
  // statistiques_notifications (mesure sur l'ensemble du perimetre, pas une
  // periode de declaration).
  useEffect(() => {
    appelApi<StatistiquesNotifications>("/dhis2/statistiques-notifications/")
      .then(setStatsNotifications)
      .catch(() => setStatsNotifications(null));
  }, []);

  const total = useMemo(() => repartitionStatut?.reduce((s, r) => s + r.valeur, 0) ?? 0, [repartitionStatut]);
  const actesEmis = useMemo(() => repartitionStatut?.find((r) => r.cle === "acte_emis")?.valeur ?? 0, [repartitionStatut]);
  const sansSuite = useMemo(() => repartitionStatut?.find((r) => r.cle === "sans_suite")?.valeur ?? 0, [repartitionStatut]);
  const tauxExpiration = total > 0 ? Math.round((sansSuite / total) * 100) : 0;
  const tauxActes = total > 0 ? Math.round((actesEmis / total) * 100) : 0;

  const echeancesTriees = useMemo(
    () => echeancesProches.slice().sort((a, b) => joursDepuisAujourdhui(a.date_limite) - joursDepuisAujourdhui(b.date_limite)),
    [echeancesProches]
  );
  const enRetard = useMemo(() => echeancesProches.filter((d) => joursDepuisAujourdhui(d.date_limite) < 0).length, [echeancesProches]);

  const optionStatut = useMemo(() => optionRepartitionStatut(repartitionStatut ?? [], total), [repartitionStatut, total]);
  const optionMairie = useMemo(() => optionRepartitionMairie(repartitionMairie ?? []), [repartitionMairie]);
  const optionEvol = useMemo(() => (evolution ? optionEvolution(evolution) : null), [evolution]);

  function choisirPeriode(valeur: Periode) {
    const aujourdhui = new Date();
    setPeriode(valeur);
    if (valeur === "") {
      setDateDebut("");
      setDateFin("");
    } else if (valeur === "30j") {
      const debut = new Date(aujourdhui);
      debut.setDate(debut.getDate() - 30);
      setDateDebut(versIso(debut));
      setDateFin(versIso(aujourdhui));
    } else if (valeur === "annee") {
      setDateDebut(`${aujourdhui.getFullYear()}-01-01`);
      setDateFin(versIso(aujourdhui));
    }
  }

  const premierChargement = chargement && repartitionStatut === null;
  const filtreActif = dateDebut !== "" || dateFin !== "";

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Vue d'ensemble de la zone"
        sousTitre="Tous les dossiers de votre périmètre territorial"
        actions={
          <LienBouton to="/admin-cec/statistiques/constructeur" variante="secondaire" iconeGauche={<BarChart3 size={16} />}>
            Construire un graphique
          </LienBouton>
        }
      />

      <Carte variante="plate" className="eva-st-periode" role="group" aria-label="Période analysée">
        <div className="eva-st-periode__filtres">
          <span className="eva-st-periode__titre">Période</span>
          <PilulesFiltre<Periode>
            ariaLabel="Période rapide"
            valeur={periode}
            onChanger={choisirPeriode}
            pilules={[
              { valeur: "", libelle: "Tout l'historique" },
              { valeur: "30j", libelle: "30 derniers jours" },
              { valeur: "annee", libelle: "Cette année" }
            ]}
          />
        </div>
        <div className="eva-st-periode__dates">
          <Champ id="date-debut" label="Depuis le">
            <input
              id="date-debut"
              type="date"
              value={dateDebut}
              max={dateFin || undefined}
              onChange={(e) => {
                setDateDebut(e.target.value);
                setPeriode("perso");
              }}
            />
          </Champ>
          <Champ id="date-fin" label="Jusqu'au">
            <input
              id="date-fin"
              type="date"
              value={dateFin}
              min={dateDebut || undefined}
              onChange={(e) => {
                setDateFin(e.target.value);
                setPeriode("perso");
              }}
            />
          </Champ>
          {filtreActif && (
            <Bouton variante="fantome" taille="petit" iconeGauche={<RotateCcw size={14} />} onClick={() => choisirPeriode("")}>
              Réinitialiser
            </Bouton>
          )}
        </div>
        <p className="eva-st-periode__aide">Le filtre porte sur la date de déclaration. Laissez les dates vides pour voir l'historique complet.</p>
      </Carte>

      {erreur ? (
        <Carte>
          <EtatVide
            variante="erreur"
            icone={<AlertTriangle size={26} />}
            titre="Chargement impossible"
            description={erreur}
            action={
              <Bouton variante="secondaire" iconeGauche={<RotateCcw size={16} />} onClick={() => setTentative((n) => n + 1)}>
                Réessayer
              </Bouton>
            }
          />
        </Carte>
      ) : premierChargement ? (
        <>
          <section className="eva-st-bloc">
            <Squelette variante="stats" lignes={5} libelle="Chargement des chiffres clés" />
          </section>
          <div className="eva-st-graphiques">
            <Squelette variante="carte" lignes={6} libelle="Chargement des graphiques" />
            <Squelette variante="carte" lignes={6} libelle="Chargement des graphiques" />
          </div>
        </>
      ) : (
        <div className={chargement ? "eva-st-rafraichit" : undefined} aria-busy={chargement}>
          {enRetard > 0 && (
            <Alerte
              variante="erreur"
              titre={`${enRetard} dossier${enRetard > 1 ? "s" : ""} en retard dans la zone`}
              className="eva-st-alerte-page"
              actions={
                <LienBouton to="/admin-cec/dossiers" variante="secondaire" taille="petit">
                  Voir les dossiers de la zone
                </LienBouton>
              }
            >
              La date limite de déclaration est dépassée. Relancez les mairies concernées ou traitez ces dossiers en priorité.
            </Alerte>
          )}

          <section className="eva-st-bloc" aria-label="Chiffres clés">
            <div className="eva-grille-stats">
              <CarteStat icone={<FolderOpen size={20} />} valeur={total.toLocaleString("fr-FR")} libelle="Dossiers (période)" detail={filtreActif ? "Sur la période choisie" : "Historique complet"} />
              <CarteStat icone={<CheckCircle2 size={20} />} valeur={actesEmis.toLocaleString("fr-FR")} libelle="Actes émis" detail={total > 0 ? `${tauxActes} % des dossiers` : undefined} />
              <CarteStat
                icone={<AlertOctagon size={20} />}
                valeur={tauxExpiration}
                unite="%"
                libelle="Taux d'expiration"
                alerte={tauxExpiration > 15}
                detail={`${sansSuite.toLocaleString("fr-FR")} dossier${sansSuite > 1 ? "s" : ""} sans suite`}
              />
              <CarteStat
                icone={<Clock size={20} />}
                valeur={echeancesProches.length}
                libelle="Échéances proches (zone)"
                alerte={echeancesProches.length > 0}
                detail={enRetard > 0 ? `dont ${enRetard} en retard` : "Aucun retard"}
              />
              <CarteStat
                icone={<CalendarClock size={20} />}
                valeur={delaiMoyenJours !== null ? delaiMoyenJours : "-"}
                unite={delaiMoyenJours !== null ? "j" : undefined}
                libelle="Délai moyen déclaration à acte"
                variante={delaiMoyenJours === null ? "muet" : "defaut"}
              />
            </div>
          </section>

          {statsNotifications && (
            <section className="eva-st-bloc" aria-labelledby="titre-sous-enregistrement">
              <div className="eva-section__entete">
                <div>
                  <h2 className="eva-section__titre" id="titre-sous-enregistrement">
                    Sous-enregistrement
                  </h2>
                  <p className="eva-section__description">
                    Naissances et décès notifiés par les agents de santé communautaires (ASC) mais jamais menés à une déclaration. Mesure sur l'ensemble du périmètre.
                  </p>
                </div>
              </div>
              <div className="eva-grille-stats">
                <CarteStat icone={<Radio size={20} />} valeur={statsNotifications.notifications_sans_suite} libelle="Notifications sans suite" alerte={statsNotifications.notifications_sans_suite > 0} />
                <CarteStat icone={<FolderOpen size={20} />} valeur={statsNotifications.total_evenements} libelle="Événements (notifications et dossiers)" />
                <CarteStat icone={<AlertTriangle size={20} />} valeur={statsNotifications.evenements_non_actes} libelle="Événements jamais actés" alerte={statsNotifications.evenements_non_actes > 0} />
              </div>
            </section>
          )}

          <div className="eva-st-graphiques">
            <Carte titre="Répartition par statut" description="Où en sont les dossiers de la période.">
              {total === 0 ? (
                <EtatVide compact variante="neutre" icone={<FolderOpen size={22} />} titre="Aucun dossier sur cette période" description="Élargissez la période pour voir la répartition." />
              ) : (
                <GraphiqueECharts option={optionStatut} hauteur={320} legendeMasquable={false} />
              )}
            </Carte>

            <Carte titre="Répartition par mairie" description="Nombre de dossiers déclarés par mairie.">
              {!repartitionMairie || repartitionMairie.length === 0 ? (
                <EtatVide compact variante="neutre" icone={<FolderOpen size={22} />} titre="Aucun dossier sur cette période" description="Élargissez la période pour voir la répartition." />
              ) : (
                <GraphiqueECharts option={optionMairie} hauteur={Math.max(300, hauteurRepartitionMairie(repartitionMairie.length))} legendeMasquable={false} />
              )}
            </Carte>
          </div>

          <Carte titre="Évolution mensuelle" description="Dossiers déclarés chaque mois, par type d'événement." className="eva-st-bloc">
            {!evolution || evolution.donnees.length === 0 || !optionEvol ? (
              <EtatVide compact variante="neutre" icone={<BarChart3 size={22} />} titre="Pas assez de données" description="Aucune évolution à tracer pour cette période." />
            ) : (
              <GraphiqueECharts option={optionEvol} hauteur={300} />
            )}
          </Carte>

          <Carte
            sansMarge
            titre="Dossiers à échéance proche dans la zone"
            description="Triés par urgence : les plus en retard ou les plus proches de la date limite en premier."
            className="eva-st-bloc"
          >
            <ListeResponsive<Dossier>
              legende="Dossiers à échéance proche dans la zone"
              sansCadre
              hauteurMax="none"
              lignes={echeancesTriees}
              cle={(d) => d.id}
              colonnes={COLONNES_ECHEANCES}
              classeLigne={(d) => classeUrgence(joursDepuisAujourdhui(d.date_limite))}
              onLigneClic={(d) => navigate(`/admin-cec/dossiers/${d.id}`)}
              vide={{ titre: "Aucun dossier proche de l'échéance", description: "Tous les dossiers de la zone sont dans les délais.", icone: <CheckCircle2 size={26} /> }}
            />
          </Carte>

          <section className="eva-st-bloc" aria-labelledby="titre-actions-rapides-admin">
            <div className="eva-section__entete">
              <h2 className="eva-section__titre" id="titre-actions-rapides-admin">
                Actions rapides
              </h2>
            </div>
            <div className="eva-st-raccourcis">
              <RaccourciAction vers="/admin-cec/dossiers" icone={<FolderOpen size={20} />} titre="Dossiers de la zone" description="Rechercher, filtrer, ouvrir" />
              <RaccourciAction vers="/admin-cec/statistiques" icone={<LayoutDashboard size={20} />} titre="Tableaux de bord" description="Vos graphiques enregistrés" />
              <RaccourciAction vers="/admin-cec/demandes-modification" icone={<FileEdit size={20} />} titre="Demandes de modification" description="Traiter les demandes en attente" />
              <RaccourciAction vers="/admin-cec/utilisateurs" icone={<Users size={20} />} titre="Agents de la zone" description="Gérer les accès" />
            </div>
          </section>
        </div>
      )}
    </MiseEnPage>
  );
}
