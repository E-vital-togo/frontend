import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProprietesPagination {
  page: number;
  totalPages: number;
  total: number;
  taillePage: number;
  onChangerPage: (page: number) => void;
}

/**
 * Consomme le pager derive de {count, next, previous} (voir
 * hooks/useListePaginee) plutot que de jeter cette information comme le
 * faisait chaque page jusqu'ici.
 */
export default function Pagination({ page, totalPages, total, taillePage, onChangerPage }: ProprietesPagination) {
  if (total === 0) return null;

  const debut = (page - 1) * taillePage + 1;
  const fin = Math.min(page * taillePage, total);

  return (
    <div className="pagination">
      <span>
        {debut}-{fin} sur {total}
      </span>
      <div className="pagination__controles">
        <button
          type="button"
          className="pagination__bouton"
          disabled={page <= 1}
          onClick={() => onChangerPage(page - 1)}
          aria-label="Page precedente"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="texte-mono">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="pagination__bouton"
          disabled={page >= totalPages}
          onClick={() => onChangerPage(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
