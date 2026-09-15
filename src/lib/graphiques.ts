import type { BarSeriesOption, EChartsOption, LineSeriesOption } from "echarts";
import type { PivotResultat, TypeGraphiqueStat } from "../types/domaine";

export const PALETTE = ["#0B7A57", "#16B37D", "#A8BB1E", "#40534B", "#6B7A73", "#C8D92F", "#8AA69B", "#B3261E", "#2E6F95", "#C97A2B"];

interface Serie {
  nom: string;
  valeurs: (number | null)[];
}

/**
 * Reforme les lignes "plates" du pivot (une ligne par combinaison de
 * dimensions) en categories d'axe X + series, format directement
 * consommable par ECharts. Au plus une dimension pilote l'axe X, une
 * seconde (si presente) pilote la serie/legende - un pivot a 3+ dimensions
 * reste possible cote moteur mais n'a plus de representation graphique 2D
 * univoque, donc seules les deux premieres sont utilisees ici pour le
 * dessin (les autres restent filtrables en amont, voir ConstructeurGraphique).
 */
function construireSeries(resultat: PivotResultat, libellesMesures: Record<string, string>): { categories: string[]; series: Serie[] } {
  const [dimX, dimSerie] = resultat.dimensions;
  const categories: string[] = [];
  for (const ligne of resultat.lignes) {
    const val = String(ligne[dimX] ?? "Non renseigne");
    if (!categories.includes(val)) categories.push(val);
  }

  const series: Serie[] = [];

  if (dimSerie) {
    const valeursSerie: string[] = [];
    for (const ligne of resultat.lignes) {
      const val = String(ligne[dimSerie] ?? "Non renseigne");
      if (!valeursSerie.includes(val)) valeursSerie.push(val);
    }
    for (const valSerie of valeursSerie) {
      for (const mesure of resultat.mesures) {
        const nom = resultat.mesures.length > 1 ? `${valSerie} · ${libellesMesures[mesure] ?? mesure}` : valSerie;
        const valeurs = categories.map((cat) => {
          const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigne") === cat && String(l[dimSerie] ?? "Non renseigne") === valSerie);
          return ligne ? (ligne[mesure] as number | null) : null;
        });
        series.push({ nom, valeurs });
      }
    }
  } else {
    for (const mesure of resultat.mesures) {
      const valeurs = categories.map((cat) => {
        const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigne") === cat);
        return ligne ? (ligne[mesure] as number | null) : null;
      });
      series.push({ nom: libellesMesures[mesure] ?? mesure, valeurs });
    }
  }

  return { categories, series };
}

const OPTION_BASE: Partial<EChartsOption> = {
  tooltip: { trigger: "axis" },
  legend: { bottom: 0, textStyle: { fontSize: 11 } },
  grid: { top: 24, left: 8, right: 16, bottom: 36, containLabel: true }
};

/** Remplissage d'aire en degrade vertical (opaque en haut, transparent en bas), comme l'atelier des requetes INSEED. */
function degradeAire(couleur: string): NonNullable<LineSeriesOption["areaStyle"]> {
  return {
    opacity: 0.85,
    color: {
      type: "linear", x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0.05, color: couleur }, { offset: 0.95, color: couleur + "14" }]
    }
  };
}

export function construireOptionECharts(
  resultat: PivotResultat,
  typeGraphique: TypeGraphiqueStat,
  libellesMesures: Record<string, string> = {}
): EChartsOption {
  if (resultat.lignes.length === 0) {
    return { title: { text: "Aucune donnee", left: "center", top: "middle", textStyle: { fontSize: 13, color: "#6B7A73" } } };
  }

  if (typeGraphique === "carte_chaleur") {
    return construireOptionCarteChaleur(resultat, libellesMesures);
  }
  if (typeGraphique === "nuage_points") {
    return construireOptionNuage(resultat, libellesMesures);
  }
  if (typeGraphique === "camembert" || typeGraphique === "anneau") {
    return construireOptionCamembert(resultat, typeGraphique, libellesMesures);
  }
  if (typeGraphique === "combo") {
    return construireOptionCombo(resultat, libellesMesures);
  }

  const { categories, series } = construireSeries(resultat, libellesMesures);
  const horizontal = typeGraphique === "barres_horizontales";
  const empilees = typeGraphique === "barres_empilees" || typeGraphique === "aires_empilees";
  const aires = typeGraphique === "aires_empilees";
  const courbes = typeGraphique === "courbes";
  // Une aire est une courbe remplie : le type ECharts doit etre "line" (areaStyle
  // est ignore sur une serie "bar", ce qui rendait les aires identiques aux
  // barres empilees). Meme rendu que l'atelier des requetes INSEED (Recharts
  // AreaChart avec degrade vertical).
  const enLignes = courbes || aires;

  const axeCategories = { type: "category" as const, data: categories, axisLabel: { fontSize: 11, interval: 0, rotate: categories.length > 8 && !horizontal ? 30 : 0 } };
  const axeValeurs = { type: "value" as const, axisLabel: { fontSize: 11 } };

  return {
    ...OPTION_BASE,
    color: PALETTE,
    xAxis: horizontal ? axeValeurs : axeCategories,
    yAxis: horizontal ? axeCategories : axeValeurs,
    series: series.map((s, i): LineSeriesOption | BarSeriesOption =>
      enLignes
        ? {
            name: s.nom,
            type: "line",
            data: s.valeurs,
            stack: empilees ? "pile" : undefined,
            areaStyle: aires ? degradeAire(PALETTE[i % PALETTE.length]) : undefined,
            smooth: true,
            symbolSize: aires ? 5 : undefined,
            emphasis: { focus: "series" }
          }
        : {
            name: s.nom,
            type: "bar",
            data: s.valeurs,
            stack: empilees ? "pile" : undefined,
            emphasis: { focus: "series" }
          }
    )
  };
}

