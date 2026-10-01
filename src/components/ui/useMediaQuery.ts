import { useEffect, useState } from "react";

/** Suit une media query CSS (ex: "(max-width: 900px)") et se met a jour quand elle change. */
export function useMediaQuery(requete: string): boolean {
  const [correspond, setCorrespond] = useState(() => (typeof window !== "undefined" ? window.matchMedia(requete).matches : false));

  useEffect(() => {
    const liste = window.matchMedia(requete);
    const maj = () => setCorrespond(liste.matches);
    maj();
    liste.addEventListener("change", maj);
    return () => liste.removeEventListener("change", maj);
  }, [requete]);

  return correspond;
}
