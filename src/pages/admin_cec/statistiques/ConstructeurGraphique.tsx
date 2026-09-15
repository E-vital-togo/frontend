import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Save, Table2 } from "lucide-react";
import MiseEnPage from "../../../components/MiseEnPage";
import { Bouton, Carte, Champ, EnteteDePage, GraphiqueECharts, Modale, Tableau } from "../../../components/ui";
import { useToast } from "../../../components/ui/ToastProvider";
import { appelApi, ErreurApi } from "../../../lib/apiClient";
import { construireOptionECharts } from "../../../lib/graphiques";
import { LIENS_ADMIN_CEC } from "../navigation";
import type {
  DimensionStat,
  ListeOuPaginee,
  MesureStat,
  PivotResultat,
  TableauDeBord,
  TriPivot,
  TypeGraphiqueStat
} from "../../../types/domaine";
import { listeDepuis } from "../../../types/domaine";

const TYPES_GRAPHIQUE: { code: TypeGraphiqueStat; label: string }[] = [
  { code: "barres", label: "Barres" },
  { code: "barres_empilees", label: "Barres empilees" },
  { code: "barres_horizontales", label: "Barres horizontales" },
  { code: "courbes", label: "Courbes" },
  { code: "aires_empilees", label: "Aires empilees" },
  { code: "camembert", label: "Camembert" },
  { code: "anneau", label: "Anneau" },
  { code: "combo", label: "Combo (double axe)" },
  { code: "nuage_points", label: "Nuage de points" },
  { code: "carte_chaleur", label: "Carte de chaleur" }
];

// Le moteur backend (apps.statistiques.moteur) accepte n'importe quel
// nombre de dimensions, mais au-dela de 2 (axe X + serie/regroupement),
// il n'existe plus de representation graphique 2D univoque - voir
// construireSeries() dans src/lib/graphiques.ts. On plafonne donc ici,
// cote UI, plutot que de laisser l'utilisateur composer un croisement que
// rien ne saurait dessiner correctement.
const MAX_DIMENSIONS = 2;

