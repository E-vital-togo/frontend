import type { ReactNode } from "react";
import { PALETTES, etapesPalette, parametresCarte, type ParametresCarte } from "../lib/carte";

interface ProprietesPanneauStyleCarte {
  valeur: Partial<ParametresCarte>;
  onChange: (suivant: Partial<ParametresCarte>) => void;
  /** Nom du territoire administre (admin CEC) : propose "Ma zone" en plus de la carte entiere. */
  nomZone?: string | null;
}

const COULEURS_PERSO_DEFAUT = ["#E6F2EC", "#4FA37F", "#064D37"];
const styleLigne = { display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 8, alignItems: "flex-end" };
const styleLabel = { fontSize: 12, fontWeight: 600 as const, display: "block", marginBottom: 3 };

function Section({ titre, ouvert = false, children }: { titre: string; ouvert?: boolean; children: ReactNode }) {
  return (
    <details open={ouvert} style={{ borderTop: "1px solid var(--couleur-bordure, #E2E7DF)", padding: "8px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{titre}</summary>
      <div style={{ paddingTop: 6 }}>{children}</div>
    </details>
  );
}

function Couleur({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: "1 1 120px" }}>
      <span style={styleLabel}>{label}</span>
      <input type="color" value={valeur} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ width: "100%", height: 30, padding: 2 }} />
    </div>
  );
}

function Case({ label, coche, onChange, aide }: { label: string; coche: boolean; onChange: (v: boolean) => void; aide?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6 }} title={aide}>
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * Reglages d'apparence d'une carte : zone, couleurs et classes, contours,
 * etiquettes, bulles, legende et habillage. Chaque modification est
 * immediatement rendue par GraphiqueCarte ; rien n'est enregistre tant que
 * l'utilisateur n'enregistre pas le graphique.
 */
