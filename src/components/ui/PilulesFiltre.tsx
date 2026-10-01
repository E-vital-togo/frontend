import type { ReactNode } from "react";
import { cx } from "./utilitaires";

export interface PiluleFiltre<V extends string = string> {
  /** Valeur envoyee a `onChanger` (utiliser "" pour "Tous"). */
  valeur: V;
  libelle: string;
  /** Nombre affiche dans une petite pastille apres le libelle. */
  compteur?: number;
  icone?: ReactNode;
  /** Pastille de compteur en rouge (ex: conflits a traiter). */
  alerte?: boolean;
  desactive?: boolean;
}

interface ProprietesPilulesFiltre<V extends string> {
  pilules: PiluleFiltre<V>[];
  /** Valeur de la pilule active. */
  valeur: V;
  onChanger: (valeur: V) => void;
  /** Nom accessible du groupe de filtres (ex: "Filtrer par statut"). */
  ariaLabel?: string;
  /** Une seule ligne defilante horizontalement (au lieu de passer a la ligne), pour beaucoup de pilules sur mobile. */
  defilement?: boolean;
  className?: string;
}

/** Filtres exclusifs en pilules, avec compteurs optionnels. */
export default function PilulesFiltre<V extends string = string>({
  pilules,
  valeur,
  onChanger,
  ariaLabel = "Filtres",
  defilement,
  className
}: ProprietesPilulesFiltre<V>) {
  return (
    <div className={cx("eva-filtres", defilement && "eva-filtres--defilement", className)} role="group" aria-label={ariaLabel}>
      {pilules.map((pilule) => {
        const active = pilule.valeur === valeur;
        return (
          <button
            key={pilule.valeur}
            type="button"
            className={cx("eva-pilule", active && "eva-pilule--active", pilule.alerte && pilule.compteur ? "eva-pilule--alerte" : false)}
            aria-pressed={active}
            disabled={pilule.desactive}
            onClick={() => onChanger(pilule.valeur)}
          >
            {pilule.icone}
            {pilule.libelle}
            {pilule.compteur !== undefined && <span className="eva-pilule__compteur">{pilule.compteur}</span>}
          </button>
        );
      })}
    </div>
  );
}
