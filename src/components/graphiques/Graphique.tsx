import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { TypeGraphique } from "./SelecteurTypeGraphique";

export interface DonneeCategorielle {
  cle: string;
  libelle: string;
  valeur: number;
  couleur: string;
}

export interface SerieTemporelle {
  cle: string;
  libelle: string;
  couleur: string;
}

const STYLE_AXE = { fontSize: 11, fill: "#6B7A73", fontFamily: "var(--police-titrage)" };

function InfoBulle({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="info-bulle-graphique">
      {label && <div className="titre">{label}</div>}
      {payload.map((entree: any) => (
        <div className="ligne" key={entree.dataKey ?? entree.name}>
          <span className="puce" style={{ background: entree.color ?? entree.payload?.couleur }} />
          <span>{entree.name}</span> : <strong>{entree.value.toLocaleString("fr-FR")}</strong>
        </div>
      ))}
    </div>
  );
}

/** Legende personnalisee (une couleur par CATEGORIE, pas par cle recharts : indispensable pour les graphiques categoriels ou chaque barre/secteur a sa propre teinte). */
function LegendeCategorielle({ donnees }: { donnees: DonneeCategorielle[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10, justifyContent: "center" }}>
      {donnees.map((d) => (
        <div key={d.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--couleur-gris-service-1)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.couleur, display: "inline-block" }} />
          {d.libelle}
        </div>
      ))}
    </div>
  );
}

interface ProprietesGraphiqueCategoriel {
  mode: "categoriel";
  type: TypeGraphique;
  donnees: DonneeCategorielle[];
}

interface ProprietesGraphiqueTemporel {
  mode: "temporel";
  type: TypeGraphique;
  donnees: Array<Record<string, string | number>>;
  cleX: string;
  series: SerieTemporelle[];
  formatX?: (valeur: string) => string;
}

type ProprietesGraphique = ProprietesGraphiqueCategoriel | ProprietesGraphiqueTemporel;

/**
 * Rendu Recharts unique pour les deux familles de vues du tableau de
 * statistiques (voir TableauStatistiques.tsx) : "categoriel" (une valeur par
 * categorie - repartition) et "temporel" (une ou plusieurs series dans le
 * temps - evolution). Specs de trait fixes (barres <=24px arrondies, lignes
 * 2px, aires a 10% d'opacite, grille en trait plein recessif) : voir la
 * skill dataviz, references/marks-and-anatomy.md.
 */
