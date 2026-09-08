import { useEffect, useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import Graphique from "./Graphique";
import TableDonnees from "./TableDonnees";
import SelecteurPeriode from "./SelecteurPeriode";
import SelecteurTypeGraphique, { type TypeGraphique } from "./SelecteurTypeGraphique";
import Squelette from "../Squelette";
import { couleurCategorie, SERIES_CATEGORIELLES } from "../../lib/paletteGraphiques";
import { ErreurApi } from "../../lib/apiClient";
import {
  obtenirEvolution,
  obtenirRepartition,
  type DimensionStatistique,
  type EntreeRepartition,
  type FiltrePeriode,
  type IntervalleEvolution,
  type ReponseEvolution
} from "../../services/statistiquesService";

type Vue = "repartition" | "evolution";

const INTERVALLES: Array<{ valeur: IntervalleEvolution; libelle: string }> = [
  { valeur: "jour", libelle: "Par jour" },
  { valeur: "semaine", libelle: "Par semaine" },
  { valeur: "mois", libelle: "Par mois" }
];

function formaterPeriode(intervalle: IntervalleEvolution, valeurIso: string): string {
  const date = new Date(valeurIso);
  if (Number.isNaN(date.getTime())) return valeurIso;
  if (intervalle === "mois") return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

interface ProprietesTableauStatistiques {
  titre: string;
  /** Dimensions proposees a la selection (l'agent n'a pas "mairie", scope a une seule). */
  dimensionsDisponibles: Array<{ valeur: DimensionStatistique; libelle: string }>;
}

/**
 * Widget de statistiques complet : repartition (une dimension, un instant)
 * ou evolution (dans le temps, avec decoupe optionnelle par une seconde
 * dimension), 4 types de rendu, periode personnalisable, vue tabulaire de
 * secours. Voir Graphique.tsx pour le detail des specs de tracé.
 */
export default function TableauStatistiques({ titre, dimensionsDisponibles }: ProprietesTableauStatistiques) {
  const [vue, setVue] = useState<Vue>("repartition");
  const [dimension, setDimension] = useState<DimensionStatistique>(dimensionsDisponibles[0]?.valeur ?? "statut");
  const [intervalle, setIntervalle] = useState<IntervalleEvolution>("jour");
  const [serieDimension, setSerieDimension] = useState<DimensionStatistique | "">("statut");
  const [periode, setPeriode] = useState<FiltrePeriode>({});
  const [type, setType] = useState<TypeGraphique>("barres");
  const [afficherTable, setAfficherTable] = useState(false);

  const [repartitionData, setRepartitionData] = useState<EntreeRepartition[]>([]);
  const [evolutionData, setEvolutionData] = useState<ReponseEvolution | null>(null);
  const [chargement, setChargement] = useState(true);
  const [premierChargementFait, setPremierChargementFait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!periode.dateDebut && !periode.dateFin) return; // attend le premier calcul de SelecteurPeriode
    setChargement(true);
    setErreur(null);

    const requete =
      vue === "repartition"
        ? obtenirRepartition(dimension, periode).then((d) => setRepartitionData(d))
        : obtenirEvolution(intervalle, serieDimension || null, periode).then((d) => setEvolutionData(d));

    requete
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : "Impossible de charger les statistiques."))
      .finally(() => {
        setChargement(false);
        setPremierChargementFait(true);
      });
  }, [vue, dimension, intervalle, serieDimension, periode]);

  // Passer d'un type de graphique interdit dans la vue courante vers "barres" (toujours valide).
  useEffect(() => {
    if (vue === "evolution" && type === "circulaire" && serieDimension === "") {
      setType("barres");
    }
  }, [vue, type, serieDimension]);

  const donneesCategorielles = useMemo(
    () =>
      repartitionData.map((e, i) => ({
        cle: e.cle,
        libelle: e.libelle,
        valeur: e.valeur,
        couleur: couleurCategorie(dimension, e.libelle, i)
      })),
    [repartitionData, dimension]
  );

  const seriesTemporelles = useMemo(() => {
    if (!evolutionData) return [];
    if (!serieDimension) return [{ cle: "total", libelle: "Total", couleur: SERIES_CATEGORIELLES[0] }];
    return evolutionData.series.map((libelle, i) => ({
      cle: libelle,
      libelle,
      couleur: couleurCategorie(serieDimension, libelle, i)
    }));
  }, [evolutionData, serieDimension]);

  const libelleDimension = dimensionsDisponibles.find((d) => d.valeur === dimension)?.libelle ?? dimension;

  return (
    <div className="carte">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, margin: 0, color: "var(--couleur-emeraude)" }}>{titre}</h2>
        <div className="groupe-segmente">
          <button type="button" aria-pressed={vue === "repartition"} onClick={() => setVue("repartition")}>
            Repartition
          </button>
          <button type="button" aria-pressed={vue === "evolution"} onClick={() => setVue("evolution")}>
            Evolution
          </button>
        </div>
      </div>

      <div className="barre-outils-graphique">
        {vue === "repartition" ? (
          <select className="selecteur-simple" value={dimension} onChange={(e) => setDimension(e.target.value as DimensionStatistique)}>
            {dimensionsDisponibles.map((d) => (
              <option key={d.valeur} value={d.valeur}>
                Par {d.libelle.toLowerCase()}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select className="selecteur-simple" value={intervalle} onChange={(e) => setIntervalle(e.target.value as IntervalleEvolution)}>
              {INTERVALLES.map((i) => (
                <option key={i.valeur} value={i.valeur}>
                  {i.libelle}
                </option>
              ))}
            </select>
            <select
              className="selecteur-simple"
              value={serieDimension}
              onChange={(e) => setSerieDimension(e.target.value as DimensionStatistique | "")}
            >
              <option value="">Total (sans decoupe)</option>
              {dimensionsDisponibles.map((d) => (
                <option key={d.valeur} value={d.valeur}>
                  Decouper par {d.libelle.toLowerCase()}
                </option>
              ))}
            </select>
          </>
        )}

        <SelecteurPeriode onChange={setPeriode} />

        <SelecteurTypeGraphique
          valeur={type}
          onChange={setType}
          desactives={vue === "evolution" && serieDimension === "" ? ["circulaire"] : []}
        />

        <button
          type="button"
          className="pagination__bouton"
          style={{ width: "auto", padding: "0 10px", display: "flex", alignItems: "center", gap: 6 }}
          aria-pressed={afficherTable}
          onClick={() => setAfficherTable((v) => !v)}
          title="Afficher les donnees en tableau"
        >
          <Table2 size={14} />
        </button>
      </div>

      {erreur && <div className="message-erreur">{erreur}</div>}

      {!premierChargementFait ? (
        <Squelette lignes={5} />
      ) : (
        // Garde l'affichage precedent (opacite reduite) pendant un rafraichissement au lieu
        // de le remplacer par un squelette a chaque changement de filtre - un blanc complet
        // a chaque clic donne une impression de rechargement permanent, pas de "vrai" tableau de bord.
        <div style={{ opacity: chargement ? 0.5 : 1, transition: "opacity 0.15s" }}>
          {vue === "repartition" ? (
            donneesCategorielles.length === 0 ? (
              <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13 }}>Aucune donnee sur cette periode.</p>
            ) : (
              <>
                <Graphique mode="categoriel" type={type} donnees={donneesCategorielles} />
                {afficherTable && (
                  <TableDonnees
                    colonnes={[
                      { cle: "libelle", libelle: libelleDimension },
                      { cle: "valeur", libelle: "Nombre de dossiers" }
                    ]}
                    lignes={donneesCategorielles}
                  />
                )}
              </>
            )
          ) : !evolutionData || evolutionData.donnees.length === 0 ? (
            <p style={{ color: "var(--couleur-gris-service-2)", fontSize: 13 }}>Aucune donnee sur cette periode.</p>
          ) : (
            <>
              <Graphique
                mode="temporel"
                type={type}
                donnees={evolutionData.donnees}
                cleX="periode"
                series={seriesTemporelles}
                formatX={(v) => formaterPeriode(intervalle, v)}
              />
              {afficherTable && (
                <TableDonnees
                  colonnes={[{ cle: "periode", libelle: "Periode" }, ...seriesTemporelles.map((s) => ({ cle: s.cle, libelle: s.libelle }))]}
                  lignes={evolutionData.donnees.map((ligne) => ({ ...ligne, periode: formaterPeriode(intervalle, String(ligne.periode)) }))}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
