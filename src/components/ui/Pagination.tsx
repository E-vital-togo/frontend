import { ChevronLeft, ChevronRight } from "lucide-react";
import Bouton from "./Bouton";

interface ProprietesPagination {
  page: number;
  taillepage: number;
  total: number;
  aSuivant: boolean;
  aPrecedent: boolean;
  onChanger: (page: number) => void;
  ariaLabel?: string;
}

/** Numeros de page a afficher : premiere, derniere, page courante et ses voisines ; `null` = points de suspension. */
function numerosVisibles(page: number, nombrePages: number): Array<number | null> {
  const voulus = new Set<number>([1, nombrePages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => voulus.add(n));
  if (page >= nombrePages - 2) [nombrePages - 1, nombrePages - 2, nombrePages - 3].forEach((n) => voulus.add(n));
  const tries = [...voulus].filter((n) => n >= 1 && n <= nombrePages).sort((a, b) => a - b);
  const resultat: Array<number | null> = [];
  tries.forEach((n, i) => {
    if (i > 0 && n - tries[i - 1] > 1) resultat.push(null);
    resultat.push(n);
  });
  return resultat;
}

/**
 * Pagination generique, adaptee au style de pagination DRF (count/next/previous)
 * du backend : precedent/suivant, numeros de page (ecrans larges) et position
 * "Page 2 sur 7" (mobile).
 */
export default function Pagination({ page, taillepage, total, aSuivant, aPrecedent, onChanger, ariaLabel = "Pagination" }: ProprietesPagination) {
  if (total <= taillepage && page === 1) return null;

  const debut = total === 0 ? 0 : (page - 1) * taillepage + 1;
  const fin = Math.min(page * taillepage, total);
  const nombrePages = Math.max(1, Math.ceil(total / taillepage));

  return (
    <nav className="eva-pagination" aria-label={ariaLabel}>
      <span className="eva-pagination__info">
        {debut}-{fin} sur {total}
      </span>
      <div className="eva-pagination__boutons">
        <Bouton variante="secondaire" taille="petit" disabled={!aPrecedent} onClick={() => onChanger(page - 1)} iconeGauche={<ChevronLeft size={15} />}>
          Précédent
        </Bouton>
        <div className="eva-pagination__pages">
          {numerosVisibles(page, nombrePages).map((numero, index) =>
            numero === null ? (
              <span key={`points-${index}`} className="eva-pagination__points" aria-hidden="true">
                ...
              </span>
            ) : (
              <button
                key={numero}
                type="button"
                className="eva-pagination__page"
                aria-current={numero === page ? "page" : undefined}
                aria-label={`Page ${numero}`}
                onClick={() => numero !== page && onChanger(numero)}
              >
                {numero}
              </button>
            )
          )}
        </div>
        <span className="eva-pagination__position">
          Page {page} sur {nombrePages}
        </span>
        <Bouton variante="secondaire" taille="petit" disabled={!aSuivant} onClick={() => onChanger(page + 1)} iconeDroite={<ChevronRight size={15} />}>
          Suivant
        </Bouton>
      </div>
    </nav>
  );
}
