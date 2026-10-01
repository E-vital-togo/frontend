import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Baby, CloudOff, CloudUpload, Download, FilePlus, Flower2, Search } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import {
  Alerte,
  Badge,
  BarreOutils,
  BarreRecherche,
  Bouton,
  EnteteDePage,
  Interrupteur,
  LienBouton,
  ListeResponsive,
  Pagination,
  PilulesFiltre,
  useMediaQuery,
  useToast,
  type ColonneListe,
  type PiluleFiltre
} from "../../components/ui";
import { appelApi, ErreurApi } from "../../lib/apiClient";
import { useConnectivite } from "../../lib/connectivite";
import {
  dossiersAvecActionsEnAttente,
  instantaneEnCache,
  mettreEnCacheDossier,
  mettreEnCacheInstantane
} from "../../lib/db";
import { precacherFormulaires } from "../../lib/formulairesHorsLigne";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { classeUrgence, echeanceActive, joursRestants } from "../../lib/urgence";
import { LIENS_AGENT } from "./navigation";
import type { Dossier, ReponsePaginee, StatutDossier, TypeEvenement } from "../../types/domaine";
import "../../styles/agent.css";

const TAILLE_PAGE = 25;

const STATUTS: Array<{ valeur: StatutDossier | ""; libelle: string }> = [
  { valeur: "", libelle: "Tous" },
  { valeur: "recu", libelle: "Reçus" },
  { valeur: "notifie", libelle: "Notifiés" },
  { valeur: "en_attente_complement", libelle: "En attente de complément" },
  { valeur: "complete", libelle: "Complets" },
  { valeur: "acte_emis", libelle: "Actes émis" },
  { valeur: "sans_suite", libelle: "Sans suite" }
];

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function dateCourte(valeur: string | null | undefined): string {
  if (!valeur) return "-";
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : formatDate.format(date);
}

/** Échéance lisible : libellé court coloré selon l'urgence, date limite en complément. */
function Echeance({ dossier }: { dossier: Dossier }) {
  if (!echeanceActive(dossier.statut)) return <span className="eva-texte-discret">-</span>;
  const jours = joursRestants(dossier.date_limite);
  const ton = jours <= 3 ? "rouge" : jours <= 10 ? "orange" : "verte";
  const libelle = jours < 0 ? `Échue depuis ${-jours} j` : jours === 0 ? "Échéance aujourd'hui" : jours === 1 ? "Demain" : `${jours} jours`;
  return (
    <span className="eva-ag-echeance">
      <span className={`eva-ag-echeance__valeur eva-ag-echeance__valeur--${ton}`}>{libelle}</span>
      <span className="eva-ag-echeance__date">{dateCourte(dossier.date_limite)}</span>
    </span>
  );
}

