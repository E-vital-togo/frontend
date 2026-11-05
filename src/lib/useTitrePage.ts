import { useEffect } from "react";

const NOM_APPLICATION = "RECVIT";

/**
 * Titre de l'onglet du navigateur : « <titre> - RECVIT ». Sans titre propre,
 * tous les onglets s'appelaient « RECVIT » (lecteurs d'écran, historique,
 * plusieurs onglets ouverts au guichet).
 */
export function useTitrePage(titre: string | null | undefined) {
  useEffect(() => {
    document.title = titre ? `${titre} - ${NOM_APPLICATION}` : NOM_APPLICATION;
  }, [titre]);
}

/** Texte brut d'un titre React (chaîne ou nombre), sinon null. */
export function texteTitre(titre: unknown): string | null {
  if (typeof titre === "string" || typeof titre === "number") return String(titre);
  return null;
}