export default function Graphique(props: ProprietesGraphique) {
  const hauteur = 320;

  if (props.mode === "categoriel") {
    const { type, donnees } = props;

    if (donnees.length === 0) return null;

    if (type === "circulaire") {
      return (
        <div>
          <ResponsiveContainer width="100%" height={hauteur}>
            <PieChart>
              <Pie data={donnees} dataKey="valeur" nameKey="libelle" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {donnees.map((d) => (
                  <Cell key={d.cle} fill={d.couleur} stroke="var(--couleur-papier)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<InfoBulle />} />
            </PieChart>
          </ResponsiveContainer>
          <LegendeCategorielle donnees={donnees} />
        </div>
      );
    }

    if (type === "ligne" || type === "aire") {
      const Conteneur = type === "aire" ? AreaChart : LineChart;
      return (
        <div>
          <ResponsiveContainer width="100%" height={hauteur}>
            <Conteneur data={donnees} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E2E7DF" />
              <XAxis dataKey="libelle" tick={STYLE_AXE} axisLine={{ stroke: "#C9D2C6" }} tickLine={false} />
              <YAxis tick={STYLE_AXE} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<InfoBulle />} />
              {type === "aire" ? (
                <Area
                  dataKey="valeur"
                  stroke="#2a78d6"
                  fill="#2a78d6"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#2a78d6", stroke: "var(--couleur-papier)", strokeWidth: 2 }}
                  name="Total"
                />
              ) : (
                <Line
                  dataKey="valeur"
                  stroke="#2a78d6"
                  strokeWidth={2}
                  dot={(dotProps: any) => (
                    <circle
                      key={dotProps.payload.cle}
                      cx={dotProps.cx}
                      cy={dotProps.cy}
                      r={4}
                      fill={dotProps.payload.couleur}
                      stroke="var(--couleur-papier)"
                      strokeWidth={2}
                    />
                  )}
                  name="Total"
                />
              )}
            </Conteneur>
          </ResponsiveContainer>
          <LegendeCategorielle donnees={donnees} />
        </div>
      );
    }

    // barres (defaut)
    return (
      <div>
        <ResponsiveContainer width="100%" height={hauteur}>
          <BarChart data={donnees} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E2E7DF" />
            <XAxis dataKey="libelle" tick={STYLE_AXE} axisLine={{ stroke: "#C9D2C6" }} tickLine={false} />
            <YAxis tick={STYLE_AXE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<InfoBulle />} cursor={{ fill: "rgba(11,122,87,0.04)" }} />
            <Bar dataKey="valeur" radius={[4, 4, 0, 0]} maxBarSize={40} name="Total">
              {donnees.map((d) => (
                <Cell key={d.cle} fill={d.couleur} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <LegendeCategorielle donnees={donnees} />
      </div>
    );
  }

  // --- mode temporel ---
  const { type, donnees, cleX, series, formatX } = props;
  if (donnees.length === 0) return null;
  const afficherLegende = series.length >= 2;

  const axeX = (
    <XAxis
      dataKey={cleX}
      tick={STYLE_AXE}
      axisLine={{ stroke: "#C9D2C6" }}
      tickLine={false}
      tickFormatter={formatX}
    />
  );
  const axeY = <YAxis tick={STYLE_AXE} axisLine={false} tickLine={false} allowDecimals={false} />;
  const grille = <CartesianGrid vertical={false} stroke="#E2E7DF" />;
  const infoBulle = <Tooltip content={<InfoBulle />} />;
  const legende = afficherLegende ? <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /> : null;

  if (type === "circulaire") {
    // Pas de sens pour une serie temporelle : repli sur le total de la periode, a titre de vue "part du total".
    const dernierPoint = donnees[donnees.length - 1];
    const donneesPie: DonneeCategorielle[] = series.map((s) => ({
      cle: s.cle,
      libelle: s.libelle,
      valeur: Number(dernierPoint[s.cle] ?? 0),
      couleur: s.couleur
    }));
    return <Graphique mode="categoriel" type="circulaire" donnees={donneesPie} />;
  }

  if (type === "ligne") {
    return (
      <ResponsiveContainer width="100%" height={hauteur}>
        <LineChart data={donnees} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {grille}
          {axeX}
          {axeY}
          {infoBulle}
          {legende}
          {series.map((s) => (
            <Line
              key={s.cle}
              dataKey={s.cle}
              name={s.libelle}
              stroke={s.couleur}
              strokeWidth={2}
              dot={{ r: 4, fill: s.couleur, stroke: "var(--couleur-papier)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "aire") {
    return (
      <ResponsiveContainer width="100%" height={hauteur}>
        <AreaChart data={donnees} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {grille}
          {axeX}
          {axeY}
          {infoBulle}
          {legende}
          {series.map((s) => (
            <Area
              key={s.cle}
              dataKey={s.cle}
              name={s.libelle}
              stroke={s.couleur}
              fill={s.couleur}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // barres (defaut) : groupees, jamais empilees par defaut (chaque serie reste lisible independamment)
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={donnees} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        {grille}
        {axeX}
        {axeY}
        {infoBulle}
        {legende}
        {series.map((s) => (
          <Bar key={s.cle} dataKey={s.cle} name={s.libelle} fill={s.couleur} radius={[4, 4, 0, 0]} maxBarSize={24} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
