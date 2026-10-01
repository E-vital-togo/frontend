import type { ReactNode } from "react";
import { cx } from "./utilitaires";

interface ProprietesBarreOutils {
  /** Champ de recherche (BarreRecherche). */
  recherche?: ReactNode;
  /** Filtres (PilulesFiltre, selects...). */
  filtres?: ReactNode;
  /** Compteur de resultats (ex: "24 dossiers"). */
  compteur?: ReactNode;
  /** Boutons d'action, alignes a droite. */
  actions?: ReactNode;
  /** Place la barre dans un cadre blanc (utile au-dessus d'une liste sans carte). */
  carte?: boolean;
  className?: string;
}

/**
 * Rangee d'outils au-dessus d'une liste : recherche et filtres a gauche,
 * compteur et actions a droite. Passe a la ligne (recherche en pleine
 * largeur, actions dessous) sur petit ecran.
 */
export default function BarreOutils({ recherche, filtres, compteur, actions, carte, className }: ProprietesBarreOutils) {
  const aGauche = recherche || filtres;
  const aDroite = compteur || actions;
  return (
    <div className={cx("eva-barre-outils", carte && "eva-barre-outils--carte", className)}>
      {aGauche && (
        <div className="eva-barre-outils__groupe">
          {recherche}
          {filtres}
        </div>
      )}
      {aDroite && (
        <div className="eva-barre-outils__groupe">
          {compteur && <span className="eva-compteur">{compteur}</span>}
          {actions}
        </div>
      )}
    </div>
  );
}