export default function ConstructeurGraphique() {
  const toast = useToast();
  const [dimensionsDisponibles, setDimensionsDisponibles] = useState<DimensionStat[]>([]);
  const [mesuresDisponibles, setMesuresDisponibles] = useState<MesureStat[]>([]);

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

  const [resultat, setResultat] = useState<PivotResultat | null>(null);
  const [vueTable, setVueTable] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [modaleEnregistrement, setModaleEnregistrement] = useState(false);
  const [tableauxDeBord, setTableauxDeBord] = useState<TableauDeBord[]>([]);
  const [nomWidget, setNomWidget] = useState("");
  const [cibleTableauDeBord, setCibleTableauDeBord] = useState("__nouveau__");
  const [nomNouveauTableau, setNomNouveauTableau] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  useEffect(() => {
    appelApi<DimensionStat[]>("/statistiques/dimensions").then(setDimensionsDisponibles).catch(() => {});
    appelApi<MesureStat[]>("/statistiques/mesures").then(setMesuresDisponibles).catch(() => {});
  }, []);

  const libellesMesures = useMemo(
    () => Object.fromEntries(mesuresDisponibles.map((m) => [m.code, m.label])),
    [mesuresDisponibles]
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
    setModaleEnregistrement(true);
    try {
      const donnees = await appelApi<ListeOuPaginee<TableauDeBord>>("/statistiques/tableaux-de-bord/");
      setTableauxDeBord(listeDepuis(donnees));
    } catch {
      setTableauxDeBord([]);
    }
  }

  async function enregistrer() {
    if (!nomWidget.trim()) {
      toast.erreur("Le nom du graphique est requis.");
      return;
    }
    if (cibleTableauDeBord === "__nouveau__" && !nomNouveauTableau.trim()) {
      toast.erreur("Le nom du tableau de bord est requis.");
      return;
    }
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
          seuil_petites_cellules: seuilActuel()
        }
      });
      toast.succes("Graphique enregistre sur le tableau de bord.");
      setModaleEnregistrement(false);
      setNomWidget("");
      setNomNouveauTableau("");
    } catch (e) {
      toast.erreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  return (
    <MiseEnPage liens={LIENS_ADMIN_CEC}>
      <EnteteDePage
        titre="Constructeur de graphique"
        sousTitre="Croisez librement dimensions et mesures, puis enregistrez sur un tableau de bord."
      />

      <div className="eva-grille-2" style={{ alignItems: "start", gap: 20 }}>
        <Carte>
          <h2 style={{ fontSize: 14, marginBottom: 14 }}>Configuration</h2>

          <Champ id="type-graphique" label="Type de graphique">
            <select id="type-graphique" value={typeGraphique} onChange={(e) => setTypeGraphique(e.target.value as TypeGraphiqueStat)}>
              {TYPES_GRAPHIQUE.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </Champ>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Dimensions (axe X, puis serie) — {MAX_DIMENSIONS} maximum
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dimensionsDisponibles.map((d) => {
                const position = dimensionsChoisies.indexOf(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => basculerDimension(d.code)}
                    className={`eva-bouton eva-bouton--petit ${position >= 0 ? "eva-bouton--principal" : "eva-bouton--fantome"}`}
                  >
                    {position >= 0 && `${position + 1}. `}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Mesures (axe Y) — plusieurs possibles
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mesuresDisponibles.map((m) => {
                const position = mesuresChoisies.indexOf(m.code);
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => basculerMesure(m.code)}
                    className={`eva-bouton eva-bouton--petit ${position >= 0 ? "eva-bouton--principal" : "eva-bouton--fantome"}`}
                  >
                    {position >= 0 && `${position + 1}. `}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <Champ id="filtre-event" label="Type d'evenement">
                <select id="filtre-event" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="naissance">Naissance</option>
                  <option value="deces">Deces</option>
                </select>
              </Champ>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Champ id="date-min" label="Depuis le">
                <input id="date-min" type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)} />
              </Champ>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <Champ id="date-max" label="Jusqu'au">
                <input id="date-max" type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)} />
              </Champ>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Champ id="tri" label="Tri">
                <select id="tri" value={tri} onChange={(e) => setTri(e.target.value as TriPivot)}>
                  <option value="valeur_desc">Valeur decroissante</option>
                  <option value="valeur_asc">Valeur croissante</option>
                  <option value="libelle_asc">Libelle (A-Z)</option>
                </select>
              </Champ>
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <Champ id="limite" label="Limite (top N)">
                <input id="limite" type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Aucune" />
              </Champ>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
            <input type="checkbox" checked={regrouperAutres} onChange={(e) => setRegrouperAutres(e.target.checked)} />
            Regrouper le surplus dans "Autres"
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}
            title="Écarte les dossiers sans valeur pour une des dimensions choisies ; les taux se calculent sur le renseigné."
          >
            <input type="checkbox" checked={exclureNonRenseigne} onChange={(e) => setExclureNonRenseigne(e.target.checked)} />
            Exclure « Non renseigné »
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, flexWrap: "wrap" }}
            title="Protection contre la ré-identification : toute cellule de moins de N dossiers est masquée (« < N ») dans le graphique, le tableau et les exports."
          >
            <input type="checkbox" checked={seuilActif} onChange={(e) => setSeuilActif(e.target.checked)} />
            Masquer les cellules de moins de
            <input type="number" min={2} value={seuil} disabled={!seuilActif} onChange={(e) => setSeuil(e.target.value)} style={{ width: 64 }} />
            dossiers
          </label>

          <Bouton
            onClick={ouvrirModaleEnregistrement}
            disabled={!resultat || resultat.lignes.length === 0}
            iconeGauche={<Save size={15} />}
            style={{ width: "100%" }}
          >
            Enregistrer sur un tableau de bord
          </Bouton>
        </Carte>

        <Carte>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 14 }}>Apercu</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setVueTable(false)}
                className={`eva-bouton eva-bouton--petit ${!vueTable ? "eva-bouton--principal" : "eva-bouton--fantome"}`}
                aria-label="Vue graphique"
                aria-pressed={!vueTable}
              >
                <BarChart3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setVueTable(true)}
                className={`eva-bouton eva-bouton--petit ${vueTable ? "eva-bouton--principal" : "eva-bouton--fantome"}`}
                aria-label="Vue tableau"
                aria-pressed={vueTable}
              >
                <Table2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDimensionsChoisies((d) => [...d])}
                className="eva-bouton eva-bouton--petit eva-bouton--fantome"
                aria-label="Rafraichir"
                title="Rafraichir"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {dimensionsChoisies.length === 0 || mesuresChoisies.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13.5 }}>
              Choisissez au moins une dimension et une mesure pour voir un apercu.
            </p>
          ) : erreur ? (
            <p className="message-erreur">{erreur}</p>
          ) : chargement && !resultat ? (
            <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13.5 }}>Calcul en cours...</p>
          ) : !resultat ? null : vueTable ? (
            <Tableau>
              <thead>
                <tr>
                  {resultat.dimensions.map((d) => (
                    <th key={d}>{dimensionsDisponibles.find((dd) => dd.code === d)?.label ?? d}</th>
                  ))}
                  {resultat.mesures.map((m) => (
                    <th key={m}>{libellesMesures[m] ?? m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultat.lignes.map((ligne, index) => (
                  <tr key={index}>
                    {resultat.dimensions.map((d) => (
                      <td key={d}>{ligne[d]}</td>
                    ))}
                    {resultat.mesures.map((m) => (
                      <td key={m} style={ligne._masque ? { color: "var(--gris-2)", fontStyle: "italic" } : undefined}>
                        {ligne._masque ? `< ${resultat.traitements?.seuil_petites_cellules ?? ""}` : ligne[m] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Tableau>
          ) : (
            <GraphiqueECharts option={construireOptionECharts(resultat, typeGraphique, libellesMesures)} hauteur={360} />
          )}
        </Carte>
      </div>

      {modaleEnregistrement && (
        <Modale
          titre="Enregistrer ce graphique"
          onFermer={() => setModaleEnregistrement(false)}
          actions={
            <>
              <Bouton variante="fantome" onClick={() => setModaleEnregistrement(false)}>
                Annuler
              </Bouton>
              <Bouton chargement={enregistrementEnCours} onClick={enregistrer}>
                Enregistrer
              </Bouton>
            </>
          }
        >
          <Champ id="nom-widget" label="Nom du graphique" requis>
            <input id="nom-widget" value={nomWidget} onChange={(e) => setNomWidget(e.target.value)} placeholder="Ex. Naissances par commune" />
          </Champ>
          <Champ id="cible-tableau" label="Tableau de bord">
            <select id="cible-tableau" value={cibleTableauDeBord} onChange={(e) => setCibleTableauDeBord(e.target.value)}>
              <option value="__nouveau__">+ Nouveau tableau de bord</option>
              {tableauxDeBord.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>
          </Champ>
          {cibleTableauDeBord === "__nouveau__" && (
            <Champ id="nom-nouveau-tableau" label="Nom du nouveau tableau de bord" requis>
              <input
                id="nom-nouveau-tableau"
                value={nomNouveauTableau}
                onChange={(e) => setNomNouveauTableau(e.target.value)}
                placeholder="Ex. Suivi mensuel"
              />
            </Champ>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