export default function ListeDossiers() {
  const enLigne = useConnectivite();
  const navigate = useNavigate();
  const toast = useToast();
  const mobile = useMediaQuery("(max-width: 720px)");
  const [parametresUrl] = useSearchParams();
  const evenementUrl = parametresUrl.get("event_type");
  const [dossiers, setDossiers] = useState<ReponsePaginee<Dossier> | null>(null);
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [evenementFiltre, setEvenementFiltre] = useState<TypeEvenement | "">((evenementUrl as TypeEvenement | null) || "");
  const [recherche, setRecherche] = useState("");
  const [echeanceUniquement, setEcheanceUniquement] = useState(parametresUrl.get("echeance") === "1");
  const [masquerActesEmis, setMasquerActesEmis] = useState(false);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [echecServeur, setEchecServeur] = useState(false);
  const [dateInstantane, setDateInstantane] = useState<string | null>(null);
  const [aSynchroniser, setASynchroniser] = useState<Set<string>>(new Set());
  const [relance, setRelance] = useState(0);

  useEffect(() => {
    // Le lien "Naissance"/"Décès" du menu latéral ne change QUE la query string
    // (même route /agent/dossiers) : react-router ne remonte donc pas ce
    // composant, et le useState ci-dessus (initialisé une seule fois au
    // premier montage) ne suivrait jamais un second clic sans ce useEffect.
    setEvenementFiltre((evenementUrl as TypeEvenement | null) || "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementUrl]);

  const construireParametres = useCallback((): URLSearchParams => {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (evenementFiltre) parametres.set("event_type", evenementFiltre);
    if (recherche) parametres.set("search", recherche);
    if (echeanceUniquement) parametres.set("echeance_proche", "true");
    if (masquerActesEmis) parametres.set("masquer_actes_emis", "true");
    return parametres;
  }, [statutFiltre, evenementFiltre, recherche, echeanceUniquement, masquerActesEmis]);

  useEffect(() => {
    const parametres = construireParametres();
    parametres.set("page", String(page));
    // Une entrée de cache par combinaison exacte de filtres + page : hors ligne,
    // on ne montre que ce qui a réellement été reçu du serveur pour CETTE
    // requête, jamais une liste recalculée à partir d'un autre filtre (le
    // filtre "echeance_proche" notamment dépend d'une règle métier - origine
    // DHIS2 + statut - qui ne peut pas être redéduite côté client sans
    // risquer de diverger de _proche_echeance côté backend).
    const cleCache = `dossiers_liste::${parametres.toString()}`;
    let annule = false;

    async function charger() {
      setChargement(true);
      setEchecServeur(false);
      dossiersAvecActionsEnAttente()
        .then((ids) => {
          if (!annule) setASynchroniser(ids);
        })
        .catch(() => undefined);

      if (enLigne) {
        try {
          const donnees = await appelApi<ReponsePaginee<Dossier>>(`/dossiers/?${parametres.toString()}`);
          if (annule) return;
          setDossiers(donnees);
          setHorsLigne(false);
          setChargement(false);
          await mettreEnCacheInstantane(cleCache, donnees);
          // Chaque dossier de la liste est aussi gardé individuellement :
          // c'est ce cache-là que lit DetailDossier, donc ouvrir une fiche
          // hors ligne ne demande plus de l'avoir déjà ouverte avant.
          await Promise.all(donnees.results.map((dossier) => mettreEnCacheDossier(dossier)));
          // Formulaires de la page en une seule requête, en arrière-plan :
          // l'affichage de la liste ne doit pas attendre un préchargement
          // qui ne servira que si le réseau tombe ensuite.
          precacherFormulaires(donnees.results.map((dossier) => dossier.id)).catch(() => {});
          return;
        } catch {
          if (annule) return;
          setEchecServeur(true);
          // bascule sur l'instantané ci-dessous
        }
      }

      const instantane = await instantaneEnCache<ReponsePaginee<Dossier>>(cleCache);
      if (annule) return;
      setDossiers(instantane?.donnees ?? null);
      setDateInstantane(instantane?.horodatage ?? null);
      setHorsLigne(true);
      setChargement(false);
    }

    charger();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutFiltre, evenementFiltre, recherche, echeanceUniquement, masquerActesEmis, page, enLigne, relance]);

  async function exporter(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    try {
      const parametres = construireParametres();
      parametres.set("format", format);
      const blob = await appelApi<Blob>(`/dossiers/export/?${parametres.toString()}`);
      telechargerBlob(blob, `dossiers.${format}`);
      toast.succes(`L'export ${format === "xlsx" ? "Excel" : "PDF"} est prêt.`);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "L'export a échoué. Réessayez dans un instant.", { titre: "Export impossible" });
    } finally {
      setExportEnCours(null);
    }
  }

  const resultats = dossiers?.results ?? [];
  const total = dossiers?.count ?? 0;
  const nombreASynchroniser = resultats.filter((d) => aSynchroniser.has(d.id)).length;

  const pilulesStatut: PiluleFiltre<StatutDossier | "">[] = STATUTS.map((s) => ({
    ...s,
    compteur: s.valeur === statutFiltre && dossiers && !horsLigne ? total : undefined
  }));

  const pilulesEvenement: PiluleFiltre<TypeEvenement | "">[] = [
    { valeur: "", libelle: "Tous" },
    { valeur: "naissance", libelle: "Naissances", icone: <Baby size={15} aria-hidden="true" /> },
    { valeur: "deces", libelle: "Décès", icone: <Flower2 size={15} aria-hidden="true" /> }
  ];

  function changer<V>(definir: (valeur: V) => void) {
    return (valeur: V) => {
      setPage(1);
      definir(valeur);
    };
  }

  const colonnes: ColonneListe<Dossier>[] = [
    {
      id: "id",
      libelle: "Identifiant",
      principale: true,
      nowrap: true,
      rendu: (d) => (
        <Link to={`/agent/dossiers/${d.id}`} className="eva-ag-lien-dossier texte-mono" aria-label={`Ouvrir le dossier ${d.id.slice(0, 8)}`}>
          {d.id.slice(0, 8)}
        </Link>
      )
    },
    { id: "nom", libelle: "Nom", rendu: (d) => d.nom || <span className="eva-texte-discret">Non renseigné</span> },
    {
      id: "evenement",
      libelle: "Événement",
      rendu: (d) => (
        <span className="eva-ag-evenement">
          {d.event_type === "naissance" ? <Baby size={15} aria-hidden="true" /> : <Flower2 size={15} aria-hidden="true" />}
          {d.event_type === "naissance" ? "Naissance" : "Décès"}
        </span>
      )
    },
    { id: "origine", libelle: "Origine", masquerMobile: true, rendu: (d) => (d.origine === "dhis2" ? "DHIS2" : "Saisie manuelle") },
    {
      id: "statut",
      libelle: "Statut",
      rendu: (d) => (
        <span className="eva-ag-statuts">
          <BadgeStatut statut={d.statut} />
          {d.a_une_nouvelle_version && <Badge variante="info">Nouvelle version</Badge>}
          {aSynchroniser.has(d.id) && (
            <span title="Modifications saisies sur cet appareil, pas encore envoyées au serveur">
              <Badge variante="attente" icone={<CloudUpload size={12} aria-hidden="true" />}>
                À synchroniser
              </Badge>
            </span>
          )}
        </span>
      )
    },
    {
      id: "date",
      libelle: "Date de l'événement",
      libelleMobile: "Date",
      numerique: true,
      rendu: (d) => dateCourte(d.date_evenement)
    },
    { id: "echeance", libelle: "Échéance", rendu: (d) => <Echeance dossier={d} /> }
  ];

  const aucuneCache = horsLigne && dossiers === null;
  const erreurListe = !chargement && echecServeur && dossiers === null ? "Le serveur n'a pas répondu et aucune copie de cette liste n'est disponible sur cet appareil." : null;

  return (
    <MiseEnPage liens={LIENS_AGENT}>
      <EnteteDePage
        titre="Dossiers"
        sousTitre="Naissances et décès de votre centre d'état civil"
        actions={
          <LienBouton to="/agent/dossiers/nouveau" iconeGauche={<FilePlus size={16} />}>
            Nouveau dossier
          </LienBouton>
        }
      />

      <section className="eva-ag-panneau" aria-label="Recherche et filtres">
        <BarreOutils
          recherche={
            <BarreRecherche
              valeur={recherche}
              onChanger={changer(setRecherche)}
              delai={300}
              placeholder="Nom, identifiant, code de retrait..."
              ariaLabel="Rechercher un dossier par nom, identifiant ou code de retrait"
              chargement={chargement && dossiers !== null}
            />
          }
          compteur={dossiers && !aucuneCache ? `${total} dossier${total > 1 ? "s" : ""}` : undefined}
          actions={
            <div className="eva-groupe-boutons" role="group" aria-label="Exporter la liste">
              <Bouton
                variante="secondaire"
                taille="petit"
                onClick={() => exporter("xlsx")}
                chargement={exportEnCours === "xlsx"}
                disabled={exportEnCours !== null || !enLigne}
                iconeGauche={exportEnCours !== "xlsx" && <Download size={15} />}
                title={enLigne ? "Exporter les dossiers filtrés au format Excel" : "Export indisponible hors ligne"}
              >
                Excel
              </Bouton>
              <Bouton
                variante="secondaire"
                taille="petit"
                onClick={() => exporter("pdf")}
                chargement={exportEnCours === "pdf"}
                disabled={exportEnCours !== null || !enLigne}
                iconeGauche={exportEnCours !== "pdf" && <Download size={15} />}
                title={enLigne ? "Exporter les dossiers filtrés au format PDF" : "Export indisponible hors ligne"}
              >
                PDF
              </Bouton>
            </div>
          }
        />
        <div className="eva-ag-filtres">
          <div className="eva-ag-filtre">
            <span className="eva-ag-filtre__libelle">Événement</span>
            <PilulesFiltre
              ariaLabel="Filtrer par type d'événement"
              valeur={evenementFiltre}
              onChanger={changer(setEvenementFiltre)}
              pilules={pilulesEvenement}
            />
          </div>
          <div className="eva-ag-filtre">
            <span className="eva-ag-filtre__libelle">Statut</span>
            <PilulesFiltre
              ariaLabel="Filtrer par statut"
              valeur={statutFiltre}
              onChanger={changer(setStatutFiltre)}
              pilules={pilulesStatut}
              defilement={mobile}
            />
          </div>
          <div className="eva-ag-filtre eva-ag-filtre--options">
            <Interrupteur checked={echeanceUniquement} onChange={changer(setEcheanceUniquement)} label="Échéance proche uniquement" />
            <Interrupteur checked={masquerActesEmis} onChange={changer(setMasquerActesEmis)} label="Masquer les actes émis" />
          </div>
        </div>
      </section>

      <div className="eva-ag-messages" aria-live="polite">
        {horsLigne && !chargement && dossiers !== null && (
          <Alerte
            variante="avertissement"
            icone={<CloudOff size={18} aria-hidden="true" />}
            titre={echecServeur ? "Connexion instable : liste enregistrée" : "Mode hors ligne : liste enregistrée"}
            actions={
              enLigne ? (
                <Bouton variante="secondaire" taille="petit" onClick={() => setRelance((n) => n + 1)}>
                  Réessayer
                </Bouton>
              ) : undefined
            }
          >
            Cette liste a été enregistrée{dateInstantane ? ` le ${new Date(dateInstantane).toLocaleString("fr-FR")}` : ""} pour ces filtres. Elle sera
            actualisée dès le retour du réseau.
          </Alerte>
        )}
        {nombreASynchroniser > 0 && (
          <Alerte
            variante="info"
            icone={<CloudUpload size={18} aria-hidden="true" />}
            titre={`${nombreASynchroniser} dossier${nombreASynchroniser > 1 ? "s" : ""} de cette page en attente de synchronisation`}
            actions={
              <LienBouton to="/agent/synchronisation" variante="secondaire" taille="petit">
                Voir la synchronisation
              </LienBouton>
            }
          >
            Les modifications saisies sur cet appareil partiront automatiquement dès que la connexion le permettra.
          </Alerte>
        )}
      </div>

      <ListeResponsive<Dossier>
        legende="Dossiers"
        lignes={resultats}
        cle={(d) => d.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreurListe}
        onReessayer={() => setRelance((n) => n + 1)}
        onLigneClic={(d) => navigate(`/agent/dossiers/${d.id}`)}
        classeLigne={(d) => {
          if (!echeanceActive(d.statut)) return undefined;
          const jours = joursRestants(d.date_limite);
          return jours <= 10 ? classeUrgence(jours) : undefined;
        }}
        vide={
          aucuneCache
            ? {
                titre: "Aucune liste enregistrée pour ces filtres",
                description: "Consultez cette liste en ligne au moins une fois pour qu'elle soit disponible hors ligne.",
                icone: <CloudOff size={26} />
              }
            : {
                titre: "Aucun dossier ne correspond à ces critères",
                description: "Modifiez la recherche ou retirez un filtre pour élargir les résultats.",
                icone: <Search size={26} />
              }
        }
      />

      {dossiers && (
        <Pagination
          page={page}
          taillepage={TAILLE_PAGE}
          total={dossiers.count}
          aSuivant={!!dossiers.next}
          aPrecedent={!!dossiers.previous}
          onChanger={setPage}
        />
      )}
    </MiseEnPage>
  );
}
