import type { ReactNode } from "react";
import { cx } from "./utilitaires";

interface ProprietesTableau {
  children: ReactNode;
  /** Cellules resserrees. */
  compact?: boolean;
  /** Alternance de lignes tres douce. */
  zebre?: boolean;
  /** En-tete collant : necessite `hauteurMax` (le tableau defile alors verticalement dans son cadre). */
  collant?: boolean;
  /** Hauteur maximale du cadre (ex: "60vh"), pour l'en-tete collant. */
  hauteurMax?: string;
  /** Desactive la teinte de survol des lignes. */
  sansSurvol?: boolean;
  /** Nom accessible du tableau. */
  legende?: string;
  className?: string;
}

/**
 * Enveloppe un <table> natif pour garantir le defilement horizontal sur petit
 * ecran plutot qu'un debordement de page. Pour une liste de donnees complete
 * (colonnes declaratives, tri, etat vide, fiches sur mobile) preferer ListeResponsive.
 */
export default function Tableau({ children, compact, zebre, collant, hauteurMax, sansSurvol, legende, className }: ProprietesTableau) {
  return (
    <div
      className={cx("eva-tableau-conteneur", collant && "eva-tableau-conteneur--collant", className)}
      style={hauteurMax ? { maxHeight: hauteurMax } : undefined}
    >
      <table
        className={cx("eva-tableau", compact && "eva-tableau--compact", zebre && "eva-tableau--zebre", sansSurvol && "eva-tableau--sans-survol")}
        aria-label={legende}
      >
        {children}
      </table>
    </div>
  );
}
