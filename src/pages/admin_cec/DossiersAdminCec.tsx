import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, FileSpreadsheet, FileText, FolderSearch } from "lucide-react";
import MiseEnPage from "../../components/MiseEnPage";
import BadgeStatut from "../../components/BadgeStatut";
import BadgeRetrait from "../../components/retrait/BadgeRetrait";
import {
  Badge,
  BarreOutils,
  BarreRecherche,
  Bouton,
  EnteteDePage,
  LienBouton,
  ListeResponsive,
  Pagination,
  PilulesFiltre,
  Selecteur,
  useToast,
  type ColonneListe,
  type PiluleFiltre,
  type VarianteBadge
} from "../../components/ui";
import { appelApi } from "../../lib/apiClient";
import { telechargerBlob } from "../../lib/telechargerBlob";
import { echeanceActive, joursRestants } from "../../lib/urgence";
import { LIENS_ADMIN_CEC } from "./navigation";
import { compterAvecUnite, formaterDate, libelleEvenement, messageErreur } from "./outils";
import {
  listeDepuis,
  type Dossier,
  type ListeOuPaginee,
  type Mairie,
  type ReponsePaginee,
  type StatutDossier,
  type TypeEvenement
} from "../../types/domaine";
import "../../styles/admin-cec-pilotage.css";
import "../../styles/retrait.css";

/** Filtre de retrait de l'acte (paramètre `retrait` du serveur) : "" = tous. */
type FiltreRetrait = "" | "a_retirer" | "retire";

function filtreRetraitDepuis(valeur: string | null): FiltreRetrait {
  return valeur === "a_retirer" || valeur === "retire" ? valeur : "";
}

const PILULES_RETRAIT: PiluleFiltre<FiltreRetrait>[] = [
  { valeur: "", libelle: "Tous" },
  { valeur: "a_retirer", libelle: "À retirer" },
  { valeur: "retire", libelle: "Retirés" }
];

const LIBELLES_STATUT: Array<{ valeur: StatutDossier | ""; libelle: string }> = [
  { valeur: "", libelle: "Tous" },
  { valeur: "recu", libelle: "Reçus" },
  { valeur: "notifie", libelle: "Notifiés" },
  { valeur: "en_attente_complement", libelle: "En attente de complément" },
  { valeur: "complete", libelle: "Complets" },
  { valeur: "acte_emis", libelle: "Actes émis" },
  { valeur: "sans_suite", libelle: "Sans suite" }
];

const TAILLE_PAGE = 25;

function varianteEcheance(jours: number): VarianteBadge {
  if (jours <= 3) return "danger";
  if (jours <= 10) return "attente";
  return "succes";
}

