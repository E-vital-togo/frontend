import { AreaChart, BarChart3, LineChart, PieChart } from "lucide-react";

export type TypeGraphique = "barres" | "circulaire" | "ligne" | "aire";

const OPTIONS: Array<{ valeur: TypeGraphique; libelle: string; Icone: typeof BarChart3 }> = [
  { valeur: "barres", libelle: "Barres", Icone: BarChart3 },
  { valeur: "circulaire", libelle: "Circulaire", Icone: PieChart },
  { valeur: "ligne", libelle: "Ligne", Icone: LineChart },
  { valeur: "aire", libelle: "Aire", Icone: AreaChart }
];

interface ProprietesSelecteurType {
  valeur: TypeGraphique;
  onChange: (type: TypeGraphique) => void;
  /** Types desactives pour la vue courante (ex: circulaire n'a pas de sens pour une evolution multi-series). */
  desactives?: TypeGraphique[];
}

export default function SelecteurTypeGraphique({ valeur, onChange, desactives = [] }: ProprietesSelecteurType) {
  return (
    <div className="groupe-segmente" role="group" aria-label="Type de graphique">
      {OPTIONS.map(({ valeur: v, libelle, Icone }) => (
        <button
          key={v}
          type="button"
          aria-pressed={valeur === v}
          disabled={desactives.includes(v)}
          onClick={() => onChange(v)}
          title={libelle}
        >
          <Icone size={14} />
          {libelle}
        </button>
      ))}
    </div>
  );
}
