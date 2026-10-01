import type { ReactNode } from "react";
import { cx } from "./utilitaires";

export type VarianteEtatVide = "defaut" | "erreur" | "attention" | "neutre";

interface ProprietesEtatVide {
  /** Icone lucide (ex: `<Inbox size={26} />`), affichee dans un rond teinte. */
  icone?: ReactNode;
  titre: string;
  description?: string;
  /** Bouton ou lien d'action (ex: "Creer un dossier"). */
  action?: ReactNode;
  /** Couleur du rond d'icone : defaut (emeraude), erreur, attention, neutre. */
  variante?: VarianteEtatVide;
  /** Version resserree, pour un etat vide dans une carte ou un panneau. */
  compact?: boolean;
  className?: string;
}

export default function EtatVide({ icone, titre, description, action, variante = "defaut", compact, className }: ProprietesEtatVide) {
  return (
    <div className={cx("eva-etat-vide", variante !== "defaut" && `eva-etat-vide--${variante}`, compact && "eva-etat-vide--compact", className)}>
      {icone && (
        <div className="eva-etat-vide__icone" aria-hidden="true">
          {icone}
        </div>
      )}
      <div className="eva-etat-vide__titre">{titre}</div>
      {description && <p>{description}</p>}
      {action && <div className="eva-etat-vide__action">{action}</div>}
    </div>
  );
}
