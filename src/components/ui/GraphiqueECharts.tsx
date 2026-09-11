import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

// Import selectif (pas `import * as echarts from "echarts"`) : seuls les
// types de graphiques reellement utilises par le constructeur (voir
// apps.statistiques.models.WidgetGraphique.TypeGraphique cote backend)
// sont embarques dans le bundle - une bibliotheque ECharts complete pese
// plusieurs Mo, incompatible avec la contrainte de legerete de la PWA
// terrain (voir le commentaire sur le lazy-loading dans App.tsx).
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  DataZoomComponent,
  CanvasRenderer
]);

interface ProprietesGraphiqueECharts {
  option: EChartsOption;
  hauteur?: number | string;
}

export default function GraphiqueECharts({ option, hauteur = 320 }: ProprietesGraphiqueECharts) {
  const refConteneur = useRef<HTMLDivElement>(null);
  const refInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!refConteneur.current) return;
    const instance = echarts.init(refConteneur.current);
    refInstance.current = instance;

    const observateur = new ResizeObserver(() => instance.resize());
    observateur.observe(refConteneur.current);

    return () => {
      observateur.disconnect();
      instance.dispose();
      refInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refInstance.current?.setOption(option, true);
  }, [option]);

  return <div ref={refConteneur} style={{ width: "100%", height: hauteur }} />;
}
