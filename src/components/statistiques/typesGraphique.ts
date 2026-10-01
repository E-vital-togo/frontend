import {
  AreaChart,
  BarChart3,
  BarChartHorizontal,
  ChartColumnStacked,
  ChartNoAxesCombined,
  Donut,
  Grid3x3,
  LineChart,
  Map as IconeCarte,
  PieChart,
  ScatterChart,
  type LucideIcon
} from "lucide-react";
import type { TypeGraphiqueStat } from "../../types/domaine";

export interface TypeGraphique {
  code: TypeGraphiqueStat;
  label: string;
  icone: LucideIcon;
  /** Ce que le type demande pour se dessiner correctement (affiche sous le choix). */
  exigence?: string;
}

/** Types de graphiques proposes par le constructeur (miroir de WidgetGraphique.TypeGraphique cote backend). */
export const TYPES_GRAPHIQUE: TypeGraphique[] = [
  { code: "barres", label: "Barres", icone: BarChart3 },
  { code: "barres_empilees", label: "Barres empilées", icone: ChartColumnStacked, exigence: "Utile avec 2 dimensions : la seconde forme les couches." },
  { code: "barres_horizontales", label: "Barres horizontales", icone: BarChartHorizontal },
  { code: "courbes", label: "Courbes", icone: LineChart, exigence: "Idéal avec une dimension temporelle en axe X." },
  { code: "aires_empilees", label: "Aires empilées", icone: AreaChart, exigence: "Idéal avec une dimension temporelle en axe X." },
  { code: "camembert", label: "Camembert", icone: PieChart, exigence: "Une dimension et une mesure." },
  { code: "anneau", label: "Anneau", icone: Donut, exigence: "Une dimension et une mesure." },
  { code: "combo", label: "Combo (double axe)", icone: ChartNoAxesCombined, exigence: "Demande 2 mesures : barres pour la première, courbe pour la suivante." },
  { code: "nuage_points", label: "Nuage de points", icone: ScatterChart, exigence: "Demande 2 mesures (axe X et axe Y)." },
  { code: "carte_chaleur", label: "Carte de chaleur", icone: Grid3x3, exigence: "Demande 2 dimensions et une mesure." },
  { code: "carte", label: "Carte géographique", icone: IconeCarte, exigence: "Première dimension territoriale : région, préfecture ou commune." }
];

export function typeGraphique(code: TypeGraphiqueStat): TypeGraphique {
  return TYPES_GRAPHIQUE.find((t) => t.code === code) ?? TYPES_GRAPHIQUE[0];
}
