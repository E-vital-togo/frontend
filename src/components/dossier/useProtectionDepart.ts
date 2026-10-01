import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirmation } from "../ui/ConfirmationProvider";

/**
 * Protège une saisie en cours contre une navigation interne accidentelle.
 *
 * L'application utilise un BrowserRouter (pas de routeur de données) :
 * `useBlocker` n'est donc pas disponible. On intercepte à la place le clic sur
 * un lien interne (menu latéral, fil d'Ariane, tiroir mobile...) pour demander
 * confirmation, puis on navigue si l'utilisateur confirme. La fermeture de
 * l'onglet ou le rechargement sont gérés par `BarreEnregistrement`
 * (`avertirAvantDepart`). Le bouton "Retour" du navigateur n'est pas couvert.
 */
export function useProtectionDepart(actif: boolean, nbModifications: number) {
  const confirmer = useConfirmation();
  const navigate = useNavigate();
  const enCours = useRef(false);
  const compteur = useRef(nbModifications);
  compteur.current = nbModifications;

  useEffect(() => {
    if (!actif) return;

    function surClic(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const cible = e.target instanceof Element ? e.target : null;
      const ancre = cible?.closest<HTMLAnchorElement>("a[href]");
      if (!ancre || (ancre.target && ancre.target !== "_self") || ancre.hasAttribute("download")) return;
      const url = new URL(ancre.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // La confirmation est asynchrone : on bloque ce clic, puis on navigue nous-mêmes.
      e.preventDefault();
      if (enCours.current) return;
      enCours.current = true;
      const n = compteur.current;
      void confirmer({
        titre: "Quitter sans enregistrer ?",
        description: `${n} modification${n > 1 ? "s" : ""} non enregistrée${n > 1 ? "s" : ""} ${n > 1 ? "seront perdues" : "sera perdue"} si vous quittez cette page.`,
        libelleConfirmer: "Quitter la page",
        libelleAnnuler: "Rester sur le dossier",
        dangereux: true
      })
        .then((ok) => {
          if (ok) navigate(url.pathname + url.search + url.hash);
        })
        .finally(() => {
          enCours.current = false;
        });
    }

    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
  }, [actif, confirmer, navigate]);
}
