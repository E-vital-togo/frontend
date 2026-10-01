import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, BarChart3, Check, FileSpreadsheet, FileText, Info, RefreshCw, Save, Table2 } from "lucide-react";
import MiseEnPage from "../../../components/MiseEnPage";
import {
  Alerte,
  Bouton,
  Carte,
  Champ,
  EnteteDePage,
  EtatVide,
  GraphiqueECharts,
  Interrupteur,
  ListeResponsive,
  Modale,
  Onglets,
  Selecteur,
  Squelette,
  type ColonneListe,
  type PoigneeGraphique
} from "../../../components/ui";
import GraphiqueCarte from "../../../components/GraphiqueCarte";
import PanneauStyleCarte from "../../../components/PanneauStyleCarte";
import SectionRepliable from "../../../components/statistiques/SectionRepliable";
import SelecteurPilules from "../../../components/statistiques/SelecteurPilules";
import { TYPES_GRAPHIQUE, typeGraphique as descriptionType } from "../../../components/statistiques/typesGraphique";
import type { ParametresCarte } from "../../../lib/carte";
import { useMonTerritoire } from "../../../lib/useMonTerritoire";
import { telechargerBlob } from "../../../lib/telechargerBlob";
import { useToast } from "../../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../../lib/apiClient";
import { construireOptionECharts } from "../../../lib/graphiques";
import { LIENS_ADMIN_CEC } from "../navigation";
import type {
  DimensionStat,
  ListeOuPaginee,
  MesureStat,
  PivotLigne,
  PivotResultat,
  TableauDeBord,
  TriPivot,
  TypeGraphiqueStat
} from "../../../types/domaine";
import { listeDepuis } from "../../../types/domaine";

import "../../../styles/statistiques.css";

// Le moteur backend (apps.statistiques.moteur) accepte n'importe quel
// nombre de dimensions, mais au-dela de 2 (axe X + serie/regroupement),
// il n'existe plus de representation graphique 2D univoque - voir
// construireSeries() dans src/lib/graphiques.ts. On plafonne donc ici,
// cote UI, plutot que de laisser l'utilisateur composer un croisement que
// rien ne saurait dessiner correctement.
const MAX_DIMENSIONS = 2;

const LIBELLES_TRI: Record<TriPivot, string> = {
  valeur_desc: "Valeur décroissante",
  valeur_asc: "Valeur croissante",
  libelle_asc: "Libellé (A à Z)"
};

const LIBELLES_EVENEMENT: Record<string, string> = { naissance: "Naissances", deces: "Décès" };

/** Role de chaque dimension choisie selon le type de graphique (affiche dans la pastille de choix). */
function rolesDimensions(type: TypeGraphiqueStat): string[] {
  switch (type) {
    case "camembert":
    case "anneau":
      return ["Secteurs"];
    case "nuage_points":
      return ["Points"];
    case "carte_chaleur":
      return ["Axe X", "Axe Y"];
    case "carte":
      return ["Territoire", "Non utilisée"];
    case "combo":
      return ["Axe X", "Non utilisée"];
    default:
      return ["Axe X", "Série"];
  }
}

function rolesMesures(type: TypeGraphiqueStat): string[] {
  if (type === "combo") return ["Barres", "Courbe", "Courbe", "Courbe", "Courbe", "Courbe"];
  if (type === "nuage_points") return ["Axe X", "Axe Y"];
  return [];
}

function formaterDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR");
}

function IllustrationApercu() {
  return (
    <svg className="eva-st-illustration" viewBox="0 0 160 110" role="img" aria-label="Schéma d'un graphique en barres en attente de données">
      <line className="eva-st-illustration__axe" x1="14" y1="96" x2="150" y2="96" />
      <line className="eva-st-illustration__axe" x1="14" y1="14" x2="14" y2="96" />
      <line className="eva-st-illustration__grille" x1="14" y1="64" x2="150" y2="64" />
      <line className="eva-st-illustration__grille" x1="14" y1="32" x2="150" y2="32" />
      <rect className="eva-st-illustration__barre" x="28" y="58" width="20" height="38" rx="3" />
      <rect className="eva-st-illustration__barre eva-st-illustration__barre--forte" x="58" y="30" width="20" height="66" rx="3" />
      <rect className="eva-st-illustration__barre" x="88" y="46" width="20" height="50" rx="3" />
      <rect className="eva-st-illustration__barre eva-st-illustration__barre--forte" x="118" y="20" width="20" height="76" rx="3" />
      <path className="eva-st-illustration__courbe" d="M38 60 C58 44, 72 34, 88 40 S122 20, 130 12" />
    </svg>
  );
}

