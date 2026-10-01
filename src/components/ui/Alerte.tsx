import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "./utilitaires";

export type VarianteAlerte = "info" | "succes" | "avertissement" | "erreur";

interface ProprietesAlerte {
  variante?: VarianteAlerte;
  /** Titre en gras au-dessus du message. */
  titre?: string;
  /** Affiche une croix : l'alerte appelle `onFermer` (c'est au parent de la retirer). */
  onFermer?: () => void;
  /** Boutons d'action sous le message (ex: "Reessayer"). */
  actions?: ReactNode;
  /** Icone personnalisee, de preference avec aria-hidden (defaut : selon la variante). */
  icone?: ReactNode;
  /** Version resserree. */
  compacte?: boolean;
  className?: string;
  children?: ReactNode;
}

const ICONES: Record<VarianteAlerte, ReactNode> = {
  info: <Info size={18} aria-hidden="true" />,
  succes: <CheckCircle2 size={18} aria-hidden="true" />,
  avertissement: <AlertTriangle size={18} aria-hidden="true" />,
  erreur: <AlertCircle size={18} aria-hidden="true" />
};

/** Message d'etat integre a la page (et non ephemere) : information, confirmation, avertissement, erreur. */
export default function Alerte({ variante = "info", titre, onFermer, actions, icone, compacte, className, children }: ProprietesAlerte) {
  return (
    <div className={cx("eva-alerte", `eva-alerte--${variante}`, compacte && "eva-alerte--compacte", className)} role={variante === "erreur" ? "alert" : "status"}>
      {icone ?? ICONES[variante]}
      <div className="eva-alerte__contenu">
        {titre && <span className="eva-alerte__titre">{titre}</span>}
        {children}
        {actions && <div className="eva-alerte__actions">{actions}</div>}
      </div>
      {onFermer && (
        <button type="button" className="eva-alerte__fermer" onClick={onFermer} aria-label="Fermer le message">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
