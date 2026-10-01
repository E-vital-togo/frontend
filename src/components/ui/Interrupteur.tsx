import { useId, type ReactNode } from "react";
import { cx } from "./utilitaires";

interface ProprietesInterrupteur {
  checked: boolean;
  onChange: (valeur: boolean) => void;
  /** Libelle visible. Sans libelle, fournir `ariaLabel`. */
  label?: ReactNode;
  /** Ligne d'aide sous le libelle. */
  aide?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/**
 * Interrupteur on/off (role="switch") : pour un reglage applique tel quel
 * (actif, notifications...). Pour un choix soumis avec un formulaire, preferer
 * une case a cocher. Zone tactile de 40px.
 */
export default function Interrupteur({ checked, onChange, label, aide, ariaLabel, disabled, id, name, className }: ProprietesInterrupteur) {
  const identifiant = useId();
  const idChamp = id ?? `${identifiant}-champ`;
  const idAide = aide ? `${idChamp}-aide` : undefined;
  return (
    <label className={cx("eva-bascule", disabled && "eva-bascule--desactive", className)} htmlFor={idChamp}>
      <span className="eva-bascule__piste">
        <input
          id={idChamp}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          aria-describedby={idAide}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
      {(label || aide) && (
        <span className="eva-bascule__corps">
          {label && <span className="eva-bascule__texte">{label}</span>}
          {aide && (
            <span className="eva-bascule__aide" id={idAide}>
              {aide}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
