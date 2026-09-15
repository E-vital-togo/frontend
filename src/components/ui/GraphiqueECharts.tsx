import { useEffect, useRef, useState } from "react";
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

// Preference "legende visible" partagee par tous les graphiques du
// navigateur : sur un petit ecran ou un widget etroit, la legende du bas
// chevauche les libelles de l'axe X - l'utilisateur la masque une fois,
// le choix tient pour les suivants (meme cle que cote INSEED, voir
// templates/admin_inseed/_graphiques_avances.html).
const CLE_LEGENDE = "evital.legende.visible";

function lireLegendeVisible(): boolean {
  try {
    return window.localStorage.getItem(CLE_LEGENDE) !== "0";
  } catch {
    return true;
  }
}

function memoriserLegendeVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(CLE_LEGENDE, visible ? "1" : "0");
  } catch {
    // stockage indisponible (navigation privee...) : preference non memorisee, sans consequence
  }
}

interface ProprietesGraphiqueECharts {
  option: EChartsOption;
  hauteur?: number | string;
  /** Bouton discret (coin bas droit) pour masquer/afficher la legende. Actif par defaut. */
  legendeMasquable?: boolean;
}

export default function GraphiqueECharts({ option, hauteur = 320, legendeMasquable = true }: ProprietesGraphiqueECharts) {
  const refConteneur = useRef<HTMLDivElement>(null);
  const refInstance = useRef<echarts.ECharts | null>(null);
  const [legendeVisible, setLegendeVisible] = useState<boolean>(lireLegendeVisible);

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
    // setOption(option, true) remet legend.show a sa valeur d'origine :
    // re-appliquer le masquage en fusion (ne touche qu'a legend.show).
    if (!legendeVisible) refInstance.current?.setOption({ legend: { show: false } });
  }, [option, legendeVisible]);

  // Pas de bouton sur un graphique sans legende (carte de chaleur, nuage...).
  const legende = option.legend;
  const aUneLegende = Array.isArray(legende) ? legende.length > 0 : !!legende && legende.show !== false;

  function basculerLegende() {
    const suivant = !legendeVisible;
    memoriserLegendeVisible(suivant);
    setLegendeVisible(suivant);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: hauteur }}>
      <div ref={refConteneur} style={{ width: "100%", height: "100%" }} />
      {legendeMasquable && aUneLegende && (
        <button
          type="button"
          onClick={basculerLegende}
          title={legendeVisible ? "Masquer la légende" : "Afficher la légende"}
          style={{
            position: "absolute",
            right: 4,
            bottom: 2,
            zIndex: 2,
            fontSize: 10.5,
            lineHeight: 1,
            padding: "3px 7px",
            border: "1px solid var(--bordure, #C9D2C6)",
            borderRadius: 10,
            background: "rgba(255,255,255,0.9)",
            color: "var(--gris-1, #40534B)",
            cursor: "pointer",
            opacity: 0.75
          }}
        >
          {legendeVisible ? "Légende ▾" : "Légende ▸"}
        </button>
      )}
    </div>
  );
}