export default function PanneauStyleCarte({ valeur, onChange, nomZone }: ProprietesPanneauStyleCarte) {
  const p = parametresCarte(valeur);
  const maj = (partiel: Partial<ParametresCarte>) => onChange({ ...valeur, ...partiel });
  const majSeuils = (texte: string) =>
    maj({
      seuils: texte
        .split(/[;,\s]+/)
        .map(Number)
        .filter((n) => texte.trim() !== "" && Number.isFinite(n))
    });

  return (
    <div style={{ marginBottom: 14 }}>
      <Section titre="Zone affichée" ouvert>
        <div style={styleLigne}>
          <div style={{ flex: "1 1 200px" }}>
            <span style={styleLabel}>Territoire représenté</span>
            <select value={p.portee} onChange={(e) => maj({ portee: e.target.value as ParametresCarte["portee"] })} style={{ width: "100%" }}>
              {nomZone !== null && <option value="zone">Ma zone{nomZone ? ` : ${nomZone}` : ""} (carte partielle)</option>}
              <option value="nationale">Pays entier{nomZone ? " (ma zone en évidence)" : ""}</option>
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <span style={styleLabel}>Représentation</span>
            <select value={p.mode} onChange={(e) => maj({ mode: e.target.value as ParametresCarte["mode"] })} style={{ width: "100%" }}>
              <option value="aplat">Zones colorées</option>
              <option value="bulles">Bulles proportionnelles</option>
              <option value="aplat_bulles">Zones et bulles</option>
            </select>
          </div>
        </div>
      </Section>

      <Section titre="Couleurs et classes" ouvert>
        <div style={styleLigne}>
          <div style={{ flex: "1 1 180px" }}>
            <span style={styleLabel}>Palette</span>
            <select value={p.palette} onChange={(e) => maj({ palette: e.target.value, couleurs: e.target.value === "personnalisee" && p.couleurs.length !== 3 ? COULEURS_PERSO_DEFAUT : p.couleurs })} style={{ width: "100%" }}>
              {Object.entries(PALETTES).map(([code, { label }]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
              <option value="personnalisee">Personnalisée</option>
            </select>
          </div>
          <div style={{ flex: "0 0 120px" }}>
            <span style={styleLabel}>Classes</span>
            <select
              value={p.methode_classes === "manuel" ? "manuel" : p.classes}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "manuel") maj({ methode_classes: "manuel", classes: 0 });
                else maj({ classes: Number(v), methode_classes: p.methode_classes === "manuel" ? "egal" : p.methode_classes });
              }}
              style={{ width: "100%" }}
            >
              <option value={0}>Dégradé continu</option>
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} classes
                </option>
              ))}
              <option value="manuel">Seuils manuels</option>
            </select>
          </div>
        </div>

        <div
          aria-hidden
          style={{ height: 10, borderRadius: 3, marginBottom: 8, border: "1px solid var(--couleur-bordure, #E2E7DF)", background: `linear-gradient(90deg, ${etapesPalette(p).join(",")})` }}
        />

        {p.palette === "personnalisee" && (
          <div style={styleLigne}>
            {(["Faible", "Moyen", "Élevé"] as const).map((nom, i) => {
              const actuelles = p.couleurs.length === 3 ? p.couleurs : COULEURS_PERSO_DEFAUT;
              return (
                <Couleur
                  key={nom}
                  label={nom}
                  valeur={actuelles[i]}
                  onChange={(c) => maj({ couleurs: actuelles.map((x, k) => (k === i ? c : x)) })}
                />
              );
            })}
          </div>
        )}

        {p.classes >= 2 && p.methode_classes !== "manuel" && (
          <div style={{ marginBottom: 8 }}>
            <span style={styleLabel}>Découpage des classes</span>
            <select value={p.methode_classes} onChange={(e) => maj({ methode_classes: e.target.value as ParametresCarte["methode_classes"] })} style={{ width: "100%" }}>
              <option value="egal">Intervalles égaux</option>
              <option value="quantiles">Effectifs égaux (quantiles)</option>
            </select>
          </div>
        )}
        {p.methode_classes === "manuel" && (
          <div style={{ marginBottom: 8 }}>
            <span style={styleLabel}>Seuils (bornes inférieures, séparées par des virgules)</span>
            <input defaultValue={p.seuils.join(", ")} onBlur={(e) => majSeuils(e.target.value)} placeholder="Ex. 10, 50, 200" style={{ width: "100%" }} />
          </div>
        )}
        <Case label="Inverser la palette" coche={p.inverser_palette} onChange={(v) => maj({ inverser_palette: v })} />
        <div style={{ marginBottom: 4 }}>
          <span style={styleLabel}>Opacité des zones : {Math.round(p.opacite * 100)} %</span>
          <input type="range" min={0.2} max={1} step={0.05} value={p.opacite} onChange={(e) => maj({ opacite: Number(e.target.value) })} style={{ width: "100%" }} />
        </div>
      </Section>

      <Section titre="Contours et fond">
        <div style={styleLigne}>
          <Couleur label="Contours" valeur={p.contour_couleur} onChange={(v) => maj({ contour_couleur: v })} />
          <Couleur label="Survol" valeur={p.survol_couleur} onChange={(v) => maj({ survol_couleur: v })} />
          <Couleur label="Sans donnée" valeur={p.couleur_sans_donnee} onChange={(v) => maj({ couleur_sans_donnee: v })} />
          <Couleur label="Hors zone" valeur={p.couleur_hors_zone} onChange={(v) => maj({ couleur_hors_zone: v })} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={styleLabel}>Épaisseur des contours : {p.contour_epaisseur}</span>
          <input type="range" min={0} max={4} step={0.1} value={p.contour_epaisseur} onChange={(e) => maj({ contour_epaisseur: Number(e.target.value) })} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={styleLabel}>Fond de la carte</span>
          <select value={p.fond} onChange={(e) => maj({ fond: e.target.value as ParametresCarte["fond"] })} style={{ width: "100%" }}>
            <option value="blanc">Blanc</option>
            <option value="gris">Gris clair</option>
            <option value="eau">Bleu très clair</option>
          </select>
        </div>
      </Section>

      <Section titre="Étiquettes">
        <div style={styleLigne}>
          <div style={{ flex: "1 1 180px" }}>
            <span style={styleLabel}>Afficher</span>
            <select value={p.etiquettes} onChange={(e) => maj({ etiquettes: e.target.value as ParametresCarte["etiquettes"] })} style={{ width: "100%" }}>
              <option value="aucune">Aucune</option>
              <option value="noms">Noms des territoires</option>
              <option value="valeurs">Valeurs</option>
              <option value="noms_valeurs">Noms et valeurs</option>
            </select>
          </div>
          <div style={{ flex: "0 0 100px" }}>
            <span style={styleLabel}>Taille</span>
            <input type="number" min={7} max={18} value={p.taille_etiquettes} onChange={(e) => maj({ taille_etiquettes: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>
        </div>
      </Section>

      {p.mode !== "aplat" && (
        <Section titre="Bulles" ouvert>
          <div style={styleLigne}>
            <Couleur label="Couleur" valeur={p.bulles_couleur} onChange={(v) => maj({ bulles_couleur: v })} />
            <div style={{ flex: "1 1 100px" }}>
              <span style={styleLabel}>Taille min</span>
              <input type="number" min={2} max={30} value={p.bulles_taille_min} onChange={(e) => maj({ bulles_taille_min: Number(e.target.value) })} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <span style={styleLabel}>Taille max</span>
              <input type="number" min={8} max={80} value={p.bulles_taille_max} onChange={(e) => maj({ bulles_taille_max: Number(e.target.value) })} style={{ width: "100%" }} />
            </div>
          </div>
          <span style={styleLabel}>Opacité : {Math.round(p.bulles_opacite * 100)} %</span>
          <input type="range" min={0.1} max={1} step={0.05} value={p.bulles_opacite} onChange={(e) => maj({ bulles_opacite: Number(e.target.value) })} style={{ width: "100%" }} />
        </Section>
      )}

      <Section titre="Légende et habillage">
        <Case label="Afficher la légende" coche={p.legende} onChange={(v) => maj({ legende: v })} />
        {p.legende && (
          <div style={styleLigne}>
            <div style={{ flex: "1 1 160px" }}>
              <span style={styleLabel}>Position</span>
              <select value={p.legende_position} onChange={(e) => maj({ legende_position: e.target.value as ParametresCarte["legende_position"] })} style={{ width: "100%" }}>
                <option value="bas_gauche">Bas gauche</option>
                <option value="bas_droite">Bas droite</option>
                <option value="haut_gauche">Haut gauche</option>
                <option value="haut_droite">Haut droite</option>
              </select>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <span style={styleLabel}>Titre de la légende</span>
              <input value={p.legende_titre} onChange={(e) => maj({ legende_titre: e.target.value })} placeholder="Par défaut : la mesure" maxLength={80} style={{ width: "100%" }} />
            </div>
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <span style={styleLabel}>Titre de la carte</span>
          <input value={p.titre} onChange={(e) => maj({ titre: e.target.value })} maxLength={120} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={styleLabel}>Sous-titre</span>
          <input value={p.sous_titre} onChange={(e) => maj({ sous_titre: e.target.value })} maxLength={160} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <span style={styleLabel}>Source</span>
          <input value={p.source} onChange={(e) => maj({ source: e.target.value })} placeholder="Ex. E-VITAL, état civil, 2026" maxLength={160} style={{ width: "100%" }} />
        </div>
        <Case label="Échelle graphique" coche={p.echelle} onChange={(v) => maj({ echelle: v })} />
        <Case label="Flèche du nord" coche={p.nord} onChange={(v) => maj({ nord: v })} />
        <Case label="Coordonnées (quadrillage et position du curseur)" coche={p.coordonnees} onChange={(v) => maj({ coordonnees: v })} />
        <Case label="Zoom et déplacement à la souris" coche={p.zoom_libre} onChange={(v) => maj({ zoom_libre: v })} />
      </Section>
    </div>
  );
}