export default function ConstructeurGraphique() {
  const toast = useToast();
  const [dimensionsDisponibles, setDimensionsDisponibles] = useState<DimensionStat[]>([]);
  const [mesuresDisponibles, setMesuresDisponibles] = useState<MesureStat[]>([]);
  const [chargementReferentiels, setChargementReferentiels] = useState(true);
  const [erreurReferentiels, setErreurReferentiels] = useState(false);

  const [dimensionsChoisies, setDimensionsChoisies] = useState<string[]>([]);
  const [mesuresChoisies, setMesuresChoisies] = useState<string[]>([]);
  const [typeGraphique, setTypeGraphique] = useState<TypeGraphiqueStat>("barres");
  const [eventType, setEventType] = useState("");
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");
  const [tri, setTri] = useState<TriPivot>("valeur_desc");
  const [limite, setLimite] = useState("");
  const [regrouperAutres, setRegrouperAutres] = useState(true);
  // Options de traitement (voir apps.statistiques.moteur) : inclus / non masque par defaut.
  const [exclureNonRenseigne, setExclureNonRenseigne] = useState(false);
  const [seuilActif, setSeuilActif] = useState(false);
  const [seuil, setSeuil] = useState("5");
  const seuilActuel = (): number | null => {
    const n = Number(seuil);
    return seuilActif && n >= 2 ? n : null;
  };

  const territoire = useMonTerritoire();
  const [parametresCarte, setParametresCarte] = useState<Partial<ParametresCarte>>({});
  const poigneeGraphique = useRef<PoigneeGraphique>(null);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);

  const [resultat, setResultat] = useState<PivotResultat | null>(null);
  const [vueTable, setVueTable] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [modaleEnregistrement, setModaleEnregistrement] = useState(false);
  const [tableauxDeBord, setTableauxDeBord] = useState<TableauDeBord[]>([]);
  const [chargementTableaux, setChargementTableaux] = useState(false);
  const [nomWidget, setNomWidget] = useState("");
  const [cibleTableauDeBord, setCibleTableauDeBord] = useState("__nouveau__");
  const [nomNouveauTableau, setNomNouveauTableau] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreursFormulaire, setErreursFormulaire] = useState<{ nom?: string; tableau?: string }>({});

  function chargerReferentiels() {
    setChargementReferentiels(true);
    setErreurReferentiels(false);
    Promise.all([appelApi<DimensionStat[]>("/statistiques/dimensions"), appelApi<MesureStat[]>("/statistiques/mesures")])
      .then(([dimensions, mesures]) => {
        setDimensionsDisponibles(dimensions);
        setMesuresDisponibles(mesures);
      })
      .catch(() => setErreurReferentiels(true))
      .finally(() => setChargementReferentiels(false));
  }

  useEffect(() => {
    chargerReferentiels();
  }, []);

  const libellesMesures = useMemo(
    () => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.label])),
    [mesuresDisponibles]
  );

  const unitesMesures = useMemo(
    () => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.unite])),
    [mesuresDisponibles]
  );

  const libellesDimensions = useMemo(
    () => Object.fromEntries(dimensionsDisponibles.map((d) => [d.code, d.label])),
    [dimensionsDisponibles]
  );

  function filtresActuels(): Record<string, string> {
    const filtres: Record<string, string> = {};
    if (eventType) filtres.event_type = eventType;
    if (dateMin) filtres.date_declaration_min = dateMin;
    if (dateMax) filtres.date_declaration_max = dateMax;
    return filtres;
  }

  useEffect(() => {
    if (dimensionsChoisies.length === 0 || mesuresChoisies.length === 0) {
      setResultat(null);
      setErreur(null);
      return;
    }
    let annule = false;
    setChargement(true);
    setErreur(null);
    appelApi<PivotResultat>("/statistiques/pivot", {
      methode: "POST",
      corps: {
        dimensions: dimensionsChoisies,
        mesures: mesuresChoisies,
        filtres: filtresActuels(),
        tri,
        limite: limite ? Number(limite) : null,
        regrouper_autres: regrouperAutres,
        exclure_non_renseigne: exclureNonRenseigne,
        seuil_petites_cellules: seuilActuel()
      }
    })
      .then((donnees) => !annule && setResultat(donnees))
      .catch((e) => {
        if (annule) return;
        setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du calcul.");
        setResultat(null);
      })
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensionsChoisies, mesuresChoisies, eventType, dateMin, dateMax, tri, limite, regrouperAutres, exclureNonRenseigne, seuilActif, seuil]);

  async function exporter(format: "xlsx" | "pdf") {
    if (!resultat) return;
    setExportEnCours(format);
    try {
      const nom = nomWidget.trim() || "Graphique";
      // L'image n'existe que si le graphique est affiche (pas en vue tableau) ;
      // les donnees, elles, sont toujours recalculees cote serveur.
      const image = vueTable ? null : poigneeGraphique.current?.obtenirImage();
      const blob = await appelApi<Blob>("/statistiques/pivot/export", {
        methode: "POST",
        corps: {
          format,
          nom,
          type_graphique: typeGraphique,
          dimensions: dimensionsChoisies,
          mesures: mesuresChoisies,
          filtres: filtresActuels(),
          tri,
          limite: limite ? Number(limite) : null,
          regrouper_autres: regrouperAutres,
          exclure_non_renseigne: exclureNonRenseigne,
          seuil_petites_cellules: seuilActuel(),
          image_data_url: image ?? ""
        }
      });
      telechargerBlob(blob, `${nom}.${format}`);
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'export.");
    } finally {
      setExportEnCours(null);
    }
  }

  function basculerDimension(code: string) {
    setDimensionsChoisies((actuelles) =>
      actuelles.includes(code)
        ? actuelles.filter((c) => c !== code)
        : actuelles.length >= MAX_DIMENSIONS
          ? actuelles
          : [...actuelles, code]
    );
  }

  function basculerMesure(code: string) {
    setMesuresChoisies((actuelles) => (actuelles.includes(code) ? actuelles.filter((c) => c !== code) : [...actuelles, code]));
  }

  async function ouvrirModaleEnregistrement() {
    setErreursFormulaire({});
    setModaleEnregistrement(true);
    setChargementTableaux(true);
    try {
      const donnees = await appelApi<ListeOuPaginee<TableauDeBord>>("/statistiques/tableaux-de-bord/");
      setTableauxDeBord(listeDepuis(donnees));
    } catch {
      setTableauxDeBord([]);
    } finally {
      setChargementTableaux(false);
    }
  }

  async function enregistrer(evenement?: FormEvent) {
    evenement?.preventDefault();
    const erreurs: { nom?: string; tableau?: string } = {};
    if (!nomWidget.trim()) erreurs.nom = "Le nom du graphique est requis.";
    if (cibleTableauDeBord === "__nouveau__" && !nomNouveauTableau.trim()) erreurs.tableau = "Le nom du tableau de bord est requis.";
    setErreursFormulaire(erreurs);
    if (erreurs.nom || erreurs.tableau) return;

    setEnregistrementEnCours(true);
    try {
      let tableauDeBordId = cibleTableauDeBord;
      if (cibleTableauDeBord === "__nouveau__") {
        const nouveau = await appelApi<TableauDeBord>("/statistiques/tableaux-de-bord/", {
          methode: "POST",
          corps: { nom: nomNouveauTableau, partage: "prive" }
        });
        tableauDeBordId = nouveau.id;
      }
      await appelApi("/statistiques/widgets/", {
        methode: "POST",
        corps: {
          tableau_de_bord: tableauDeBordId,
          nom: nomWidget,
          type_graphique: typeGraphique,
          dimensions: dimensionsChoisies,
          mesures: mesuresChoisies,
          filtres: filtresActuels(),
          tri,
          limite: limite ? Number(limite) : null,
          regrouper_autres: regrouperAutres,
          exclure_non_renseigne: exclureNonRenseigne,
          seuil_petites_cellules: seuilActuel(),
          parametres_carte: typeGraphique === "carte" ? parametresCarte : {}
        }
      });
      toast.succes("Graphique enregistré sur le tableau de bord.");
      setModaleEnregistrement(false);
      setNomWidget("");
      setNomNouveauTableau("");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  // --- Libelles de synthese (resumes des etapes, sous-titre de l'apercu, recapitulatif)
  const descriptionTypeCourant = descriptionType(typeGraphique);
  const libelleDimensions = dimensionsChoisies.map((c) => libellesDimensions[c] ?? c);
  const libelleMesuresChoisies = mesuresChoisies.map((c) => libellesMesures[c] ?? c);
  const configurationComplete = dimensionsChoisies.length > 0 && mesuresChoisies.length > 0;
  const resultatPret = !!resultat && resultat.lignes.length > 0;

  const resumeFiltres = [
    eventType ? LIBELLES_EVENEMENT[eventType] ?? eventType : null,
    dateMin ? `depuis le ${formaterDate(dateMin)}` : null,
    dateMax ? `jusqu'au ${formaterDate(dateMax)}` : null
  ].filter(Boolean);
  const resumeOptions = [LIBELLES_TRI[tri], limite ? `Top ${limite}` : null, seuilActuel() ? `Cellules < ${seuilActuel()} masquées` : null].filter(Boolean);

  const sousTitreApercu = configurationComplete
    ? `${libelleMesuresChoisies.join(" et ")} par ${libelleDimensions.join(" et ")}`
    : "Choisissez au moins une dimension et une mesure.";

  const colonnesTable = useMemo<ColonneListe<PivotLigne>[]>(() => {
    if (!resultat) return [];
    return [
      ...resultat.dimensions.map((d, index) => ({
        id: d,
        libelle: libellesDimensions[d] ?? d,
        principale: index === 0,
        rendu: (ligne: PivotLigne) => ligne[d]
      })),
      ...resultat.mesures.map((m) => ({
        id: m,
        libelle: libellesMesures[m] ?? m,
        numerique: true,
        rendu: (ligne: PivotLigne) =>
          ligne._masque ? <span className="eva-st-masque">{`< ${resultat.traitements?.seuil_petites_cellules ?? ""}`}</span> : (ligne[m] ?? "-")
      }))
    ];
  }, [resultat, libellesDimensions, libellesMesures]);

  function rendreApercu() {
    if (!configurationComplete) {
      return (
        <div className="eva-st-vide">
          <IllustrationApercu />
          <h3 className="eva-st-vide__titre">Composez votre graphique</h3>
          <p className="eva-st-vide__texte">L'aperçu apparaît dès que vous avez choisi ce qu'il faut croiser.</p>
          <ul className="eva-st-vide__etapes" aria-label="Étapes restantes">
            <li className={dimensionsChoisies.length > 0 ? "est-faite" : undefined}>
              <span className="eva-st-vide__coche" aria-hidden="true">
                {dimensionsChoisies.length > 0 && <Check size={12} strokeWidth={3} />}
              </span>
              Choisir au moins une dimension (étape 2)
            </li>
            <li className={mesuresChoisies.length > 0 ? "est-faite" : undefined}>
              <span className="eva-st-vide__coche" aria-hidden="true">
                {mesuresChoisies.length > 0 && <Check size={12} strokeWidth={3} />}
              </span>
              Choisir au moins une mesure (étape 3)
            </li>
          </ul>
        </div>
      );
    }
    if (erreur) {
      return (
        <Alerte
          variante="erreur"
          titre="Le calcul a échoué"
          actions={
            <Bouton variante="secondaire" taille="petit" onClick={() => setDimensionsChoisies((d) => [...d])}>
              Réessayer
            </Bouton>
          }
        >
          {erreur}
        </Alerte>
      );
    }
    if (chargement && !resultat) return <Squelette variante="bloc" hauteur={360} libelle="Calcul de l'aperçu en cours" />;
    if (!resultat) return null;
    if (resultat.lignes.length === 0) {
      return (
        <EtatVide
          variante="neutre"
          icone={<BarChart3 size={26} />}
          titre="Aucune donnée pour ce croisement"
          description="Modifiez les filtres ou élargissez la période pour obtenir des résultats."
        />
      );
    }
    if (vueTable) {
      return (
        <ListeResponsive<PivotLigne>
          legende="Résultat du croisement"
          colonnes={colonnesTable}
          lignes={resultat.lignes}
          cle={(_, index) => String(index)}
          hauteurMax="420px"
          dense
          sansSurvol
        />
      );
    }
    return typeGraphique === "carte" ? (
      <GraphiqueCarte
        ref={poigneeGraphique}
        resultat={resultat}
        parametres={parametresCarte}
        libellesMesures={libellesMesures}
        unites={unitesMesures}
        hauteur={460}
      />
    ) : (
      <GraphiqueECharts ref={poigneeGraphique} option={construireOptionECharts(resultat, typeGraphique, libellesMesures)} hauteur={360} />
    );
  }

  const exportPossible = resultatPret && !chargement;

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Constructeur de graphique"
        sousTitre="Croisez librement dimensions et mesures, puis enregistrez sur un tableau de bord."
      />

      {erreurReferentiels && (
        <Alerte
          variante="erreur"
          titre="Les dimensions et mesures n'ont pas pu être chargées"
          className="eva-st-alerte-page"
          actions={
            <Bouton variante="secondaire" taille="petit" iconeGauche={<RefreshCw size={14} />} onClick={chargerReferentiels}>
              Réessayer
            </Bouton>
          }
        >
          Vérifiez votre connexion, puis réessayez.
        </Alerte>
      )}

      <div className="eva-st-constructeur">
        <Carte titre="Configuration" description="L'aperçu se met à jour à chaque modification." className="eva-st-configuration">
          <div className="eva-st-etapes">
            <SectionRepliable numero={1} titre="Type de graphique" resume={descriptionTypeCourant.label} complete ouverteParDefaut>
              <div className="eva-st-types" role="radiogroup" aria-label="Type de graphique">
                {TYPES_GRAPHIQUE.map((t) => {
                  const Icone = t.icone;
                  const choisi = t.code === typeGraphique;
                  return (
                    <label key={t.code} className={`eva-st-type${choisi ? " est-choisi" : ""}`}>
                      <input
                        type="radio"
                        name="type-graphique"
                        className="eva-sr-only"
                        value={t.code}
                        checked={choisi}
                        onChange={() => setTypeGraphique(t.code)}
                      />
                      <Icone size={22} aria-hidden="true" />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
              {descriptionTypeCourant.exigence && (
                <p className="eva-st-astuce">
                  <Info size={15} aria-hidden="true" />
                  {descriptionTypeCourant.exigence}
                </p>
              )}
            </SectionRepliable>

            <SectionRepliable
              numero={2}
              titre="Dimensions"
              resume={libelleDimensions.length > 0 ? libelleDimensions.join(", ") : "À choisir (2 au maximum)"}
              complete={dimensionsChoisies.length > 0}
              ouverteParDefaut
            >
              <p className="eva-st-consigne">Ce que vous voulez comparer : axe X, puis série ou regroupement.</p>
              <SelecteurPilules
                options={dimensionsDisponibles.map((d) => ({ code: d.code, label: d.label }))}
                selection={dimensionsChoisies}
                onBasculer={basculerDimension}
                max={MAX_DIMENSIONS}
                roles={rolesDimensions(typeGraphique)}
                ariaLabel="Dimensions disponibles"
                placeholderRecherche="Rechercher une dimension"
                chargement={chargementReferentiels}
                unite="dimensions"
              />
            </SectionRepliable>

            <SectionRepliable
              numero={3}
              titre="Mesures"
              resume={libelleMesuresChoisies.length > 0 ? libelleMesuresChoisies.join(", ") : "À choisir"}
              complete={mesuresChoisies.length > 0}
              ouverteParDefaut
            >
              <p className="eva-st-consigne">Ce que vous voulez mesurer (axe Y). Plusieurs mesures sont possibles.</p>
              <SelecteurPilules
                options={mesuresDisponibles.map((m) => ({ code: m.code, label: m.label }))}
                selection={mesuresChoisies}
                onBasculer={basculerMesure}
                roles={rolesMesures(typeGraphique)}
                ariaLabel="Mesures disponibles"
                placeholderRecherche="Rechercher une mesure"
                chargement={chargementReferentiels}
                unite="mesures"
              />
            </SectionRepliable>

            <SectionRepliable numero={4} titre="Filtres" resume={resumeFiltres.length > 0 ? resumeFiltres.join(", ") : "Aucun filtre"}>
              <div className="eva-st-champs">
                <Champ id="filtre-event" label="Type d'événement" className="eva-st-champs__large">
                  <Selecteur id="filtre-event" valeur={eventType} onChange={setEventType}>
                    <option value="">Tous</option>
                    <option value="naissance">Naissance</option>
                    <option value="deces">Décès</option>
                  </Selecteur>
                </Champ>
                <Champ id="date-min" label="Déclarés depuis le">
                  <input id="date-min" type="date" value={dateMin} max={dateMax || undefined} onChange={(e) => setDateMin(e.target.value)} />
                </Champ>
                <Champ id="date-max" label="Jusqu'au">
                  <input id="date-max" type="date" value={dateMax} min={dateMin || undefined} onChange={(e) => setDateMax(e.target.value)} />
                </Champ>
              </div>
            </SectionRepliable>

            <SectionRepliable numero={5} titre="Options" resume={resumeOptions.join(" · ")}>
              <div className="eva-st-champs">
                <Champ id="tri" label="Tri">
                  <Selecteur id="tri" valeur={tri} onChange={(v) => setTri(v as TriPivot)}>
                    <option value="valeur_desc">Valeur décroissante</option>
                    <option value="valeur_asc">Valeur croissante</option>
                    <option value="libelle_asc">Libellé (A à Z)</option>
                  </Selecteur>
                </Champ>
                <Champ id="limite" label="Limite (top N)">
                  <input id="limite" type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Aucune" />
                </Champ>
              </div>
              <div className="eva-st-interrupteurs">
                <Interrupteur checked={regrouperAutres} onChange={setRegrouperAutres} label="Regrouper le surplus dans « Autres »" aide="Les valeurs au-delà de la limite sont additionnées en une seule ligne." />
                <Interrupteur
                  checked={exclureNonRenseigne}
                  onChange={setExclureNonRenseigne}
                  label="Exclure « Non renseigné »"
                  aide="Écarte les dossiers sans valeur pour une des dimensions ; les taux se calculent sur le renseigné."
                />
                <Interrupteur
                  checked={seuilActif}
                  onChange={setSeuilActif}
                  label="Masquer les petites cellules"
                  aide="Protection contre la ré-identification : toute cellule de moins de N dossiers est masquée (« < N ») dans le graphique, le tableau et les exports."
                />
                {seuilActif && (
                  <Champ id="seuil" label="Masquer les cellules de moins de (dossiers)" className="eva-st-seuil">
                    <input id="seuil" type="number" min={2} value={seuil} onChange={(e) => setSeuil(e.target.value)} />
                  </Champ>
                )}
              </div>
            </SectionRepliable>

            {typeGraphique === "carte" && (
              <SectionRepliable numero={6} titre="Style de la carte" resume="Zone, couleurs, étiquettes, légende" ouverteParDefaut>
                <PanneauStyleCarte valeur={parametresCarte} onChange={setParametresCarte} nomZone={territoire ? territoire.nom : undefined} />
              </SectionRepliable>
            )}
          </div>
        </Carte>

        <Carte
          className="eva-st-apercu"
          titre="Aperçu"
          description={sousTitreApercu}
          pied={
            <div className="eva-st-pied">
              <div className="eva-st-pied__groupe">
                <span className="eva-st-pied__etiquette">Exporter</span>
                <Bouton
                  variante="secondaire"
                  taille="petit"
                  onClick={() => exporter("xlsx")}
                  chargement={exportEnCours === "xlsx"}
                  disabled={!exportPossible || exportEnCours !== null}
                  iconeGauche={<FileSpreadsheet size={15} />}
                  title="Exporter en Excel (données et graphique)"
                >
                  Excel
                </Bouton>
                <Bouton
                  variante="secondaire"
                  taille="petit"
                  onClick={() => exporter("pdf")}
                  chargement={exportEnCours === "pdf"}
                  disabled={!exportPossible || exportEnCours !== null}
                  iconeGauche={<FileText size={15} />}
                  title="Exporter en PDF (graphique, fiche méthodologique et données)"
                >
                  PDF
                </Bouton>
              </div>
              <Bouton onClick={ouvrirModaleEnregistrement} disabled={!resultatPret} iconeGauche={<Save size={16} />}>
                Enregistrer sur un tableau de bord
              </Bouton>
            </div>
          }
        >
          <div className="eva-st-apercu__barre">
            <Onglets
              variante="pilules"
              ariaLabel="Mode d'affichage"
              prefixeId="apercu"
              actif={vueTable ? "tableau" : "graphique"}
              onChanger={(id) => setVueTable(id === "tableau")}
              onglets={[
                { id: "graphique", libelle: "Graphique", icone: <BarChart3 size={15} aria-hidden="true" /> },
                { id: "tableau", libelle: "Tableau", icone: <Table2 size={15} aria-hidden="true" /> }
              ]}
            />
            <Bouton
              variante="fantome"
              taille="petit"
              iconeSeule
              iconeGauche={<RefreshCw size={15} />}
              aria-label="Actualiser l'aperçu"
              title="Actualiser l'aperçu"
              onClick={() => setDimensionsChoisies((d) => [...d])}
              disabled={!configurationComplete}
            />
          </div>

          <div
            className={chargement && resultat ? "eva-st-apercu__zone eva-st-rafraichit" : "eva-st-apercu__zone"}
            role="tabpanel"
            id={`apercu-panneau-${vueTable ? "tableau" : "graphique"}`}
            aria-labelledby={`apercu-${vueTable ? "tableau" : "graphique"}`}
            aria-busy={chargement}
          >
            {rendreApercu()}
          </div>

          {resultat && resultat.lignes.length > 0 && (
            <p className="eva-st-apercu__info">
              <span>
                {resultat.total_lignes.toLocaleString("fr-FR")} ligne{resultat.total_lignes > 1 ? "s" : ""}
              </span>
              {!!resultat.traitements?.cellules_masquees && (
                <span className="eva-st-apercu__info-alerte">
                  <AlertTriangle size={13} aria-hidden="true" />
                  {resultat.traitements.cellules_masquees} cellule{resultat.traitements.cellules_masquees > 1 ? "s" : ""} masquée{resultat.traitements.cellules_masquees > 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
        </Carte>
      </div>

      {modaleEnregistrement && (
        <Modale
          titre="Enregistrer ce graphique"
          description="Il sera ajouté à la grille d'un tableau de bord, où vous pourrez le déplacer et l'exporter."
          onFermer={() => setModaleEnregistrement(false)}
          actions={
            <>
              <Bouton variante="fantome" onClick={() => setModaleEnregistrement(false)}>
                Annuler
              </Bouton>
              <Bouton chargement={enregistrementEnCours} onClick={() => enregistrer()} iconeGauche={<Save size={16} />}>
                Enregistrer
              </Bouton>
            </>
          }
        >
          <form onSubmit={enregistrer} noValidate className="eva-st-formulaire">
            <dl className="eva-st-recap">
              <div>
                <dt>Type</dt>
                <dd>{descriptionTypeCourant.label}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{libelleDimensions.join(", ")}</dd>
              </div>
              <div>
                <dt>Mesures</dt>
                <dd>{libelleMesuresChoisies.join(", ")}</dd>
              </div>
            </dl>

            <Champ id="nom-widget" label="Nom du graphique" requis erreur={erreursFormulaire.nom}>
              <input id="nom-widget" autoFocus value={nomWidget} onChange={(e) => setNomWidget(e.target.value)} placeholder="Ex. Naissances par commune" />
            </Champ>

            <div className="eva-st-cible">
              <span className="eva-st-cible__etiquette" id="etiquette-cible">
                Tableau de bord
              </span>
              <Onglets
                variante="pilules"
                ariaLabel="Destination du graphique"
                prefixeId="cible"
                actif={cibleTableauDeBord === "__nouveau__" ? "nouveau" : "existant"}
                onChanger={(id) => setCibleTableauDeBord(id === "nouveau" ? "__nouveau__" : (tableauxDeBord[0]?.id ?? "__nouveau__"))}
                onglets={[
                  { id: "nouveau", libelle: "Nouveau tableau" },
                  { id: "existant", libelle: "Tableau existant", compteur: chargementTableaux ? undefined : tableauxDeBord.length, desactive: chargementTableaux || tableauxDeBord.length === 0 }
                ]}
              />
            </div>

            {cibleTableauDeBord === "__nouveau__" ? (
              <Champ id="nom-nouveau-tableau" label="Nom du nouveau tableau de bord" requis erreur={erreursFormulaire.tableau}>
                <input id="nom-nouveau-tableau" value={nomNouveauTableau} onChange={(e) => setNomNouveauTableau(e.target.value)} placeholder="Ex. Suivi mensuel" />
              </Champ>
            ) : (
              <Champ id="cible-tableau" label="Ajouter au tableau de bord">
                <Selecteur id="cible-tableau" valeur={cibleTableauDeBord} onChange={setCibleTableauDeBord}>
                  {tableauxDeBord.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                    </option>
                  ))}
                </Selecteur>
              </Champ>
            )}
            <button type="submit" className="eva-sr-only" tabIndex={-1}>
              Enregistrer
            </button>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
