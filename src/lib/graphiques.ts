import type { BarSeriesOption, EChartsOption, LineSeriesOption } from "echarts";
import type { PivotResultat, TypeGraphiqueStat } from "../types/domaine";

/**
 * Palette categorielle alignee sur la charte : emeraude en premier, puis des
 * teintes volontairement bien distinctes entre series voisines (bleu, citron,
 * orange, gris service) avant les tons de rappel. Valeurs en hexadecimal car le
 * canvas d'ECharts ne lit pas les variables CSS (memes valeurs que theme.css).
 */
export const PALETTE = ["#0B7A57", "#2E6F95", "#A8BB1E", "#C97A2B", "#40534B", "#16B37D", "#8AA69B", "#7A5C99", "#B3261E", "#C8D92F"];

/** Couleurs neutres des graphiques (texte, axes, grille, infobulle), tirees des jetons de theme.css. */
export const COULEURS_GRAPHIQUE = {
  encre: "#14231C",
  texte: "#40534B",
  discret: "#5E6B65",
  axe: "#C9D2C6",
  grille: "#E2E7DF",
  fond: "#FFFFFF"
};

export const POLICE_GRAPHIQUE = '"Instrument Sans", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Habillage commun d'une infobulle (carte blanche, filet, ombre douce). */
export const INFOBULLE_GRAPHIQUE = {
  backgroundColor: COULEURS_GRAPHIQUE.fond,
  borderColor: COULEURS_GRAPHIQUE.grille,
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: COULEURS_GRAPHIQUE.encre, fontSize: 12.5, fontFamily: POLICE_GRAPHIQUE },
  extraCssText: "box-shadow: 0 8px 24px rgba(20,35,28,0.14); border-radius: 8px;"
};

/** Legende en pastilles rondes, texte lisible. */
export const LEGENDE_GRAPHIQUE = {
  type: "scroll" as const,
  left: "center",
  width: "76%",
  bottom: 0,
  icon: "circle",
  itemWidth: 9,
  itemHeight: 9,
  itemGap: 16,
  textStyle: { fontSize: 12, color: COULEURS_GRAPHIQUE.texte }
};

const STYLE_AXE_CATEGORIES = {
  axisLine: { lineStyle: { color: COULEURS_GRAPHIQUE.axe } },
  axisTick: { show: false }
};

const STYLE_AXE_VALEURS = {
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: COULEURS_GRAPHIQUE.grille, type: "dashed" as const } }
};

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
    const val = String(ligne[dimX] ?? "Non renseigné");
    if (!categories.includes(val)) categories.push(val);
  }

  const series: Serie[] = [];

  if (dimSerie) {
    const valeursSerie: string[] = [];
    for (const ligne of resultat.lignes) {
      const val = String(ligne[dimSerie] ?? "Non renseigné");
      if (!valeursSerie.includes(val)) valeursSerie.push(val);
    }
    for (const valSerie of valeursSerie) {
      for (const mesure of resultat.mesures) {
        const nom = resultat.mesures.length > 1 ? `${valSerie} · ${libellesMesures[mesure] ?? mesure}` : valSerie;
        const valeurs = categories.map((cat) => {
          const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigné") === cat && String(l[dimSerie] ?? "Non renseigné") === valSerie);
          return ligne ? (ligne[mesure] as number | null) : null;
        });
        series.push({ nom, valeurs });
      }
    }
  } else {
    for (const mesure of resultat.mesures) {
      const valeurs = categories.map((cat) => {
        const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigné") === cat);
        return ligne ? (ligne[mesure] as number | null) : null;
      });
      series.push({ nom: libellesMesures[mesure] ?? mesure, valeurs });
    }
  }

  return { categories, series };
}

const SEUIL_ZOOM = 24;

const OPTION_BASE: Partial<EChartsOption> = {
  textStyle: { fontFamily: POLICE_GRAPHIQUE, color: COULEURS_GRAPHIQUE.texte },
  tooltip: { ...INFOBULLE_GRAPHIQUE, trigger: "axis" },
  legend: LEGENDE_GRAPHIQUE,
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
    return { title: { text: "Aucune donnée", left: "center", top: "middle", textStyle: { fontSize: 13, color: COULEURS_GRAPHIQUE.discret } } };
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

  const axeCategories = {
    type: "category" as const,
    data: categories,
    ...STYLE_AXE_CATEGORIES,
    axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte, interval: 0, hideOverlap: true, rotate: categories.length > 8 && !horizontal ? 30 : 0 }
  };
  const axeValeurs = { type: "value" as const, ...STYLE_AXE_VALEURS, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret } };
  // Longue serie (> SEUIL_ZOOM categories) : zoom molette/glisser + curseur
  // de defilement au-dessus de la legende, sinon l'axe X devient illisible.
  const zoom = categories.length > SEUIL_ZOOM && !horizontal;

  return {
    ...OPTION_BASE,
    grid: { ...OPTION_BASE.grid, bottom: zoom ? 62 : 36 },
    dataZoom: zoom
      ? [{ type: "inside" }, { type: "slider", height: 14, bottom: 26, start: 0, end: Math.min(100, (SEUIL_ZOOM / categories.length) * 100) }]
      : undefined,
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
            barMaxWidth: 56,
            emphasis: { focus: "series" }
          }
    )
  };
}