function construireOptionCombo(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dimX] = resultat.dimensions;
  const categories: string[] = [];
  for (const ligne of resultat.lignes) {
    const val = String(ligne[dimX] ?? "Non renseigne");
    if (!categories.includes(val)) categories.push(val);
  }
  const [mesurePrincipale, ...mesuresSecondaires] = resultat.mesures;

  const valeursPour = (mesure: string) => categories.map((cat) => {
    const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigne") === cat);
    return ligne ? (ligne[mesure] as number | null) : null;
  });

  return {
    ...OPTION_BASE,
    color: PALETTE,
    xAxis: { type: "category", data: categories, axisLabel: { fontSize: 11, interval: 0, rotate: categories.length > 8 ? 30 : 0 } },
    yAxis: [
      { type: "value", name: libellesMesures[mesurePrincipale] ?? mesurePrincipale, axisLabel: { fontSize: 11 } },
      { type: "value", name: mesuresSecondaires.map((m) => libellesMesures[m] ?? m).join(", "), axisLabel: { fontSize: 11 } }
    ],
    series: [
      { name: libellesMesures[mesurePrincipale] ?? mesurePrincipale, type: "bar", data: valeursPour(mesurePrincipale), yAxisIndex: 0 },
      ...mesuresSecondaires.map((mesure) => ({
        name: libellesMesures[mesure] ?? mesure,
        type: "line" as const,
        data: valeursPour(mesure),
        yAxisIndex: 1,
        smooth: true
      }))
    ]
  };
}

function construireOptionCamembert(resultat: PivotResultat, type: "camembert" | "anneau", libellesMesures: Record<string, string>): EChartsOption {
  const [dim] = resultat.dimensions;
  const [mesure] = resultat.mesures;
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    color: PALETTE,
    series: [
      {
        name: libellesMesures[mesure] ?? mesure,
        type: "pie",
        radius: type === "anneau" ? ["45%", "72%"] : "72%",
        center: ["50%", "45%"],
        data: resultat.lignes.map((l) => ({ name: String(l[dim] ?? "Non renseigne"), value: l[mesure] as number })),
        label: { fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } }
      }
    ]
  };
}

function construireOptionNuage(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dim] = resultat.dimensions;
  const [mesureX, mesureY] = resultat.mesures;
  if (!mesureY) {
    return { title: { text: "Un nuage de points demande 2 mesures (X et Y)", left: "center", top: "middle", textStyle: { fontSize: 12.5, color: "#6B7A73" } } };
  }
  return {
    ...OPTION_BASE,
    tooltip: {
      trigger: "item",
      formatter: (parametres) => {
        const p = parametres as unknown as { data: [number, number]; name: string };
        return `${p.name}<br/>${libellesMesures[mesureX] ?? mesureX} : ${p.data[0]}<br/>${libellesMesures[mesureY] ?? mesureY} : ${p.data[1]}`;
      }
    },
    xAxis: { type: "value", name: libellesMesures[mesureX] ?? mesureX, axisLabel: { fontSize: 11 } },
    yAxis: { type: "value", name: libellesMesures[mesureY] ?? mesureY, axisLabel: { fontSize: 11 } },
    series: [
      {
        type: "scatter",
        symbolSize: 14,
        data: resultat.lignes.map((l) => ({ name: String(l[dim] ?? "Non renseigne"), value: [l[mesureX], l[mesureY]] })),
        itemStyle: { color: PALETTE[0] }
      }
    ]
  };
}

function construireOptionCarteChaleur(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dimX, dimY] = resultat.dimensions;
  const [mesure] = resultat.mesures;
  if (!dimY) {
    return { title: { text: "Une carte de chaleur demande 2 dimensions", left: "center", top: "middle", textStyle: { fontSize: 12.5, color: "#6B7A73" } } };
  }
  const categoriesX: string[] = [];
  const categoriesY: string[] = [];
  for (const ligne of resultat.lignes) {
    const vx = String(ligne[dimX] ?? "Non renseigne");
    const vy = String(ligne[dimY] ?? "Non renseigne");
    if (!categoriesX.includes(vx)) categoriesX.push(vx);
    if (!categoriesY.includes(vy)) categoriesY.push(vy);
  }
  const donnees = resultat.lignes.map((l) => [
    categoriesX.indexOf(String(l[dimX] ?? "Non renseigne")),
    categoriesY.indexOf(String(l[dimY] ?? "Non renseigne")),
    l[mesure] as number
  ]);
  const valeurs = donnees.map((d) => d[2] as number);

  return {
    tooltip: { position: "top" },
    grid: { top: 24, left: 8, right: 16, bottom: 60, containLabel: true },
    xAxis: { type: "category", data: categoriesX, splitArea: { show: true }, axisLabel: { fontSize: 11, interval: 0, rotate: 30 } },
    yAxis: { type: "category", data: categoriesY, splitArea: { show: true }, axisLabel: { fontSize: 11 } },
    visualMap: {
      min: Math.min(0, ...valeurs),
      max: Math.max(1, ...valeurs),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { fontSize: 11 },
      inRange: { color: ["#EAF3EE", "#A8BB1E", "#0B7A57"] }
    },
    series: [
      {
        name: libellesMesures[mesure] ?? mesure,
        type: "heatmap",
        data: donnees,
        label: { show: true, fontSize: 10 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.3)" } }
      }
    ]
  };
}