export default function DossiersAdminCec() {
  const navigate = useNavigate();
  const toast = useToast();
  const [parametresUrl] = useSearchParams();
  const evenementUrl = parametresUrl.get("event_type");
  const [dossiers, setDossiers] = useState<ReponsePaginee<Dossier> | null>(null);
  const [mairies, setMairies] = useState<Mairie[]>([]);
  const [statutFiltre, setStatutFiltre] = useState<StatutDossier | "">("");
  const [evenementFiltre, setEvenementFiltre] = useState<TypeEvenement | "">((evenementUrl as TypeEvenement | null) || "");
  const [mairieFiltre, setMairieFiltre] = useState("");
  const [recherche, setRecherche] = useState("");
  const [masquerActesEmis, setMasquerActesEmis] = useState(false);
  const retraitUrl = parametresUrl.get("retrait");
  const [retraitFiltre, setRetraitFiltre] = useState<FiltreRetrait>(filtreRetraitDepuis(retraitUrl));
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    // Un clic sur "Naissance"/"Décès" dans la barre latérale ne fait changer
    // que la query string sur cette même page, ce que le useState d'origine
    // (initialisé une seule fois) ne suit pas tout seul.
    setEvenementFiltre((evenementUrl as TypeEvenement | null) || "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evenementUrl]);

  useEffect(() => {
    // Compteur « Actes à retirer » du tableau de bord : ?retrait=a_retirer
    setRetraitFiltre(filtreRetraitDepuis(retraitUrl));
    setPage(1);
  }, [retraitUrl]);

  useEffect(() => {
    appelApi<ListeOuPaginee<Mairie>>("/mairies/")
      .then((donnees) => setMairies(listeDepuis(donnees)))
      .catch(() => setMairies([]));
  }, []);

  function construireParametres(): URLSearchParams {
    const parametres = new URLSearchParams();
    if (statutFiltre) parametres.set("statut", statutFiltre);
    if (evenementFiltre) parametres.set("event_type", evenementFiltre);
    if (mairieFiltre) parametres.set("mairie", mairieFiltre);
    if (recherche) parametres.set("search", recherche);
    if (masquerActesEmis) parametres.set("masquer_actes_emis", "true");
    if (retraitFiltre) parametres.set("retrait", retraitFiltre);
    return parametres;
  }

  useEffect(() => {
    let obsolete = false;
    const parametres = construireParametres();
    parametres.set("page", String(page));

    setChargement(true);
    setErreur(null);
    appelApi<ReponsePaginee<Dossier>>(`/dossiers/?${parametres.toString()}`)
      .then((donnees) => {
        if (!obsolete) setDossiers(donnees);
      })
      .catch((e) => {
        if (!obsolete) setErreur(messageErreur(e, "Impossible de charger les dossiers."));
      })
      .finally(() => {
        if (!obsolete) setChargement(false);
      });
    return () => {
      obsolete = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statutFiltre, evenementFiltre, mairieFiltre, recherche, masquerActesEmis, retraitFiltre, page, rechargement]);

  async function exporter(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    try {
      const parametres = construireParametres();
      parametres.set("format", format);
      const blob = await appelApi<Blob>(`/dossiers/export/?${parametres.toString()}`);
      telechargerBlob(blob, `dossiers.${format}`);
      toast.succes(`Export ${format === "xlsx" ? "Excel" : "PDF"} téléchargé.`);
    } catch (e) {
      toast.erreur(messageErreur(e, "L'export a échoué. Réessayez."));
    } finally {
      setExportEnCours(null);
    }
  }

  const resultats = dossiers?.results ?? [];
  const total = dossiers?.count ?? 0;
  const affichageMairie = mairies.length > 1;
  const filtreActif = !!(statutFiltre || evenementFiltre || mairieFiltre || recherche || masquerActesEmis || retraitFiltre);

  // Le serveur ne renvoie que le total du filtre courant : le compteur
  // n'est donc affiché que sur la pilule active.
  const pilules: PiluleFiltre<StatutDossier | "">[] = useMemo(
    () =>
      LIBELLES_STATUT.map((p) => ({
        ...p,
        compteur: p.valeur === statutFiltre && dossiers ? dossiers.count : undefined
      })),
    [statutFiltre, dossiers]
  );

  function reinitialiserFiltres() {
    setStatutFiltre("");
    setEvenementFiltre("");
    setMairieFiltre("");
    setRecherche("");
    setMasquerActesEmis(false);
    setRetraitFiltre("");
    setPage(1);
  }

  const colonnes: ColonneListe<Dossier>[] = [
    {
      id: "identifiant",
      libelle: "Dossier",
      principale: true,
      rendu: (d) => (
        <span className="eva-ac-identite__texte">
          <span className="texte-mono">{d.id.slice(0, 8)}</span>
          {d.nom && <span className="eva-ac-identite__detail">{d.nom}</span>}
        </span>
      )
    },
    { id: "evenement", libelle: "Événement", rendu: (d) => libelleEvenement(d.event_type) },
    ...(affichageMairie ? [{ id: "mairie", libelle: "Mairie", rendu: (d: Dossier) => d.mairie_nom || "-" }] : []),
    {
      id: "statut",
      libelle: "Statut",
      rendu: (d) => (
        <span className="eva-rt-statuts">
          <BadgeStatut statut={d.statut} />
          <BadgeRetrait etat={d.etat_retrait} retireLe={d.retire_le} masquerNonEmis />
        </span>
      )
    },
    { id: "date", libelle: "Date de l'événement", alignement: "droite", rendu: (d) => <span className="texte-mono">{formaterDate(d.date_evenement)}</span> },
    {
      id: "echeance",
      libelle: "Échéance",
      rendu: (d) => {
        if (!echeanceActive(d.statut)) return <span className="eva-texte-discret">-</span>;
        const jours = joursRestants(d.date_limite);
        return (
          <Badge variante={varianteEcheance(jours)} mono>
            {jours <= 0 ? "Échue" : `${jours} j`}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      libelle: "Actions",
      actions: true,
      masquerLibelle: true,
      rendu: (d) => (
        <LienBouton to={`/admin-cec/dossiers/${d.id}`} variante="secondaire" taille="petit" iconeDroite={<ArrowRight size={14} />}>
          Ouvrir
        </LienBouton>
      )
    }
  ];

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage titre="Dossiers de la zone" sousTitre="Tous les dossiers de votre périmètre territorial" />

      <BarreOutils
        carte
        recherche={
          <BarreRecherche
            valeur={recherche}
            onChanger={(v) => {
              setPage(1);
              setRecherche(v);
            }}
            delai={300}
            placeholder="Rechercher un nom, un identifiant..."
            ariaLabel="Rechercher un dossier"
          />
        }
        filtres={
          <>
            <Selecteur
              compact
              ariaLabel="Filtrer par événement"
              valeur={evenementFiltre}
              onChange={(v) => {
                setPage(1);
                setEvenementFiltre(v as TypeEvenement | "");
              }}
            >
              <option value="">Tous les événements</option>
              <option value="naissance">Naissances</option>
              <option value="deces">Décès</option>
            </Selecteur>
            {affichageMairie && (
              <Selecteur
                compact
                ariaLabel="Filtrer par mairie"
                valeur={mairieFiltre}
                onChange={(v) => {
                  setPage(1);
                  setMairieFiltre(v);
                }}
              >
                <option value="">Toutes les mairies</option>
                {mairies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </Selecteur>
            )}
            <label className="eva-ac-case">
              <input
                type="checkbox"
                checked={masquerActesEmis}
                onChange={(e) => {
                  setPage(1);
                  setMasquerActesEmis(e.target.checked);
                }}
              />
              Masquer les actes émis
            </label>
          </>
        }
        actions={
          <>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("xlsx")}
              chargement={exportEnCours === "xlsx"}
              disabled={exportEnCours !== null}
              iconeGauche={<FileSpreadsheet size={15} />}
            >
              Excel
            </Bouton>
            <Bouton
              variante="secondaire"
              taille="petit"
              onClick={() => exporter("pdf")}
              chargement={exportEnCours === "pdf"}
              disabled={exportEnCours !== null}
              iconeGauche={<FileText size={15} />}
            >
              PDF
            </Bouton>
          </>
        }
      />

      <div className="eva-ac-pilules">
        <PilulesFiltre
          ariaLabel="Filtrer par statut"
          defilement
          valeur={statutFiltre}
          onChanger={(v) => {
            setPage(1);
            setStatutFiltre(v);
          }}
          pilules={pilules}
        />
        {dossiers && !erreur && (
          <span className="eva-compteur" role="status" aria-live="polite">
            {compterAvecUnite(total, "dossier")}
          </span>
        )}
      </div>

      <div className="eva-rt-filtre-retrait eva-rt-filtre-retrait--liste">
        <span className="eva-rt-etiquette-filtre">Retrait de l'acte</span>
        <PilulesFiltre
          ariaLabel="Filtrer par retrait de l'acte"
          valeur={retraitFiltre}
          onChanger={(v) => {
            setPage(1);
            setRetraitFiltre(v);
          }}
          pilules={PILULES_RETRAIT}
        />
      </div>

      <ListeResponsive<Dossier>
        legende="Dossiers de la zone"
        lignes={resultats}
        cle={(d) => d.id}
        colonnes={colonnes}
        chargement={chargement}
        erreur={erreur}
        onReessayer={() => setRechargement((n) => n + 1)}
        onLigneClic={(d) => navigate(`/admin-cec/dossiers/${d.id}`)}
        hauteurMax="none"
        vide={{
          icone: <FolderSearch size={26} />,
          titre: "Aucun dossier ne correspond à ces critères",
          description: filtreActif ? "Modifiez votre recherche ou retirez des filtres." : "Aucun dossier n'a encore été enregistré dans votre zone.",
          action: filtreActif ? (
            <Bouton variante="secondaire" onClick={reinitialiserFiltres}>
              Réinitialiser les filtres
            </Bouton>
          ) : undefined
        }}
      />

      {dossiers && !erreur && (
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
