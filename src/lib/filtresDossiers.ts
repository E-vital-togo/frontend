import type { StatutDossier } from "../types/domaine";

/**
 * Trois filtres de la liste des dossiers parlent de l'acte : le statut
 * « Actes émis », le retrait de l'acte (seul un dossier à l'acte émis en a
 * un) et « Masquer les actes émis ». Certaines combinaisons ne peuvent rien
 * renvoyer ; quand l'utilisateur en change un, les autres s'ajustent pour
 * ne jamais aboutir à une liste vide par contradiction.
 */
export interface FiltresActe {
  statut: StatutDossier | "";
  retrait: "" | "a_retirer" | "retire";
  masquerActesEmis: boolean;
}

export function concilierFiltresActe(actuel: FiltresActe, changement: Partial<FiltresActe>): FiltresActe {
  const suivant = { ...actuel, ...changement };
  if ("masquerActesEmis" in changement && suivant.masquerActesEmis) {
    if (suivant.statut === "acte_emis") suivant.statut = "";
    suivant.retrait = "";
  }
  if ("statut" in changement && suivant.statut) {
    if (suivant.statut === "acte_emis") suivant.masquerActesEmis = false;
    else suivant.retrait = "";
  }
  if ("retrait" in changement && suivant.retrait) {
    suivant.masquerActesEmis = false;
    if (suivant.statut && suivant.statut !== "acte_emis") suivant.statut = "";
  }
  return suivant;
}
