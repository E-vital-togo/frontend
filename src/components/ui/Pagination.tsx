import { ChevronLeft, ChevronRight } from "lucide-react";
import Bouton from "./Bouton";

interface ProprietesPagination {
  page: number;
  taillepage: number;
  total: number;
  aSuivant: boolean;
  aPrecedent: boolean;
  onChanger: (page: number) => void;
}

/** Pagination "precedent/suivant" generique, adaptee au style de pagination DRF (count/next/previous) du backend. */
export default function Pagination({ page, taillepage, total, aSuivant, aPrecedent, onChanger }: ProprietesPagination) {
  if (total <= taillepage && page === 1) return null;

  const debut = total === 0 ? 0 : (page - 1) * taillepage + 1;
  const fin = Math.min(page * taillepage, total);

  return (
    <div className="eva-pagination">
      <span className="eva-pagination__info">
        {debut}-{fin} sur {total}
      </span>
      <div className="eva-pagination__boutons">
        <Bouton variante="secondaire" taille="petit" disabled={!aPrecedent} onClick={() => onChanger(page - 1)} iconeGauche={<ChevronLeft size={15} />}>
          Precedent
        </Bouton>
        <Bouton variante="secondaire" taille="petit" disabled={!aSuivant} onClick={() => onChanger(page + 1)} iconeDroite={<ChevronRight size={15} />}>
          Suivant
        </Bouton>
      </div>
    </div>
  );
}
