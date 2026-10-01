import type { ReactNode } from "react";
import { cx } from "./utilitaires";

export type VarianteBadge = "neutre" | "succes" | "danger" | "attente" | "info" | "plein";

interface ProprietesBadge {
  variante?: VarianteBadge;
  /** Petit point de couleur avant le libelle (statuts). */
  point?: boolean;
  /** Police monospace (codes, identifiants, compteurs). */
  mono?: boolean;
  icone?: ReactNode;
  children: ReactNode;
}

/** Pastille de statut : etat d'un dossier, d'un compte, d'une synchronisation... */
export default function Badge({ variante = "neutre", point, mono, icone, children }: ProprietesBadge) {
  return (
    <span className={cx("eva-badge", `eva-badge--${variante}`, point && "eva-badge--point", mono && "eva-badge--mono")}>
      {icone}
      {children}
    </span>
  );
}
