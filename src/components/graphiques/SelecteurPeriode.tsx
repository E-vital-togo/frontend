import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import type { FiltrePeriode } from "../../services/statistiquesService";

type PresetPeriode = "7j" | "30j" | "mois_courant" | "personnalise";

const PRESETS: Array<{ valeur: PresetPeriode; libelle: string }> = [
  { valeur: "7j", libelle: "7 derniers jours" },
  { valeur: "30j", libelle: "30 derniers jours" },
  { valeur: "mois_courant", libelle: "Ce mois-ci" },
  { valeur: "personnalise", libelle: "Personnalisee" }
];

function isoJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calculerPeriode(preset: PresetPeriode): FiltrePeriode {
  const aujourdHui = new Date();
  if (preset === "7j") {
    const debut = new Date(aujourdHui);
    debut.setDate(debut.getDate() - 6);
    return { dateDebut: isoJour(debut), dateFin: isoJour(aujourdHui) };
  }
  if (preset === "30j") {
    const debut = new Date(aujourdHui);
    debut.setDate(debut.getDate() - 29);
    return { dateDebut: isoJour(debut), dateFin: isoJour(aujourdHui) };
  }
  if (preset === "mois_courant") {
    const debut = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1);
    return { dateDebut: isoJour(debut), dateFin: isoJour(aujourdHui) };
  }
  return {};
}

interface ProprietesSelecteurPeriode {
  onChange: (periode: FiltrePeriode) => void;
}

export default function SelecteurPeriode({ onChange }: ProprietesSelecteurPeriode) {
  const [preset, setPreset] = useState<PresetPeriode>("30j");
  const [personnaliseDebut, setPersonnaliseDebut] = useState(isoJour(new Date(Date.now() - 29 * 86400000)));
  const [personnaliseFin, setPersonnaliseFin] = useState(isoJour(new Date()));

  useEffect(() => {
    if (preset === "personnalise") {
      onChange({ dateDebut: personnaliseDebut, dateFin: personnaliseFin });
    } else {
      onChange(calculerPeriode(preset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, personnaliseDebut, personnaliseFin]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Calendar size={15} style={{ color: "var(--couleur-gris-service-2)" }} />
      <select className="selecteur-simple" value={preset} onChange={(e) => setPreset(e.target.value as PresetPeriode)}>
        {PRESETS.map((p) => (
          <option key={p.valeur} value={p.valeur}>
            {p.libelle}
          </option>
        ))}
      </select>
      {preset === "personnalise" && (
        <>
          <input
            type="date"
            className="selecteur-simple"
            value={personnaliseDebut}
            max={personnaliseFin}
            onChange={(e) => setPersonnaliseDebut(e.target.value)}
          />
          <span style={{ color: "var(--couleur-gris-service-2)", fontSize: 13 }}>au</span>
          <input
            type="date"
            className="selecteur-simple"
            value={personnaliseFin}
            min={personnaliseDebut}
            max={isoJour(new Date())}
            onChange={(e) => setPersonnaliseFin(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
