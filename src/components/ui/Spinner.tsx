import { cx } from "./utilitaires";

interface ProprietesSpinner {
  grand?: boolean;
  /** Texte lu par les lecteurs d'ecran (defaut : aucun, le spinner est decoratif). */
  libelle?: string;
  className?: string;
}

/** Indicateur rotatif en ligne ; herite de la couleur du texte. */
export default function Spinner({ grand, libelle, className }: ProprietesSpinner = {}) {
  return (
    <span
      className={cx("eva-spinner", grand && "eva-spinner--grand", className)}
      role={libelle ? "status" : undefined}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
    />
  );
}

/** Bloc centre "Chargement" pour une page ou une section entiere. Pour un contenu qui a une forme connue, preferer Squelette. */
export function ChargementPage({ texte = "Chargement en cours..." }: { texte?: string }) {
  return (
    <div className="eva-page-chargement" role="status" aria-live="polite">
      <Spinner grand />
      <span>{texte}</span>
    </div>
  );
}
