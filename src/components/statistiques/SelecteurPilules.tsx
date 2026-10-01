import { useMemo, useState } from "react";
import { Check, SearchX, X } from "lucide-react";
import { BarreRecherche, Squelette } from "../ui";
import "../../styles/statistiques.css";

export interface OptionPilule {
  code: string;
  label: string;
}

interface ProprietesSelecteurPilules {
  options: OptionPilule[];
  /** Codes choisis, dans l'ordre de choix. */
  selection: string[];
  onBasculer: (code: string) => void;
  /** Nombre maximal de choix (les autres pilules se desactivent une fois atteint). */
  max?: number;
  /** Role de chaque choix selon sa position ("Axe X", "Série"...). */
  roles?: string[];
  /** Nom accessible du groupe de pilules. */
  ariaLabel: string;
  placeholderRecherche: string;
  /** Liste encore en cours de chargement : squelette de pilules. */
  chargement?: boolean;
  /** Mot au pluriel pour le compteur ("dimensions", "mesures"). */
  unite: string;
}

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Choix d'un ou plusieurs elements parmi une liste, en pilules. Les choix
 * apparaissent d'abord (numerotes, retirables d'un clic), puis la liste
 * filtrable par une recherche insensible aux accents.
 */
export default function SelecteurPilules({
  options,
  selection,
  onBasculer,
  max,
  roles = [],
  ariaLabel,
  placeholderRecherche,
  chargement,
  unite
}: ProprietesSelecteurPilules) {
  const [recherche, setRecherche] = useState("");
  const atteint = max !== undefined && selection.length >= max;
  const libelles = useMemo(() => new Map(options.map((o) => [o.code, o.label])), [options]);

  const visibles = useMemo(() => {
    const terme = normaliser(recherche.trim());
    return terme ? options.filter((o) => normaliser(o.label).includes(terme)) : options;
  }, [options, recherche]);

  if (chargement) {
    return (
      <div className="eva-st-selecteur">
        <Squelette variante="bloc" hauteur={36} libelle={`Chargement des ${unite}`} />
        <div className="eva-st-pilules-squelette" aria-hidden="true">
          {[72, 110, 90, 130, 84, 100].map((largeur, i) => (
            <Squelette key={i} variante="bloc" largeur={largeur} hauteur={32} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="eva-st-selecteur">
      {selection.length > 0 && (
        <ul className="eva-st-choix" aria-label={`${unite.charAt(0).toUpperCase()}${unite.slice(1)} choisies`}>
          {selection.map((code, index) => {
            const libelle = libelles.get(code) ?? code;
            return (
              <li key={code}>
                <button type="button" className="eva-st-choix__puce" onClick={() => onBasculer(code)} aria-label={`Retirer ${libelle}`}>
                  <span className="eva-st-choix__rang" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="eva-st-choix__texte">
                    {roles[index] && <span className="eva-st-choix__role">{roles[index]}</span>}
                    {libelle}
                  </span>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {options.length > 6 && (
        <BarreRecherche valeur={recherche} onChanger={setRecherche} placeholder={placeholderRecherche} ariaLabel={placeholderRecherche} pleineLargeur />
      )}

      {visibles.length === 0 ? (
        <p className="eva-st-selecteur__vide">
          <SearchX size={16} aria-hidden="true" />
          {options.length === 0 ? `Aucune ${unite.replace(/s$/, "")} disponible.` : `Aucun résultat pour « ${recherche.trim()} ».`}
        </p>
      ) : (
        <div className="eva-st-pilules" role="group" aria-label={ariaLabel}>
          {visibles.map((option) => {
            const choisi = selection.includes(option.code);
            const bloque = atteint && !choisi;
            return (
              <button
                key={option.code}
                type="button"
                className={`eva-st-pilule${choisi ? " est-choisie" : ""}`}
                aria-pressed={choisi}
                disabled={bloque}
                title={bloque ? `${max} ${unite} au maximum : retirez-en une pour en choisir une autre.` : undefined}
                onClick={() => onBasculer(option.code)}
              >
                {choisi && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <p className="eva-st-selecteur__pied" aria-live="polite">
        {max !== undefined ? `${selection.length} sur ${max} ${unite} au maximum` : `${selection.length} ${selection.length > 1 ? unite : unite.replace(/s$/, "")} ${selection.length > 1 ? "choisies" : "choisie"}`}
      </p>
    </div>
  );
}
