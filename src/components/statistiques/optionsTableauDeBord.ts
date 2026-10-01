import type { EChartsOption } from "echarts";
import { COULEURS_GRAPHIQUE, INFOBULLE_GRAPHIQUE, LEGENDE_GRAPHIQUE, PALETTE, POLICE_GRAPHIQUE } from "../../lib/graphiques";
import type { StatistiqueEvolutionReponse, StatistiqueRepartitionItem } from "../../types/domaine";

// Options ECharts des graphiques de la vue d'ensemble de la zone (admin CEC).
// Couleurs en hexadecimal : le canvas ne lit pas les variables CSS ; ce sont
// les valeurs des jetons de theme.css (voir aussi PALETTE dans lib/graphiques).

// sans_suite est un dossier CLOS (plus d'echeance active), pas un dossier
// urgent : gris neutre ici, pour ne pas se confondre avec le rouge
// "presque expire" des echeances.
const COULEUR_PAR_STATUT: Record<string, string> = {
  recu: "#8AA69B",
  notifie: "#2E6F95",
  en_attente_complement: "#A8BB1E",
  complete: "#16B37D",
  acte_emis: "#0B7A57",
  sans_suite: "#B7C0BA",
  non_renseigne: "#DDE3DC"
};

const COULEUR_PAR_SERIE: Record<string, string> = {
  naissance: "#0B7A57",
  deces: "#40534B"
};

const LIBELLE_PAR_SERIE: Record<string, string> = {
  naissance: "Naissances",
  deces: "Décès"
};

const formatNombre = new Intl.NumberFormat("fr-FR");
const TEXTE_BASE = { fontFamily: POLICE_GRAPHIQUE, color: COULEURS_GRAPHIQUE.texte };

export function optionRepartitionStatut(donnees: StatistiqueRepartitionItem[], total: number): EChartsOption {
  return {
    textStyle: TEXTE_BASE,
    tooltip: { ...INFOBULLE_GRAPHIQUE, trigger: "item", formatter: "{b}<br/><b>{c}</b> dossiers ({d} %)" },
    legend: LEGENDE_GRAPHIQUE,
    title: {
      text: formatNombre.format(total),
      subtext: total > 1 ? "dossiers" : "dossier",
      left: "center",
      top: "35%",
      itemGap: 2,
      textStyle: { fontSize: 26, fontWeight: 600, color: COULEURS_GRAPHIQUE.encre, fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' },
      subtextStyle: { fontSize: 12, color: COULEURS_GRAPHIQUE.discret, fontFamily: POLICE_GRAPHIQUE }
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "74%"],
        center: ["50%", "43%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: COULEURS_GRAPHIQUE.fond, borderWidth: 3, borderRadius: 4 },
        emphasis: { scaleSize: 4 },
        data: donnees.map((entree) => ({
          name: entree.libelle,
          value: entree.valeur,
          itemStyle: { color: COULEUR_PAR_STATUT[entree.cle] ?? "#8AA69B" }
        }))
      }
    ]
  };
}

/** Hauteur adaptee au nombre de mairies : une barre lisible par ligne, bornee. */
export function hauteurRepartitionMairie(nombre: number): number {
  return Math.min(520, Math.max(260, nombre * 34 + 40));
}

export function optionRepartitionMairie(donnees: StatistiqueRepartitionItem[]): EChartsOption {
  const tries = [...donnees].sort((a, b) => b.valeur - a.valeur);
  return {
    textStyle: TEXTE_BASE,
    tooltip: { ...INFOBULLE_GRAPHIQUE, trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 8, left: 8, right: 44, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret },
      splitLine: { lineStyle: { color: COULEURS_GRAPHIQUE.grille, type: "dashed" } }
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: tries.map((entree) => entree.libelle),
      axisLine: { lineStyle: { color: COULEURS_GRAPHIQUE.axe } },
      axisTick: { show: false },
      axisLabel: { fontSize: 12, color: COULEURS_GRAPHIQUE.texte, width: 150, overflow: "truncate" }
    },
    series: [
      {
        name: "Dossiers",
        type: "bar",
        data: tries.map((entree) => entree.valeur),
        barMaxWidth: 22,
        itemStyle: { color: PALETTE[0], borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", fontSize: 11.5, color: COULEURS_GRAPHIQUE.texte, fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace' },
        emphasis: { itemStyle: { color: "#086346" } }
      }
    ]
  };
}

function libellePeriode(periode: string): string {
  if (/^\d{4}-\d{2}$/.test(periode)) {
    const [annee, mois] = periode.split("-").map(Number);
    return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  return periode;
}

export function optionEvolution(evolution: StatistiqueEvolutionReponse): EChartsOption {
  return {
    textStyle: TEXTE_BASE,
    tooltip: { ...INFOBULLE_GRAPHIQUE, trigger: "axis" },
    legend: evolution.series.length > 1 ? LEGENDE_GRAPHIQUE : undefined,
    grid: { top: 16, left: 8, right: 16, bottom: evolution.series.length > 1 ? 36 : 8, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: evolution.donnees.map((point) => libellePeriode(point.periode)),
      axisLine: { lineStyle: { color: COULEURS_GRAPHIQUE.axe } },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.texte }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: COULEURS_GRAPHIQUE.discret },
      splitLine: { lineStyle: { color: COULEURS_GRAPHIQUE.grille, type: "dashed" } }
    },
    series: evolution.series.map((serie, index) => {
      const couleur = COULEUR_PAR_SERIE[serie] ?? PALETTE[index % PALETTE.length];
      return {
        name: LIBELLE_PAR_SERIE[serie] ?? serie,
        type: "line" as const,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: evolution.donnees.length <= 24,
        lineStyle: { width: 2.5, color: couleur },
        itemStyle: { color: couleur, borderColor: COULEURS_GRAPHIQUE.fond, borderWidth: 2 },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${couleur}33` },
              { offset: 1, color: `${couleur}05` }
            ]
          }
        },
        emphasis: { focus: "series" as const },
        data: evolution.donnees.map((point) => (typeof point[serie] === "number" ? point[serie] : null))
      };
    })
  };
}
