import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cx } from "../ui/utilitaires";
import "../../styles/auth.css";

interface ProprietesChampCode {
  id: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /** Nombre de chiffres (6 par defaut). */
  longueur?: number;
  erreur?: string;
  aide?: string;
  autoFocus?: boolean;
  /** Masque le libelle a l'ecran (il reste lu par les lecteurs d'ecran). */
  libelleMasque?: boolean;
  desactive?: boolean;
}

/**
 * Saisie d'un code a chiffres en cases separees. C'est un vrai <input>
 * (transparent, par-dessus les cases) : clavier numerique, collage, remplissage
 * automatique du code recu par SMS ou email (one-time-code) fonctionnent comme
 * pour un champ normal. Police 16px pour eviter le zoom automatique d'iOS.
 */
export default function ChampCode({ id, label, valeur, onChange, longueur = 6, erreur, aide, autoFocus, libelleMasque, desactive }: ProprietesChampCode) {
  const champ = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);
  const idMessage = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;
  const active = Math.min(valeur.length, longueur - 1);

  useEffect(() => {
    if (document.activeElement === champ.current) setFocus(true);
  }, []);

  function placerCurseurALaFin() {
    const element = champ.current;
    if (element) element.setSelectionRange(element.value.length, element.value.length);
  }

  return (
    <div className={cx("eva-acces-champ-code", erreur && "est-erreur")}>
      <label htmlFor={id} className={libelleMasque ? "eva-sr-only" : "eva-acces-champ-code__label"}>
        {label}
      </label>
      <div className={cx("eva-acces-code", focus && "est-focus")} style={{ "--eva-acces-n": longueur } as CSSProperties}>
        <div className="eva-acces-code__cases" aria-hidden="true">
          {Array.from({ length: longueur }, (_, i) => (
            <span key={i} className={cx("eva-acces-code__case", i < valeur.length && "est-rempli", i === active && "est-active")}>
              {valeur.charAt(i)}
            </span>
          ))}
        </div>
        {/* Pas de maxLength : un code colle avec des espaces ("123 456") serait tronque avant d'etre nettoye. */}
        <input
          ref={champ}
          id={id}
          className="eva-acces-code__champ"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={desactive}
          value={valeur}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, longueur))}
          onFocus={() => {
            setFocus(true);
            placerCurseurALaFin();
          }}
          onBlur={() => setFocus(false)}
          onClick={placerCurseurALaFin}
          aria-describedby={idMessage}
          aria-invalid={erreur ? true : undefined}
        />
      </div>
      {erreur ? (
        <p className="eva-acces-champ-code__erreur" id={`${id}-erreur`} role="alert">
          {erreur}
        </p>
      ) : aide ? (
        <p className="eva-acces-champ-code__aide" id={`${id}-aide`}>
          {aide}
        </p>
      ) : null}
    </div>
  );
}
