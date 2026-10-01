import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Champ, Interrupteur, Selecteur } from "./ui";
import { PALETTES, couleurDegrade, etapesPalette, parametresCarte, type ParametresCarte } from "../lib/carte";

import "../styles/statistiques.css";

interface ProprietesPanneauStyleCarte {
  valeur: Partial<ParametresCarte>;
  onChange: (suivant: Partial<ParametresCarte>) => void;
  /** Nom du territoire administre (admin CEC) : propose "Ma zone" en plus de la carte entiere. */
  nomZone?: string | null;
}

const COULEURS_PERSO_DEFAUT = ["#E6F2EC", "#4FA37F", "#064D37"];

function Section({ titre, ouvert = false, children }: { titre: string; ouvert?: boolean; children: ReactNode }) {
  return (
    <details className="eva-st-style" open={ouvert}>
      <summary className="eva-st-style__titre">
        {titre}
        <ChevronDown size={16} className="eva-st-style__chevron" aria-hidden="true" />
      </summary>
      <div className="eva-st-style__corps">{children}</div>
    </details>
  );
}

function ChampCouleur({ id, label, valeur, onChange }: { id: string; label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div className="eva-st-couleur">
      <label htmlFor={id} className="eva-st-couleur__label">
        {label}
      </label>
      <div className="eva-st-couleur__controle">
        <input id={id} type="color" value={valeur} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span className="eva-st-couleur__code texte-mono">{valeur.toUpperCase()}</span>
      </div>
    </div>
  );
}