function construireOptionCombo(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dimX] = resultat.dimensions;
  const categories: string[] = [];
  for (const ligne of resultat.lignes) {
    const val = String(ligne[dimX] ?? "Non renseigné");
    if (!categories.includes(val)) categories.push(val);
  }
  const [mesurePrincipale, ...mesuresSecondaires] = resultat.mesures;

  const valeursPour = (mesure: string) => categories.map((cat) => {
    const ligne = resultat.lignes.find((l) => String(l[dimX] ?? "Non renseigné") === cat);
    return ligne ? (ligne[mesure] as number | null) : null;
  });

  return {
    ...OPTION_BASE,
    color: PALETTE,
    xAxis: { type: "category", data: categories, ...STYLE_AXE_CATEGORIES, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte, interval: 0, rotate: categories.length > 8 ? 30 : 0 } },
    yAxis: [
      { type: "value", name: libellesMesures[mesurePrincipale] ?? mesurePrincipale, ...STYLE_AXE_VALEURS, nameTextStyle: { color: COULEURS_GRAPHIQUE.discret }, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret } },
      { type: "value", name: mesuresSecondaires.map((m) => libellesMesures[m] ?? m).join(", "), ...STYLE_AXE_VALEURS, splitLine: { show: false }, nameTextStyle: { color: COULEURS_GRAPHIQUE.discret }, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret } }
    ],
    series: [
      { name: libellesMesures[mesurePrincipale] ?? mesurePrincipale, type: "bar", data: valeursPour(mesurePrincipale), yAxisIndex: 0, barMaxWidth: 56 },
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
    textStyle: { fontFamily: POLICE_GRAPHIQUE, color: COULEURS_GRAPHIQUE.texte },
    tooltip: { ...INFOBULLE_GRAPHIQUE, trigger: "item" },
    legend: LEGENDE_GRAPHIQUE,
    color: PALETTE,
    series: [
      {
        name: libellesMesures[mesure] ?? mesure,
        type: "pie",
        radius: type === "anneau" ? ["40%", "64%"] : "64%",
        center: ["50%", "45%"],
        data: resultat.lignes.map((l) => ({ name: String(l[dim] ?? "Non renseigné"), value: l[mesure] as number })),
        label: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte, edgeDistance: 4 },
        itemStyle: { borderColor: COULEURS_GRAPHIQUE.fond, borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } }
      }
    ]
  };
}

function construireOptionNuage(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dim] = resultat.dimensions;
  const [mesureX, mesureY] = resultat.mesures;
  if (!mesureY) {
    return { title: { text: "Un nuage de points demande 2 mesures (X et Y)", left: "center", top: "middle", textStyle: { fontSize: 12.5, color: COULEURS_GRAPHIQUE.discret } } };
  }
  return {
    ...OPTION_BASE,
    tooltip: {
      ...INFOBULLE_GRAPHIQUE,
      trigger: "item",
      formatter: (parametres) => {
        const p = parametres as unknown as { data: [number, number]; name: string };
        return `${p.name}<br/>${libellesMesures[mesureX] ?? mesureX} : ${p.data[0]}<br/>${libellesMesures[mesureY] ?? mesureY} : ${p.data[1]}`;
      }
    },
    xAxis: { type: "value", name: libellesMesures[mesureX] ?? mesureX, ...STYLE_AXE_VALEURS, nameTextStyle: { color: COULEURS_GRAPHIQUE.discret }, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret } },
    yAxis: { type: "value", name: libellesMesures[mesureY] ?? mesureY, ...STYLE_AXE_VALEURS, nameTextStyle: { color: COULEURS_GRAPHIQUE.discret }, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret } },
    series: [
      {
        type: "scatter",
        symbolSize: 14,
        data: resultat.lignes.map((l) => ({ name: String(l[dim] ?? "Non renseigné"), value: [l[mesureX], l[mesureY]] })),
        itemStyle: { color: PALETTE[0] }
      }
    ]
  };
}

function construireOptionCarteChaleur(resultat: PivotResultat, libellesMesures: Record<string, string>): EChartsOption {
  const [dimX, dimY] = resultat.dimensions;
  const [mesure] = resultat.mesures;
  if (!dimY) {
    return { title: { text: "Une carte de chaleur demande 2 dimensions", left: "center", top: "middle", textStyle: { fontSize: 12.5, color: COULEURS_GRAPHIQUE.discret } } };
  }
  const categoriesX: string[] = [];
  const categoriesY: string[] = [];
  for (const ligne of resultat.lignes) {
    const vx = String(ligne[dimX] ?? "Non renseigné");
    const vy = String(ligne[dimY] ?? "Non renseigné");
    if (!categoriesX.includes(vx)) categoriesX.push(vx);
    if (!categoriesY.includes(vy)) categoriesY.push(vy);
  }
  const donnees = resultat.lignes.map((l) => [
    categoriesX.indexOf(String(l[dimX] ?? "Non renseigné")),
    categoriesY.indexOf(String(l[dimY] ?? "Non renseigné")),
    l[mesure] as number
  ]);
  const valeurs = donnees.map((d) => d[2] as number);

  return {
    textStyle: { fontFamily: POLICE_GRAPHIQUE, color: COULEURS_GRAPHIQUE.texte },
    tooltip: { ...INFOBULLE_GRAPHIQUE, position: "top" },
    grid: { top: 24, left: 8, right: 16, bottom: 60, containLabel: true },
    xAxis: { type: "category", data: categoriesX, splitArea: { show: true }, ...STYLE_AXE_CATEGORIES, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte, interval: 0, rotate: 30 } },
    yAxis: { type: "category", data: categoriesY, splitArea: { show: true }, ...STYLE_AXE_CATEGORIES, axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte } },
    visualMap: {
      min: Math.min(0, ...valeurs),
      max: Math.max(1, ...valeurs),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte },
      inRange: { color: ["#E7F3EE", "#A8D5BF", "#0B7A57"] }
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
