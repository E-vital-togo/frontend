import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { OptionChampEffective } from "../../types/domaine";

interface ProprietesSelectMultiple {
  id: string;
  options: OptionChampEffective[];
  /** Codes (`option.valeur`) des choix coches. */
  valeur: string[];
  /** Emet les codes coches DANS L'ORDRE DES OPTIONS (meme semantique que l'ancien <select multiple>). */
  onChange: (valeur: string[]) => void;
  disabled?: boolean;
  /** Dossier verrouille : rendu distinct, interactions transmises a onChange (le parent avertit). */
  verrouille?: boolean;
  /** id de l'element qui porte le libelle du groupe (le label du champ). */
  etiquettePar?: string;
  decritPar?: string;
  invalide?: boolean;
  max?: number;
  min?: number;
}

/** Au-dela de ce nombre de choix, un champ de filtre apparait au-dessus de la liste. */
const SEUIL_FILTRE = 8;

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * OBSOLETE : ChampDynamique utilise desormais `Selecteur multiple` (liste deroulante avec recherche, cases et puces).
 * Ce composant n'est plus reference ; il est conserve le temps de verifier qu'aucune page externe n'en depend.
 *
 * Choix multiple sous forme de "chips" cochables, avec filtre quand la liste
 * est longue : bien plus lisible et tactile que le <select multiple> natif
 * (liste ouverte, selection a coups de Ctrl/Cmd-clic, impossible sur mobile).
 * Chaque chip est une vraie case a cocher (clavier, lecteurs d'ecran).
 */
export default function SelectMultiple({
  id,
  options,
  valeur,
  onChange,
  disabled = false,
  verrouille = false,
  etiquettePar,
  decritPar,
  invalide = false,
  max,
  min
}: ProprietesSelectMultiple) {
  const [filtre, setFiltre] = useState("");
  const choisis = useMemo(() => new Set(valeur), [valeur]);
  const visibles = useMemo(() => {
    const recherche = normaliser(filtre.trim());
    return recherche ? options.filter((option) => normaliser(option.libelle).includes(recherche)) : options;
  }, [options, filtre]);

  const nombre = options.filter((option) => choisis.has(option.valeur)).length;
  const limiteAtteinte = max !== undefined && nombre >= max;

  function basculer(code: string, coche: boolean) {
    const suivant = new Set(choisis);
    if (coche) suivant.add(code);
    else suivant.delete(code);
    onChange(options.filter((option) => suivant.has(option.valeur)).map((option) => option.valeur));
  }

  let indication = `${nombre} sélectionné${nombre > 1 ? "s" : ""}`;
  if (min !== undefined && max !== undefined) indication += ` (${min === max ? min : `${min} à ${max}`} attendu${max > 1 ? "s" : ""})`;
  else if (max !== undefined) indication += ` sur ${max} maximum`;
  else if (min !== undefined && min > 0) indication += ` (${min} minimum)`;

  return (
    <div
      id={id}
      className={`eva-multi${disabled ? " eva-multi--desactive" : ""}${verrouille ? " eva-multi--verrouille" : ""}${invalide ? " eva-multi--invalide" : ""}`}
      role="group"
      aria-labelledby={etiquettePar}
      aria-describedby={decritPar}
    >
      {options.length > SEUIL_FILTRE && (
        <div className="eva-multi__filtre">
          <Search size={15} aria-hidden="true" className="eva-multi__loupe" />
          <input
            type="text"
            className="eva-ctl eva-multi__filtre-champ"
            placeholder="Filtrer les choix..."
            aria-label="Filtrer les choix"
            autoComplete="off"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            // Entree dans ce champ ne doit jamais soumettre le formulaire parent.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
      )}

      {options.length === 0 ? (
        <p className="eva-multi__vide">Aucun choix disponible.</p>
      ) : visibles.length === 0 ? (
        <p className="eva-multi__vide">Aucun choix ne correspond à « {filtre} ».</p>
      ) : (
        <div className="eva-multi__liste">
          {visibles.map((option) => {
            const coche = choisis.has(option.valeur);
            const bloque = disabled || (!coche && limiteAtteinte);
            return (
              <label
                key={option.valeur}
                className={`eva-chip${coche ? " eva-chip--choisi" : ""}${bloque ? " eva-chip--bloque" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={coche}
                  disabled={bloque}
                  onChange={(e) => basculer(option.valeur, e.target.checked)}
                />
                <span className="eva-chip__marque" aria-hidden="true">
                  {coche && <Check size={11} strokeWidth={3.2} />}
                </span>
                <span className="eva-chip__texte">{option.libelle}</span>
              </label>
            );
          })}
        </div>
      )}

      <div className="eva-multi__pied">
        <span aria-live="polite">{indication}</span>
        {nombre > 0 && !disabled && (
          <button type="button" className="eva-multi__effacer" onClick={() => onChange([])}>
            <X size={12} aria-hidden="true" /> Tout effacer
          </button>
        )}
      </div>
    </div>
  );
}