function Curseur({
  id,
  label,
  affichage,
  min,
  max,
  pas,
  valeur,
  onChange
}: {
  id: string;
  label: string;
  affichage: string;
  min: number;
  max: number;
  pas: number;
  valeur: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="eva-st-curseur">
      <div className="eva-st-curseur__entete">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="eva-st-curseur__valeur texte-mono">
          {affichage}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Previsualisation de la palette : degrade continu, ou pastilles des classes quand le decoupage est en classes. */
function ApercuPalette({ p }: { p: ParametresCarte }) {
  const etapes = etapesPalette(p);
  const nombreClasses = p.methode_classes === "manuel" ? Math.max(2, p.seuils.length + 1) : p.classes;
  const discret = nombreClasses >= 2;
  return (
    <div className="eva-st-apercu-palette">
      {discret ? (
        <div className="eva-st-apercu-palette__classes" aria-hidden="true">
          {Array.from({ length: nombreClasses }, (_, i) => (
            <span key={i} className="eva-st-apercu-palette__classe" style={{ background: couleurDegrade(i / (nombreClasses - 1), etapes) }} />
          ))}
        </div>
      ) : (
        <div className="eva-st-apercu-palette__degrade" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${etapes.join(",")})` }} />
      )}
      <div className="eva-st-apercu-palette__bornes" aria-hidden="true">
        <span>Faible</span>
        <span>Élevé</span>
      </div>
      <span className="eva-sr-only">{discret ? `${nombreClasses} classes, de la valeur la plus faible à la plus élevée` : "Dégradé continu, de la valeur la plus faible à la plus élevée"}</span>
    </div>
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
  const base = useId();
  const id = (nom: string) => `${base}-${nom}`;
  const actuelles = p.couleurs.length === 3 ? p.couleurs : COULEURS_PERSO_DEFAUT;

  function choisirPalette(code: string) {
    maj({ palette: code, couleurs: code === "personnalisee" && p.couleurs.length !== 3 ? COULEURS_PERSO_DEFAUT : p.couleurs });
  }

  return (
    <div className="eva-st-styles">
      <Section titre="Zone affichée" ouvert>
        <div className="eva-st-duo">
          <Champ id={id("portee")} label="Territoire représenté">
            <Selecteur id={id("portee")} valeur={p.portee} onChange={(v) => maj({ portee: v as ParametresCarte["portee"] })}>
              {nomZone !== null && <option value="zone">Ma zone{nomZone ? ` : ${nomZone}` : ""} (carte partielle)</option>}
              <option value="nationale">Pays entier{nomZone ? " (ma zone en évidence)" : ""}</option>
            </Selecteur>
          </Champ>
          <Champ id={id("mode")} label="Représentation">
            <Selecteur id={id("mode")} valeur={p.mode} onChange={(v) => maj({ mode: v as ParametresCarte["mode"] })}>
              <option value="aplat">Zones colorées</option>
              <option value="bulles">Bulles proportionnelles</option>
              <option value="aplat_bulles">Zones et bulles</option>
            </Selecteur>
          </Champ>
        </div>
      </Section>

      <Section titre="Couleurs et classes" ouvert>
        <div className="eva-st-palettes" role="radiogroup" aria-label="Palette de couleurs">
          {[...Object.entries(PALETTES).map(([code, { label, couleurs }]) => ({ code, label, couleurs })), { code: "personnalisee", label: "Personnalisée", couleurs: actuelles }].map(
            (palette) => (
              <label key={palette.code} className={`eva-st-palette${p.palette === palette.code ? " est-choisie" : ""}`}>
                <input type="radio" name={id("palette")} className="eva-sr-only" checked={p.palette === palette.code} onChange={() => choisirPalette(palette.code)} />
                <span className="eva-st-palette__degrade" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${palette.couleurs.join(",")})` }} />
                <span className="eva-st-palette__nom">{palette.label}</span>
              </label>
            )
          )}
        </div>

        {p.palette === "personnalisee" && (
          <div className="eva-st-trio">
            {(["Faible", "Moyen", "Élevé"] as const).map((nom, i) => (
              <ChampCouleur key={nom} id={id(`perso-${i}`)} label={nom} valeur={actuelles[i]} onChange={(c) => maj({ couleurs: actuelles.map((x, k) => (k === i ? c : x)) })} />
            ))}
          </div>
        )}

        <ApercuPalette p={p} />

        <div className="eva-st-duo">
          <Champ id={id("classes")} label="Classes">
            <Selecteur
              id={id("classes")}
              valeur={p.methode_classes === "manuel" ? "manuel" : String(p.classes)}
              onChange={(v) => {
                if (v === "manuel") maj({ methode_classes: "manuel", classes: 0 });
                else maj({ classes: Number(v), methode_classes: p.methode_classes === "manuel" ? "egal" : p.methode_classes });
              }}
            >
              <option value={0}>Dégradé continu</option>
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} classes
                </option>
              ))}
              <option value="manuel">Seuils manuels</option>
            </Selecteur>
          </Champ>
          {p.classes >= 2 && p.methode_classes !== "manuel" && (
            <Champ id={id("methode")} label="Découpage des classes">
              <Selecteur id={id("methode")} valeur={p.methode_classes} onChange={(v) => maj({ methode_classes: v as ParametresCarte["methode_classes"] })}>
                <option value="egal">Intervalles égaux</option>
                <option value="quantiles">Effectifs égaux (quantiles)</option>
              </Selecteur>
            </Champ>
          )}
        </div>
        {p.methode_classes === "manuel" && (
          <Champ id={id("seuils")} label="Seuils" aide="Bornes inférieures séparées par des virgules, par exemple 10, 50, 200.">
            <input id={id("seuils")} defaultValue={p.seuils.join(", ")} onBlur={(e) => majSeuils(e.target.value)} placeholder="Ex. 10, 50, 200" />
          </Champ>
        )}

        <Interrupteur checked={p.inverser_palette} onChange={(v) => maj({ inverser_palette: v })} label="Inverser la palette" />
        <Curseur id={id("opacite")} label="Opacité des zones" affichage={`${Math.round(p.opacite * 100)} %`} min={0.2} max={1} pas={0.05} valeur={p.opacite} onChange={(v) => maj({ opacite: v })} />
      </Section>

      <Section titre="Contours et fond">
        <div className="eva-st-duo">
          <ChampCouleur id={id("contour")} label="Contours" valeur={p.contour_couleur} onChange={(v) => maj({ contour_couleur: v })} />
          <ChampCouleur id={id("survol")} label="Survol" valeur={p.survol_couleur} onChange={(v) => maj({ survol_couleur: v })} />
          <ChampCouleur id={id("sans-donnee")} label="Sans donnée" valeur={p.couleur_sans_donnee} onChange={(v) => maj({ couleur_sans_donnee: v })} />
          <ChampCouleur id={id("hors-zone")} label="Hors zone" valeur={p.couleur_hors_zone} onChange={(v) => maj({ couleur_hors_zone: v })} />
        </div>
        <Curseur id={id("epaisseur")} label="Épaisseur des contours" affichage={String(p.contour_epaisseur)} min={0} max={4} pas={0.1} valeur={p.contour_epaisseur} onChange={(v) => maj({ contour_epaisseur: v })} />
        <Champ id={id("fond")} label="Fond de la carte">
          <Selecteur id={id("fond")} valeur={p.fond} onChange={(v) => maj({ fond: v as ParametresCarte["fond"] })}>
            <option value="blanc">Blanc</option>
            <option value="gris">Gris clair</option>
            <option value="eau">Bleu très clair</option>
          </Selecteur>
        </Champ>
      </Section>

      <Section titre="Étiquettes">
        <div className="eva-st-duo">
          <Champ id={id("etiquettes")} label="Afficher">
            <Selecteur id={id("etiquettes")} valeur={p.etiquettes} onChange={(v) => maj({ etiquettes: v as ParametresCarte["etiquettes"] })}>
              <option value="aucune">Aucune</option>
              <option value="noms">Noms des territoires</option>
              <option value="valeurs">Valeurs</option>
              <option value="noms_valeurs">Noms et valeurs</option>
            </Selecteur>
          </Champ>
          <Champ id={id("taille-etiquettes")} label="Taille du texte">
            <input id={id("taille-etiquettes")} type="number" min={7} max={18} value={p.taille_etiquettes} onChange={(e) => maj({ taille_etiquettes: Number(e.target.value) })} />
          </Champ>
        </div>
      </Section>

      {p.mode !== "aplat" && (
        <Section titre="Bulles" ouvert>
          <div className="eva-st-trio">
            <ChampCouleur id={id("bulles-couleur")} label="Couleur" valeur={p.bulles_couleur} onChange={(v) => maj({ bulles_couleur: v })} />
            <Champ id={id("bulles-min")} label="Taille min">
              <input id={id("bulles-min")} type="number" min={2} max={30} value={p.bulles_taille_min} onChange={(e) => maj({ bulles_taille_min: Number(e.target.value) })} />
            </Champ>
            <Champ id={id("bulles-max")} label="Taille max">
              <input id={id("bulles-max")} type="number" min={8} max={80} value={p.bulles_taille_max} onChange={(e) => maj({ bulles_taille_max: Number(e.target.value) })} />
            </Champ>
          </div>
          <Curseur id={id("bulles-opacite")} label="Opacité des bulles" affichage={`${Math.round(p.bulles_opacite * 100)} %`} min={0.1} max={1} pas={0.05} valeur={p.bulles_opacite} onChange={(v) => maj({ bulles_opacite: v })} />
        </Section>
      )}

      <Section titre="Légende et habillage">
        <Interrupteur checked={p.legende} onChange={(v) => maj({ legende: v })} label="Afficher la légende" />
        {p.legende && (
          <div className="eva-st-duo">
            <Champ id={id("legende-position")} label="Position">
              <Selecteur id={id("legende-position")} valeur={p.legende_position} onChange={(v) => maj({ legende_position: v as ParametresCarte["legende_position"] })}>
                <option value="bas_gauche">Bas gauche</option>
                <option value="bas_droite">Bas droite</option>
                <option value="haut_gauche">Haut gauche</option>
                <option value="haut_droite">Haut droite</option>
              </Selecteur>
            </Champ>
            <Champ id={id("legende-titre")} label="Titre de la légende">
              <input id={id("legende-titre")} value={p.legende_titre} onChange={(e) => maj({ legende_titre: e.target.value })} placeholder="Par défaut : la mesure" maxLength={80} />
            </Champ>
          </div>
        )}
        <Champ id={id("titre")} label="Titre de la carte">
          <input id={id("titre")} value={p.titre} onChange={(e) => maj({ titre: e.target.value })} maxLength={120} />
        </Champ>
        <Champ id={id("sous-titre")} label="Sous-titre">
          <input id={id("sous-titre")} value={p.sous_titre} onChange={(e) => maj({ sous_titre: e.target.value })} maxLength={160} />
        </Champ>
        <Champ id={id("source")} label="Source">
          <input id={id("source")} value={p.source} onChange={(e) => maj({ source: e.target.value })} placeholder="Ex. E-VITAL, état civil, 2026" maxLength={160} />
        </Champ>
        <div className="eva-st-interrupteurs">
          <Interrupteur checked={p.echelle} onChange={(v) => maj({ echelle: v })} label="Échelle graphique" />
          <Interrupteur checked={p.nord} onChange={(v) => maj({ nord: v })} label="Flèche du nord" />
          <Interrupteur checked={p.coordonnees} onChange={(v) => maj({ coordonnees: v })} label="Coordonnées" aide="Quadrillage et position du curseur." />
          <Interrupteur checked={p.zoom_libre} onChange={(v) => maj({ zoom_libre: v })} label="Zoom et déplacement à la souris" />
        </div>
      </Section>
    </div>
  );
}
