import { Link } from "react-router-dom";

export interface ElementFilAriane {
  libelle: string;
  /** Destination. Omise pour l'element courant (dernier). */
  vers?: string;
}

interface ProprietesFilAriane {
  elements: ElementFilAriane[];
  ariaLabel?: string;
}

/** Chemin de navigation : `Accueil > Dossiers > Acte 2026-0142`. Le dernier element est la page courante. */
export default function FilAriane({ elements, ariaLabel = "Fil d'Ariane" }: ProprietesFilAriane) {
  if (elements.length === 0) return null;
  return (
    <nav className="eva-fil-ariane" aria-label={ariaLabel}>
      <ol>
        {elements.map((element, index) => {
          const courant = index === elements.length - 1;
          return (
            <li key={`${index}-${element.libelle}`}>
              {element.vers && !courant ? (
                <Link to={element.vers}>{element.libelle}</Link>
              ) : (
                <span aria-current={courant ? "page" : undefined}>{element.libelle}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
