import { useEffect, useRef, useState } from "react";
import { appelApi, ErreurApi } from "../lib/apiClient";
import type { ListeOuPaginee, ReponsePaginee } from "../types/domaine";

interface ResultatListePaginee<T> {
  items: T[];
  count: number;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  chargement: boolean;
  erreur: string | null;
  recharger: () => void;
}

/**
 * Consomme la pagination DRF standard ({count, next, previous, results},
 * voir apps.core.pagination.PaginationStandard cote backend) au lieu de la
 * jeter comme le faisait `listeDepuis` seule jusqu'ici. `cheminBase` doit
 * contenir tous les filtres/recherche SAUF `page` (ajoute automatiquement) ;
 * un changement de `cheminBase` revient a la page 1.
 */
export function useListePaginee<T>(cheminBase: string, tailleParDefaut = 25): ResultatListePaginee<T> {
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<ReponsePaginee<T> | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);
  const cheminBasePrecedent = useRef(cheminBase);

  useEffect(() => {
    const pageDemandee = cheminBasePrecedent.current === cheminBase ? page : 1;
    cheminBasePrecedent.current = cheminBase;
    if (pageDemandee !== page) {
      setPage(pageDemandee);
      return; // le changement de `page` redeclenche cet effet avec la bonne valeur
    }

    let annule = false;
    const separateur = cheminBase.includes("?") ? "&" : "?";
    setChargement(true);
    setErreur(null);
    appelApi<ListeOuPaginee<T>>(`${cheminBase}${separateur}page=${pageDemandee}`)
      .then((reponse) => {
        if (annule) return;
        setDonnees(
          Array.isArray(reponse) ? { count: reponse.length, next: null, previous: null, results: reponse } : reponse
        );
      })
      .catch((e) => {
        if (annule) return;
        setErreur(e instanceof ErreurApi ? e.message : "Erreur de chargement.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheminBase, page, jeton]);

  const items = donnees?.results ?? [];
  const count = donnees?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / tailleParDefaut));

  return { items, count, page, setPage, totalPages, chargement, erreur, recharger: () => setJeton((j) => j + 1) };
}
